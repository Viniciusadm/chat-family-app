import * as cryptoApi from "@/src/api/crypto";
import type { WrappedKey } from "./crypto/asymmetric";
import type { KeyShareDoc } from "@/types/chat";

export async function writeKeyShare(
  deviceId: string,
  chatId: string,
  share: WrappedKey,
): Promise<void> {
  await cryptoApi.putKeyShare(deviceId, chatId, {
    ephemeral_public_key: share.ephemeralPublicKey,
    iv: share.iv,
    ciphertext: share.ciphertext,
  });
}

export async function writeChatKeyShare(
  deviceId: string,
  chatId: string,
  share: WrappedKey,
): Promise<void> {
  await cryptoApi.putChatKeyShare(deviceId, chatId, {
    ephemeral_public_key: share.ephemeralPublicKey,
    iv: share.iv,
    ciphertext: share.ciphertext,
  });
}

export type PendingKeyShare = { chatId: string; share: KeyShareDoc };

const KEY_SHARE_CACHE_TTL_MS = 30_000;

type KeyShareCache = {
  deviceId: string;
  fetchedAt: number;
  shares: PendingKeyShare[];
};

let cache: KeyShareCache | null = null;
let inFlight: Promise<PendingKeyShare[]> | null = null;

/// The pending share list is read on every chat refresh and every send, so an uncached
/// implementation turned one incoming message into one request per chat. Writes to it are
/// announced by the key_share.updated event, which drops the cache.
export function invalidateKeySharesCache(): void {
  cache = null;
}

export async function listKeyShares(
  deviceId: string,
): Promise<PendingKeyShare[]> {
  if (cache && cache.deviceId === deviceId) {
    if (Date.now() - cache.fetchedAt < KEY_SHARE_CACHE_TTL_MS) return cache.shares;
    cache = null;
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const shares = await cryptoApi.listKeyShares(deviceId);
    const mapped = shares.map((share) => ({
      chatId: share.chat_id,
      share: {
        ephemeralPublicKey: share.ephemeral_public_key,
        iv: share.iv,
        ciphertext: share.ciphertext,
      },
    }));
    cache = { deviceId, fetchedAt: Date.now(), shares: mapped };
    return mapped;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
