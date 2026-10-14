import { replyPreviewForType } from "@/lib/messageReply";
import type {
  Message,
  MessagePendingOp,
  MessageReplySnapshot,
  MessageReplyType,
  MessageStatus,
  MessageType,
} from "@/types/chat";

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  type: string;
  status: string;
  created_at: string;
  synced_at: string | null;
  local_audio_uri: string | null;
  audio_downloaded_at: string | null;
  audio_duration: number | null;
  reply_to_message_id: string | null;
  reply_to_sender_id: string | null;
  reply_to_sender_name: string | null;
  reply_to_type: string | null;
  reply_to_preview: string | null;
  image_remote_url: string | null;
  local_image_uri: string | null;
  image_width: number | null;
  image_height: number | null;
  image_file_size: number | null;
  image_pending_source_uri: string | null;
  image_downloaded_at: string | null;
  is_edited: number | null;
  edited_at: string | null;
  is_deleted: number | null;
  deleted_at: string | null;
  pending_op: string | null;
  original_body: string | null;
  updated_at: string | null;
  edit_attempts: number | null;
  ciphertext: string | null;
  iv: string | null;
  enc_version: number | null;
  quoted_body?: string | null;
  quoted_is_deleted?: number | null;
};

export function normalizeReplyType(type: string | null | undefined): MessageReplyType {
  if (type === "audio" || type === "image") return type;
  return "text";
}

function rowReplyPreview(row: MessageRow, type: MessageReplyType): string {
  if (row.quoted_is_deleted) return "Mensagem apagada";
  if (row.quoted_body != null) return replyPreviewForType(type, row.quoted_body);
  return row.reply_to_preview || replyPreviewForType(type, "");
}

export function rowReplyTo(row: MessageRow): MessageReplySnapshot | undefined {
  if (!row.reply_to_message_id) return undefined;

  const type = normalizeReplyType(row.reply_to_type);
  return {
    id: row.reply_to_message_id,
    senderId: row.reply_to_sender_id ?? "",
    senderName: row.reply_to_sender_name ?? "Participante",
    type,
    preview: rowReplyPreview(row, type),
  };
}

export function rowToMessage(row: MessageRow): Message {
  const type: MessageType =
    row.type === "audio" ? "audio" : row.type === "image" ? "image" : "text";
  const timestamp = new Date(row.created_at);
  const isDeleted = row.is_deleted === 1;
  const isEdited = row.is_edited === 1;
  const decryptionFailed =
    type === "text" && row.status === "sent" && row.body == null && !isDeleted;
  const status: MessageStatus =
    row.status === "loading"
      ? "loading"
      : row.status === "failed"
        ? "failed"
        : "sent";
  const pendingOp: MessagePendingOp | null =
    row.pending_op === "update" || row.pending_op === "delete"
      ? row.pending_op
      : null;

  return {
    id: row.id,
    chatId: row.conversation_id,
    senderId: row.sender_id,
    type,
    content: type === "text" ? row.body ?? "" : "",
    audioUrl:
      type === "audio" ? row.local_audio_uri ?? row.body ?? undefined : undefined,
    audioRemoteUrl: type === "audio" ? row.body ?? undefined : undefined,
    audioLocalUri: type === "audio" ? row.local_audio_uri ?? undefined : undefined,
    audioDuration:
      type === "audio" && typeof row.audio_duration === "number"
        ? row.audio_duration
        : undefined,
    imageUrl:
      type === "image"
        ? row.local_image_uri ??
          row.image_remote_url ??
          row.image_pending_source_uri ??
          undefined
        : undefined,
    imageRemoteUrl:
      type === "image" ? row.image_remote_url ?? undefined : undefined,
    imageLocalUri:
      type === "image" ? row.local_image_uri ?? undefined : undefined,
    imageWidth:
      type === "image" && typeof row.image_width === "number"
        ? row.image_width
        : undefined,
    imageHeight:
      type === "image" && typeof row.image_height === "number"
        ? row.image_height
        : undefined,
    imageFileSize:
      type === "image" && typeof row.image_file_size === "number"
        ? row.image_file_size
        : undefined,
    imagePendingSourceUri:
      type === "image" ? row.image_pending_source_uri ?? undefined : undefined,
    timestamp,
    createdAtMs: timestamp.getTime(),
    status,
    replyTo: rowReplyTo(row),
    decryptionFailed: decryptionFailed || undefined,
    isEdited: isEdited || undefined,
    editedAt: row.edited_at ? new Date(row.edited_at) : null,
    isDeleted: isDeleted || undefined,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    pendingOp,
  };
}
