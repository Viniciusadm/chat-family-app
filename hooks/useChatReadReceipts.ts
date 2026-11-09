import { useAuth } from "@/context/AuthContext";
import { useConnectivity } from "@/hooks/useConnectivity";
import { ChatRepository } from "@/lib/ChatRepository";
import type { LocalTimestamp } from "@/lib/localTimestamp";
import { timestampFromMillis } from "@/lib/localTimestamp";
import { markRead } from "@/src/api/chats";
import type { Message } from "@/types/chat";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useState } from "react";

export function useChatReadReceipts(
  chatId: string,
  messages: Message[],
  localReadUpTo?: Record<string, LocalTimestamp>
): { readUpTo: Record<string, LocalTimestamp> | null } {
  const { currentUser } = useAuth();
  const { isOnline } = useConnectivity();
  const isFocused = useIsFocused();
  const currentUserId = currentUser?.id;
  let targetMs: number | null = null;
  for (const message of messages) {
    // Server timestamps have microseconds; include the whole final millisecond
    // after converting them to JavaScript dates, and ignore unsent local rows.
    if (message.status === "sent") targetMs = message.createdAtMs + 1;
  }
  const [readUpTo, setReadUpTo] = useState<Record<string, LocalTimestamp> | null>(
    localReadUpTo ?? null
  );

  useEffect(() => {
    setReadUpTo(localReadUpTo ?? null);
  }, [chatId, localReadUpTo]);

  useEffect(() => {
    if (!chatId || localReadUpTo) return;
    let active = true;
    void ChatRepository.getLocalChat(chatId)
      .then((chat) => {
        if (active && chat?.readUpTo) setReadUpTo(chat.readUpTo);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [chatId, localReadUpTo]);

  useEffect(() => {
    if (!isFocused || !chatId || !currentUserId || targetMs == null) {
      return;
    }
    const uid = currentUserId;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const syncRead = async () => {
      try {
        await markRead(chatId, new Date(targetMs).toISOString());
      } catch {
        if (active) retry = setTimeout(() => void syncRead(), 5000);
      }
    };
    const id = setTimeout(() => {
      setReadUpTo((prev) => ({
        ...(prev ?? {}),
        [uid]: timestampFromMillis(Math.max(targetMs, prev?.[uid]?.toMillis() ?? 0)),
      }));
      void ChatRepository.markRead(chatId, uid, targetMs, uid).catch(() => {});
      if (isOnline) void syncRead();
    }, 400);
    return () => {
      active = false;
      clearTimeout(id);
      if (retry) clearTimeout(retry);
    };
  }, [isOnline, isFocused, chatId, currentUserId, targetMs]);

  return { readUpTo };
}
