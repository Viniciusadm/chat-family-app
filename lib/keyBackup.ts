import {
  checkPasswordVerifier,
  decryptConversationKeyWithKek,
  deriveKeyFromPassword,
  encryptConversationKeyWithKek,
  generatePasswordSalt,
  makePasswordVerifier,
} from "./crypto/passwordKey";
import {
  clearPasswordSettings,
  countKeyBackups,
  deleteAllKeyBackups,
  getPasswordSettings,
  listKeyBackups,
  writeKeyBackup,
  writePasswordSettings,
} from "./remoteKeyBackups";
import { SecureKeyStore } from "./secureKeyStore";

export type RestoreResult =
  | { ok: true; restoredChatIds: string[]; failedChatIds: string[] }
  | { ok: false; reason: "no-settings" | "wrong-password" | "no-backups" };

export type CryptoProgress =
  | { phase: "deriving"; percent: number }
  | { phase: "backing-up"; done: number; total: number }
  | { phase: "restoring"; done: number; total: number };

export type CryptoProgressCallback = (p: CryptoProgress) => void;

const BACKUP_CONCURRENCY = 8;

interface UnlockedState {
  uid: string;
  kek: Uint8Array;
}

let unlocked: UnlockedState | null = null;

export function isBackupUnlockedFor(uid: string): boolean {
  return unlocked != null && unlocked.uid === uid;
}

export function lockBackup(): void {
  if (unlocked) unlocked.kek.fill(0);
  unlocked = null;
}

export async function hasPasswordConfigured(): Promise<boolean> {
  const settings = await getPasswordSettings();
  return settings != null;
}

export async function hasRemoteBackups(): Promise<boolean> {
  return (await countKeyBackups()) > 0;
}

export async function setupBackupPassword(
  uid: string,
  password: string,
  onProgress?: CryptoProgressCallback,
): Promise<void> {
  if (await getPasswordSettings()) {
    throw new Error("Password already configured. Use changeBackupPassword.");
  }
  const salt = generatePasswordSalt();
  const kek = await deriveKeyFromPassword(password, salt, (percent) =>
    onProgress?.({ phase: "deriving", percent }),
  );
  const verifier = makePasswordVerifier(kek);
  unlocked = { uid, kek };
  // Publish the settings last: while they are absent the setup can simply be retried,
  // whereas settings without backups look configured but protect nothing.
  try {
    await backupAllLocalKeys(uid, onProgress);
    await writePasswordSettings({ salt, verifier });
  } catch (error) {
    lockBackup();
    throw error;
  }
}

export async function unlockBackupWithPassword(
  uid: string,
  password: string,
  onProgress?: CryptoProgressCallback,
): Promise<{ ok: true } | { ok: false; reason: "no-settings" | "wrong-password" }> {
  const settings = await getPasswordSettings();
  if (!settings) return { ok: false, reason: "no-settings" };
  const kek = await deriveKeyFromPassword(password, settings.salt, (percent) =>
    onProgress?.({ phase: "deriving", percent }),
  );
  if (!checkPasswordVerifier(kek, settings.verifier)) {
    kek.fill(0);
    return { ok: false, reason: "wrong-password" };
  }
  unlocked = { uid, kek };
  return { ok: true };
}

export async function changeBackupPassword(
  uid: string,
  oldPassword: string,
  newPassword: string,
  onProgress?: CryptoProgressCallback,
): Promise<{ ok: true } | { ok: false; reason: "no-settings" | "wrong-password" }> {
  const settings = await getPasswordSettings();
  if (!settings) return { ok: false, reason: "no-settings" };
  const oldKek = await deriveKeyFromPassword(oldPassword, settings.salt, (percent) =>
    onProgress?.({ phase: "deriving", percent: percent / 2 }),
  );
  if (!checkPasswordVerifier(oldKek, settings.verifier)) {
    oldKek.fill(0);
    return { ok: false, reason: "wrong-password" };
  }
  const newSalt = generatePasswordSalt();
  const newKek = await deriveKeyFromPassword(newPassword, newSalt, (percent) =>
    onProgress?.({ phase: "deriving", percent: 0.5 + percent / 2 }),
  );
  const newVerifier = makePasswordVerifier(newKek);

  // Re-wrap every existing backup under the new key BEFORE publishing the new
  // settings. Deleting first (or writing the verifier first) would leave keys that
  // only exist on the server permanently unrecoverable if anything failed here.
  try {
    await rewrapRemoteBackups(oldKek, newKek, onProgress, async () => {
      try {
        await writePasswordSettings({ salt: newSalt, verifier: newVerifier });
      } catch (error) {
        const published = await getPasswordSettings().catch(() => null);
        if (published?.salt !== newSalt) throw error;
      }
    });
  } finally {
    oldKek.fill(0);
  }

  unlocked = { uid, kek: newKek };
  await backupAllLocalKeys(uid, onProgress);
  return { ok: true };
}

