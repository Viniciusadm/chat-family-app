import { consumePendingKeyShares } from "@/lib/keyDistribution";
import { MessageRepository } from "@/lib/MessageRepository";
import { syncChatHistories } from "@/lib/offlineSync";
import { invalidateKeySharesCache } from "@/lib/remoteKeyShares";
import { realtimeClient } from "@/src/api/realtime";
import { useEffect } from "react";

async function consumeAndDecryptKeyShares(deviceId: string): Promise<void> {
  const chatIds = await consumePendingKeyShares(deviceId);
  await Promise.all(
    chatIds.map((chatId) => MessageRepository.decryptStoredMessages(chatId))
  );
  if (chatIds.length > 0) syncChatHistories(chatIds, true, deviceId);
}

export function useKeyShareConsumer(deviceId: string, deviceApproved: boolean | null) {
  useEffect(() => {
    if (!deviceId || deviceApproved !== true) return;
    void consumeAndDecryptKeyShares(deviceId).catch(() => {});
  }, [deviceApproved, deviceId]);

  useEffect(() => {
    if (!deviceId || deviceApproved !== true) return;
    const unsubscribe = realtimeClient.subscribe((event) => {
      if (event.type !== "key_share.updated") return;
      const targetDeviceId =
        typeof event.payload.device_id === "string"
          ? event.payload.device_id
          : event.entity_id;
      if (targetDeviceId !== deviceId) return;

      invalidateKeySharesCache();
      void consumeAndDecryptKeyShares(deviceId).catch(() => {});
    });
    return () => {
      unsubscribe();
    };
  }, [deviceApproved, deviceId]);
}
