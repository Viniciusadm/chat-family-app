import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as authApi from "@/src/api/auth";
import { getDeviceStatus, updateDevice } from "@/src/api/devices";
import { loadStoredTokens, onApiLogout } from "@/src/api/client";
import { realtimeClient } from "@/src/api/realtime";
import { ensureDeviceKeyPair } from "@/lib/deviceIdentity";
import { fetchExpoPushToken, isValidExpoPushTokenString } from "@/lib/expoPushToken";
import { invalidateKeySharesCache } from "@/lib/remoteKeyShares";
import { wipeLocalUserData } from "@/lib/localDataWipe";
import type { CryptoProgress } from "@/lib/keyBackup";
import { randomUuid } from "@/lib/randomUuid";
import { SessionRepository } from "@/lib/SessionRepository";
import { useBackupPassword } from "@/hooks/useBackupPassword";
import { useDeviceApproval } from "@/hooks/useDeviceApproval";
import { useKeyShareConsumer } from "@/hooks/useKeyShareConsumer";
import type { AppUser } from "@/types/chat";

const DEVICE_ID_KEY = "deviceId";
const ACCOUNT_DELETED_MESSAGE = "A conta foi apagada.";

async function getOrCreateDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = randomUuid();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function userFromApi(user: authApi.ApiUser): AppUser {
  return {
    id: user.member_id,
    tenantId: user.tenant_id,
    name: user.name,
    role: user.role,
  };
}

