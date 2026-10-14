import { ChatRepository } from "@/lib/ChatRepository";
import {
  prepareConversationKeyForEncryption,
  repairConversationKeyFromPendingShare,
} from "@/lib/conversationKeyReadiness";
import { encryptMessageText } from "@/lib/encryptedMessages";
import { distributeConversationKeyForChat } from "@/lib/keyDistribution";
import {
  ensureAudioMessageRemote,
  ensureTextMessageRemote,
  softDeleteMessageRemote,
  updateTextMessageRemote,
} from "@/lib/remoteMessages";
import { AudioCacheRepository } from "@/lib/AudioCacheRepository";
import { ImageCacheRepository } from "@/lib/ImageCacheRepository";
import { uploadAndPersistImage } from "@/lib/imageUpload";
import { MessageRepository } from "@/lib/MessageRepository";
import { tryLockMessage, unlockMessage } from "@/lib/outboxLocks";
import { ReactionRepository } from "@/lib/ReactionRepository";
import {
  listMessages,
  removeReaction,
  upsertReaction,
  type MessageDto,
} from "@/src/api/chats";
import { ApiError } from "@/src/api/client";
import { uploadMessageAudio } from "@/src/api/media";
import type { AppUser } from "@/types/chat";

const MESSAGE_PAGE_SIZE = 100;
const MAX_PENDING_OP_ATTEMPTS = 5;
const inFlightHistorySyncs = new Map<string, Promise<void>>();
const historySyncRerunRequested = new Set<string>();
let pendingSyncInFlight = false;

function isRejectedByServer(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 403 || error.status === 404)
  );
}

export async function applyRemoteMessages(chatId: string, rows: MessageDto[]) {
  await MessageRepository.upsertRemoteMessages(chatId, rows, { notify: false });
  for (const data of rows) {
    if (data.audio_url) {
      void AudioCacheRepository.downloadMessageAudio({
        chatId,
        messageId: data.id,
        remoteUrl: data.audio_url,
      });
    }
    if (data.image_url) {
      void ImageCacheRepository.downloadMessageImage({
        chatId,
        messageId: data.id,
        remoteUrl: data.image_url,
      });
    }
  }
}

/// Replays every server-side write since the last pass, which is the only way an edit or a
/// soft delete of an already synced message can reach this device: neither of them moves
/// created_at, so the history cursor can never see them again.
export async function syncChangedMessages(chatId: string): Promise<number> {
  const syncState = await MessageRepository.getMessageSyncState(chatId);
  let cursor =
    syncState.changedAt ?? syncState.newestMessageAt?.toISOString() ?? null;
  if (!cursor) return 0;

  let applied = 0;
  while (true) {
    const rows = await listMessages(chatId, {
      changedAfter: cursor,
      limit: MESSAGE_PAGE_SIZE,
    });
    if (rows.length === 0) break;

    let newestRaw: string | null = null;
    let newestMs = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      if (!row.updated_at) continue;
      const ms = new Date(row.updated_at).getTime();
      if (ms > newestMs) {
        newestMs = ms;
        newestRaw = row.updated_at;
      }
    }

    await applyRemoteMessages(chatId, rows);
    applied += rows.length;

    // The cursor has to advance or the server keeps returning the same page.
    if (!newestRaw || newestRaw === cursor) break;
    cursor = newestRaw;
    if (rows.length < MESSAGE_PAGE_SIZE) break;
  }

  await MessageRepository.saveMessageSyncState(
    chatId,
    syncState.newestMessageAt,
    cursor,
  );
  if (applied > 0) {
    MessageRepository.emit(chatId);
    await ChatRepository.refreshLastMessageFromLocal(chatId);
  }
  return applied;
}

