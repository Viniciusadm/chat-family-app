import { fontSizes, maxFontScale, radius, spacing } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  OVER_MEDIA_FOREGROUND,
  OVER_MEDIA_PRESSED,
  OVER_MEDIA_SURFACE,
} from "./overMediaColors";

const DESTRUCTIVE_COLOR = "#ff6b6b";

export interface ViewerMenuItem {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface ViewerMenuProps {
  topInset: number;
  items: ViewerMenuItem[];
  onClose: () => void;
}

export function ViewerMenu({ topInset, items, onClose }: ViewerMenuProps) {
  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={onClose}
      accessibilityLabel="Fechar menu"
    >
      <View
        style={[styles.card, { top: topInset + spacing.sm }]}
        accessibilityRole="menu"
      >
        {items.map((item) => {
          const color = item.destructive
            ? DESTRUCTIVE_COLOR
            : OVER_MEDIA_FOREGROUND;
          return (
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
              <Ionicons name={item.icon} size={20} color={color} />
              <Text
                style={[styles.label, { color }]}
                maxFontSizeMultiplier={maxFontScale.compact}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    right: spacing.sm,
    minWidth: 220,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: OVER_MEDIA_SURFACE,
    elevation: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  itemPressed: {
    backgroundColor: OVER_MEDIA_PRESSED,
  },
  label: {
    fontSize: fontSizes.body,
  },
});
