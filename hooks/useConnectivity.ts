import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";

type ConnectivityListener = () => void;

let isOnlineSnapshot = false;
let unsubscribeNetInfo: (() => void) | null = null;
const connectivityListeners = new Set<ConnectivityListener>();

function isReachable(
  state: Pick<NetInfoState, "isConnected" | "isInternetReachable">
): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

function publish(next: boolean) {
  if (next === isOnlineSnapshot) return;
  isOnlineSnapshot = next;
  connectivityListeners.forEach((listener) => listener());
}

function subscribeConnectivity(listener: ConnectivityListener) {
  connectivityListeners.add(listener);
  if (!unsubscribeNetInfo) {
    unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      publish(isReachable(state));
    });
    NetInfo.fetch()
      .then((state) => publish(isReachable(state)))
      .catch(() => publish(false));
  }
  return () => {
    connectivityListeners.delete(listener);
    if (connectivityListeners.size === 0 && unsubscribeNetInfo) {
      unsubscribeNetInfo();
      unsubscribeNetInfo = null;
    }
  };
}

function getConnectivitySnapshot() {
  return isOnlineSnapshot;
}

export function useConnectivity(): { isOnline: boolean } {
  const isOnline = useSyncExternalStore(
    subscribeConnectivity,
    getConnectivitySnapshot,
    getConnectivitySnapshot
  );
  return { isOnline };
}
