import { useAuth } from "@/context/AuthContext";
import { useConnectivity } from "@/hooks/useConnectivity";
import { ChatRepository } from "@/lib/ChatRepository";
import { chatFromDtoWithDecryptedPreview } from "@/lib/chatFromDto";
import { debounce, REALTIME_REFRESH_DELAY_MS } from "@/lib/debounce";
import {
  syncChatHistories,
  syncChatHistory,
  syncPendingAudioMessages,
  syncPendingImageMessages,
  syncPendingOps,
  syncPendingReactions,
  syncPendingTextMessages,
} from "@/lib/offlineSync";
import { getChat, listChats } from "@/src/api/chats";
import { ApiError } from "@/src/api/client";
import { realtimeClient } from "@/src/api/realtime";
import type { Chat } from "@/types/chat";
import { useCallback, useEffect, useRef, useState } from "react";

const FULL_REFRESH_EVENT_TYPES = new Set([
  "chat.created",
  "chat.updated",
  "member.updated",
]);

function isMembershipLoss(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

export function useChats(): {
  chats: Chat[];
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const { currentUser, tenantId, deviceId } = useAuth();
  const { isOnline } = useConnectivity();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadLocalChats = useCallback(
    async (active: () => boolean) => {
      if (!tenantId) {
        setLoading(false);
        return;
      }
      const localChats = await ChatRepository.getLocalChats(tenantId);
      if (!active()) return;
      const memberId = currentUser?.id;
      setChats(memberId ? localChats.filter((c) => c.participants.includes(memberId)) : localChats);
      setLoading(false);
    },
    [tenantId, currentUser?.id]
  );

  const refreshRemoteChats = useCallback(
    async (active: () => boolean, options: { syncPending: boolean }) => {
      if (!currentUser || !tenantId || !isOnline) return;
      const remote = await listChats();
      const previous = new Map(
        (await ChatRepository.getLocalChats(tenantId)).map((chat) => [chat.id, chat])
      );
      const next = await Promise.all(
        remote.map((chat) => chatFromDtoWithDecryptedPreview(chat, currentUser.id, deviceId))
      );
      const remoteIds = new Set(next.map((chat) => chat.id));
      await ChatRepository.upsertChats(next, { notify: false });
      for (const chat of previous.values()) {
        if (!remoteIds.has(chat.id) && chat.participants.includes(currentUser.id)) {
          await ChatRepository.deleteChat(chat.id, { notify: false });
        }
      }
      if (!active()) return;
      const chatIdsToSync = options.syncPending
        ? next.map((chat) => chat.id)
        : remote
            .filter((dto) => {
              const local = previous.get(dto.id);
              if (!local) return true;
              const remoteAt = dto.last_message_at
                ? new Date(dto.last_message_at).getTime()
                : 0;
              const localAt = local.lastMessage?.timestamp.getTime() ?? 0;
              return remoteAt > localAt;
            })
            .map((dto) => dto.id);
      syncChatHistories(chatIdsToSync, isOnline, deviceId);
      if (options.syncPending) {
        await syncPendingTextMessages(currentUser, tenantId, isOnline, deviceId);
        await syncPendingImageMessages(currentUser, tenantId, isOnline);
        await syncPendingAudioMessages(currentUser, tenantId, isOnline);
        await syncPendingOps(currentUser, isOnline, deviceId);
        await syncPendingReactions(currentUser, isOnline);
      }
      await loadLocalChats(active);
    },
    [currentUser, deviceId, isOnline, loadLocalChats, tenantId]
  );

  const refreshChangedChats = useCallback(
    async (chatIds: string[], active: () => boolean) => {
      if (!currentUser || !tenantId || !isOnline) return;
      for (const chatId of chatIds) {
        if (!active()) return;
        const local = await ChatRepository.getLocalChat(chatId);
        if (!local?.participants.includes(currentUser.id)) continue;
        await syncChatHistory(chatId, isOnline, deviceId);
        try {
          const chat = await chatFromDtoWithDecryptedPreview(await getChat(chatId), currentUser.id, deviceId);
          await ChatRepository.upsertChat(chat, { notify: false });
        } catch (error) {
          if (isMembershipLoss(error)) {
            await ChatRepository.deleteChat(chatId, { notify: false });
          }
        }
      }
      await loadLocalChats(active);
    },
    [currentUser, deviceId, isOnline, loadLocalChats, tenantId]
  );

  useEffect(() => {
    if (!tenantId || !currentUser) {
      setChats([]);
      setLoading(false);
      return;
    }

    let active = true;
    const isActive = () => active;
    void loadLocalChats(isActive);
    const unsubLocal = ChatRepository.subscribe(() => {
      void loadLocalChats(isActive);
    });
    void refreshRemoteChats(isActive, { syncPending: true }).catch(() => {});
    const scheduleFullRefresh = debounce(
      () => void refreshRemoteChats(isActive, { syncPending: false }).catch(() => {}),
      REALTIME_REFRESH_DELAY_MS,
    );
    const changedChatIds = new Set<string>();
    const scheduleChangedRefresh = debounce(() => {
      const chatIds = [...changedChatIds];
      changedChatIds.clear();
      void refreshChangedChats(chatIds, isActive).catch(() => {});
    }, REALTIME_REFRESH_DELAY_MS);
    const unsubRealtime = realtimeClient.subscribe((event) => {
      if (event.type === "chat.deleted") {
        // The chat is already gone server-side, so it carries its id in the payload
        // instead of chat_id, and a remote refresh would never prune it locally.
        const deletedChatId =
          typeof event.payload?.chat_id === "string"
            ? event.payload.chat_id
            : event.entity_id;
        if (deletedChatId) {
          void ChatRepository.deleteChat(deletedChatId);
        }
        return;
      }
      if (FULL_REFRESH_EVENT_TYPES.has(event.type)) {
        scheduleFullRefresh();
        return;
      }
      if (event.type.startsWith("message.") && event.chat_id) {
        changedChatIds.add(event.chat_id);
        scheduleChangedRefresh();
      }
    });
    return () => {
      active = false;
      scheduleFullRefresh.cancel();
      scheduleChangedRefresh.cancel();
      unsubLocal();
      unsubRealtime();
    };
  }, [currentUser, loadLocalChats, refreshChangedChats, refreshRemoteChats, tenantId]);

  const refresh = useCallback(
    () =>
      refreshRemoteChats(() => mountedRef.current, { syncPending: false }),
    [refreshRemoteChats]
  );

  return { chats, loading, refresh };
}
