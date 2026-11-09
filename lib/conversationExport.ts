import type { Message } from "@/types/chat";

type ExportableMessage = Pick<
  Message,
  | "senderId"
  | "type"
  | "content"
  | "timestamp"
  | "decryptionFailed"
  | "isEdited"
>;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatExportTimestamp(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function messageBody(message: ExportableMessage): string {
  if (message.type === "image") return "<imagem>";
  if (message.type === "audio") return "<áudio>";
  if (message.decryptionFailed || !message.content) {
    return "<mensagem indisponível>";
  }
  return message.isEdited ? `${message.content} <editada>` : message.content;
}

export function formatConversationExport(
  messages: ExportableMessage[],
  senderName: (senderId: string) => string,
): string {
  return messages
    .map(
      (message) =>
        `${formatExportTimestamp(message.timestamp)} - ${senderName(
          message.senderId,
        )}: ${messageBody(message)}`,
    )
    .join("\n");
}

export function exportFileName(chatName: string): string {
  const safeName = chatName
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `Conversa com ${safeName || "família"}.txt`;
}