export function syncChatHistory(
  chatId: string,
  isOnline = true,
  deviceId?: string,
): Promise<void> {
  if (!isOnline) return Promise.resolve();
  const running = inFlightHistorySyncs.get(chatId);
  if (running) {
    historySyncRerunRequested.add(chatId);
    return running;
  }

  const run = (async () => {
    try {
      do {
        historySyncRerunRequested.delete(chatId);
        await syncChatHistoryOnce(chatId, deviceId);
      } while (historySyncRerunRequested.has(chatId));
    } finally {
      inFlightHistorySyncs.delete(chatId);
    }
  })();
  inFlightHistorySyncs.set(chatId, run);
  return run;
}

async function syncChatHistoryOnce(chatId: string, deviceId?: string) {
  try {
    await repairConversationKeyFromPendingShare(chatId, deviceId);
    const syncState = await MessageRepository.getMessageSyncState(chatId);
    let newestMessageAt = syncState.newestMessageAt;
    let changedAt = syncState.changedAt;

    while (true) {
      // The cursor has to advance on every page, otherwise the server keeps
      // returning the same first page and this loop never ends.
      const cursorBefore = newestMessageAt;
      const rows = await listMessages(chatId, {
        after: cursorBefore ? cursorBefore.toISOString() : undefined,
        limit: MESSAGE_PAGE_SIZE,
      });
      if (rows.length === 0) break;

      for (const data of rows) {
        const createdAt = data.created_at ? new Date(data.created_at) : null;
        if (createdAt && (!newestMessageAt || createdAt > newestMessageAt)) {
          newestMessageAt = createdAt;
        }
        if (
          data.updated_at &&
          (!changedAt ||
            new Date(data.updated_at).getTime() > new Date(changedAt).getTime())
        ) {
          changedAt = data.updated_at;
        }
      }
      await applyRemoteMessages(chatId, rows);

      MessageRepository.emit(chatId);

      if (rows.length < MESSAGE_PAGE_SIZE) break;
      if (
        newestMessageAt &&
        cursorBefore &&
        newestMessageAt.getTime() === cursorBefore.getTime()
      ) {
        break;
      }
    }

    await repairConversationKeyFromPendingShare(chatId, deviceId);
    await MessageRepository.saveMessageSyncState(
      chatId,
      newestMessageAt,
      changedAt,
    );
    await ChatRepository.refreshLastMessageFromLocal(chatId);
    await syncChangedMessages(chatId);
  } catch {
    // Offline or permission errors are retried by the next listener/sync pass.
  }
}

const reachedHistoryStart = new Set<string>();

export function hasOlderRemoteMessages(chatId: string): boolean {
  return !reachedHistoryStart.has(chatId);
}

export async function loadOlderRemoteMessages(
  chatId: string,
  before: string,
  limit: number,
): Promise<number> {
  if (reachedHistoryStart.has(chatId)) return 0;
  const syncState = await MessageRepository.getMessageSyncState(chatId);
  if (syncState.historySyncedAt) {
    reachedHistoryStart.add(chatId);
    return 0;
  }
  const rows = await listMessages(chatId, { before, limit });
  if (rows.length < limit) reachedHistoryStart.add(chatId);
  if (rows.length === 0) return 0;
  await applyRemoteMessages(chatId, rows);
  MessageRepository.emit(chatId);
  return rows.length;
}

export function syncChatHistories(
  chatIds: string[],
  isOnline = true,
  deviceId?: string,
) {
  if (!isOnline) return;
  for (const chatId of chatIds) {
    void syncChatHistory(chatId, isOnline, deviceId);
  }
}

async function settleFailedTextMessage(messageId: string) {
  const latest = await MessageRepository.getMessage(messageId);
  if (!latest) return;
  if (latest.isDeleted && latest.pendingOp === "delete") {
    await MessageRepository.cancelPendingCreate(messageId);
    return;
  }
  await MessageRepository.updateStatus(messageId, "failed");
}

