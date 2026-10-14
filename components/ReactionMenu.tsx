import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { selectionFeedback } from "@/lib/haptics";
import {
  fontSizes,
  fontWeights,
  maxFontScale,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const EMOJI_NAMES: Record<string, string> = {
  "👍": "joinha",
  "❤️": "coração",
  "😂": "risada",
  "😮": "surpresa",
  "😢": "choro",
  "🙏": "mãos juntas",
};
const EMOJI_ROW_HEIGHT = 56;
const ACTIONS_ROW_HEIGHT = 56;
const GAP = 8;

type ActionItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
};

interface ReactionMenuProps {
  visible: boolean;
  targetX: number;
  targetY: number;
  targetWidth: number;
  targetHeight: number;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      gap: spacing.sm,
    },
    menu: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxs,
      paddingHorizontal: spacing.sm,
      height: EMOJI_ROW_HEIGHT,
      backgroundColor: t.card,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: t.shadowOpacity * 1.8,
      shadowRadius: 8,
      elevation: 8,
    },
    emojiButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    emojiButtonPressed: {
      backgroundColor: t.muted,
    },
    emojiText: {
      fontSize: fontSizes.largeTitle,
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: t.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: t.border,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: t.shadowOpacity * 1.4,
      shadowRadius: 6,
      elevation: 6,
    },
    actionButton: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xxs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.md,
    },
    actionButtonPressed: {
      backgroundColor: t.muted,
    },
    actionLabel: {
      fontSize: fontSizes.caption,
      color: t.foreground,
      fontWeight: fontWeights.medium,
      textAlign: "center",
    },
    actionLabelDestructive: {
      color: t.destructive,
    },
  });

export function ReactionMenu({
  visible,
  targetX,
  targetY,
  targetWidth,
  targetHeight,
  onEmojiSelect,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onCopy,
}: ReactionMenuProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scale.setValue(0.5);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          damping: 14,
          stiffness: 200,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, scale, opacity]);

  const actions: ActionItem[] = [];
  if (onReply) {
    actions.push({
      key: "reply",
      label: "Responder",
      icon: "arrow-undo-outline",
      onPress: onReply,
    });
  }
  if (onCopy) {
    actions.push({
      key: "copy",
      label: "Copiar",
      icon: "copy-outline",
      onPress: onCopy,
    });
  }
  if (onEdit) {
    actions.push({
      key: "edit",
      label: "Editar",
      icon: "pencil-outline",
      onPress: onEdit,
    });
  }
  if (onDelete) {
    actions.push({
      key: "delete",
      label: "Apagar",
      icon: "trash-outline",
      onPress: onDelete,
      destructive: true,
    });
  }

  const { width: screenWidth } = Dimensions.get("window");
  const menuWidth = QUICK_EMOJIS.length * 44 + 16;

  let menuX = targetX + targetWidth / 2 - menuWidth / 2;
  if (menuX < 8) menuX = 8;
  if (menuX + menuWidth > screenWidth - 8) menuX = screenWidth - menuWidth - 8;

  const totalHeight =
    EMOJI_ROW_HEIGHT + (actions.length > 0 ? ACTIONS_ROW_HEIGHT + 8 : 0);
  const aboveY = targetY - totalHeight - GAP;
  const containerY = aboveY < 8 ? targetY + targetHeight + GAP : aboveY;

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="Fechar menu da mensagem"
      >
        <Animated.View
          style={[
            styles.container,
            {
              left: menuX,
              top: containerY,
              opacity,
              transform: [{ scale }],
              width: menuWidth,
            },
          ]}
        >
          <View style={styles.menu}>
            {QUICK_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  selectionFeedback();
                  onEmojiSelect(emoji);
                }}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`Reagir com ${EMOJI_NAMES[emoji] ?? emoji}`}
                style={({ pressed }) => [
                  styles.emojiButton,
                  pressed ? styles.emojiButtonPressed : null,
                ]}
              >
                <Text
                  style={styles.emojiText}
                  maxFontSizeMultiplier={maxFontScale.compact}
                >
                  {emoji}
                </Text>
              </Pressable>
            ))}
          </View>
          {actions.length > 0 ? (
            <View style={styles.actionsRow}>
              {actions.map((action) => (
                <Pressable
                  key={action.key}
                  onPress={action.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed ? styles.actionButtonPressed : null,
                  ]}
                >
                  <Ionicons
                    name={action.icon}
                    size={20}
                    color={
                      action.destructive ? theme.destructive : theme.foreground
                    }
                  />
                  <Text
                    maxFontSizeMultiplier={maxFontScale.compact}
                    style={[
                      styles.actionLabel,
                      action.destructive ? styles.actionLabelDestructive : null,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Animated.View>
      </Pressable>
    </View>
  );
}
