import {
  changeBackupPassword as changeBackupPasswordImpl,
  disableBackupPassword as disableBackupPasswordImpl,
  hasPasswordConfigured,
  hasRemoteBackups,
  isBackupUnlockedFor,
  lockBackup as lockBackupImpl,
  restoreBackups as restoreBackupsImpl,
  setupBackupPassword as setupBackupPasswordImpl,
  unlockBackupWithPassword,
  type CryptoProgress,
} from "@/lib/keyBackup";
import { useCallback, useRef, useState } from "react";

export function useBackupPassword(authUserId: string | null) {
  const [backupUnlocked, setBackupUnlocked] = useState(false);
  const [hasBackupPassword, setHasBackupPassword] = useState(false);
  const [needsPasswordRestore, setNeedsPasswordRestore] = useState(false);
  const [cryptoInProgress, setCryptoInProgress] = useState(false);
  const [cryptoProgress, setCryptoProgress] = useState<CryptoProgress | null>(null);
  const restoreDismissedRef = useRef(false);

  const resetBackupState = useCallback(() => {
    lockBackupImpl();
    setBackupUnlocked(false);
    setHasBackupPassword(false);
    setNeedsPasswordRestore(false);
    setCryptoInProgress(false);
    restoreDismissedRef.current = false;
  }, []);

  const evaluatePasswordRestore = useCallback(
    async (uid: string, role: "adult" | "child") => {
      if (role !== "adult") {
        setHasBackupPassword(false);
        setNeedsPasswordRestore(false);
        return;
      }
      const configured = await hasPasswordConfigured().catch(() => false);
      setHasBackupPassword(configured);
      if (!configured) {
        setNeedsPasswordRestore(false);
        return;
      }
      if (isBackupUnlockedFor(uid)) {
        setBackupUnlocked(true);
        setNeedsPasswordRestore(false);
        return;
      }
      const remote = await hasRemoteBackups().catch(() => false);
      setNeedsPasswordRestore(remote && !restoreDismissedRef.current);
    },
    []
  );

  const setupBackupPassword = useCallback(async (password: string) => {
    if (!authUserId) throw new Error("Not signed in.");
    setCryptoInProgress(true);
    try {
      await setupBackupPasswordImpl(authUserId, password, setCryptoProgress);
      setBackupUnlocked(true);
      setHasBackupPassword(true);
      setNeedsPasswordRestore(false);
    } finally {
      setCryptoInProgress(false);
    }
  }, [authUserId]);

  const changeBackupPassword = useCallback(async (oldPassword: string, newPassword: string) => {
    if (!authUserId) throw new Error("Not signed in.");
    setCryptoInProgress(true);
    try {
      const result = await changeBackupPasswordImpl(
        authUserId,
        oldPassword,
        newPassword,
        setCryptoProgress,
      );
      if (result.ok) {
        setBackupUnlocked(true);
        setHasBackupPassword(true);
        setNeedsPasswordRestore(false);
      }
      return result;
    } finally {
      setCryptoInProgress(false);
    }
  }, [authUserId]);

  const disableBackupPassword = useCallback(async () => {
    if (!authUserId) throw new Error("Not signed in.");
    await disableBackupPasswordImpl();
    setBackupUnlocked(false);
    setHasBackupPassword(false);
    setNeedsPasswordRestore(false);
  }, [authUserId]);

  const unlockBackupPassword = useCallback(async (password: string) => {
    if (!authUserId) return { ok: false, reason: "no-settings" } as const;
    const result = await unlockBackupWithPassword(authUserId, password);
    if (result.ok) {
      setBackupUnlocked(true);
      setNeedsPasswordRestore(false);
    }
    return result;
  }, [authUserId]);

  const restorePasswordBackups = useCallback(async (password: string) => {
    if (!authUserId) return { ok: false, reason: "no-settings" } as const;
    const result = await restoreBackupsImpl(authUserId, password);
    if (result.ok) {
      setBackupUnlocked(true);
      setNeedsPasswordRestore(false);
    }
    return result;
  }, [authUserId]);

  const lockBackupPassword = useCallback(() => {
    lockBackupImpl();
    setBackupUnlocked(false);
  }, []);

  const dismissPasswordRestore = useCallback(() => {
    restoreDismissedRef.current = true;
    setNeedsPasswordRestore(false);
  }, []);

  return {
    backupUnlocked,
    hasBackupPassword,
    needsPasswordRestore,
    cryptoInProgress,
    cryptoProgress,
    resetBackupState,
    evaluatePasswordRestore,
    setupBackupPassword,
    changeBackupPassword,
    disableBackupPassword,
    unlockBackupPassword,
    restorePasswordBackups,
    lockBackupPassword,
    dismissPasswordRestore,
  };
}
