import type { Chat } from "@/types/chat";

export function findCommonGroups(
  chats: Chat[],
  memberId: string,
  otherMemberId: string,
): Chat[] {
  return chats
    .filter(
      (chat) =>
        chat.isGroup &&
        chat.participants.includes(memberId) &&
        chat.participants.includes(otherMemberId),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
