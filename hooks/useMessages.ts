import { useAuth } from "@/context/AuthContext";
import { useConnectivity } from "@/hooks/useConnectivity";
import { AudioCacheRepository } from "@/lib/AudioCacheRepository";
import { ImageCacheRepository } from "@/lib/ImageCacheRepository";
import { ImageGalleryRepository } from "@/lib/ImageGalleryRepository";
import { debounce, REALTIME_REFRESH_DELAY_MS } from "@/lib/debounce";
import { MessageRepository } from "@/lib/MessageRepository";
import {
  hasOlderRemoteMessages,
  loadOlderRemoteMessages,
  syncChatHistory,
  syncPendingAudioMessages,
  syncPendingImageMessages,
  syncPendingOps,
  syncPendingReactions,
  syncPendingTextMessages,
} from "@/lib/offlineSync";
import { realtimeClient } from "@/src/api/realtime";
import type { Message } from "@/types/chat";
import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 50;
const REVEAL_CONTEXT_SIZE = 10;

type MessagesState = {
  chatId: string;
  messages: Message[];
  loading: boolean;
  hasOlder: boolean;
};

type MessageWindow = {
  chatId: string;
  since: string | null;
};

type LoadGate = {
  chatId: string;
  running: Promise<void> | null;
  rerun: boolean;
};

export type UseMessagesResult = {
  messages: Message[];
  loading: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  loadOlder: () => Promise<void>;
  revealMessage: (messageId: string) => Promise<boolean>;
};

function windowFor(window: MessageWindow, chatId: string) {
  const since = window.chatId === chatId ? window.since : null;
  return since ? { since } : { limit: PAGE_SIZE };
}

