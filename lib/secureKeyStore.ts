import * as SecureStore from "expo-secure-store";
import { base64ToBytes, bytesToBase64 } from "./crypto/encoding";
import { getDatabase } from "./db";

const DEVICE_PRIV_KEY = "device-priv";
const CONV_KEY_PREFIX = "convkey-";
const LEGACY_CONV_KEY_INDEX = "convkey-index";
const KEY_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

let legacyIndexMigration: Promise<void> | null = null;

async function migrateLegacyIndex(): Promise<void> {
  const raw = await SecureStore.getItemAsync(LEGACY_CONV_KEY_INDEX);
  if (!raw) return;
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) ids = parsed.filter((v) => typeof v === "string");
  } catch {
    ids = [];
  }
  const db = await getDatabase();
  for (const chatId of ids) {
    await db.runAsync("INSERT OR IGNORE INTO conversation_keys (chat_id) VALUES (?)", [chatId]);
  }
  await SecureStore.deleteItemAsync(LEGACY_CONV_KEY_INDEX);
}

async function indexDatabase() {
  legacyIndexMigration ??= migrateLegacyIndex().catch(() => {
    legacyIndexMigration = null;
  });
  await legacyIndexMigration;
  return getDatabase();
}

export const SecureKeyStore = {
  async getDevicePrivateKey(): Promise<Uint8Array | null> {
    const raw = await SecureStore.getItemAsync(DEVICE_PRIV_KEY, KEY_STORE_OPTIONS);
    return raw ? base64ToBytes(raw) : null;
  },
  async setDevicePrivateKey(privateKey: Uint8Array): Promise<void> {
    await SecureStore.setItemAsync(DEVICE_PRIV_KEY, bytesToBase64(privateKey), KEY_STORE_OPTIONS);
  },
  async getConversationKey(chatId: string): Promise<Uint8Array | null> {
    const raw = await SecureStore.getItemAsync(CONV_KEY_PREFIX + chatId, KEY_STORE_OPTIONS);
    return raw ? base64ToBytes(raw) : null;
  },
  async setConversationKey(chatId: string, key: Uint8Array): Promise<void> {
    await SecureStore.setItemAsync(CONV_KEY_PREFIX + chatId, bytesToBase64(key), KEY_STORE_OPTIONS);
    const db = await indexDatabase();
    await db.runAsync("INSERT OR IGNORE INTO conversation_keys (chat_id) VALUES (?)", [chatId]);
  },
  async removeConversationKey(chatId: string): Promise<void> {
    await SecureStore.deleteItemAsync(CONV_KEY_PREFIX + chatId, KEY_STORE_OPTIONS);
    const db = await indexDatabase();
    await db.runAsync("DELETE FROM conversation_keys WHERE chat_id = ?", [chatId]);
  },
  async listConversationKeyChatIds(): Promise<string[]> {
    const db = await indexDatabase();
    const rows = await db.getAllAsync<{ chat_id: string }>(
      "SELECT chat_id FROM conversation_keys",
    );
    return rows.map((row) => row.chat_id);
  },
  async removeAllConversationKeys(): Promise<void> {
    const chatIds = await this.listConversationKeyChatIds();
    for (const chatId of chatIds) {
      await this.removeConversationKey(chatId);
    }
  },
};
