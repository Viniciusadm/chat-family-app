import { sha256 } from "@noble/hashes/sha2.js";
import { unwrapKeyFromShare, wrapKeyForDevice } from "./crypto/asymmetric";
import { bytesToBase64 } from "./crypto/encoding";
import { getConversationKey, importConversationKey } from "./conversationKeys";
import { getDatabase, withExclusiveWrite } from "./db";
import { getDevicePrivateKey } from "./deviceIdentity";
import { listKeyShares, writeChatKeyShare, writeKeyShare } from "./remoteKeyShares";
import { listChatKeyRecipients } from "@/src/api/crypto";
import { listKeyRecipientDevices } from "@/src/api/devices";
import { realtimeClient } from "@/src/api/realtime";

const RECIPIENTS_REFRESH_INTERVAL_MS = 3 * 60 * 1000;

type DistributionState = {
  keyFingerprint: string;
  servedDeviceIds: Set<string>;
  checkedAt: number;
};

const distributionStates = new Map<string, DistributionState>();
const inFlightDistributions = new Map<string, Promise<void>>();
let distributionGeneration = 0;

function keyFingerprint(key: Uint8Array): string {
  return bytesToBase64(sha256(key).slice(0, 16));
}

function parseDeviceIds(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

async function loadDistributionState(
  chatId: string,
): Promise<DistributionState | null> {
  const cached = distributionStates.get(chatId);
  if (cached) return cached;
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ key_fingerprint: string; device_ids: string }>(
    "SELECT key_fingerprint, device_ids FROM key_share_recipients WHERE chat_id = ?",
    [chatId],
  );
  if (!row) return null;
  const state: DistributionState = {
    keyFingerprint: row.key_fingerprint,
    servedDeviceIds: new Set(parseDeviceIds(row.device_ids)),
    checkedAt: 0,
  };
  if (!distributionStates.has(chatId)) distributionStates.set(chatId, state);
  return distributionStates.get(chatId) ?? state;
}

async function saveDistributionState(chatId: string, state: DistributionState) {
  await withExclusiveWrite(async (tx) => {
    await tx.runAsync(
      `INSERT INTO key_share_recipients (chat_id, key_fingerprint, device_ids, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(chat_id) DO UPDATE SET
         key_fingerprint = excluded.key_fingerprint,
         device_ids = excluded.device_ids,
         updated_at = excluded.updated_at`,
      [
        chatId,
        state.keyFingerprint,
        JSON.stringify([...state.servedDeviceIds]),
        new Date().toISOString(),
      ],
    );
  });
}

function markRecipientsStale(chatId: string) {
  const state = distributionStates.get(chatId);
  if (state) state.checkedAt = 0;
}

function markAllRecipientsStale() {
  distributionStates.forEach((state) => {
    state.checkedAt = 0;
  });
}

function forgetServedDevices() {
  distributionGeneration += 1;
  distributionStates.clear();
  void withExclusiveWrite(async (tx) => {
    await tx.runAsync("DELETE FROM key_share_recipients");
  }).catch(() => {});
}

realtimeClient.subscribe((event) => {
  const chatId = event.chat_id ?? event.entity_id;
  if (event.type === "chat.created" || event.type === "chat.updated") {
    if (chatId) markRecipientsStale(chatId);
    return;
  }
  if (event.type === "member.updated") {
    markAllRecipientsStale();
    return;
  }
  if (event.type === "device.updated") {
    forgetServedDevices();
    return;
  }
  if (event.type === "key_share.updated" && event.chat_id) {
    const targetDeviceId =
      typeof event.payload?.device_id === "string"
        ? event.payload.device_id
        : event.entity_id;
    const state = distributionStates.get(event.chat_id);
    if (state && targetDeviceId && !state.servedDeviceIds.has(targetDeviceId)) {
      state.checkedAt = 0;
    }
  }
});

export async function distributeConversationKey(
  chatId: string,
  participantMemberIds: string[],
): Promise<void> {
  const key = await getConversationKey(chatId);
  if (!key) return;

  const recipients = await listKeyRecipientDevices(participantMemberIds);
  await Promise.all(
    recipients.map(async (device) => {
      if (!device.public_key) return;
      const wrapped = wrapKeyForDevice(device.public_key, key);
      await writeKeyShare(device.id, chatId, wrapped);
    })
  );
}

