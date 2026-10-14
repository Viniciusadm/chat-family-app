import type { ChatListItem } from "@/lib/chatListItems";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ViewToken,
} from "react-native";

const SHOW_JUMP_TO_LATEST_OFFSET = 120;
const HIDE_JUMP_TO_LATEST_OFFSET = 48;
const BADGE_HIDE_DELAY_MS = 2000;

export function useDayBadge(chatId: string | undefined, chatListData: ChatListItem[]) {
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const hasScrolledRef = useRef(false);
  const visibleDayLabelRef = useRef("");
  const hideBadgeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showJumpToLatestRef = useRef(false);
  const badgeVisibleRef = useRef(false);
  const lastScrollActivityRef = useRef(0);
  const activeDayLabelRef = useRef("");

  const [activeDayLabel, setActiveDayLabel] = useState<string>("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const dayLabelsByKey = useMemo(() => {
    const labels = new Map<string, string>();
    for (const entry of chatListData) {
      if (entry.type === "separator") {
        labels.set(entry.dayKey, entry.label);
      }
    }
    return labels;
  }, [chatListData]);

  const dayLabelsByKeyRef = useRef(dayLabelsByKey);

  useEffect(() => {
    dayLabelsByKeyRef.current = dayLabelsByKey;
  }, [dayLabelsByKey]);

  useEffect(() => {
    setActiveDayLabel("");
    activeDayLabelRef.current = "";
    visibleDayLabelRef.current = "";
    badgeOpacity.setValue(0);
    badgeVisibleRef.current = false;
    hasScrolledRef.current = false;
    showJumpToLatestRef.current = false;
    setShowJumpToLatest(false);
    if (hideBadgeTimeoutRef.current) {
      clearTimeout(hideBadgeTimeoutRef.current);
      hideBadgeTimeoutRef.current = null;
    }
  }, [badgeOpacity, chatId]);

  useEffect(() => {
    return () => {
      if (hideBadgeTimeoutRef.current) {
        clearTimeout(hideBadgeTimeoutRef.current);
      }
    };
  }, []);

  const showBadge = useCallback(() => {
    if (!hasScrolledRef.current || badgeVisibleRef.current) return;
    badgeVisibleRef.current = true;
    Animated.timing(badgeOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [badgeOpacity]);

  const scheduleBadgeHide = useCallback(() => {
    lastScrollActivityRef.current = Date.now();
    if (hideBadgeTimeoutRef.current) return;

    const hideWhenIdle = () => {
      const remaining =
        BADGE_HIDE_DELAY_MS - (Date.now() - lastScrollActivityRef.current);
      if (remaining > 0) {
        hideBadgeTimeoutRef.current = setTimeout(hideWhenIdle, remaining);
        return;
      }
      hideBadgeTimeoutRef.current = null;
      badgeVisibleRef.current = false;
      Animated.timing(badgeOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    };

    hideBadgeTimeoutRef.current = setTimeout(hideWhenIdle, BADGE_HIDE_DELAY_MS);
  }, [badgeOpacity]);

  const syncJumpToLatestVisibility = useCallback((offsetY: number) => {
    const shouldShow = showJumpToLatestRef.current
      ? offsetY >= HIDE_JUMP_TO_LATEST_OFFSET
      : offsetY > SHOW_JUMP_TO_LATEST_OFFSET;
    if (shouldShow === showJumpToLatestRef.current) return;
    showJumpToLatestRef.current = shouldShow;
    setShowJumpToLatest(shouldShow);
  }, []);

  const updateActiveDayLabel = useCallback((label: string) => {
    activeDayLabelRef.current = label;
    setActiveDayLabel(label);
  }, []);

  const handleScrollActivity = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncJumpToLatestVisibility(event.nativeEvent.contentOffset.y);

      if (!hasScrolledRef.current) return;
      showBadge();
      scheduleBadgeHide();
    },
    [scheduleBadgeHide, showBadge, syncJumpToLatestVisibility]
  );

  const handleScrollPositionSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncJumpToLatestVisibility(event.nativeEvent.contentOffset.y);
    },
    [syncJumpToLatestVisibility]
  );

  const handleUserScrollStart = useCallback(() => {
    hasScrolledRef.current = true;
    if (visibleDayLabelRef.current) {
      updateActiveDayLabel(visibleDayLabelRef.current);
    }
    showBadge();
    scheduleBadgeHide();
  }, [scheduleBadgeHide, showBadge, updateActiveDayLabel]);

  const animateBadgeChange = useCallback(
    (nextLabel: string) => {
      if (!hasScrolledRef.current || !nextLabel) return;
      if (nextLabel === activeDayLabelRef.current) {
        showBadge();
        return;
      }
      updateActiveDayLabel(nextLabel);
      badgeVisibleRef.current = true;
      Animated.sequence([
        Animated.timing(badgeOpacity, {
          toValue: 0,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(badgeOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [badgeOpacity, showBadge, updateActiveDayLabel]
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<ChatListItem>[] }) => {
      const firstVisible = viewableItems.find(
        (entry) => entry.item.type === "message" || entry.item.type === "separator"
      )?.item;

      if (!firstVisible) return;

      const nextLabel = dayLabelsByKeyRef.current.get(firstVisible.dayKey);
      if (!nextLabel) return;

      visibleDayLabelRef.current = nextLabel;
      animateBadgeChange(nextLabel);
    },
    [animateBadgeChange]
  );

  return {
    activeDayLabel,
    badgeOpacity,
    showJumpToLatest,
    handleScrollActivity,
    handleScrollPositionSettled,
    handleUserScrollStart,
    handleViewableItemsChanged,
  };
}
