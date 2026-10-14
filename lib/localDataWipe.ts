import * as FileSystem from "expo-file-system/legacy";
import { withExclusiveWrite } from "./db";
import { SecureKeyStore } from "./secureKeyStore";

const USER_TABLES = [
  "messages",
  "message_reactions",
  "chats",
  "chat_message_sync",
  "admin_members",
  "admin_session_users",
  "admin_pending_devices",
  "app_sessions",
];

const MEDIA_CACHE_DIRS = ["audio-cache", "image-cache"];

export async function wipeLocalUserData(): Promise<void> {
  await withExclusiveWrite(async (tx) => {
    for (const table of USER_TABLES) {
      await tx.runAsync(`DELETE FROM ${table}`);
    }
  });
  await SecureKeyStore.removeAllConversationKeys();
  const root = FileSystem.documentDirectory;
  if (!root) return;
  await Promise.all(
    MEDIA_CACHE_DIRS.map((dir) =>
      FileSystem.deleteAsync(`${root}${dir}`, { idempotent: true }).catch(() => {}),
    ),
  );
}
