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
import { Pressable, StyleSheet, Text, View } from "react-native";

export interface ChatInfoAction {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  active?: boolean;
  accessibilityLabel?: string;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      justifyContent: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    action: {
      flex: 1,
      maxWidth: 96,
      alignItems: "center",
      gap: spacing.sm,
    },
    iconPill: {
      width: "100%",
      height: 56,
      borderRadius: radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.muted,
    },
    iconPillActive: {
      backgroundColor: t.primaryTintStrong,
    },
    pressed: {
      opacity: 0.7,
    },
    label: {
      fontSize: fontSizes.footnote,
      color: t.foreground,
      textAlign: "center",
    },
  });

export function ChatInfoActions({ actions }: { actions: ChatInfoAction[] }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (actions.length === 0) return null;

  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
        >
          <View
            style={[styles.iconPill, action.active && styles.iconPillActive]}
          >
            <Ionicons
              name={action.icon}
              size={24}
              color={action.active ? theme.primary : theme.foreground}
            />
          </View>
          <Text
            style={styles.label}
            numberOfLines={1}
            maxFontSizeMultiplier={maxFontScale.compact}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
