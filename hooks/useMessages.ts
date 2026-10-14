import { useAuth } from "@/context/AuthContext";
import { useConnectivity } from "@/hooks/useConnectivity";
import { AudioCacheRepository } from "@/lib/AudioCacheRepository";
import { ChatRepository } from "@/lib/ChatRepository";
import { repairConversationKeyFromPendingShare } from "@/lib/conversationKeyReadiness";
import { ImageCacheRepository } from "@/lib/ImageCacheRepository";
import { ImageGalleryRepository } from "@/lib/ImageGalleryRepository";
import { debounce, REALTIME_REFRESH_DELAY_MS } from "@/lib/debounce";
import { MessageRepository } from "@/lib/MessageRepository";
import {
  applyRemoteMessages,
  syncChangedMessages,
  syncChatHistory,
  syncPendingAudioMessages,
  syncPendingImageMessages,
  syncPendingOps,
  syncPendingTextMessages,
} from "@/lib/offlineSync";
import { listMessages } from "@/src/api/chats";
import { realtimeClient } from "@/src/api/realtime";
import type { Message } from "@/types/chat";
import { useCallback, useEffect, useState } from "react";

type MessagesState = {
  chatId: string;
  messages: Message[];
  loading: boolean;
};

export function useMessages(chatId: string): { messages: Message[]; loading: boolean } {
  const { currentUser, tenantId, deviceId } = useAuth();
  const { isOnline } = useConnectivity();
  const [state, setState] = useState<MessagesState>({
    chatId: "",
    messages: [],
    loading: true,
  });

  const loadLocalMessages = useCallback(
    async (activeChatId: string, active: () => boolean) => {
      const messages = await MessageRepository.getLocalMessages(activeChatId);
      if (!active()) return;
      setState({ chatId: activeChatId, messages, loading: false });
    },
    []
  );

  const refreshLocalMedia = useCallback(
    async (activeChatId: string, active: () => boolean, download: boolean) => {
      const messages = await MessageRepository.getLocalMessages(activeChatId);
      let changed = false;
      for (const message of messages) {
        if (message.type === "audio" && message.audioRemoteUrl) {
          const cachedUri = await AudioCacheRepository.ensureMessageAudioCache({
            chatId: activeChatId,
            messageId: message.id,
            remoteUrl: message.audioRemoteUrl,
            localUri: message.audioLocalUri,
            download,
          });
          if (!active()) return;
          changed = changed || cachedUri !== (message.audioLocalUri ?? null);
        }
        if (message.type === "image" && message.imageRemoteUrl) {
          const cachedFull = await ImageCacheRepository.ensureMessageImageCache({
            chatId: activeChatId,
            messageId: message.id,
            remoteUrl: message.imageRemoteUrl,
            localUri: message.imageLocalUri,
            download,
          });
          if (!active()) return;
          if (cachedFull && !message.imageLocalUri) {
            changed = true;
            if (currentUser && message.senderId !== currentUser.id) {
              void ImageGalleryRepository.saveToGallery({
                messageId: message.id,
                fileUri: cachedFull,
              });
            }
          }
        }
      }
      if (changed) await loadLocalMessages(activeChatId, active);
    },
    [currentUser, loadLocalMessages]
  );

  const refreshRemoteMessages = useCallback(
    async (activeChatId: string, active: () => boolean) => {
      if (!isOnline) return;
      await repairConversationKeyFromPendingShare(activeChatId, deviceId);
      const syncState = await MessageRepository.getMessageSyncState(activeChatId);
      const rows = await listMessages(activeChatId, {
        after: syncState.newestMessageAt?.toISOString(),
        limit: 500,
      });
      let newest = syncState.newestMessageAt;
      let changedAt = syncState.changedAt;
      for (const row of rows) {
        const createdAt = row.created_at ? new Date(row.created_at) : null;
        if (createdAt && (!newest || createdAt > newest)) newest = createdAt;
        if (
          row.updated_at &&
          (!changedAt ||
            new Date(row.updated_at).getTime() > new Date(changedAt).getTime())
        ) {
          changedAt = row.updated_at;
        }
      }
      await applyRemoteMessages(activeChatId, rows);
      await repairConversationKeyFromPendingShare(activeChatId, deviceId);
      await MessageRepository.saveMessageSyncState(activeChatId, newest, changedAt);
      // Edits and deletions of older messages only arrive through this pass.
      await syncChangedMessages(activeChatId);
      await ChatRepository.refreshLastMessageFromLocal(activeChatId);
      if (!active()) return;
      await loadLocalMessages(activeChatId, active);
    },
    [deviceId, isOnline, loadLocalMessages]
  );

  useEffect(() => {
    if (!chatId) {
      setState({ chatId: "", messages: [], loading: false });
      return;
    }

    let active = true;
    setState({ chatId, messages: [], loading: true });
    const isActive = () => active;

    void (async () => {
      await loadLocalMessages(chatId, isActive);
      if (!active) return;
      void refreshLocalMedia(chatId, isActive, isOnline);
      if (currentUser && tenantId) {
        await syncPendingTextMessages(currentUser, tenantId, isOnline, deviceId);
        await syncPendingImageMessages(currentUser, tenantId, isOnline);
        await syncPendingAudioMessages(currentUser, tenantId, isOnline);
        await syncPendingOps(currentUser, isOnline, deviceId);
      }
      await refreshRemoteMessages(chatId, isActive);
      void syncChatHistory(chatId, isOnline, deviceId);
    })();

    const unsubLocal = MessageRepository.subscribe(chatId, () => {
      void loadLocalMessages(chatId, isActive);
    });
    const scheduleRefresh = debounce(
      () => void refreshRemoteMessages(chatId, isActive),
      REALTIME_REFRESH_DELAY_MS,
    );
    const unsubRealtime = realtimeClient.subscribe((event) => {
      if (event.chat_id === chatId && event.type.startsWith("message.")) {
        scheduleRefresh();
      }
    });

    return () => {
      active = false;
      scheduleRefresh.cancel();
      unsubLocal();
      unsubRealtime();
    };
  }, [
    chatId,
    currentUser,
    deviceId,
    isOnline,
    loadLocalMessages,
    refreshLocalMedia,
    refreshRemoteMessages,
    tenantId,
  ]);

  if (state.chatId !== chatId) {
    return { messages: [], loading: true };
  }

  return { messages: state.messages, loading: state.loading };
}
