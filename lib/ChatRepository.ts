import { getDatabase, withExclusiveWrite } from "@/lib/db";
import type { SQLiteDatabase } from "expo-sqlite";
import { timestampFromMillis } from "@/lib/localTimestamp";
import { SecureKeyStore } from "@/lib/secureKeyStore";
import type { Chat } from "@/types/chat";

type ChatRow = {
  id: string;
  tenant_id: string;
  participants: string;
  is_group: number;
  name: string;
  photo_url: string | null;
  photo_path: string | null;
  unread_count: number;
  last_message_text: string | null;
  last_message_type: string | null;
  last_message_at: string | null;
  read_up_to: string | null;
};

type Listener = () => void;

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

function parseParticipants(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function parseReadUpTo(value: string | null): Chat["readUpTo"] {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }

    const readUpTo: NonNullable<Chat["readUpTo"]> = {};
    for (const [userId, millis] of Object.entries(parsed)) {
      if (typeof userId !== "string" || typeof millis !== "number") continue;
      readUpTo[userId] = timestampFromMillis(millis);
    }

    return Object.keys(readUpTo).length > 0 ? readUpTo : undefined;
  } catch {
    return undefined;
  }
}

function serializeReadUpTo(readUpTo: Chat["readUpTo"]): string | null {
  if (!readUpTo) return null;

  const serialized: Record<string, number> = {};
  for (const [userId, timestamp] of Object.entries(readUpTo)) {
    serialized[userId] = timestamp.toMillis();
  }

  return JSON.stringify(serialized);
}

function rowToChat(row: ChatRow): Chat {
  const chat: Chat = {
    id: row.id,
    tenantId: row.tenant_id,
    participants: parseParticipants(row.participants),
    isGroup: row.is_group === 1,
    name: row.name,
    photoUrl: row.photo_url,
    photoPath: row.photo_path,
    unreadCount: row.unread_count,
    readUpTo: parseReadUpTo(row.read_up_to),
  };

  if (row.last_message_at) {
    chat.lastMessage = {
      text: row.last_message_text,
      type:
        row.last_message_type === "audio" ||
        row.last_message_type === "text" ||
        row.last_message_type === "image"
          ? row.last_message_type
          : null,
      timestamp: new Date(row.last_message_at),
    };
  }

  return chat;
}

const UPSERT_CHAT_SQL = `INSERT INTO chats (
    id,
    tenant_id,
    participants,
    is_group,
    name,
    photo_url,
    photo_path,
    unread_count,
    last_message_text,
    last_message_type,
    last_message_at,
    read_up_to,
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    tenant_id = excluded.tenant_id,
    participants = excluded.participants,
    is_group = excluded.is_group,
    name = excluded.name,
    photo_url = excluded.photo_url,
    photo_path = excluded.photo_path,
    unread_count = excluded.unread_count,
    last_message_text = CASE
      WHEN excluded.last_message_at IS NULL THEN chats.last_message_text
      WHEN chats.last_message_at IS NULL THEN excluded.last_message_text
      WHEN excluded.last_message_at > chats.last_message_at THEN excluded.last_message_text
      ELSE chats.last_message_text
    END,
    last_message_type = CASE
      WHEN excluded.last_message_at IS NULL THEN chats.last_message_type
      WHEN chats.last_message_at IS NULL THEN excluded.last_message_type
      WHEN excluded.last_message_at > chats.last_message_at THEN excluded.last_message_type
      ELSE chats.last_message_type
    END,
    last_message_at = CASE
      WHEN excluded.last_message_at IS NULL THEN chats.last_message_at
      WHEN chats.last_message_at IS NULL THEN excluded.last_message_at
      WHEN excluded.last_message_at > chats.last_message_at THEN excluded.last_message_at
      ELSE chats.last_message_at
    END,
    read_up_to = excluded.read_up_to,
    updated_at = excluded.updated_at`;

function chatParams(chat: Chat) {
  return [
    chat.id,
    chat.tenantId,
    JSON.stringify(chat.participants),
    chat.isGroup ? 1 : 0,
    chat.name,
    chat.photoUrl ?? null,
    chat.photoPath ?? null,
    chat.unreadCount,
    chat.lastMessage?.text ?? null,
    chat.lastMessage?.type ?? null,
    chat.lastMessage?.timestamp?.toISOString() ?? null,
    serializeReadUpTo(chat.readUpTo),
    new Date().toISOString(),
  ];
}

