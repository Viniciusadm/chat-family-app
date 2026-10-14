import { useAuth } from "@/context/AuthContext";
import { useConnectivity } from "@/hooks/useConnectivity";
import { AudioCacheRepository } from "@/lib/AudioCacheRepository";
import { ChatRepository } from "@/lib/ChatRepository";
import { prepareConversationKeyForEncryption } from "@/lib/conversationKeyReadiness";
import { encryptMessageText } from "@/lib/encryptedMessages";
import { distributeConversationKeyForChat } from "@/lib/keyDistribution";
import {
  softDeleteMessageRemote,
  updateTextMessageRemote,
} from "@/lib/remoteMessages";
import { ImageCacheRepository } from "@/lib/ImageCacheRepository";
import { ImageGalleryRepository } from "@/lib/ImageGalleryRepository";
import { processImageForUpload } from "@/lib/ImageProcessor";
import { MessageRepository } from "@/lib/MessageRepository";
import {
  handlePendingOpFailure,
  sendTextMessage,
  syncPendingOps,
  uploadAudioMessage,
  uploadImageMessage,
} from "@/lib/offlineSync";
import {
  isMessageLocked,
  tryLockMessage,
  unlockMessage,
} from "@/lib/outboxLocks";
import { randomUuid } from "@/lib/randomUuid";
import type { Message, MessageReplySnapshot } from "@/types/chat";
import { useState } from "react";

export type SendableAudio =
  | { uri: string; name?: string; type?: string }
  | Blob
  | Uint8Array
  | ArrayBuffer;

export const EDIT_DELETE_WINDOW_MS = 60 * 60 * 1000;

type PendingCreateClaim = "claimed" | "in_flight" | "already_sent";

async function mutatePendingCreate(
  messageId: string,
  mutate: () => Promise<void>
): Promise<PendingCreateClaim> {
  if (!tryLockMessage(messageId)) return "in_flight";
  try {
    const latest = await MessageRepository.getMessage(messageId);
    if (!latest || latest.status === "sent") return "already_sent";
    await mutate();
    return "claimed";
  } finally {
    unlockMessage(messageId);
  }
}