async function rewrapRemoteBackups(
  oldKek: Uint8Array,
  newKek: Uint8Array,
  onProgress: CryptoProgressCallback | undefined,
  publishNewSettings: () => Promise<void>,
): Promise<void> {
  const backups = await listKeyBackups();
  const total = backups.length;
  if (total === 0) {
    await publishNewSettings();
    return;
  }
  let done = 0;
  onProgress?.({ phase: "backing-up", done: 0, total });

  // Each write overwrites the only copy of a wrapping, so a failure halfway through would
  // leave part of the set under a key the published settings cannot derive — silently
  // unrecoverable, because restoreBackups skips whatever it fails to decrypt. Everything
  // already converted is put back under the old key before the error propagates.
  const converted: { chatId: string; conversationKey: Uint8Array }[] = [];
  try {
    for (const { chatId, backup } of backups) {
      const conversationKey = decryptConversationKeyWithKek(
        oldKek,
        backup.ciphertext,
        backup.iv,
      );
      // putKeyBackup upserts per chat, so this overwrites the old wrapping in place.
      await writeKeyBackup(
        chatId,
        encryptConversationKeyWithKek(newKek, conversationKey),
      );
      converted.push({ chatId, conversationKey });
      done++;
      onProgress?.({ phase: "backing-up", done, total });
    }
    await publishNewSettings();
  } catch (error) {
    for (const { chatId, conversationKey } of converted) {
      await writeKeyBackup(
        chatId,
        encryptConversationKeyWithKek(oldKek, conversationKey),
      ).catch(() => {});
    }
    throw error;
  } finally {
    for (const { conversationKey } of converted) conversationKey.fill(0);
  }
}

export async function disableBackupPassword(): Promise<void> {
  await deleteAllKeyBackups();
  await clearPasswordSettings();
  lockBackup();
}

export async function restoreBackups(
  uid: string,
  password: string,
  onProgress?: CryptoProgressCallback,
): Promise<RestoreResult> {
  const settings = await getPasswordSettings();
  if (!settings) return { ok: false, reason: "no-settings" };
  const kek = await deriveKeyFromPassword(password, settings.salt, (percent) =>
    onProgress?.({ phase: "deriving", percent }),
  );
  if (!checkPasswordVerifier(kek, settings.verifier)) {
    kek.fill(0);
    return { ok: false, reason: "wrong-password" };
  }
  const backups = await listKeyBackups();
  if (backups.length === 0) {
    unlocked = { uid, kek };
    return { ok: false, reason: "no-backups" };
  }
  const restored: string[] = [];
  const failed: string[] = [];
  let done = 0;
  const total = backups.length;
  onProgress?.({ phase: "restoring", done: 0, total });
  for (const { chatId, backup } of backups) {
    try {
      const conversationKey = decryptConversationKeyWithKek(
        kek,
        backup.ciphertext,
        backup.iv,
      );
      await SecureKeyStore.setConversationKey(chatId, conversationKey);
      restored.push(chatId);
    } catch {
      // One unreadable backup must not abort the rest, but it cannot be swallowed either:
      // that history stays unreadable and the caller has to be able to say so.
      failed.push(chatId);
    }
    done++;
    onProgress?.({ phase: "restoring", done, total });
  }
  unlocked = { uid, kek };
  return { ok: true, restoredChatIds: restored, failedChatIds: failed };
}

export async function tryBackupConversationKey(
  uid: string,
  chatId: string,
  conversationKey: Uint8Array,
): Promise<void> {
  if (!unlocked || unlocked.uid !== uid) return;
  try {
    const wrapped = encryptConversationKeyWithKek(unlocked.kek, conversationKey);
    await writeKeyBackup(chatId, wrapped);
  } catch {
    // Network / permission issue — backup is opportunistic, never fail upstream.
  }
}

/// Backs a freshly created or imported key up under the session that is currently
/// unlocked. Without this, keys created after the password was set would never reach the
/// server and their history would be unrecoverable on a new device.
export async function backupConversationKeyIfUnlocked(
  chatId: string,
  conversationKey: Uint8Array,
): Promise<void> {
  if (!unlocked) return;
  await tryBackupConversationKey(unlocked.uid, chatId, conversationKey);
}

async function backupAllLocalKeys(
  uid: string,
  onProgress?: CryptoProgressCallback,
): Promise<void> {
  if (!unlocked || unlocked.uid !== uid) return;
  const chatIds = await SecureKeyStore.listConversationKeyChatIds();
  const total = chatIds.length;
  if (total === 0) return;
  let done = 0;
  onProgress?.({ phase: "backing-up", done: 0, total });

  const queue = [...chatIds];
  const workers: Promise<void>[] = [];
  const limit = Math.min(BACKUP_CONCURRENCY, total);
  const kek = unlocked.kek;
  for (let i = 0; i < limit; i++) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const chatId = queue.shift();
          if (!chatId) break;
          if (!unlocked || unlocked.uid !== uid) return;
          try {
            const key = await SecureKeyStore.getConversationKey(chatId);
            if (key) {
              const wrapped = encryptConversationKeyWithKek(kek, key);
              await writeKeyBackup(chatId, wrapped);
            }
          } catch {
            // Skip; user can re-trigger by toggling the password later.
          }
          done++;
          onProgress?.({ phase: "backing-up", done, total });
        }
      })(),
    );
  }
  await Promise.all(workers);
}
