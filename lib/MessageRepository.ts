import { decryptIncomingMessage } from "@/lib/encryptedMessages";
import { getDatabase, withExclusiveWrite } from "@/lib/db";
import { rowToMessage, type MessageRow } from "@/lib/messageRows";
import type { MessageDto } from "@/src/api/chats";
import type {
  Message,
  MessagePendingOp,
  MessageReplySnapshot,
  MessageStatus,
  MessageType,
} from "@/types/chat";

type MessageSyncRow = {
  history_synced_at: string | null;
  newest_message_at: string | null;
  changed_at: string | null;
};

export type LocalMessageInput = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  type: MessageType;
  status: MessageStatus;
  createdAt: Date;
  syncedAt?: Date | null;
  localAudioUri?: string | null;
  audioDownloadedAt?: Date | null;
  audioDuration?: number | null;
  replyTo?: MessageReplySnapshot | null;
  imageRemoteUrl?: string | null;
  localImageUri?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageFileSize?: number | null;
  imagePendingSourceUri?: string | null;
  imageDownloadedAt?: Date | null;
  isEdited?: boolean;
  editedAt?: Date | null;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  ciphertext?: string | null;
  iv?: string | null;
  encVersion?: number | null;
};

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
const allListeners = new Set<Listener>();

function emit(conversationId: string) {
  listeners.get(conversationId)?.forEach((listener) => listener());
  allListeners.forEach((listener) => listener());
}

async function updateAndEmit(
  messageId: string,
  sql: string,
  params: (string | number | null)[]
) {
  let conversationId: string | undefined;
  await withExclusiveWrite(async (tx) => {
    const existing = await tx.getFirstAsync<Pick<MessageRow, "conversation_id">>(
      "SELECT conversation_id FROM messages WHERE id = ?",
      [messageId]
    );
    if (!existing) return;
    conversationId = existing.conversation_id;
    await tx.runAsync(sql, params);
  });
  if (conversationId) emit(conversationId);
}

function inputParams(message: LocalMessageInput) {
  return {
    $id: message.id,
    $conversationId: message.conversationId,
    $senderId: message.senderId,
    $body: message.body,
    $type: message.type,
    $status: message.status,
    $createdAt: message.createdAt.toISOString(),
    $syncedAt: message.syncedAt ? message.syncedAt.toISOString() : null,
    $localAudioUri: message.localAudioUri ?? null,
    $audioDownloadedAt: message.audioDownloadedAt
      ? message.audioDownloadedAt.toISOString()
      : null,
    $audioDuration: message.audioDuration ?? null,
    $replyToMessageId: message.replyTo?.id ?? null,
    $replyToSenderId: message.replyTo?.senderId ?? null,
    $replyToSenderName: message.replyTo?.senderName ?? null,
    $replyToType: message.replyTo?.type ?? null,
    $replyToPreview: message.replyTo?.preview || null,
    $imageRemoteUrl: message.imageRemoteUrl ?? null,
    $localImageUri: message.localImageUri ?? null,
    $imageWidth: message.imageWidth ?? null,
    $imageHeight: message.imageHeight ?? null,
    $imageFileSize: message.imageFileSize ?? null,
    $imagePendingSourceUri: message.imagePendingSourceUri ?? null,
    $imageDownloadedAt: message.imageDownloadedAt
      ? message.imageDownloadedAt.toISOString()
      : null,
    $isEdited: message.isEdited ? 1 : 0,
    $editedAt: message.editedAt ? message.editedAt.toISOString() : null,
    $isDeleted: message.isDeleted ? 1 : 0,
    $deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
    $ciphertext: message.ciphertext ?? null,
    $iv: message.iv ?? null,
    $encVersion: message.encVersion ?? null,
  };
}

