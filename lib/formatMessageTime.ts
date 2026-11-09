function formatClockTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatMessageTime(date: Date, now: Date = new Date()): string {
  if (isSameDay(date, now)) return formatClockTime(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: date.getFullYear() === now.getFullYear() ? undefined : "2-digit",
  });
}

export function formatViewerTimestamp(
  date: Date,
  now: Date = new Date()
): string {
  const time = formatClockTime(date);
  if (isSameDay(date, now)) return `Hoje ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Ontem ${time}`;
  const day = date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
  return `${day} ${time}`;
}
