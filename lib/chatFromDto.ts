import { repairConversationKeyFromPendingShare } from "@/lib/conversationKeyReadiness";
import { decryptIncomingMessage } from "@/lib/encryptedMessages";
import { timestampFromIso } from "@/lib/localTimestamp";
import type { ChatDto } from "@/src/api/chats";
import type { Chat } from "@/types/chat";

function chatFieldsFromDto(data: ChatDto, currentMemberId: string): Omit<Chat, "lastMessage"> {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    participants: data.participant_ids ?? [],
    isGroup: data.is_group,
    name: data.name,
    photoUrl: data.photo_url ?? null,
    photoPath: data.photo_path ?? null,
    unreadCount: data.unread_by?.[currentMemberId] ?? 0,
    readUpTo: Object.fromEntries(
      Object.entries(data.read_up_to ?? {})
        .map(([memberId, value]) => [memberId, timestampFromIso(value)])
        .filter((entry): entry is [string, NonNullable<Chat["readUpTo"]>[string]] => entry[1] != null)
    ),
  };
}

export function chatFromDto(data: ChatDto, currentMemberId: string): Chat {
  return {
    ...chatFieldsFromDto(data, currentMemberId),
    lastMessage: data.last_message_at && data.last_message_type
      ? {
          text: null,
          type: data.last_message_type,
          timestamp: new Date(data.last_message_at),
        }
      : undefined,
  };
}

export async function chatFromDtoWithDecryptedPreview(
  data: ChatDto,
  currentMemberId: string,
  deviceId?: string,
): Promise<Chat> {
  const chat: Chat = chatFieldsFromDto(data, currentMemberId);
  if (data.last_message_at && data.last_message_type) {
    const timestamp = new Date(data.last_message_at);
    if (data.last_message_type === "text") {
      await repairConversationKeyFromPendingShare(data.id, deviceId);
      const text = await decryptIncomingMessage(data.id, {
        ciphertext: data.last_message_ciphertext,
        iv: data.last_message_iv,
      });
      if (text != null) {
        chat.lastMessage = { text, type: "text", timestamp };
      }
    } else {
      chat.lastMessage = { text: null, type: data.last_message_type, timestamp };
    }
  }
  return chat;
}
