import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  lineHeights,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface InfoRowProps {
  title: string;
  subtitle?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  leading?: ReactNode;
  trailing?: ReactNode;
  destructive?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.lg,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      minHeight: 64,
    },
    pressed: {
      backgroundColor: t.muted,
    },
    leading: {
      width: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    body: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: fontSizes.body,
      lineHeight: lineHeights.body,
      fontWeight: fontWeights.medium,
      color: t.foreground,
    },
    titleDestructive: {
      color: t.destructive,
    },
    subtitle: {
      marginTop: 2,
      fontSize: fontSizes.subhead,
      lineHeight: lineHeights.subhead,
      color: t.mutedForeground,
    },
  });

export function InfoRow({
  title,
  subtitle,
  icon,
  leading,
  trailing,
  destructive,
  onPress,
  accessibilityLabel,
}: InfoRowProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const iconColor = destructive ? theme.destructive : theme.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && onPress && styles.pressed,
      ]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {leading || icon ? (
        <View style={styles.leading}>
          {leading ??
            (icon ? (
              <Ionicons name={icon} size={24} color={iconColor} />
            ) : null)}
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={[styles.title, destructive && styles.titleDestructive]}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}
