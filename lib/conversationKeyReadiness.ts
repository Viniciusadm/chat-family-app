import {
  ensureConversationKey,
  getConversationKey,
  importConversationKey,
} from "@/lib/conversationKeys";
import {
  consumePendingKeyShares,
  importPendingKeyShareForChat,
} from "@/lib/keyDistribution";
import { MessageRepository } from "@/lib/MessageRepository";
import { invalidateKeySharesCache } from "@/lib/remoteKeyShares";
import { claimChatKey } from "@/src/api/crypto";

const chatKeyLocks = new Map<string, Promise<unknown>>();

function withChatKeyLock<T>(chatId: string, task: () => Promise<T>): Promise<T> {
  const previous = chatKeyLocks.get(chatId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  chatKeyLocks.set(chatId, next);
  void next.catch(() => {}).finally(() => {
    if (chatKeyLocks.get(chatId) === next) chatKeyLocks.delete(chatId);
  });
  return next;
}

async function adoptKeyFromAnotherDevice(
  chatId: string,
  deviceId: string | undefined,
): Promise<Uint8Array | null> {
  if (!deviceId) return null;
  invalidateKeySharesCache();
  await importPendingKeyShareForChat(deviceId, chatId);
  return getConversationKey(chatId);
}

export async function repairConversationKeyFromPendingShare(
  chatId: string,
  deviceId?: string,
): Promise<boolean> {
  if (!chatId || !deviceId) return false;

  const existingKey = await getConversationKey(chatId);
  const undecryptedCount = await MessageRepository.countUndecryptedTextMessages(chatId);
  // This runs on every chat refresh and every send. With a usable key and nothing left to
  // decrypt there is nothing to repair, so it must not scan the chat or hit the network.
  if (undecryptedCount === 0 && existingKey) return false;

  if (existingKey) {
    const repairedWithExistingKey = await MessageRepository.decryptStoredMessages(chatId);
    if (repairedWithExistingKey > 0) return true;
  }

  await consumePendingKeyShares(deviceId);
  const keyAfterImport = await getConversationKey(chatId);
  if (!existingKey && keyAfterImport) {
    await MessageRepository.decryptStoredMessages(chatId);
    return true;
  }

  if (undecryptedCount === 0) return false;

  const imported = await importPendingKeyShareForChat(deviceId, chatId, {
    replaceExisting: true,
  });
  if (!imported) return false;

  const repaired = await MessageRepository.decryptStoredMessages(chatId);
  if (repaired > 0) return true;

  if (existingKey) {
    await importConversationKey(chatId, existingKey);
  }
  return false;
}

export function prepareConversationKeyForEncryption(
  chatId: string,
  deviceId?: string,
  options: { canCreate?: boolean } = {},
): Promise<Uint8Array | null> {
  return withChatKeyLock(chatId, async () => {
    await repairConversationKeyFromPendingShare(chatId, deviceId);
    const existingKey = await getConversationKey(chatId);
    if (existingKey) return existingKey;

    if (options.canCreate === false) return null;

    const claim = await claimChatKey(chatId).catch(() => null);
    if (!claim) return null;
    if (!claim.granted) return adoptKeyFromAnotherDevice(chatId, deviceId);

    return ensureConversationKey(chatId);
  });
}