export function useSendMessage(chatId: string) {
  const { currentUser, tenantId, deviceId } = useAuth();
  const { isOnline } = useConnectivity();
  const [isSending, setIsSending] = useState(false);

  const sendText = async (
    text: string,
    options?: { replyTo?: MessageReplySnapshot | null }
  ) => {
    const trimmed = text.trim();
    if (!currentUser || !tenantId || !trimmed) return;
    setIsSending(true);
    const messageId = randomUuid();
    const createdAt = new Date();
    try {
      await MessageRepository.insertLocalMessage({
        id: messageId,
        conversationId: chatId,
        senderId: currentUser.id,
        body: trimmed,
        type: "text",
        status: "loading",
        createdAt,
        replyTo: options?.replyTo ?? null,
      });
      await ChatRepository.updateLastMessage(chatId, {
        text: trimmed,
        type: "text",
        timestamp: createdAt,
      });
      if (!isOnline) return;
      await sendTextMessage(messageId, currentUser, tenantId, deviceId);
    } catch {
      // Keep the local message pending. The offline sync will retry it.
    } finally {
      setIsSending(false);
    }
  };

  const sendAudio = async (
    audio: SendableAudio,
    options?: {
      extension?: string;
      contentType?: string;
      duration?: number;
      localUri?: string | null;
      replyTo?: MessageReplySnapshot | null;
    }
  ) => {
    if (!currentUser || !tenantId) return;
    setIsSending(true);
    const messageId = randomUuid();
    const sentAt = new Date();
    try {
      await MessageRepository.insertLocalMessage({
        id: messageId,
        conversationId: chatId,
        senderId: currentUser.id,
        body: null,
        type: "audio",
        status: "loading",
        createdAt: sentAt,
        localAudioUri: options?.localUri ?? null,
        audioDuration: options?.duration ?? null,
        replyTo: options?.replyTo ?? null,
      });
      await ChatRepository.updateLastMessage(chatId, {
        text: null,
        type: "audio",
        timestamp: sentAt,
      });
      if (!isOnline) {
        await MessageRepository.updateStatus(messageId, "failed");
        return;
      }

      const audioUrl = await uploadAudioMessage(messageId, currentUser, tenantId, {
        audio,
        extension: options?.extension,
        contentType: options?.contentType,
      });
      if (!audioUrl) return;
      void AudioCacheRepository.downloadMessageAudio({
        chatId,
        messageId,
        remoteUrl: audioUrl,
      });
    } catch (error) {
      console.warn("Audio message upload failed", error);
      await MessageRepository.updateStatus(messageId, "failed").catch(() => {});
    } finally {
      setIsSending(false);
    }
  };

  const sendImage = async (
    source: { uri: string; width: number; height: number },
    options?: { replyTo?: MessageReplySnapshot | null }
  ) => {
    if (!currentUser || !tenantId) return;
    setIsSending(true);
    const messageId = randomUuid();
    const createdAt = new Date();

    try {
      const processed = await processImageForUpload(
        source.uri,
        source.width,
        source.height
      );

      const localUri = await ImageCacheRepository.copyLocalSource({
        chatId,
        messageId,
        sourceUri: processed.uri,
      });

      await MessageRepository.insertLocalMessage({
        id: messageId,
        conversationId: chatId,
        senderId: currentUser.id,
        body: null,
        type: "image",
        status: "loading",
        createdAt,
        localImageUri: localUri,
        imageWidth: processed.width,
        imageHeight: processed.height,
        imageFileSize: processed.fileSize,
        imagePendingSourceUri: localUri ?? processed.uri,
        replyTo: options?.replyTo ?? null,
      });

      await ChatRepository.updateLastMessage(chatId, {
        text: null,
        type: "image",
        timestamp: createdAt,
      });

      if (localUri) {
        void ImageGalleryRepository.saveToGallery({
          messageId,
          fileUri: localUri,
        });
      }

      if (!isOnline) return;

      await uploadImageMessage(messageId, currentUser, tenantId, processed.uri);
    } catch {
      await MessageRepository.updateStatus(messageId, "failed").catch(() => {});
    } finally {
      setIsSending(false);
    }
  };

  const retryAudioMessage = async (message: Message) => {
    if (!currentUser || !tenantId || !isOnline) return;
    if (message.type !== "audio") return;
    if (!message.audioLocalUri) return;
    await uploadAudioMessage(message.id, currentUser, tenantId);
  };

  const retryImageMessage = async (message: Message) => {
    if (!currentUser || !tenantId || !isOnline) return;
    if (message.type !== "image") return;
    const sourceUri = message.imagePendingSourceUri ?? message.imageLocalUri;
    if (!sourceUri) return;
    await uploadImageMessage(message.id, currentUser, tenantId);
  };

  const retryTextMessage = async (message: Message) => {
    if (!currentUser || !tenantId || !isOnline) return;
    if (message.type !== "text" || message.status !== "failed") return;
    await sendTextMessage(message.id, currentUser, tenantId, deviceId);
  };

  const flushOpRecordedDuringCreate = (messageId: string) => {
    if (!currentUser || !isOnline || isMessageLocked(messageId)) return;
    void syncPendingOps(currentUser, isOnline, deviceId);
  };

  const canModifyMessage = (message: Message): boolean => {
    if (!currentUser) return false;
    if (message.senderId !== currentUser.id) return false;
    if (message.isDeleted) return false;
    const ageMs = Date.now() - message.timestamp.getTime();
    return ageMs <= EDIT_DELETE_WINDOW_MS;
  };

  const editTextMessage = async (
    message: Message,
    newText: string
  ): Promise<boolean> => {
    if (!currentUser || !tenantId) return false;
    if (!canModifyMessage(message)) return false;
    if (message.type !== "text") return false;
    const trimmed = newText.trim();
    if (!trimmed || trimmed === message.content) return false;

    let createInFlight = false;
    if (message.status !== "sent") {
      const claim = await mutatePendingCreate(message.id, () =>
        MessageRepository.overwritePendingCreateBody(message.id, trimmed)
      );
      if (claim === "claimed") {
        if (isOnline) {
          void sendTextMessage(message.id, currentUser, tenantId, deviceId);
        }
        return true;
      }
      createInFlight = claim === "in_flight";
    }

    const editedAt = new Date();
    await MessageRepository.markAsEdited(message.id, {
      newBody: trimmed,
      editedAt,
      pendingOp: "update",
      preserveOriginal: !message.isEdited,
    });

    if (createInFlight) {
      flushOpRecordedDuringCreate(message.id);
      return true;
    }
    if (!isOnline) return true;
    try {
      await prepareConversationKeyForEncryption(message.chatId, deviceId, {
        canCreate: currentUser.role === "adult",
      });
      await distributeConversationKeyForChat(message.chatId);
      const enc = await encryptMessageText(message.chatId, trimmed);
      if (!enc) return true;
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
    } catch (error) {
      await handlePendingOpFailure(message.id, error).catch(() => {});
    }
    return true;
  };

  const deleteMessage = async (message: Message): Promise<boolean> => {
    if (!currentUser) return false;
    if (!canModifyMessage(message)) return false;

    const deletedAt = new Date();

    let createInFlight = false;
    if (message.status !== "sent") {
      const claim = await mutatePendingCreate(message.id, async () => {
        await MessageRepository.markAsDeleted(message.id, {
          deletedAt,
          pendingOp: null,
        });
        await MessageRepository.cancelPendingCreate(message.id);
      });
      if (claim === "claimed") return true;
      createInFlight = claim === "in_flight";
    }

    await MessageRepository.markAsDeleted(message.id, {
      deletedAt,
      pendingOp: "delete",
    });

    if (createInFlight) {
      flushOpRecordedDuringCreate(message.id);
      return true;
    }
    if (!isOnline) return true;
    try {
      await softDeleteMessageRemote({
        chatId: message.chatId,
        messageId: message.id,
      });
      await MessageRepository.clearPendingOp(message.id);
    } catch (error) {
      await handlePendingOpFailure(message.id, error).catch(() => {});
    }
    return true;
  };

  return {
    sendText,
    sendAudio,
    sendImage,
    retryAudioMessage,
    retryImageMessage,
    retryTextMessage,
    editTextMessage,
    deleteMessage,
    canModifyMessage,
    isSending,
  };
}