export function distributeConversationKeyForChat(chatId: string): Promise<void> {
  const running = inFlightDistributions.get(chatId);
  if (running) return running;
  const run = distributeConversationKeyOnce(chatId).finally(() => {
    inFlightDistributions.delete(chatId);
  });
  inFlightDistributions.set(chatId, run);
  return run;
}

async function distributeConversationKeyOnce(chatId: string): Promise<void> {
  const key = await getConversationKey(chatId);
  if (!key) return;

  const generation = distributionGeneration;
  const fingerprint = keyFingerprint(key);
  let state = await loadDistributionState(chatId);
  if (!state || state.keyFingerprint !== fingerprint) {
    state = { keyFingerprint: fingerprint, servedDeviceIds: new Set(), checkedAt: 0 };
    distributionStates.set(chatId, state);
  }
  if (
    state.checkedAt > 0 &&
    Date.now() - state.checkedAt < RECIPIENTS_REFRESH_INTERVAL_MS
  ) {
    return;
  }

  const recipients = await listChatKeyRecipients(chatId);
  const recipientIds = new Set(recipients.map((device) => device.id));
  const served = state.servedDeviceIds;
  const pending = recipients.filter(
    (device) => device.public_key && !served.has(device.id),
  );
  const results = await Promise.allSettled(
    pending.map(async (device) => {
      const wrapped = wrapKeyForDevice(device.public_key, key);
      await writeChatKeyShare(device.id, chatId, wrapped);
      return device.id;
    }),
  );

  if (generation !== distributionGeneration) return;
  const nextServed = new Set([...served].filter((id) => recipientIds.has(id)));
  let failure: unknown = null;
  for (const result of results) {
    if (result.status === "fulfilled") nextServed.add(result.value);
    else failure = failure ?? result.reason;
  }
  const changed =
    nextServed.size !== served.size || [...nextServed].some((id) => !served.has(id));
  state.servedDeviceIds = nextServed;
  state.checkedAt = failure ? 0 : Date.now();
  if (changed) await saveDistributionState(chatId, state).catch(() => {});
  if (failure) throw failure;
}

export async function distributeAllOwnedKeysToDevice(
  targetDeviceId: string,
  targetPublicKey: string,
  chatIds: string[],
): Promise<void> {
  for (const chatId of chatIds) {
    const key = await getConversationKey(chatId);
    if (!key) continue;
    const wrapped = wrapKeyForDevice(targetPublicKey, key);
    try {
      await writeKeyShare(targetDeviceId, chatId, wrapped);
    } catch {
      // Skip; the next approval pass can retry.
    }
  }
}

export async function consumePendingKeyShares(deviceId: string): Promise<string[]> {
  if (!deviceId) return [];
  const priv = await getDevicePrivateKey();
  if (!priv) return [];
  const shares = await listKeyShares(deviceId);
  const importedChatIds: string[] = [];
  for (const { chatId, share } of shares) {
    try {
      if (await getConversationKey(chatId)) continue;
      const key = unwrapKeyFromShare(priv, share);
      await importConversationKey(chatId, key);
      importedChatIds.push(chatId);
    } catch {
      // Bad share; skip.
    }
  }
  return importedChatIds;
}

export async function importPendingKeyShareForChat(
  deviceId: string,
  chatId: string,
  options: { replaceExisting?: boolean } = {},
): Promise<boolean> {
  if (!deviceId || !chatId) return false;
  const priv = await getDevicePrivateKey();
  if (!priv) return false;
  if (!options.replaceExisting && (await getConversationKey(chatId))) {
    return false;
  }

  const share = (await listKeyShares(deviceId)).find(
    (item) => item.chatId === chatId,
  );
  if (!share) return false;

  try {
    const key = unwrapKeyFromShare(priv, share.share);
    await importConversationKey(chatId, key);
    return true;
  } catch {
    return false;
  }
}
