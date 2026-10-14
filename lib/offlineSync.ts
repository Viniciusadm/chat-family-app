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
import { ReactionRepository } from "@/lib/ReactionRepository";
import { listMessages, upsertReaction, type MessageDto } from "@/src/api/chats";
import { uploadMessageAudio } from "@/src/api/media";
import type { AppUser } from "@/types/chat";

const MESSAGE_PAGE_SIZE = 100;
const inFlightHistorySyncs = new Set<string>();
let pendingSyncInFlight = false;

export async function applyRemoteMessages(chatId: string, rows: MessageDto[]) {
  for (const data of rows) {
    await MessageRepository.upsertRemoteMessage(chatId, data.id, data, {
      notify: false,
    });
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

export async function syncChatHistory(
  chatId: string,
  isOnline = true,
  deviceId?: string,
) {
  if (!isOnline) return;
  if (inFlightHistorySyncs.has(chatId)) return;
  inFlightHistorySyncs.add(chatId);

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
  } finally {
    inFlightHistorySyncs.delete(chatId);
  }
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

      try {
        await prepareConversationKeyForEncryption(message.chatId, deviceId, {
          canCreate: currentUser.role === "adult",
        });
        await distributeConversationKeyForChat(message.chatId);
        const enc = await encryptMessageText(message.chatId, message.content);
        if (!enc) continue;
        await ensureTextMessageRemote({
          chatId: message.chatId,
          messageId: message.id,
          tenantId,
          senderId: currentUser.id,
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
      } catch {
        // Leave the row pending for the next online pass.
      }
    }
  } finally {
    pendingSyncInFlight = false;
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
      const sourceUri =
        message.imagePendingSourceUri ?? message.imageLocalUri ?? null;
      if (!sourceUri) continue;

      try {
        if (message.status === "failed") {
          await MessageRepository.updateStatus(message.id, "loading");
        }
        await uploadAndPersistImage({
          chatId: message.chatId,
          messageId: message.id,
          tenantId,
          senderId: currentUser.id,
          imageUri: sourceUri,
          imageWidth: message.imageWidth ?? 0,
          imageHeight: message.imageHeight ?? 0,
          imageFileSize: message.imageFileSize ?? 0,
          replyTo: message.replyTo ?? null,
        });
      } catch {
        await MessageRepository.updateStatus(message.id, "failed").catch(
          () => {}
        );
      }
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
      const localUri = message.audioLocalUri;
      if (!localUri) continue;

      try {
        await MessageRepository.updateStatus(message.id, "loading");
        await ensureAudioMessageRemote({
          chatId: message.chatId,
          messageId: message.id,
          tenantId,
          senderId: currentUser.id,
          audioUrl: null,
          audioDuration: message.audioDuration ?? null,
          replyTo: message.replyTo ?? null,
        });
        const options = audioUploadOptions(localUri);
        const uploaded = await uploadMessageAudio(
          message.chatId,
          message.id,
          { uri: localUri, name: `${message.id}.${options.extension}`, type: options.contentType },
          options,
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
      } catch {
        await MessageRepository.updateStatus(message.id, "failed").catch(
          () => {},
        );
      }
    }
  } finally {
    pendingAudioSyncInFlight = false;
  }
}

let pendingOpsSyncInFlight = false;

export async function syncPendingOps(
  currentUser: AppUser,
  isOnline = true,
  deviceId?: string,
) {
  if (!isOnline) return;
  if (pendingOpsSyncInFlight) return;
  pendingOpsSyncInFlight = true;

  try {
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
      } catch {
        await MessageRepository.incrementEditAttempts(message.id).catch(
          () => {}
        );
      }
    }
  } finally {
    pendingOpsSyncInFlight = false;
  }
}

export async function syncPendingReactions(
  currentUser: AppUser,
  isOnline = true
) {
  if (!isOnline) return;

  const pending = await ReactionRepository.getPendingReactions();
  for (const reaction of pending) {
    if (reaction.userId !== currentUser.id) continue;

    try {
      await upsertReaction(reaction.chatId, reaction.messageId, reaction.emoji);
      await ReactionRepository.updateStatus(reaction.messageId, reaction.userId, "sent");
    } catch {
      // Leave pending for retry.
    }
  }
}