async function deleteChatRows(tx: SQLiteDatabase, chatId: string) {
  await tx.runAsync("DELETE FROM chats WHERE id = ?", [chatId]);
  await tx.runAsync(
    `DELETE FROM message_reactions
     WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = ?)`,
    [chatId]
  );
  await tx.runAsync("DELETE FROM messages WHERE conversation_id = ?", [chatId]);
  await tx.runAsync("DELETE FROM chat_message_sync WHERE chat_id = ?", [chatId]);
  await tx.runAsync("DELETE FROM key_share_recipients WHERE chat_id = ?", [chatId]);
}

export const ChatRepository = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  async getLocalChats(tenantId: string): Promise<Chat[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<ChatRow>(
      `SELECT *
       FROM chats
       WHERE tenant_id = ?
       ORDER BY COALESCE(last_message_at, updated_at, '') DESC, name ASC`,
      [tenantId]
    );

    return rows.map(rowToChat);
  },

  async getLocalChat(chatId: string): Promise<Chat | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<ChatRow>(
      `SELECT *
       FROM chats
       WHERE id = ?`,
      [chatId]
    );

    return row ? rowToChat(row) : null;
  },

  async upsertChat(chat: Chat, options: { notify?: boolean } = {}) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(UPSERT_CHAT_SQL, chatParams(chat));
    });

    if (options.notify !== false) {
      emit();
    }
  },

  async upsertChats(chats: Chat[], options: { notify?: boolean } = {}) {
    if (chats.length === 0) return;
    await withExclusiveWrite(async (tx) => {
      const statement = await tx.prepareAsync(UPSERT_CHAT_SQL);
      try {
        for (const chat of chats) {
          await statement.executeAsync(chatParams(chat));
        }
      } finally {
        await statement.finalizeAsync();
      }
    });

    if (options.notify !== false) {
      emit();
    }
  },

  // Reconciles the tenant's chat list without touching the rows that survive, so the
  // decrypted last message preview of an existing chat is never wiped by a caller whose
  // payload does not carry it.
  async upsertTenantChats(
    tenantId: string,
    chats: Chat[],
    options: { notify?: boolean } = {}
  ) {
    const keepIds = new Set(chats.map((chat) => chat.id));
    const removedIds: string[] = [];
    await withExclusiveWrite(async (tx) => {
      const statement = await tx.prepareAsync(UPSERT_CHAT_SQL);
      try {
        for (const chat of chats) {
          await statement.executeAsync(chatParams(chat));
        }
      } finally {
        await statement.finalizeAsync();
      }
      const existing = await tx.getAllAsync<{ id: string }>(
        "SELECT id FROM chats WHERE tenant_id = ?",
        [tenantId]
      );
      for (const row of existing) {
        if (keepIds.has(row.id)) continue;
        await deleteChatRows(tx, row.id);
        removedIds.push(row.id);
      }
    });
    await Promise.all(
      removedIds.map((chatId) =>
        SecureKeyStore.removeConversationKey(chatId).catch(() => {})
      )
    );

    if (options.notify !== false) {
      emit();
    }
  },

  async deleteChat(chatId: string, options: { notify?: boolean } = {}) {
    // There are no foreign keys in the local schema, so every table that references the
    // chat has to be cleared here — otherwise the decrypted message bodies of a deleted
    // conversation stay on the device forever.
    await withExclusiveWrite(async (tx) => {
      await deleteChatRows(tx, chatId);
    });
    await SecureKeyStore.removeConversationKey(chatId).catch(() => {});
    if (options.notify !== false) {
      emit();
    }
  },

  async updateLastMessage(
    chatId: string,
    lastMessage: {
      text: string | null;
      type: "text" | "audio" | "image";
      timestamp: Date;
    },
    options: { notify?: boolean } = {}
  ) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(
        `UPDATE chats
         SET last_message_text = ?,
             last_message_type = ?,
             last_message_at = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          lastMessage.text,
          lastMessage.type,
          lastMessage.timestamp.toISOString(),
          new Date().toISOString(),
          chatId,
        ]
      );
    });

    if (options.notify !== false) {
      emit();
    }
  },

  async refreshLastMessageFromLocal(
    chatId: string,
    options: { notify?: boolean } = {}
  ) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{
      body: string | null;
      type: string;
      created_at: string;
    }>(
      `SELECT body, type, created_at
       FROM messages
       WHERE conversation_id = ?
         AND COALESCE(is_deleted, 0) = 0
       ORDER BY created_at DESC
       LIMIT 1`,
      [chatId]
    );
    if (!row) return;
    const type: "text" | "audio" | "image" =
      row.type === "audio" ? "audio" : row.type === "image" ? "image" : "text";
    await this.updateLastMessage(
      chatId,
      {
        text: type === "text" ? row.body : null,
        type,
        timestamp: new Date(row.created_at),
      },
      options
    );
  },
};
