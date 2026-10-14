import type { LocalTimestamp } from "@/lib/localTimestamp";

export interface PasswordVerifierField {
  ciphertext: string;
  iv: string;
}

export interface KeyBackupDoc {
  ciphertext: string;
  iv: string;
  encVersion: number;
  createdAt: string;
}

export interface KeyShareDoc {
  ephemeralPublicKey: string;
  iv: string;
  ciphertext: string;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export type UserRole = "adult" | "child";
export type MessageType = "text" | "audio" | "image";
export type MessageReplyType = MessageType;
export type MessageStatus = "loading" | "sent" | "failed";

export interface MessageReplySnapshot {
  id: string;
  senderId: string;
  senderName: string;
  type: MessageReplyType;
  preview: string;
}

export interface AppUser {
  id: string;
  tenantId: string;
  name: string;
  role: UserRole;
  photoUrl?: string | null;
  photoPath?: string | null;
}

export interface AppMember extends AppUser {
  loginCode: string | null;
}

export interface Device {
  id: string;
  tenantId: string;
  userId: string;
  memberId?: string | null;
  approved: boolean;
  active?: boolean;
  pushToken: string;
  publicKey?: string | null;
  createdAt: Date;
}

export interface Chat {
  id: string;
  tenantId: string;
  participants: string[];
  isGroup: boolean;
  name: string;
  photoUrl?: string | null;
  photoPath?: string | null;
  unreadCount: number;
  readUpTo?: Record<string, LocalTimestamp>;
  lastMessage?: {
    text: string | null;
    type: "text" | "audio" | "image" | null;
    timestamp: Date;
  };
}

export type MessagePendingOp = "update" | "delete";

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  content: string;
  audioUrl?: string;
  audioRemoteUrl?: string;
  audioLocalUri?: string;
  audioDuration?: number;
  imageUrl?: string;
  imageRemoteUrl?: string;
  imageLocalUri?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageFileSize?: number;
  imagePendingSourceUri?: string;
  timestamp: Date;
  createdAtMs: number;
  status?: MessageStatus;
  replyTo?: MessageReplySnapshot;
  reactions?: Reaction[];
  decryptionFailed?: boolean;
  isEdited?: boolean;
  editedAt?: Date | null;
  isDeleted?: boolean;
  deletedAt?: Date | null;
  pendingOp?: MessagePendingOp | null;
}
