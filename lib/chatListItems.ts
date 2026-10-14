import type { Message } from "@/types/chat";

export interface DaySeparatorItem {
  id: string;
  type: "separator";
  date: Date;
  dayKey: string;
  label: string;
}

export interface MessageItem {
  id: string;
  type: "message";
  message: Message;
  dayKey: string;
}

export type ChatListItem = DaySeparatorItem | MessageItem;

export function getDayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - target.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";

  return target.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function buildChatListItems(messages: Message[]): ChatListItem[] {
  const ordered = [...messages].reverse();
  const list: ChatListItem[] = [];

  ordered.forEach((message, index) => {
    const currentDayKey = getDayKey(message.timestamp);

    list.push({
      id: message.id,
      type: "message",
      message,
      dayKey: currentDayKey,
    });

    const nextDayKey =
      index < ordered.length - 1 ? getDayKey(ordered[index + 1].timestamp) : null;

    if (currentDayKey !== nextDayKey) {
      list.push({
        id: `separator-${currentDayKey}`,
        type: "separator",
        dayKey: currentDayKey,
        date: message.timestamp,
        label: formatDayLabel(message.timestamp),
      });
    }
  });

  return list;
}