async function remoteMessageToInput(
  conversationId: string,
  id: string,
  data: MessageDto
): Promise<LocalMessageInput> {
  const isAudio = data.type === "audio";
  const isImage = data.type === "image";
  const createdAt = data.created_at ? new Date(data.created_at) : new Date();
  const isDeleted = data.is_deleted === true;
  const editedAt = data.edited_at ? new Date(data.edited_at) : null;
  const deletedAt = data.deleted_at ? new Date(data.deleted_at) : null;

  let body: string | null;
  let type: MessageType;
  let status: MessageStatus = "sent";
  if (isAudio) {
    body = data.audio_url ?? null;
    type = "audio";
    if (!data.audio_url && !isDeleted) {
      status = "failed";
    }
  } else if (isImage) {
    body = null;
    type = "image";
  } else if (data.ciphertext && data.iv) {
    body = await decryptIncomingMessage(conversationId, data);
    type = "text";
  } else {
    body = null;
    type = "text";
  }

  return {
    id,
    conversationId,
    senderId: data.sender_member_id,
    type,
    body,
    status,
    createdAt,
    syncedAt: new Date(),
    audioDuration: isAudio ? data.audio_duration ?? null : null,
    imageRemoteUrl: isImage ? data.image_url ?? null : null,
    imageWidth: isImage ? data.image_width ?? null : null,
    imageHeight: isImage ? data.image_height ?? null : null,
    imageFileSize: isImage ? data.image_file_size ?? null : null,
    replyTo: data.reply_to_message_id
      ? {
          id: data.reply_to_message_id,
          senderId: data.reply_to_sender_id ?? "",
          senderName: data.reply_to_sender_name ?? "Participante",
          type:
            data.reply_to_type === "audio" || data.reply_to_type === "image"
              ? data.reply_to_type
              : "text",
          preview: "",
        }
      : null,
    isEdited: editedAt != null,
    editedAt,
    isDeleted,
    deletedAt,
    ciphertext: data.ciphertext ?? null,
    iv: data.iv ?? null,
    encVersion: data.enc_version ?? null,
  };
}

const UPSERT_MESSAGE_SQL = `INSERT INTO messages (
    id,
    conversation_id,
    sender_id,
    body,
    type,
    status,
    created_at,
    synced_at,
    local_audio_uri,
    audio_downloaded_at,
    audio_duration,
    reply_to_message_id,
    reply_to_sender_id,
    reply_to_sender_name,
    reply_to_type,
    reply_to_preview,
    image_remote_url,
    local_image_uri,
    image_width,
    image_height,
    image_file_size,
    image_pending_source_uri,
    image_downloaded_at,
    is_edited,
    edited_at,
    is_deleted,
    deleted_at,
    ciphertext,
    iv,
    enc_version
  ) VALUES (
    $id,
    $conversationId,
    $senderId,
    $body,
    $type,
    $status,
    $createdAt,
    $syncedAt,
    $localAudioUri,
    $audioDownloadedAt,
    $audioDuration,
    $replyToMessageId,
    $replyToSenderId,
    $replyToSenderName,
    $replyToType,
    $replyToPreview,
    $imageRemoteUrl,
    $localImageUri,
    $imageWidth,
    $imageHeight,
    $imageFileSize,
    $imagePendingSourceUri,
    $imageDownloadedAt,
    $isEdited,
    $editedAt,
    $isDeleted,
    $deletedAt,
    $ciphertext,
    $iv,
    $encVersion
  )
  ON CONFLICT(id) DO UPDATE SET
    conversation_id = excluded.conversation_id,
    sender_id = excluded.sender_id,
    body = CASE
      WHEN messages.pending_op IS NOT NULL THEN messages.body
      WHEN excluded.body IS NULL AND messages.body IS NOT NULL THEN messages.body
      ELSE excluded.body
    END,
    type = excluded.type,
    status = CASE
      WHEN messages.status = 'loading' AND excluded.status = 'sent'
        THEN 'sent'
      WHEN messages.status = 'loading'
        THEN messages.status
      ELSE excluded.status
    END,
    created_at = excluded.created_at,
    synced_at = COALESCE(excluded.synced_at, messages.synced_at),
    is_edited = CASE
      WHEN messages.pending_op IS NOT NULL THEN messages.is_edited
      ELSE excluded.is_edited
    END,
    edited_at = CASE
      WHEN messages.pending_op IS NOT NULL THEN messages.edited_at
      ELSE COALESCE(excluded.edited_at, messages.edited_at)
    END,
    is_deleted = CASE
      WHEN messages.pending_op IS NOT NULL THEN messages.is_deleted
      ELSE excluded.is_deleted
    END,
    deleted_at = CASE
      WHEN messages.pending_op IS NOT NULL THEN messages.deleted_at
      ELSE COALESCE(excluded.deleted_at, messages.deleted_at)
    END,
    local_audio_uri = COALESCE(excluded.local_audio_uri, messages.local_audio_uri),
    audio_downloaded_at = COALESCE(
      excluded.audio_downloaded_at,
      messages.audio_downloaded_at
    ),
    audio_duration = COALESCE(excluded.audio_duration, messages.audio_duration),
    reply_to_message_id = COALESCE(
      excluded.reply_to_message_id,
      messages.reply_to_message_id
    ),
    reply_to_sender_id = COALESCE(
      excluded.reply_to_sender_id,
      messages.reply_to_sender_id
    ),
    reply_to_sender_name = COALESCE(
      excluded.reply_to_sender_name,
      messages.reply_to_sender_name
    ),
    reply_to_type = COALESCE(excluded.reply_to_type, messages.reply_to_type),
    reply_to_preview = COALESCE(
      excluded.reply_to_preview,
      messages.reply_to_preview
    ),
    image_remote_url = COALESCE(
      excluded.image_remote_url,
      messages.image_remote_url
    ),
    local_image_uri = COALESCE(
      excluded.local_image_uri,
      messages.local_image_uri
    ),
    image_width = COALESCE(excluded.image_width, messages.image_width),
    image_height = COALESCE(excluded.image_height, messages.image_height),
    image_file_size = COALESCE(
      excluded.image_file_size,
      messages.image_file_size
    ),
    image_pending_source_uri = COALESCE(
      excluded.image_pending_source_uri,
      messages.image_pending_source_uri
    ),
    image_downloaded_at = COALESCE(
      excluded.image_downloaded_at,
      messages.image_downloaded_at
    ),
    ciphertext = COALESCE(excluded.ciphertext, messages.ciphertext),
    iv = COALESCE(excluded.iv, messages.iv),
    enc_version = COALESCE(excluded.enc_version, messages.enc_version)`;

