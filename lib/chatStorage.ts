import * as FileSystem from "expo-file-system/legacy";

export type ChatMediaKind = "image" | "audio";

const MEDIA_CACHE_ROOTS: Record<ChatMediaKind, string> = {
  image: "image-cache",
  audio: "audio-cache",
};

export function chatMediaDir(
  kind: ChatMediaKind,
  chatId: string,
): string | null {
  const root = FileSystem.documentDirectory;
  if (!root) return null;
  return `${root}${MEDIA_CACHE_ROOTS[kind]}/${encodeURIComponent(chatId)}`;
}

async function directorySize(dir: string): Promise<number> {
  const info = await FileSystem.getInfoAsync(dir).catch(() => null);
  if (!info?.exists) return 0;
  if (!info.isDirectory) return info.size ?? 0;
  const entries = await FileSystem.readDirectoryAsync(dir).catch(() => []);
  const sizes = await Promise.all(
    entries.map((entry) => directorySize(`${dir}/${entry}`)),
  );
  return sizes.reduce((total, size) => total + size, 0);
}

export async function getChatMediaSize(chatId: string): Promise<number> {
  const dirs = (["image", "audio"] as const)
    .map((kind) => chatMediaDir(kind, chatId))
    .filter((dir): dir is string => dir !== null);
  const sizes = await Promise.all(dirs.map(directorySize));
  return sizes.reduce((total, size) => total + size, 0);
}

export async function deleteChatMedia(chatId: string): Promise<void> {
  const dirs = (["image", "audio"] as const)
    .map((kind) => chatMediaDir(kind, chatId))
    .filter((dir): dir is string => dir !== null);
  await Promise.all(
    dirs.map((dir) =>
      FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => {}),
    ),
  );
}

const BYTE_UNITS = ["B", "KB", "MB", "GB"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${BYTE_UNITS[unitIndex]}`;
}
