import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useKeyboardState } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TOAST_DURATION_MS = 2000;
const TOAST_ANIMATION_MS = 180;
const TOAST_BOTTOM_OFFSET = 96;

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    host: {
      position: "absolute",
      left: spacing.lg,
      right: spacing.lg,
      alignItems: "center",
    },
    pill: {
      maxWidth: "100%",
      backgroundColor: t.foreground,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      shadowColor: t.shadow,
      shadowOpacity: t.shadowOpacity,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    text: {
      color: t.background,
      fontSize: fontSizes.subhead,
      fontWeight: fontWeights.medium,
      textAlign: "center",
    },
  });

export function ToastProvider({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const keyboardInset = useKeyboardState((state) =>
    state.isVisible ? state.height : 0
  );
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: TOAST_ANIMATION_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMessage(null);
    });
  }, [opacity]);

  const showToast = useCallback(
    (next: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      opacity.stopAnimation();
      setMessage(next);
      Animated.timing(opacity, {
        toValue: 1,
        duration: TOAST_ANIMATION_MS,
        useNativeDriver: true,
      }).start();
      hideTimer.current = setTimeout(hide, TOAST_DURATION_MS);
      if (Platform.OS === "ios") {
        AccessibilityInfo.announceForAccessibility(next);
      }
    },
    [hide, opacity]
  );

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  const translateY = opacity.interpolate({
    inputRange: [0, 1],
    outputRange: [spacing.lg, 0],
  });

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <View
          pointerEvents="none"
          style={[
            styles.host,
            {
              bottom:
                Math.max(insets.bottom, keyboardInset) + TOAST_BOTTOM_OFFSET,
            },
          ]}
        >
          <Animated.View
            style={[styles.pill, { opacity, transform: [{ translateY }] }]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Text style={styles.text}>{message}</Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
