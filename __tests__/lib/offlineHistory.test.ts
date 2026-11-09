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

beforeEach(() => jest.clearAllMocks());

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

  expect(MessageRepository.saveMessageSyncState).toHaveBeenCalledWith("chat", new Date(newAt), start);
  expect(MessageRepository.saveMessageSyncState).toHaveBeenCalledTimes(1);
});
