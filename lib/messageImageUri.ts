import type { Message } from "@/types/chat";

export function getMessageImageUri(message: Message): string | null {
  if (message.type !== "image") return null;
  return (
    message.imageLocalUri ?? message.imageRemoteUrl ?? message.imageUrl ?? null
  );
}

export function selectViewableImages(messages: Message[]): Message[] {
  return messages
    .filter(
      (message) =>
        message.type === "image" &&
        !message.isDeleted &&
        getMessageImageUri(message) !== null
    )
    .sort((a, b) => a.createdAtMs - b.createdAtMs);
}
