import * as authApi from "@/src/api/auth";
import { getDeviceStatus } from "@/src/api/devices";
import { realtimeClient } from "@/src/api/realtime";
import { SessionRepository } from "@/lib/SessionRepository";
import { useEffect } from "react";

const DEVICE_STATUS_POLL_INTERVAL_MS = 5000;

interface UseDeviceApprovalParams {
  deviceId: string;
  deviceApproved: boolean | null;
  authUserId: string | null;
  setDeviceApproved: (approved: boolean) => void;
  establishSession: (apiUser: authApi.ApiUser, approved: boolean | null) => Promise<void>;
  resetSignedOutState: () => void;
  markAccountDeleted: () => void;
}

export function useDeviceApproval({
  deviceId,
  deviceApproved,
  authUserId,
  setDeviceApproved,
  establishSession,
  resetSignedOutState,
  markAccountDeleted,
}: UseDeviceApprovalParams) {
  useEffect(() => {
    if (!deviceId || deviceApproved !== false) return;
    let cancelled = false;
    const tick = async () => {
      const status = await getDeviceStatus(deviceId).catch(() => null);
      if (cancelled || !status) return;
      // Without this the member whose account an adult deleted was just bounced to the
      // login screen with no explanation.
      if (status.reason === "account_deleted") {
        markAccountDeleted();
        await authApi.logout().catch(() => {});
        if (authUserId) await SessionRepository.deleteSession(authUserId).catch(() => {});
        resetSignedOutState();
        return;
      }
      setDeviceApproved(status.approved && status.active);
      if (authUserId) {
        await SessionRepository.updateDeviceApproved(
          authUserId,
          status.approved && status.active,
        ).catch(() => {});
      }
      if (status.approved && status.active) {
        realtimeClient.start();
        void authApi.me().then((me) => establishSession(me, true)).catch(() => {});
      }
    };
    void tick();
    const interval = setInterval(tick, DEVICE_STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    authUserId,
    deviceApproved,
    deviceId,
    establishSession,
    markAccountDeleted,
    resetSignedOutState,
    setDeviceApproved,
  ]);
}
