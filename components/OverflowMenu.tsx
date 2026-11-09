import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  maxFontScale,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Modal, Pressable, StyleSheet, Text } from "react-native";

export interface OverflowMenuItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface OverflowMenuProps {
  visible: boolean;
  top: number;
  items: OverflowMenuItem[];
  onClose: () => void;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
    },
    card: {
      position: "absolute",
      right: spacing.sm,
      minWidth: 230,
      paddingVertical: spacing.xs,
      borderRadius: radius.lg,
      backgroundColor: t.card,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: t.shadowOpacity * 3,
      shadowRadius: 16,
      elevation: 10,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 48,
    },
    itemPressed: {
      backgroundColor: t.muted,
    },
    label: {
      fontSize: fontSizes.body,
      color: t.foreground,
    },
    labelDestructive: {
      color: t.destructive,
    },
  });

export function OverflowMenu({
  visible,
  top,
  items,
  onClose,
}: OverflowMenuProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      damping: 20,
      stiffness: 320,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [progress, visible]);

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Fechar menu"
      >
        <Animated.View
          style={[
            styles.card,
            { top, opacity: progress, transform: [{ scale }] },
          ]}
          accessibilityRole="menu"
        >
          {items.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => {
                onClose();
                item.onPress();
              }}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}
              accessibilityRole="menuitem"
              accessibilityLabel={item.label}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={
                  item.destructive ? theme.destructive : theme.mutedForeground
                }
              />
              <Text
                style={[
                  styles.label,
                  item.destructive && styles.labelDestructive,
                ]}
                maxFontSizeMultiplier={maxFontScale.compact}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