async function deliverLockedTextMessage(
  messageId: string,
  currentUser: AppUser,
  tenantId: string,
  deviceId?: string,
): Promise<boolean> {
  const message = await MessageRepository.getMessage(messageId);
  if (
    !message ||
    message.type !== "text" ||
    message.senderId !== currentUser.id ||
    message.status === "sent" ||
    message.isDeleted
  ) {
    return false;
  }

  try {
    await prepareConversationKeyForEncryption(message.chatId, deviceId, {
      canCreate: currentUser.role === "adult",
    });
    await distributeConversationKeyForChat(message.chatId);
    const enc = await encryptMessageText(message.chatId, message.content);
    if (!enc) throw new Error("Conversation key unavailable for encryption.");
    await ensureTextMessageRemote({
      chatId: message.chatId,
      messageId: message.id,
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      replyTo: message.replyTo ?? null,
    });
    await MessageRepository.updateEncryptedPayload(message.id, {
      ciphertext: enc.ciphertext,
      iv: enc.iv,
      encVersion: 1,
    });
    await MessageRepository.updateStatus(message.id, "sent");
    return true;
  } catch {
    // Leave the row pending for the next online pass.
    await settleFailedTextMessage(message.id).catch(() => {});
    return false;
  }
}

async function runLockedSend<T>(
  messageId: string,
  currentUser: AppUser,
  deviceId: string | undefined,
  send: () => Promise<T>,
): Promise<T | null> {
  if (!tryLockMessage(messageId)) return null;
  let result: T;
  try {
    result = await send();
  } finally {
    unlockMessage(messageId);
  }
  const latest = await MessageRepository.getMessage(messageId);
  if (latest?.status === "sent" && latest.pendingOp) {
    void syncPendingOps(currentUser, true, deviceId);
  }
  return result;
}

export async function sendTextMessage(
  messageId: string,
  currentUser: AppUser,
  tenantId: string,
  deviceId?: string,
): Promise<boolean> {
  const delivered = await runLockedSend(messageId, currentUser, deviceId, () =>
    deliverLockedTextMessage(messageId, currentUser, tenantId, deviceId),
  );
  return delivered === true;
}

export async function syncPendingTextMessages(
  currentUser: AppUser,
  tenantId: string,
  isOnline = true,
  deviceId?: string,
) {
  if (!isOnline) return;
  if (pendingSyncInFlight) return;
  pendingSyncInFlight = true;

  try {
    const messages = await MessageRepository.getPendingTextMessages();
    for (const message of messages) {
      if (message.senderId !== currentUser.id || message.type !== "text") {
        continue;
      }
      await sendTextMessage(message.id, currentUser, tenantId, deviceId);
    }
  } finally {
    pendingSyncInFlight = false;
  }
}

export async function uploadImageMessage(
  messageId: string,
  currentUser: AppUser,
  tenantId: string,
  sourceUriOverride?: string,
): Promise<boolean> {
  const uploaded = await runLockedSend(messageId, currentUser, undefined, () =>
    uploadLockedImageMessage(messageId, currentUser, tenantId, sourceUriOverride),
  );
  return uploaded === true;
}

async function uploadLockedImageMessage(
  messageId: string,
  currentUser: AppUser,
  tenantId: string,
  sourceUriOverride?: string,
): Promise<boolean> {
  const message = await MessageRepository.getMessage(messageId);
  if (
    !message ||
    message.type !== "image" ||
    message.senderId !== currentUser.id ||
    message.status === "sent" ||
    message.isDeleted
  ) {
    return false;
  }
  const sourceUri =
    sourceUriOverride ??
    message.imagePendingSourceUri ??
    message.imageLocalUri ??
    null;
  if (!sourceUri) return false;

  try {
    if (message.status === "failed") {
      await MessageRepository.updateStatus(message.id, "loading");
    }
    await uploadAndPersistImage({
      chatId: message.chatId,
      messageId: message.id,
      imageUri: sourceUri,
      imageWidth: message.imageWidth ?? 0,
      imageHeight: message.imageHeight ?? 0,
      imageFileSize: message.imageFileSize ?? 0,
      replyTo: message.replyTo ?? null,
    });
    return true;
  } catch {
    await MessageRepository.updateStatus(message.id, "failed").catch(
      () => {}
    );
    return false;
  }
}

let pendingImageSyncInFlight = false;

