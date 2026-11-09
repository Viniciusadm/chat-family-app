import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Ion = keyof typeof Ionicons.glyphMap;

interface AppHeaderProps {
  title: string;
  leading?: ReactNode;
  onBack?: () => void;
  rightIcon?: Ion;
  onRightPress?: () => void;
  rightAccessibilityLabel?: string;
  onTitlePress?: () => void;
  titleAccessibilityLabel?: string;
  rightActions?: {
    key: string;
    icon?: Ion;
    content?: ReactNode;
    onPress: () => void;
    accessibilityLabel?: string;
  }[];
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    container: {
      backgroundColor: t.chatHeader,
    },
    bar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      paddingTop: spacing.md,
    },
    iconBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
    },
    iconPlaceholder: {
      width: 36,
      height: 36,
    },
    leading: {
      marginRight: spacing.xs,
      alignItems: "center",
      justifyContent: "center",
    },
    actions: {
      minWidth: 36,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: spacing.xs,
    },
    pressed: {
      opacity: 0.7,
    },
    titleButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      alignSelf: "stretch",
    },
    titleWrap: {
      flex: 1,
      alignSelf: "stretch",
      justifyContent: "center",
      minHeight: 36,
    },
    title: {
      fontWeight: fontWeights.semibold,
      color: t.chatHeaderForeground,
    },
    titleWithBack: {
      fontSize: fontSizes.headline,
    },
    titleLarge: {
      fontSize: fontSizes.title,
    },
  });

export function AppHeader({
  title,
  leading,
  onBack,
  rightIcon,
  onRightPress,
  rightAccessibilityLabel,
  rightActions,
  onTitlePress,
  titleAccessibilityLabel,
}: AppHeaderProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const actions =
    rightActions ??
    (rightIcon && onRightPress
      ? [
          {
            key: "right",
            icon: rightIcon,
            onPress: onRightPress,
            accessibilityLabel: rightAccessibilityLabel,
          },
        ]
      : []);

  const titleText = (
    <View style={styles.titleWrap}>
      <Text
        style={[
          styles.title,
          onBack ? styles.titleWithBack : styles.titleLarge,
        ]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.bar}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={theme.chatHeaderForeground}
            />
          </Pressable>
        ) : null}

        {onTitlePress ? (
          <Pressable
            onPress={onTitlePress}
            style={({ pressed }) => [
              styles.titleButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={titleAccessibilityLabel ?? title}
          >
            {leading ? <View style={styles.leading}>{leading}</View> : null}
            {titleText}
          </Pressable>
        ) : (
          <>
            {leading ? <View style={styles.leading}>{leading}</View> : null}
            {titleText}
          </>
        )}

        {actions.length > 0 ? (
          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel}
                style={({ pressed }) => [
                  styles.iconBtn,
                  pressed && styles.pressed,
                ]}
                hitSlop={8}
              >
                {action.content ??
                  (action.icon ? (
                    <Ionicons
                      name={action.icon}
                      size={22}
                      color={theme.chatHeaderForeground}
                    />
                  ) : null)}
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.iconPlaceholder} />
        )}
      </View>
    </SafeAreaView>
  );
}
