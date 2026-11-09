import { useAuth } from "@/context/AuthContext";
import { useConnectivity } from "@/hooks/useConnectivity";
import {
  activeMutes,
  childMuteFromDto,
  nextExpiry,
  type ChildMute,
  type ChildMuteScope,
} from "@/lib/childMutes";
import { debounce, REALTIME_REFRESH_DELAY_MS } from "@/lib/debounce";
import { listChildMutes, muteChild, unmuteChild } from "@/src/api/childMutes";
import { realtimeClient } from "@/src/api/realtime";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

const MAX_TIMER_DELAY_MS = 60 * 60 * 1000;

let mutesSnapshot: ChildMute[] = [];
let refreshGeneration = 0;
const listeners = new Set<() => void>();

function publish(next: ChildMute[]) {
  mutesSnapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return mutesSnapshot;
}

async function refreshChildMutes() {
  const generation = ++refreshGeneration;
  const rows = await listChildMutes().catch(() => null);
  if (!rows || generation !== refreshGeneration) return;
  publish(rows.map(childMuteFromDto));
}

const scheduleRefresh = debounce(() => {
  if (listeners.size > 0) void refreshChildMutes();
}, REALTIME_REFRESH_DELAY_MS);

realtimeClient.subscribe((event) => {
  if (event.type === "child_mute.updated") scheduleRefresh();
});

function withoutReplacedMutes(
  mutes: ChildMute[],
  childId: string,
  scope: ChildMuteScope,
  adultId: string,
): ChildMute[] {
  return mutes.filter(
    (mute) =>
      mute.childId !== childId ||
      mute.scope !== scope ||
      (scope === "direct" && mute.mutedById !== adultId),
  );
}

export function useChildMutes() {
  const { currentUser } = useAuth();
  const { isOnline } = useConnectivity();
  const currentUserId = currentUser?.id ?? null;
  const allMutes = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!currentUserId) {
      refreshGeneration += 1;
      publish([]);
      return;
    }
    if (isOnline) void refreshChildMutes();
  }, [currentUserId, isOnline]);

  useEffect(() => {
    setNow(new Date());
  }, [allMutes]);

  useEffect(() => {
    const expiry = nextExpiry(allMutes, now);
    if (!expiry) return;
    const delay = Math.min(
      Math.max(expiry.getTime() - Date.now(), 0) + 250,
      MAX_TIMER_DELAY_MS,
    );
    const timer = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(timer);
  }, [allMutes, now]);

  const mute = useCallback(
    async (childId: string, scope: ChildMuteScope) => {
      if (!currentUserId) return;
      const dto = await muteChild(childId, scope);
      refreshGeneration += 1;
      publish([
        ...withoutReplacedMutes(mutesSnapshot, childId, scope, currentUserId),
        childMuteFromDto(dto),
      ]);
    },
    [currentUserId],
  );

  const unmute = useCallback(
    async (childId: string, scope: ChildMuteScope) => {
      if (!currentUserId) return;
      await unmuteChild(childId, scope);
      refreshGeneration += 1;
      publish(
        withoutReplacedMutes(mutesSnapshot, childId, scope, currentUserId),
      );
    },
    [currentUserId],
  );

  const mutes = useMemo(() => activeMutes(allMutes, now), [allMutes, now]);

  return {
    mutes,
    now,
    mute,
    unmute,
  };
}
