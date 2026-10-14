import { useAuth } from "@/context/AuthContext";
import { useConnectivity } from "@/hooks/useConnectivity";
import { debounce, REALTIME_REFRESH_DELAY_MS } from "@/lib/debounce";
import { ReactionRepository } from "@/lib/ReactionRepository";
import { listReactions, removeReaction, upsertReaction } from "@/src/api/chats";
import { realtimeClient } from "@/src/api/realtime";
import type { Reaction } from "@/types/chat";
import { useCallback, useEffect, useState } from "react";

type ReactionAction =
  | { type: "add"; messageId: string; userId: string; emoji: string }
  | { type: "remove"; messageId: string; userId: string };

function sameReactions(a: Reaction[], b: Reaction[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (reaction, index) =>
      reaction.userId === b[index].userId && reaction.emoji === b[index].emoji
  );
}

function reuseUnchangedReactions(
  previous: Record<string, Reaction[]>,
  next: Record<string, Reaction[]>
): Record<string, Reaction[]> {
  const merged: Record<string, Reaction[]> = {};
  let changed = Object.keys(previous).length !== Object.keys(next).length;
  for (const [messageId, reactions] of Object.entries(next)) {
    const prior = previous[messageId];
    if (prior && sameReactions(prior, reactions)) {
      merged[messageId] = prior;
    } else {
      merged[messageId] = reactions;
      changed = true;
    }
  }
  return changed ? merged : previous;
}

export function useReactions(chatId: string) {
  const { currentUser } = useAuth();
  const { isOnline } = useConnectivity();
  const [reactions, setReactions] = useState<Record<string, Reaction[]>>({});
  const currentUserId = currentUser?.id;

  const loadLocalReactions = useCallback(
    async (activeChatId: string, active: () => boolean) => {
      const data = await ReactionRepository.getReactions(activeChatId);
      if (!active()) return;
      setReactions((previous) => reuseUnchangedReactions(previous, data));
    },
    []
  );

  const refreshRemoteReactions = useCallback(
    async (activeChatId: string, active: () => boolean) => {
      if (!isOnline) return;
      const rows = await listReactions(activeChatId);
      await ReactionRepository.replaceRemoteReactions(
        activeChatId,
        rows.map((row) => ({
          messageId: row.message_id,
          userId: row.member_id,
          emoji: row.emoji,
        }))
      );
      await loadLocalReactions(activeChatId, active);
    },
    [isOnline, loadLocalReactions]
  );

  const executeReaction = useCallback(
    async (action: ReactionAction) => {
      if (!currentUserId) return;
      const { messageId, userId } = action;
      if (action.type === "add") {
        await ReactionRepository.saveReaction(messageId, userId, action.emoji, "loading", chatId);
        if (isOnline) {
          await upsertReaction(chatId, messageId, action.emoji)
            .then(() => ReactionRepository.confirmReactionSent(messageId, userId, action.emoji))
            .catch(() => {});
        }
      } else {
        await ReactionRepository.markRemoving(messageId, userId, chatId);
        if (isOnline) {
          await removeReaction(chatId, messageId)
            .then(() => ReactionRepository.deleteRemovedReaction(messageId, userId))
            .catch(() => {});
        }
      }
    },
    [chatId, currentUserId, isOnline]
  );

  const reactToMessage = useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentUserId) return;
      const messageReactions = reactions[messageId] ?? [];
      const existing = messageReactions.find((r) => r.userId === currentUserId);
      if (existing?.emoji === emoji) {
        await executeReaction({ type: "remove", messageId, userId: currentUserId });
        return;
      }
      if (existing) {
        await executeReaction({ type: "remove", messageId, userId: currentUserId });
      }
      await executeReaction({ type: "add", messageId, userId: currentUserId, emoji });
    },
    [currentUserId, reactions, executeReaction]
  );

  useEffect(() => {
    if (!chatId) {
      setReactions({});
      return;
    }
    let active = true;
    const isActive = () => active;
    void loadLocalReactions(chatId, isActive);
    void refreshRemoteReactions(chatId, isActive);
    const unsubLocal = ReactionRepository.subscribe(chatId, () => {
      void loadLocalReactions(chatId, isActive);
    });
    const scheduleRefresh = debounce(
      () => void refreshRemoteReactions(chatId, isActive),
      REALTIME_REFRESH_DELAY_MS,
    );
    const unsubRealtime = realtimeClient.subscribe((event) => {
      if (event.chat_id === chatId && event.type.startsWith("reaction.")) {
        scheduleRefresh();
      }
    });
    return () => {
      active = false;
      scheduleRefresh.cancel();
      unsubLocal();
      unsubRealtime();
    };
  }, [chatId, loadLocalReactions, refreshRemoteReactions]);

  return { reactions, reactToMessage };
}
