import { ChatRepository } from "@/lib/ChatRepository";
import { useAuth } from "@/context/AuthContext";
import { debounce, REALTIME_REFRESH_DELAY_MS } from "@/lib/debounce";
import { realtimeClient } from "@/src/api/realtime";
import type { Chat } from "@/types/chat";
import { useCallback, useEffect, useState } from "react";

// Reads a single chat from the local mirror. The chat screen used to mount useChats(), so
// opening a conversation subscribed it to the whole tenant's realtime traffic and every
// incoming message triggered a full chat list refresh from inside the screen.
export function useChat(chatId: string): Chat | null {
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id;
  const [chat, setChat] = useState<Chat | null>(null);

  const load = useCallback(
    async (active: () => boolean) => {
      if (!chatId) {
        setChat(null);
        return;
      }
      const local = await ChatRepository.getLocalChat(chatId).catch(() => null);
      if (!active()) return;
      setChat(local);
    },
    [chatId]
  );

  useEffect(() => {
    let active = true;
    const isActive = () => active;
    void load(isActive);

    const unsubLocal = ChatRepository.subscribe(() => {
      void load(isActive);
    });
    const scheduleReload = debounce(() => void load(isActive), REALTIME_REFRESH_DELAY_MS);
    const unsubRealtime = realtimeClient.subscribe((event) => {
      if (event.type === "chat.read" && event.chat_id === chatId && currentUserId) {
        const { member_id, read_up_to } = event.payload;
        const readAtMs = typeof read_up_to === "string" ? Date.parse(read_up_to) : NaN;
        if (typeof member_id === "string" && Number.isFinite(readAtMs)) {
          void ChatRepository.markRead(chatId, member_id, readAtMs, currentUserId).catch(() => {});
        }
        return;
      }
      if (event.chat_id === chatId || event.entity_id === chatId) {
        scheduleReload();
      }
    });

    return () => {
      active = false;
      scheduleReload.cancel();
      unsubLocal();
      unsubRealtime();
    };
  }, [chatId, currentUserId, load]);

  return chat;
}
