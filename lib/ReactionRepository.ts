import { getDatabase, withExclusiveWrite } from "@/lib/db";
import type { Reaction } from "@/types/chat";

type ReactionRow = {
  message_id: string;
  user_id: string;
  emoji: string;
  status: string;
};

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

function emit(conversationId: string) {
  listeners.get(conversationId)?.forEach((l) => l());
}

function rowToReaction(row: ReactionRow): Reaction {
  return { userId: row.user_id, emoji: row.emoji };
}

export type ReactionStatus = "loading" | "sent" | "removing";

export type PendingReaction = {
  messageId: string;
  userId: string;
  emoji: string;
  chatId: string;
  status: "loading" | "removing";
};

export const ReactionRepository = {
  subscribe(conversationId: string, listener: Listener) {
    const set = listeners.get(conversationId) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(conversationId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) listeners.delete(conversationId);
    };
  },

  emit(conversationId: string) {
    emit(conversationId);
  },

  async getReactions(conversationId: string): Promise<Record<string, Reaction[]>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ReactionRow>(
      `SELECT mr.*
       FROM message_reactions mr
       INNER JOIN messages m ON m.id = mr.message_id
       WHERE m.conversation_id = ?
         AND mr.status <> 'removing'
       ORDER BY mr.emoji`,
      [conversationId]
    );
    const map: Record<string, Reaction[]> = {};
    for (const row of rows) {
      if (!map[row.message_id]) map[row.message_id] = [];
      map[row.message_id].push(rowToReaction(row));
    }
    return map;
  },

  async saveReaction(
    messageId: string,
    userId: string,
    emoji: string,
    status: "loading" | "sent",
    conversationId: string
  ) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(
        `INSERT OR REPLACE INTO message_reactions (message_id, user_id, emoji, status)
         VALUES (?, ?, ?, ?)`,
        [messageId, userId, emoji, status]
      );
    });
    emit(conversationId);
  },

  async removeReaction(messageId: string, userId: string, conversationId: string) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(
        `DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?`,
        [messageId, userId]
      );
    });
    emit(conversationId);
  },

  async markRemoving(messageId: string, userId: string, conversationId: string) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(
        `UPDATE message_reactions SET status = 'removing' WHERE message_id = ? AND user_id = ?`,
        [messageId, userId]
      );
    });
    emit(conversationId);
  },

  async getPendingReactions(): Promise<PendingReaction[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ message_id: string; user_id: string; emoji: string; status: string; conversation_id: string }>(
      `SELECT mr.message_id, mr.user_id, mr.emoji, mr.status, m.conversation_id
       FROM message_reactions mr
       INNER JOIN messages m ON m.id = mr.message_id
       WHERE mr.status IN ('loading', 'removing')`
    );
    return rows.map((r) => ({
      messageId: r.message_id,
      userId: r.user_id,
      emoji: r.emoji,
      chatId: r.conversation_id,
      status: r.status === "removing" ? "removing" : "loading",
    }));
  },

  async confirmReactionSent(messageId: string, userId: string, emoji: string) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(
        `UPDATE message_reactions SET status = 'sent'
         WHERE message_id = ? AND user_id = ? AND emoji = ? AND status = 'loading'`,
        [messageId, userId, emoji]
      );
    });
  },

  async deleteRemovedReaction(messageId: string, userId: string) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(
        `DELETE FROM message_reactions
         WHERE message_id = ? AND user_id = ? AND status = 'removing'`,
        [messageId, userId]
      );
    });
  },

  async discardPendingReaction(messageId: string, userId: string, conversationId: string) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(
        `DELETE FROM message_reactions
         WHERE message_id = ? AND user_id = ? AND status IN ('loading', 'removing')`,
        [messageId, userId]
      );
    });
    emit(conversationId);
  },

  async updateStatus(messageId: string, userId: string, status: ReactionStatus) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(
        `UPDATE message_reactions SET status = ? WHERE message_id = ? AND user_id = ?`,
        [status, messageId, userId]
      );
    });
  },

  // The server returns the full reaction set of the chat, so anything stored here and
  // missing from it was removed elsewhere. Without this prune a reaction removed on another
  // device stayed visible on this one forever. Rows still pending upload are kept.
  async replaceRemoteReactions(
    conversationId: string,
    remote: { messageId: string; userId: string; emoji: string }[]
  ) {
    await withExclusiveWrite(async (tx) => {
      const upsert = await tx.prepareAsync(
        `INSERT INTO message_reactions (message_id, user_id, emoji, status)
         VALUES (?, ?, ?, 'sent')
         ON CONFLICT(message_id, user_id) DO UPDATE SET
           emoji = excluded.emoji,
           status = 'sent'
         WHERE message_reactions.status = 'sent'`
      );
      try {
        for (const reaction of remote) {
          await upsert.executeAsync([
            reaction.messageId,
            reaction.userId,
            reaction.emoji,
          ]);
        }
      } finally {
        await upsert.finalizeAsync();
      }

      const keep = new Set(
        remote.map((reaction) => `${reaction.messageId}:${reaction.userId}`)
      );
      const stored = await tx.getAllAsync<Pick<ReactionRow, "message_id" | "user_id">>(
        `SELECT mr.message_id, mr.user_id
         FROM message_reactions mr
         INNER JOIN messages m ON m.id = mr.message_id
         WHERE m.conversation_id = ?
           AND mr.status = 'sent'`,
        [conversationId]
      );
      const stale = stored.filter(
        (row) => !keep.has(`${row.message_id}:${row.user_id}`)
      );
      if (stale.length === 0) return;
      const remove = await tx.prepareAsync(
        `DELETE FROM message_reactions
         WHERE message_id = ? AND user_id = ? AND status = 'sent'`
      );
      try {
        for (const row of stale) {
          await remove.executeAsync([row.message_id, row.user_id]);
        }
      } finally {
        await remove.finalizeAsync();
      }
    });
    emit(conversationId);
  },
};