export async function syncPendingImageMessages(
  currentUser: AppUser,
  tenantId: string,
  isOnline = true
) {
  if (!isOnline) return;
  if (pendingImageSyncInFlight) return;
  pendingImageSyncInFlight = true;

  try {
    const messages = await MessageRepository.getPendingImageMessages();
    for (const message of messages) {
      if (message.senderId !== currentUser.id || message.type !== "image") {
        continue;
      }
      await uploadImageMessage(message.id, currentUser, tenantId);
    }
  } finally {
    pendingImageSyncInFlight = false;
  }
}

let pendingAudioSyncInFlight = false;

const AUDIO_CONTENT_TYPES: Record<string, string> = {
  aac: "audio/aac",
  m4a: "audio/mp4",
  mp3: "audio/mpeg",
  mp4: "audio/mp4",
  ogg: "audio/ogg",
  webm: "audio/webm",
};

function audioUploadOptions(localUri: string): {
  extension: string;
  contentType: string;
} {
  const extension =
    localUri.split("?")[0].split(".").pop()?.toLowerCase() ?? "m4a";
  const contentType = AUDIO_CONTENT_TYPES[extension];
  return contentType
    ? { extension, contentType }
    : { extension: "m4a", contentType: "audio/mp4" };
}

export type AudioUploadSource = {
  audio: Parameters<typeof uploadMessageAudio>[2];
  extension?: string;
  contentType?: string;
};

export async function uploadAudioMessage(
  messageId: string,
  currentUser: AppUser,
  tenantId: string,
  sourceOverride?: AudioUploadSource,
): Promise<string | null> {
  return runLockedSend(messageId, currentUser, undefined, () =>
    uploadLockedAudioMessage(messageId, currentUser, tenantId, sourceOverride),
  );
}

async function uploadLockedAudioMessage(
  messageId: string,
  currentUser: AppUser,
  tenantId: string,
  sourceOverride?: AudioUploadSource,
): Promise<string | null> {
  const message = await MessageRepository.getMessage(messageId);
  if (
    !message ||
    message.type !== "audio" ||
    message.senderId !== currentUser.id ||
    message.status === "sent" ||
    message.isDeleted
  ) {
    return null;
  }
  const localUri = message.audioLocalUri ?? null;
  let source: AudioUploadSource;
  if (sourceOverride) {
    source = sourceOverride;
  } else if (localUri) {
    const options = audioUploadOptions(localUri);
    source = {
      audio: {
        uri: localUri,
        name: `${message.id}.${options.extension}`,
        type: options.contentType,
      },
      ...options,
    };
  } else {
    return null;
  }

  try {
    if (message.status === "failed") {
      await MessageRepository.updateStatus(message.id, "loading");
    }
    await ensureAudioMessageRemote({
      chatId: message.chatId,
      messageId: message.id,
      audioUrl: null,
      audioDuration: message.audioDuration ?? null,
      replyTo: message.replyTo ?? null,
    });
    const uploaded = await uploadMessageAudio(
      message.chatId,
      message.id,
      source.audio,
      { extension: source.extension, contentType: source.contentType },
    );
    if (!uploaded.url) throw new Error("Audio upload returned no URL.");
    await MessageRepository.insertLocalMessage({
      id: message.id,
      conversationId: message.chatId,
      senderId: currentUser.id,
      body: uploaded.url,
      type: "audio",
      status: "sent",
      createdAt: message.timestamp,
      syncedAt: new Date(),
      localAudioUri: localUri,
      audioDuration: message.audioDuration ?? null,
      replyTo: message.replyTo ?? null,
    });
    return uploaded.url;
  } catch (error) {
    console.warn("Audio message upload failed", error);
    await MessageRepository.updateStatus(message.id, "failed").catch(
      () => {},
    );
    return null;
  }
}