export function useMessages(
  chatId: string,
  options: { focusMessageId?: string | null } = {}
): UseMessagesResult {
  const { currentUser, tenantId, deviceId } = useAuth();
  const { isOnline } = useConnectivity();
  const currentUserId = currentUser?.id;
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);
  const [state, setState] = useState<MessagesState>({
    chatId: "",
    messages: [],
    loading: true,
    hasOlder: false,
  });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const windowRef = useRef<MessageWindow>({ chatId: "", since: null });
  const gateRef = useRef<LoadGate>({ chatId: "", running: null, rerun: false });
  const activeChatIdRef = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);

  const readWindow = useCallback(
    async (activeChatId: string, active: () => boolean) => {
      const messages = await MessageRepository.getLocalMessages(
        activeChatId,
        windowFor(windowRef.current, activeChatId)
      );
      if (!active()) return;
      const oldest = messages[0]?.timestamp.toISOString() ?? null;
      if (
        oldest &&
        messages.length >= PAGE_SIZE &&
        (windowRef.current.chatId !== activeChatId || !windowRef.current.since)
      ) {
        windowRef.current = { chatId: activeChatId, since: oldest };
      }
      const hasOlderLocal = oldest
        ? await MessageRepository.hasLocalMessagesBefore(activeChatId, oldest)
        : false;
      if (!active()) return;
      setState({
        chatId: activeChatId,
        messages,
        loading: false,
        hasOlder:
          messages.length > 0 &&
          (hasOlderLocal || hasOlderRemoteMessages(activeChatId)),
      });
    },
    []
  );

  const loadLocalMessages = useCallback(
    (activeChatId: string, active: () => boolean): Promise<void> => {
      const gate = gateRef.current;
      if (gate.running && gate.chatId === activeChatId) {
        gate.rerun = true;
        return gate.running;
      }
      const next: LoadGate = { chatId: activeChatId, running: null, rerun: false };
      next.running = (async () => {
        try {
          do {
            next.rerun = false;
            await readWindow(activeChatId, active);
          } while (next.rerun && active());
        } finally {
          next.running = null;
        }
      })();
      gateRef.current = next;
      return next.running;
    },
    [readWindow]
  );

  const refreshLocalMedia = useCallback(
    async (activeChatId: string, active: () => boolean, download: boolean) => {
      const messages = await MessageRepository.getLocalMessages(
        activeChatId,
        windowFor(windowRef.current, activeChatId)
      );
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
            if (currentUserId && message.senderId !== currentUserId) {
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
    [currentUserId, loadLocalMessages]
  );

  const refreshRemoteMessages = useCallback(
    async (activeChatId: string, active: () => boolean) => {
      if (!isOnline) return;
      // Edits and deletions of older messages only arrive through this pass.
      await syncChatHistory(activeChatId, isOnline, deviceId);
      if (!active()) return;
      await loadLocalMessages(activeChatId, active);
    },
    [deviceId, isOnline, loadLocalMessages]
  );

  useEffect(() => {
    if (!chatId) {
      activeChatIdRef.current = null;
      setState({ chatId: "", messages: [], loading: false, hasOlder: false });
      return;
    }

    if (windowRef.current.chatId !== chatId) {
      windowRef.current = { chatId, since: null };
    }
    activeChatIdRef.current = chatId;
    let active = true;
    const isActive = () => active;

    void (async () => {
      await loadLocalMessages(chatId, isActive);
      if (!active) return;
      void refreshLocalMedia(chatId, isActive, isOnline);
      const user = currentUserRef.current;
      if (user && currentUserId && tenantId) {
        await syncPendingTextMessages(user, tenantId, isOnline, deviceId);
        await syncPendingImageMessages(user, tenantId, isOnline);
        await syncPendingAudioMessages(user, tenantId, isOnline);
        await syncPendingOps(user, isOnline, deviceId);
        await syncPendingReactions(user, isOnline);
      }
      await refreshRemoteMessages(chatId, isActive);
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
      if (activeChatIdRef.current === chatId) activeChatIdRef.current = null;
      scheduleRefresh.cancel();
      unsubLocal();
      unsubRealtime();
    };
  }, [
    chatId,
    currentUserId,
    deviceId,
    isOnline,
    loadLocalMessages,
    refreshLocalMedia,
    refreshRemoteMessages,
    tenantId,
  ]);

  const loadOlder = useCallback(async () => {
    if (!chatId || loadingOlderRef.current) return;
    const current = stateRef.current;
    if (current.chatId !== chatId || !current.hasOlder) return;
    const oldest = current.messages[0]?.timestamp.toISOString();
    if (!oldest) return;
    const isActive = () => activeChatIdRef.current === chatId;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      let nextSince = await MessageRepository.getOlderWindowStart(
        chatId,
        oldest,
        PAGE_SIZE
      );
      if (!nextSince && isOnline && hasOlderRemoteMessages(chatId)) {
        const fetched = await loadOlderRemoteMessages(chatId, oldest, PAGE_SIZE).catch(
          () => 0
        );
        if (fetched > 0) {
          nextSince = await MessageRepository.getOlderWindowStart(
            chatId,
            oldest,
            PAGE_SIZE
          );
        }
      }
      if (!isActive()) return;
      windowRef.current = { chatId, since: nextSince ?? oldest };
      await loadLocalMessages(chatId, isActive);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }, [chatId, isOnline, loadLocalMessages]);

  const revealMessage = useCallback(
    async (messageId: string): Promise<boolean> => {
      if (!chatId) return false;
      const current = stateRef.current;
      if (
        current.chatId === chatId &&
        current.messages.some((message) => message.id === messageId)
      ) {
        return true;
      }
      const createdAt = await MessageRepository.getMessageCreatedAt(chatId, messageId);
      if (!createdAt) return false;
      const isActive = () => activeChatIdRef.current === chatId;
      if (!isActive()) return false;
      const loadedOldest =
        current.chatId === chatId
          ? current.messages[0]?.timestamp.toISOString() ?? null
          : null;
      const since = windowRef.current.chatId === chatId ? windowRef.current.since : null;
      const windowStart = since ?? loadedOldest;
      if (windowStart && createdAt >= windowStart) return true;
      const start =
        (await MessageRepository.getOlderWindowStart(
          chatId,
          createdAt,
          REVEAL_CONTEXT_SIZE
        )) ?? createdAt;
      if (!isActive()) return false;
      windowRef.current = { chatId, since: start };
      await loadLocalMessages(chatId, isActive);
      return true;
    },
    [chatId, loadLocalMessages]
  );

  const focusMessageId = options.focusMessageId ?? null;
  const revealedFocusRef = useRef<string | null>(null);
  const stateMessages = state.messages;
  useEffect(() => {
    if (!focusMessageId || revealedFocusRef.current === `${chatId}:${focusMessageId}`) {
      return;
    }
    if (stateRef.current.chatId !== chatId || stateRef.current.loading) return;
    void revealMessage(focusMessageId).then((revealed) => {
      if (revealed) revealedFocusRef.current = `${chatId}:${focusMessageId}`;
    });
  }, [chatId, focusMessageId, revealMessage, stateMessages]);

  if (state.chatId !== chatId) {
    return {
      messages: [],
      loading: true,
      hasOlder: false,
      loadingOlder: false,
      loadOlder,
      revealMessage,
    };
  }

  return {
    messages: state.messages,
    loading: state.loading,
    hasOlder: state.hasOlder,
    loadingOlder,
    loadOlder,
    revealMessage,
  };
}
