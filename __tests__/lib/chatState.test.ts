jest.mock("@/lib/db", () => ({ getDatabase: jest.fn(), withExclusiveWrite: jest.fn() }));
jest.mock("@/lib/secureKeyStore", () => ({ SecureKeyStore: {} }));
jest.mock("@/lib/encryptedMessages", () => ({}));

import { ChatRepository } from "@/lib/ChatRepository";
import { MessageRepository } from "@/lib/MessageRepository";
import { getDatabase, withExclusiveWrite } from "@/lib/db";

// Execute the repository's SQL against SQLite rather than asserting its query text.
const { DatabaseSync } = jest.requireActual("node:sqlite");
let db: InstanceType<typeof DatabaseSync>;

beforeEach(() => {
  db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE chats (id TEXT PRIMARY KEY, read_up_to TEXT, unread_count INTEGER,
      last_message_text TEXT, last_message_type TEXT, last_message_at TEXT, updated_at TEXT);
    CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT, sender_id TEXT,
      body TEXT, type TEXT, created_at TEXT, status TEXT, is_deleted INTEGER);
    INSERT INTO chats VALUES ('chat', NULL, 3, 'old preview', 'text', '2026-11-08T10:00:00.000Z', NULL);
  `);
  const adapter = {
    getFirstAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).get(...params) ?? null,
    runAsync: async (sql: string, params: unknown[] = []) => db.prepare(sql).run(...params),
  };
  jest.mocked(getDatabase).mockResolvedValue(adapter as never);
  jest.mocked(withExclusiveWrite).mockImplementation(async (callback) => callback(adapter as never));
});

afterEach(() => db.close());

it("clears the preview after the only message is deleted", async () => {
  db.exec("INSERT INTO messages VALUES ('m', 'chat', 'other', 'deleted', 'text', '2026-11-08T10:00:00.000Z', 'sent', 1)");
  await ChatRepository.refreshLastMessageFromLocal("chat");
  const row = db.prepare("SELECT * FROM chats").get();
  expect(row.last_message_text).toBeNull();
  expect(row.last_message_type).toBeNull();
  expect(row.last_message_at).toBeNull();
});

it("updates the preview immediately when deleting offline", async () => {
  db.exec(`
    INSERT INTO messages VALUES ('m', 'chat', 'me', 'old preview', 'text', '2026-11-08T10:00:00.000Z', 'sent', 0);
    ALTER TABLE messages ADD COLUMN deleted_at TEXT;
    ALTER TABLE messages ADD COLUMN pending_op TEXT;
    ALTER TABLE messages ADD COLUMN edit_attempts INTEGER;
    ALTER TABLE messages ADD COLUMN updated_at TEXT;
  `);
  await MessageRepository.markAsDeleted("m", { deletedAt: new Date(), pendingOp: "delete" });
  expect(db.prepare("SELECT last_message_text FROM chats").get().last_message_text).toBeNull();
});

it("uses the surviving message for the preview", async () => {
  db.exec("INSERT INTO messages VALUES ('m', 'chat', 'other', 'survivor', 'text', '2026-11-08T09:00:00.000Z', 'sent', 0)");
  await ChatRepository.refreshLastMessageFromLocal("chat");
  expect(db.prepare("SELECT last_message_text FROM chats").get().last_message_text).toBe("survivor");
});

it("clears only read messages from the badge and never moves a receipt backwards", async () => {
  db.exec(`INSERT INTO messages VALUES
    ('old', 'chat', 'other', 'read', 'text', '2026-11-08T09:00:00.000Z', 'sent', 0),
    ('new', 'chat', 'other', 'unread', 'text', '2026-11-08T11:00:00.000Z', 'sent', 0)`);
  await ChatRepository.markRead("chat", "me", Date.parse("2026-11-08T10:00:00.000Z"), "me");
  await ChatRepository.markRead("chat", "me", Date.parse("2026-11-08T08:00:00.000Z"), "me");
  const row = db.prepare("SELECT * FROM chats").get();
  expect(row.unread_count).toBe(1);
  expect(JSON.parse(row.read_up_to).me).toBe(Date.parse("2026-11-08T10:00:00.000Z"));
});

it("does not clear our unread badge when someone else reads", async () => {
  await ChatRepository.markRead("chat", "other", Date.parse("2026-11-08T10:00:00.000Z"), "me");
  expect(db.prepare("SELECT unread_count FROM chats").get().unread_count).toBe(3);
});