interface AuthContextValue {
  currentUser: AppUser | null;
  authUserId: string | null;
  tenantId: string | null;
  deviceId: string;
  deviceApproved: boolean | null;
  sessionReady: boolean;
  isOfflineSession: boolean;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
  loginWithChildCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentUserPhoto: (photoUrl: string | null, photoPath: string | null) => Promise<void>;
  deletedAccountMessage: string | null;
  clearDeletedAccountMessage: () => void;
  backupUnlocked: boolean;
  needsPasswordRestore: boolean;
  hasBackupPassword: boolean;
  cryptoInProgress: boolean;
  cryptoProgress: CryptoProgress | null;
  setupBackupPassword: (password: string) => Promise<void>;
  changeBackupPassword: (
    oldPassword: string,
    newPassword: string,
  ) => Promise<{ ok: true } | { ok: false; reason: "wrong-password" | "no-settings" }>;
  disableBackupPassword: () => Promise<void>;
  unlockBackupPassword: (
    password: string,
  ) => Promise<{ ok: true } | { ok: false; reason: "wrong-password" | "no-settings" }>;
  restorePasswordBackups: (
    password: string,
  ) => Promise<
    | { ok: true; restoredChatIds: string[]; failedChatIds: string[] }
    | { ok: false; reason: "wrong-password" | "no-settings" | "no-backups" }
  >;
  lockBackupPassword: () => void;
  dismissPasswordRestore: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [deviceApproved, setDeviceApproved] = useState<boolean | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [isOfflineSession, setIsOfflineSession] = useState(false);
  const [deletedAccountMessage, setDeletedAccountMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState("");
  const deviceIdRef = useRef("");
  const authUserIdRef = useRef<string | null>(null);
  const backupPassword = useBackupPassword(authUserId);
  const { resetBackupState, evaluatePasswordRestore } = backupPassword;

  useEffect(() => {
    authUserIdRef.current = authUserId;
  }, [authUserId]);

  const resetSignedOutState = useCallback(() => {
    realtimeClient.stop();
    void realtimeClient.resetCursor();
    invalidateKeySharesCache();
    setCurrentUser(null);
    setAuthUserId(null);
    setTenantId(null);
    setDeviceApproved(null);
    setSessionReady(true);
    setIsOfflineSession(false);
    setLoading(false);
    resetBackupState();
    void wipeLocalUserData().catch(() => {});
  }, [resetBackupState]);

  const clearDeletedAccountMessage = useCallback(() => {
    setDeletedAccountMessage(null);
  }, []);

  const markAccountDeleted = useCallback(() => {
    setDeletedAccountMessage(ACCOUNT_DELETED_MESSAGE);
  }, []);

  const establishSession = useCallback(
    async (apiUser: authApi.ApiUser, approved: boolean | null) => {
      const appUser = userFromApi(apiUser);
      setAuthUserId(apiUser.id);
      setCurrentUser(appUser);
      setTenantId(apiUser.tenant_id);
      setDeviceApproved(approved);
      setSessionReady(true);
      setIsOfflineSession(false);
      setLoading(false);
      await SessionRepository.saveSession({
        authUserId: apiUser.id,
        currentUser: appUser,
        deviceApproved: approved,
      });
      // The socket runs catchUp itself on open; calling it here too only duplicated the
      // event replay and every refresh it triggers.
      if (approved === true) {
        realtimeClient.start();
      }
      void evaluatePasswordRestore(apiUser.id, apiUser.role);
    },
    [evaluatePasswordRestore]
  );

  const refreshPushToken = useCallback(async () => {
    try {
      const token = await fetchExpoPushToken();
      if (!token || !isValidExpoPushTokenString(token)) return null;
      return token;
    } catch {
      return null;
    }
  }, []);

  const devicePayload = useCallback(async () => {
    const [pushToken, keyPair] = await Promise.all([
      refreshPushToken(),
      ensureDeviceKeyPair(),
    ]);
    return {
      push_token: pushToken,
      public_key: keyPair.publicKeyBase64,
    };
  }, [refreshPushToken]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const id = await getOrCreateDeviceId();
      if (cancelled) return;
      deviceIdRef.current = id;
      setDeviceId(id);

      const tokens = await loadStoredTokens();
      if (!tokens.accessToken) {
        const cached = await SessionRepository.getLastApprovedSession();
        if (cached) {
          setCurrentUser(cached.currentUser);
          setAuthUserId(cached.authUserId);
          setTenantId(cached.currentUser.tenantId);
          setDeviceApproved(cached.deviceApproved);
          setIsOfflineSession(true);
        }
        setSessionReady(true);
        setLoading(false);
        return;
      }

      try {
        const me = await authApi.me();
        await establishSession(me, true);
        const payload = await devicePayload();
        await updateDevice(id, { device_id: id, ...payload }).catch(() => {});
      } catch {
        const cached = await SessionRepository.getLastSession();
        if (cached) {
          setCurrentUser(cached.currentUser);
          setAuthUserId(cached.authUserId);
          setTenantId(cached.currentUser.tenantId);
          setDeviceApproved(cached.deviceApproved);
          setIsOfflineSession(cached.deviceApproved === true);
          setSessionReady(true);
          setLoading(false);
          if (cached.deviceApproved !== true) {
            void getDeviceStatus(id)
              .then((status) => setDeviceApproved(status.approved && status.active))
              .catch(() => {});
          }
        } else {
          resetSignedOutState();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [devicePayload, establishSession, resetSignedOutState]);

  useEffect(() => {
    const unsubscribe = onApiLogout((reason) => {
      // The session extractor answers "user deleted" once an adult removes the member, and
      // that is the only chance to tell the person why they are back on the login screen.
      if (reason && reason.toLowerCase().includes("user deleted")) {
        markAccountDeleted();
      }
      const uid = authUserIdRef.current;
      if (uid) void SessionRepository.deleteSession(uid).catch(() => {});
      resetSignedOutState();
    });
    return () => {
      unsubscribe();
    };
  }, [markAccountDeleted, resetSignedOutState]);

  useDeviceApproval({
    deviceId,
    deviceApproved,
    authUserId,
    setDeviceApproved,
    establishSession,
    resetSignedOutState,
    markAccountDeleted,
  });

  useKeyShareConsumer(deviceId, deviceApproved);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      try {
        const id = deviceIdRef.current || await getOrCreateDeviceId();
        const payload = await devicePayload();
        const response = await authApi.login({
          email,
          password,
          device_id: id,
          ...payload,
        });
        await establishSession(response.user, true);
      } catch (error) {
        setLoading(false);
        throw error;
      }
    },
    [devicePayload, establishSession]
  );

  const registerWithEmail = useCallback(
    async (email: string, password: string, name: string) => {
      setLoading(true);
      try {
        const id = deviceIdRef.current || await getOrCreateDeviceId();
        const payload = await devicePayload();
        const response = await authApi.register({
          email,
          password,
          name,
          device_id: id,
          ...payload,
        });
        await establishSession(response.user, true);
      } catch (error) {
        setLoading(false);
        throw error;
      }
    },
    [devicePayload, establishSession]
  );

  const loginWithChildCode = useCallback(
    async (code: string) => {
      setLoading(true);
      try {
        const id = deviceIdRef.current || await getOrCreateDeviceId();
        const payload = await devicePayload();
        const response = await authApi.childLogin({
          code,
          device_id: id,
          ...payload,
        });
        await establishSession(response.user, false);
      } catch (error) {
        setLoading(false);
        throw error;
      }
    },
    [devicePayload, establishSession]
  );

  const logout = useCallback(async () => {
    const uid = authUserId;
    try {
      await authApi.logout();
    } finally {
      if (uid) await SessionRepository.deleteSession(uid).catch(() => {});
      resetSignedOutState();
    }
  }, [authUserId, resetSignedOutState]);

  const setCurrentUserPhoto = useCallback(
    async (photoUrl: string | null, photoPath: string | null) => {
      if (!currentUser || !authUserId) return;
      const next = { ...currentUser, photoUrl, photoPath };
      setCurrentUser(next);
      await SessionRepository.updateProfilePhoto(authUserId, photoUrl, photoPath);
    },
    [authUserId, currentUser]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        authUserId,
        tenantId,
        deviceId,
        deviceApproved,
        sessionReady,
        isOfflineSession,
        loading,
        loginWithEmail,
        registerWithEmail,
        loginWithChildCode,
        logout,
        setCurrentUserPhoto,
        deletedAccountMessage,
        clearDeletedAccountMessage,
        backupUnlocked: backupPassword.backupUnlocked,
        needsPasswordRestore: backupPassword.needsPasswordRestore,
        hasBackupPassword: backupPassword.hasBackupPassword,
        cryptoInProgress: backupPassword.cryptoInProgress,
        cryptoProgress: backupPassword.cryptoProgress,
        setupBackupPassword: backupPassword.setupBackupPassword,
        changeBackupPassword: backupPassword.changeBackupPassword,
        disableBackupPassword: backupPassword.disableBackupPassword,
        unlockBackupPassword: backupPassword.unlockBackupPassword,
        restorePasswordBackups: backupPassword.restorePasswordBackups,
        lockBackupPassword: backupPassword.lockBackupPassword,
        dismissPasswordRestore: backupPassword.dismissPasswordRestore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