/// Recording offline, or losing the upload halfway, used to leave the message failed with no
/// way back: only text and image had a resend queue.
export async function syncPendingAudioMessages(
  currentUser: AppUser,
  tenantId: string,
  isOnline = true,
) {
  if (!isOnline) return;
  if (pendingAudioSyncInFlight) return;
  pendingAudioSyncInFlight = true;

  try {
    const messages = await MessageRepository.getPendingAudioMessages();
    for (const message of messages) {
      if (message.senderId !== currentUser.id || message.type !== "audio") {
        continue;
      }
      if (!message.audioLocalUri) continue;
      await uploadAudioMessage(message.id, currentUser, tenantId);
    }
  } finally {
    pendingAudioSyncInFlight = false;
  }
}

export async function handlePendingOpFailure(
  messageId: string,
  error: unknown,
) {
  if (isRejectedByServer(error)) {
    await MessageRepository.abandonPendingOp(messageId);
    return;
  }
  const attempts = await MessageRepository.incrementEditAttempts(messageId);
  if (attempts >= MAX_PENDING_OP_ATTEMPTS) {
    await MessageRepository.abandonPendingOp(messageId);
  }
}

let pendingOpsSyncInFlight = false;
let pendingOpsRerunRequested = false;

export async function syncPendingOps(
  currentUser: AppUser,
  isOnline = true,
  deviceId?: string,
) {
  if (!isOnline) return;
  if (pendingOpsSyncInFlight) {
    pendingOpsRerunRequested = true;
    return;
  }
  pendingOpsSyncInFlight = true;

  try {
    do {
      pendingOpsRerunRequested = false;
      await syncPendingOpsOnce(currentUser, deviceId);
    } while (pendingOpsRerunRequested);
  } finally {
    pendingOpsSyncInFlight = false;
  }
}

async function syncPendingOpsOnce(currentUser: AppUser, deviceId?: string) {
  const messages = await MessageRepository.getPendingOps();
  for (const message of messages) {
    if (message.senderId !== currentUser.id) continue;
    try {
      if (message.pendingOp === "delete") {
        await softDeleteMessageRemote({
          chatId: message.chatId,
          messageId: message.id,
        });
        await MessageRepository.clearPendingOp(message.id);
      } else if (message.pendingOp === "update" && message.type === "text") {
        await prepareConversationKeyForEncryption(message.chatId, deviceId, {
          canCreate: currentUser.role === "adult",
        });
        await distributeConversationKeyForChat(message.chatId);
        const enc = await encryptMessageText(message.chatId, message.content);
        if (!enc) continue;
        await updateTextMessageRemote({
          chatId: message.chatId,
          messageId: message.id,
          ciphertext: enc.ciphertext,
          iv: enc.iv,
        });
        await MessageRepository.updateEncryptedPayload(message.id, {
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          encVersion: 1,
        });
        await MessageRepository.clearPendingOp(message.id);
      }
    } catch (error) {
      await handlePendingOpFailure(message.id, error).catch(() => {});
    }
  }
}

let pendingReactionsSyncInFlight = false;

export async function syncPendingReactions(
  currentUser: AppUser,
  isOnline = true
) {
  if (!isOnline) return;
  if (pendingReactionsSyncInFlight) return;
  pendingReactionsSyncInFlight = true;

  try {
    const pending = await ReactionRepository.getPendingReactions();
    for (const reaction of pending) {
      if (reaction.userId !== currentUser.id) continue;

      try {
        if (reaction.status === "removing") {
          await removeReaction(reaction.chatId, reaction.messageId);
          await ReactionRepository.deleteRemovedReaction(
            reaction.messageId,
            reaction.userId
          );
        } else {
          await upsertReaction(
            reaction.chatId,
            reaction.messageId,
            reaction.emoji
          );
          await ReactionRepository.confirmReactionSent(
            reaction.messageId,
            reaction.userId,
            reaction.emoji
          );
        }
      } catch (error) {
        // Leave pending for retry.
        if (isRejectedByServer(error)) {
          await ReactionRepository.discardPendingReaction(
            reaction.messageId,
            reaction.userId,
            reaction.chatId
          ).catch(() => {});
        }
      }
    }
  } finally {
    pendingReactionsSyncInFlight = false;
  }
}