export const MessageRepository = {
  emit(conversationId: string) {
    emit(conversationId);
  },

  subscribe(conversationId: string, listener: Listener) {
    const set = listeners.get(conversationId) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(conversationId, set);

    return () => {
      set.delete(listener);
      if (set.size === 0) {
        listeners.delete(conversationId);
      }
    };
  },

  subscribeAll(listener: Listener) {
    allListeners.add(listener);
    return () => {
      allListeners.delete(listener);
    };
  },

  async getAllTextMessages(tenantId: string, memberId: string): Promise<
    {
      id: string;
      chatId: string;
      senderId: string;
      content: string;
      createdAtMs: number;
    }[]
  > {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{
      id: string;
      conversation_id: string;
      sender_id: string;
      body: string;
      created_at: string;
    }>(
      `SELECT m.id, m.conversation_id, m.sender_id, m.body, m.created_at
       FROM messages m
       INNER JOIN chats c ON c.id = m.conversation_id
       WHERE c.tenant_id = ?
         AND instr(c.participants, ?) > 0
         AND m.type = 'text'
         AND m.body IS NOT NULL
         AND m.body <> ''
         AND COALESCE(m.is_deleted, 0) = 0
       ORDER BY m.created_at DESC`,
      [tenantId, JSON.stringify(memberId)]
    );
    return rows.map((row) => ({
      id: row.id,
      chatId: row.conversation_id,
      senderId: row.sender_id,
      content: row.body,
      createdAtMs: new Date(row.created_at).getTime(),
    }));
  },

  async getLocalMessages(
    conversationId: string,
    window: { since?: string | null; limit?: number } = {}
  ): Promise<Message[]> {
    const db = await getDatabase();
    const select = `SELECT m.*,
              quoted.body AS quoted_body,
              quoted.is_deleted AS quoted_is_deleted
       FROM messages m
       LEFT JOIN messages quoted ON quoted.id = m.reply_to_message_id
       WHERE m.conversation_id = ?`;
    let rows: MessageRow[];
    if (window.since) {
      rows = await db.getAllAsync<MessageRow>(
        `${select}
         AND m.created_at >= ?
         ORDER BY m.created_at ASC`,
        [conversationId, window.since]
      );
    } else if (window.limit != null) {
      rows = await db.getAllAsync<MessageRow>(
        `SELECT * FROM (
           ${select}
           ORDER BY m.created_at DESC
           LIMIT ?
         )
         ORDER BY created_at ASC`,
        [conversationId, window.limit]
      );
    } else {
      rows = await db.getAllAsync<MessageRow>(
        `${select}
         ORDER BY m.created_at ASC`,
        [conversationId]
      );
    }

    return rows.map(rowToMessage);
  },

  async hasLocalMessagesBefore(
    conversationId: string,
    createdAt: string
  ): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ found: number }>(
      `SELECT 1 AS found
       FROM messages
       WHERE conversation_id = ? AND created_at < ?
       LIMIT 1`,
      [conversationId, createdAt]
    );
    return row != null;
  },

  async getOlderWindowStart(
    conversationId: string,
    before: string,
    count: number
  ): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ created_at: string | null }>(
      `SELECT MIN(created_at) AS created_at
       FROM (
         SELECT created_at
         FROM messages
         WHERE conversation_id = ? AND created_at < ?
         ORDER BY created_at DESC
         LIMIT ?
       )`,
      [conversationId, before, count]
    );
    return row?.created_at ?? null;
  },

  async getOldestLocalMessageCreatedAt(conversationId: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ created_at: string | null }>(
      `SELECT MIN(created_at) AS created_at
       FROM messages
       WHERE conversation_id = ?`,
      [conversationId]
    );
    return row?.created_at ?? null;
  },

  async getMessageCreatedAt(
    conversationId: string,
    id: string
  ): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Pick<MessageRow, "created_at">>(
      "SELECT created_at FROM messages WHERE id = ? AND conversation_id = ?",
      [id, conversationId]
    );
    return row?.created_at ?? null;
  },

  async insertLocalMessage(
    message: LocalMessageInput,
    options: { notify?: boolean } = {}
  ) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(UPSERT_MESSAGE_SQL, inputParams(message));
    });
    if (options.notify !== false) {
      emit(message.conversationId);
    }
  },

  async insertLocalMessages(
    conversationId: string,
    messages: LocalMessageInput[],
    options: { notify?: boolean } = {}
  ) {
    if (messages.length === 0) return;
    await withExclusiveWrite(async (tx) => {
      const statement = await tx.prepareAsync(UPSERT_MESSAGE_SQL);
      try {
        for (const message of messages) {
          await statement.executeAsync(inputParams(message));
        }
      } finally {
        await statement.finalizeAsync();
      }
    });
    if (options.notify !== false) {
      emit(conversationId);
    }
  },

  async updateStatus(id: string, status: MessageStatus) {
    await updateAndEmit(
      id,
      `UPDATE messages
       SET status = ?, synced_at = ?
       WHERE id = ?`,
      [status, status === "sent" ? new Date().toISOString() : null, id]
    );
  },

  async updateEncryptedPayload(
    id: string,
    payload: { ciphertext: string; iv: string; encVersion: number }
  ) {
    await updateAndEmit(
      id,
      `UPDATE messages
       SET ciphertext = ?, iv = ?, enc_version = ?
       WHERE id = ?`,
      [payload.ciphertext, payload.iv, payload.encVersion, id]
    );
  },

  async decryptStoredMessages(conversationId: string): Promise<number> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<
      Pick<MessageRow, "id" | "ciphertext" | "iv" | "enc_version">
    >(
      `SELECT id, ciphertext, iv, enc_version
       FROM messages
       WHERE conversation_id = ?
         AND type = 'text'
         AND body IS NULL
         AND ciphertext IS NOT NULL
         AND iv IS NOT NULL
         AND COALESCE(is_deleted, 0) = 0`,
      [conversationId]
    );
    const decrypted: { id: string; body: string }[] = [];
    for (const row of rows) {
      const body = await decryptIncomingMessage(conversationId, {
        ciphertext: row.ciphertext,
        iv: row.iv,
      });
      if (body != null) decrypted.push({ id: row.id, body });
    }
    if (decrypted.length === 0) return 0;
    await withExclusiveWrite(async (tx) => {
      const statement = await tx.prepareAsync(
        `UPDATE messages
         SET body = ?
         WHERE id = ? AND body IS NULL`
      );
      try {
        for (const item of decrypted) {
          await statement.executeAsync([item.body, item.id]);
        }
      } finally {
        await statement.finalizeAsync();
      }
    });
    emit(conversationId);
    return decrypted.length;
  },

  async countUndecryptedTextMessages(conversationId: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM messages
       WHERE conversation_id = ?
         AND type = 'text'
         AND body IS NULL
         AND ciphertext IS NOT NULL
         AND iv IS NOT NULL
         AND COALESCE(is_deleted, 0) = 0`,
      [conversationId]
    );
    return row?.count ?? 0;
  },

  async updateLocalAudioUri(id: string, localAudioUri: string) {
    await updateAndEmit(
      id,
      `UPDATE messages
       SET local_audio_uri = ?, audio_downloaded_at = ?
       WHERE id = ?`,
      [localAudioUri, new Date().toISOString(), id]
    );
  },

  async clearLocalAudioUri(id: string) {
    await updateAndEmit(
      id,
      `UPDATE messages
       SET local_audio_uri = NULL, audio_downloaded_at = NULL
       WHERE id = ?`,
      [id]
    );
  },

  async updateLocalImageUri(
    id: string,
    localUri: string
  ) {
    await updateAndEmit(
      id,
      `UPDATE messages
       SET local_image_uri = ?, image_downloaded_at = ?
       WHERE id = ?`,
      [localUri, new Date().toISOString(), id]
    );
  },

  async updateImageRemoteUrls(
    id: string,
    urls: { remote: string }
  ) {
    await updateAndEmit(
      id,
      `UPDATE messages
       SET image_remote_url = ?
       WHERE id = ?`,
      [urls.remote, id]
    );
  },

  async getPendingImageMessages(): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<MessageRow>(
      `SELECT *
       FROM messages
       WHERE status IN ('loading', 'failed')
         AND type = 'image'
       ORDER BY created_at ASC`
    );
    return rows.map(rowToMessage);
  },

  // An audio message is only resendable while its recording is still on disk, which is what
  // local_audio_uri points at until the upload succeeds.
  async getPendingAudioMessages(): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<MessageRow>(
      `SELECT *
       FROM messages
       WHERE status IN ('loading', 'failed')
         AND type = 'audio'
         AND local_audio_uri IS NOT NULL
         AND COALESCE(is_deleted, 0) = 0
       ORDER BY created_at ASC`
    );
    return rows.map(rowToMessage);
  },

  async upsertRemoteMessage(
    conversationId: string,
    id: string,
    data: MessageDto,
    options: { notify?: boolean } = {}
  ) {
    await this.insertLocalMessage(
      await remoteMessageToInput(conversationId, id, data),
      options
    );
  },

  async upsertRemoteMessages(
    conversationId: string,
    rows: MessageDto[],
    options: { notify?: boolean } = {}
  ) {
    const inputs: LocalMessageInput[] = [];
    for (const data of rows) {
      inputs.push(await remoteMessageToInput(conversationId, data.id, data));
    }
    await this.insertLocalMessages(conversationId, inputs, options);
  },

  async getMessage(id: string): Promise<Message | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<MessageRow>(
      "SELECT * FROM messages WHERE id = ?",
      [id]
    );
    return row ? rowToMessage(row) : null;
  },

  async getPendingTextMessages(): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<MessageRow>(
      `SELECT *
       FROM messages
       WHERE status IN ('loading', 'failed')
         AND type = 'text'
         AND COALESCE(is_deleted, 0) = 0
       ORDER BY created_at ASC`
    );

    return rows.map(rowToMessage);
  },

  async getPendingOps(): Promise<Message[]> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<MessageRow>(
      `SELECT *
       FROM messages
       WHERE pending_op IN ('update', 'delete')
         AND status = 'sent'
       ORDER BY COALESCE(updated_at, created_at) ASC`
    );

    return rows.map(rowToMessage);
  },

  async markAsEdited(
    id: string,
    options: {
      newBody: string;
      editedAt: Date;
      pendingOp: MessagePendingOp | null;
      preserveOriginal: boolean;
    }
  ) {
    let conversationId: string | undefined;
    await withExclusiveWrite(async (tx) => {
      const existing = await tx.getFirstAsync<
        Pick<MessageRow, "conversation_id" | "body" | "original_body">
      >(
        "SELECT conversation_id, body, original_body FROM messages WHERE id = ?",
        [id]
      );
      if (!existing) return;
      conversationId = existing.conversation_id;
      const original = options.preserveOriginal
        ? existing.original_body ?? existing.body
        : existing.original_body;
      const editedAtIso = options.editedAt.toISOString();
      await tx.runAsync(
        `UPDATE messages
         SET body = ?,
             original_body = ?,
             is_edited = 1,
             edited_at = ?,
             pending_op = ?,
             edit_attempts = 0,
             updated_at = ?
         WHERE id = ?`,
        [
          options.newBody,
          original ?? null,
          editedAtIso,
          options.pendingOp,
          editedAtIso,
          id,
        ]
      );
    });
    if (conversationId) emit(conversationId);
  },

  async overwritePendingCreateBody(id: string, newBody: string) {
    await updateAndEmit(
      id,
      `UPDATE messages
       SET body = ?, updated_at = ?
       WHERE id = ?`,
      [newBody, new Date().toISOString(), id]
    );
  },

  async markAsDeleted(
    id: string,
    options: { deletedAt: Date; pendingOp: MessagePendingOp | null }
  ) {
    const deletedAtIso = options.deletedAt.toISOString();
    await updateAndEmit(
      id,
      `UPDATE messages
       SET is_deleted = 1,
           deleted_at = ?,
           pending_op = ?,
           edit_attempts = 0,
           updated_at = ?
       WHERE id = ?`,
      [deletedAtIso, options.pendingOp, deletedAtIso, id]
    );
  },

  async cancelPendingCreate(id: string) {
    const now = new Date().toISOString();
    await updateAndEmit(
      id,
      `UPDATE messages
       SET status = 'sent',
           synced_at = ?,
           pending_op = NULL,
           updated_at = ?
       WHERE id = ?`,
      [now, now, id]
    );
  },

  async clearPendingOp(id: string) {
    await updateAndEmit(
      id,
      `UPDATE messages
       SET pending_op = NULL,
           updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), id]
    );
  },

  async incrementEditAttempts(id: string): Promise<number> {
    let attempts = 0;
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(
        `UPDATE messages
         SET edit_attempts = COALESCE(edit_attempts, 0) + 1
         WHERE id = ?`,
        [id]
      );
      const row = await tx.getFirstAsync<Pick<MessageRow, "edit_attempts">>(
        "SELECT edit_attempts FROM messages WHERE id = ?",
        [id]
      );
      attempts = row?.edit_attempts ?? 0;
    });
    return attempts;
  },

  async abandonPendingOp(id: string) {
    const db = await getDatabase();
    const row = await db.getFirstAsync<MessageRow>(
      "SELECT * FROM messages WHERE id = ?",
      [id]
    );
    if (!row?.pending_op) return;
    const now = new Date().toISOString();

    if (row.pending_op === "delete") {
      await withExclusiveWrite(async (tx) => {
        await tx.runAsync(
          `UPDATE messages
           SET is_deleted = 0,
               deleted_at = NULL,
               pending_op = NULL,
               edit_attempts = 0,
               updated_at = ?
           WHERE id = ? AND pending_op = 'delete'`,
          [now, id]
        );
      });
    } else {
      const serverBody =
        row.ciphertext && row.iv
          ? await decryptIncomingMessage(row.conversation_id, {
              ciphertext: row.ciphertext,
              iv: row.iv,
            })
          : null;
      const restoredBody = serverBody ?? row.original_body ?? row.body;
      const neverEditedRemotely =
        row.original_body != null && restoredBody === row.original_body;
      await withExclusiveWrite(async (tx) => {
        await tx.runAsync(
          `UPDATE messages
           SET body = ?,
               is_edited = CASE WHEN ? = 1 THEN 0 ELSE is_edited END,
               edited_at = CASE WHEN ? = 1 THEN NULL ELSE edited_at END,
               pending_op = NULL,
               edit_attempts = 0,
               updated_at = ?
           WHERE id = ? AND pending_op = 'update'`,
          [
            restoredBody,
            neverEditedRemotely ? 1 : 0,
            neverEditedRemotely ? 1 : 0,
            now,
            id,
          ]
        );
      });
    }
    emit(row.conversation_id);
  },

  async getMessageSyncState(conversationId: string): Promise<{
    historySyncedAt: Date | null;
    newestMessageAt: Date | null;
    changedAt: string | null;
  }> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<MessageSyncRow>(
      `SELECT history_synced_at, newest_message_at, changed_at
       FROM chat_message_sync
       WHERE chat_id = ?`,
      [conversationId]
    );

    return {
      historySyncedAt: row?.history_synced_at
        ? new Date(row.history_synced_at)
        : null,
      newestMessageAt: row?.newest_message_at
        ? new Date(row.newest_message_at)
        : null,
      // Kept as the raw server string: parsing it to a Date would drop the microseconds
      // and make every poll return the boundary rows again.
      changedAt: row?.changed_at ?? null,
    };
  },

  async saveMessageSyncState(
    conversationId: string,
    newestMessageAt: Date | null,
    changedAt?: string | null
  ) {
    await withExclusiveWrite(async (tx) => {
      await tx.runAsync(
        `INSERT INTO chat_message_sync (
          chat_id,
          history_synced_at,
          newest_message_at,
          changed_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          history_synced_at = excluded.history_synced_at,
          newest_message_at = COALESCE(
            excluded.newest_message_at,
            chat_message_sync.newest_message_at
          ),
          changed_at = COALESCE(
            excluded.changed_at,
            chat_message_sync.changed_at
          )`,
        [
          conversationId,
          new Date().toISOString(),
          newestMessageAt?.toISOString() ?? null,
          changedAt ?? null,
        ]
      );
    });
  },
};
