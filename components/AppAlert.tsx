import {
  fontSizes,
  fontWeights,
  lineHeights,
  maxFontScale,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/useThemedStyles";
import React, { useEffect, useRef, useSyncExternalStore } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

export type AlertButtonStyle = "default" | "cancel" | "destructive";

export interface AlertButton {
  text?: string;
  style?: AlertButtonStyle;
  onPress?: () => void;
}

interface AlertRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

const DEFAULT_BUTTONS: AlertButton[] = [{ text: "OK" }];

let nextAlertId = 1;
let alertQueue: AlertRequest[] = [];
const listeners = new Set<() => void>();

function publish(next: AlertRequest[]) {
  alertQueue = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getCurrentAlert(): AlertRequest | null {
  return alertQueue[0] ?? null;
}

export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
) {
  publish([
    ...alertQueue,
    {
      id: nextAlertId++,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : DEFAULT_BUTTONS,
    },
  ]);
}

function dismiss(id: number, button?: AlertButton) {
  publish(alertQueue.filter((request) => request.id !== id));
  button?.onPress?.();
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xxl,
      backgroundColor: t.modalBackdrop,
    },
    card: {
      width: "100%",
      maxWidth: 400,
      backgroundColor: t.card,
      borderRadius: radius.xxl,
      paddingTop: spacing.xxl,
      paddingHorizontal: spacing.xxl,
      paddingBottom: spacing.xl,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: t.shadowOpacity * 3,
      shadowRadius: 24,
      elevation: 12,
    },
    title: {
      fontSize: fontSizes.title,
      lineHeight: lineHeights.title,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
    },
    message: {
      marginTop: spacing.sm,
      fontSize: fontSizes.bodySmall,
      lineHeight: lineHeights.bodySmall,
      color: t.mutedForeground,
    },
    buttons: {
      marginTop: spacing.xxl,
      gap: spacing.sm,
    },
    buttonsRow: {
      flexDirection: "row",
    },
    button: {
      minHeight: 48,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.primary,
    },
    buttonInRow: {
      flex: 1,
    },
    buttonCancel: {
      backgroundColor: t.muted,
    },
    buttonDestructive: {
      backgroundColor: t.destructive,
    },
    buttonPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    buttonText: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: t.primaryForeground,
      textAlign: "center",
    },
    buttonTextCancel: {
      color: t.foreground,
    },
    buttonTextDestructive: {
      color: t.destructiveForeground,
    },
  });

function orderButtons(buttons: AlertButton[]): AlertButton[] {
  const cancel = buttons.filter((button) => button.style === "cancel");
  const others = buttons.filter((button) => button.style !== "cancel");
  return [...cancel, ...others];
}

export function AlertHost() {
  const styles = useThemedStyles(createStyles);
  const { height } = useWindowDimensions();
  const current = useSyncExternalStore(
    subscribe,
    getCurrentAlert,
    getCurrentAlert
  );
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const currentId = current?.id;

  useEffect(() => {
    if (currentId === undefined) return;
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        damping: 18,
        stiffness: 260,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentId, opacity, scale]);

  if (!current) return null;

  const buttons = orderButtons(current.buttons);
  const cancelButton = current.buttons.find(
    (button) => button.style === "cancel"
  );
  const inRow = buttons.length === 2;
  const handleDismissRequest = () => {
    if (cancelButton) dismiss(current.id, cancelButton);
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismissRequest}
    >
      <Pressable
        style={styles.backdrop}
        onPress={handleDismissRequest}
        accessibilityLabel={cancelButton ? "Fechar alerta" : undefined}
      >
        <Animated.View
          style={[styles.card, { opacity, transform: [{ scale }] }]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Pressable onPress={() => {}} accessible={false}>
            <ScrollView
              style={{ maxHeight: height * 0.5 }}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.title} accessibilityRole="header">
                {current.title}
              </Text>
              {current.message ? (
                <Text style={styles.message}>{current.message}</Text>
              ) : null}
            </ScrollView>
            <View style={[styles.buttons, inRow && styles.buttonsRow]}>
              {buttons.map((button, index) => {
                const isCancel = button.style === "cancel";
                const isDestructive = button.style === "destructive";
                return (
                  <Pressable
                    key={`${button.text ?? "OK"}-${index}`}
                    onPress={() => dismiss(current.id, button)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.button,
                      inRow && styles.buttonInRow,
                      isCancel && styles.buttonCancel,
                      isDestructive && styles.buttonDestructive,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        isCancel && styles.buttonTextCancel,
                        isDestructive && styles.buttonTextDestructive,
                      ]}
                      maxFontSizeMultiplier={maxFontScale.compact}
                      numberOfLines={2}
                    >
                      {button.text ?? "OK"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
