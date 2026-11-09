jest.mock("@/lib/ChatRepository", () => ({
  ChatRepository: { refreshLastMessageFromLocal: jest.fn() },
}));
jest.mock("@/lib/conversationKeyReadiness", () => ({
  repairConversationKeyFromPendingShare: jest.fn(),
}));
jest.mock("@/lib/encryptedMessages", () => ({}));
jest.mock("@/lib/keyDistribution", () => ({}));
jest.mock("@/lib/remoteMessages", () => ({}));
jest.mock("@/lib/AudioCacheRepository", () => ({}));
jest.mock("@/lib/ImageCacheRepository", () => ({}));
jest.mock("@/lib/imageUpload", () => ({}));
jest.mock("@/lib/ReactionRepository", () => ({}));
jest.mock("@/src/api/media", () => ({}));
jest.mock("@/src/api/client", () => ({ ApiError: class extends Error {} }));
jest.mock("@/src/api/chats", () => ({ listMessages: jest.fn() }));
jest.mock("@/lib/MessageRepository", () => ({
  MessageRepository: {
    getMessageSyncState: jest.fn(),
    saveMessageSyncState: jest.fn(),
    upsertRemoteMessages: jest.fn(),
    emit: jest.fn(),
  },
}));

import { MessageRepository } from "@/lib/MessageRepository";
import { syncChatHistory } from "@/lib/offlineSync";
import { listMessages, type MessageDto } from "@/src/api/chats";

const start = "2026-11-08T10:00:00.000Z";
const editedAt = "2026-11-08T10:01:00.000Z";
const newAt = "2026-11-08T10:02:00.000Z";
const older = { id: "older", created_at: "2026-11-08T09:00:00.000Z", updated_at: editedAt } as MessageDto;
const newest = { id: "new", created_at: newAt, updated_at: newAt } as MessageDto;

beforeEach(() => jest.resetAllMocks());

it.each([false, true])("replays an older change before a new message (deleted=%s)", async (isDeleted) => {
  let state = { newestMessageAt: new Date(start), changedAt: start, historySyncedAt: new Date(start) };
  const changed = { ...older, is_deleted: isDeleted };
  jest.mocked(MessageRepository.getMessageSyncState).mockImplementation(async () => state);
  jest.mocked(MessageRepository.saveMessageSyncState).mockImplementation(async (_, newestMessageAt, changedAt) => {
    state = { ...state, newestMessageAt: newestMessageAt!, changedAt: changedAt ?? state.changedAt };
  });
  jest.mocked(listMessages).mockImplementation(async (_, query = {}) =>
    [changed, newest].filter((row) => query.changedAfter
      ? row.updated_at! > query.changedAfter
      : row.created_at! > (query.after ?? ""))
  );

  await syncChatHistory("chat");

  expect(listMessages).toHaveBeenCalledWith("chat", { changedAfter: start, limit: 100 });
  expect(MessageRepository.upsertRemoteMessages).toHaveBeenCalledWith("chat", [changed, newest], { notify: false });
  expect(state.changedAt).toBe(newAt);
});

it("does not advance the edit cursor when fetching changes fails", async () => {
  const state = { newestMessageAt: new Date(start), changedAt: start, historySyncedAt: new Date(start) };
  jest.mocked(MessageRepository.getMessageSyncState).mockResolvedValue(state);
  jest.mocked(listMessages).mockImplementation(async (_, query = {}) => {
    if (query.changedAfter) throw new Error("offline");
    return [newest];
  });

  await syncChatHistory("chat");

  expect(MessageRepository.saveMessageSyncState).not.toHaveBeenCalled();
});

it("imports a cold 125-message history once, including a timestamp shared across pages", async () => {
  const rows = Array.from({ length: 125 }, (_, index) => ({
    ...newest, id: `message-${String(index).padStart(3, "0")}`,
  }));
  jest.mocked(MessageRepository.getMessageSyncState).mockResolvedValue({
    historySyncedAt: null, newestMessageAt: null, changedAt: null,
  });
  jest.mocked(listMessages).mockImplementation(async (_, query = {}) => rows.filter((row) =>
    row.updated_at! > query.changedAfter! ||
    (row.updated_at === query.changedAfter && !!query.changedAfterId && row.id > query.changedAfterId)
  ).slice(0, query.limit));

  await syncChatHistory("cold");

  expect(listMessages).toHaveBeenCalledTimes(2);
  const imported = jest.mocked(MessageRepository.upsertRemoteMessages).mock.calls.flatMap((call) => call[1]);
  expect(imported.map((row) => row.id)).toEqual(rows.map((row) => row.id));
  expect(MessageRepository.saveMessageSyncState).toHaveBeenCalledWith("cold", new Date(newAt), newAt, "message-124");
});

it("checks an unchanged conversation with one request and no mirror writes", async () => {
  jest.mocked(MessageRepository.getMessageSyncState).mockResolvedValue({
    historySyncedAt: new Date(start), newestMessageAt: new Date(start), changedAt: start,
  });
  jest.mocked(listMessages).mockResolvedValue([]);
  await syncChatHistory("unchanged");
  expect(listMessages).toHaveBeenCalledTimes(1);
  expect(MessageRepository.saveMessageSyncState).not.toHaveBeenCalled();
  expect(MessageRepository.upsertRemoteMessages).not.toHaveBeenCalled();
});

it("keeps the saved cursor unchanged if the second page fails", async () => {
  jest.mocked(MessageRepository.getMessageSyncState).mockResolvedValue({
    historySyncedAt: new Date(start), newestMessageAt: new Date(start), changedAt: start,
  });
  jest.mocked(listMessages).mockResolvedValueOnce(Array.from({ length: 100 }, (_, index) => ({ ...newest, id: `message-${index}` })))
    .mockRejectedValueOnce(new Error("offline"));
  await syncChatHistory("interrupted");
  expect(MessageRepository.saveMessageSyncState).not.toHaveBeenCalled();
});
