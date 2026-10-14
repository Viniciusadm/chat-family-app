import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  maxFontScale,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import type { Reaction } from "@/types/chat";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ReactionBubbleProps {
  reactions: Reaction[];
  currentUserId: string;
  onPress: () => void;
}

function groupReactions(reactions: Reaction[], currentUserId: string) {
  const counts = new Map<string, { count: number; hasMine: boolean }>();
  for (const r of reactions) {
    const entry = counts.get(r.emoji) ?? { count: 0, hasMine: false };
    entry.count += 1;
    if (r.userId === currentUserId) entry.hasMine = true;
    counts.set(r.emoji, entry);
  }
  return Array.from(counts.entries()).map(([emoji, { count, hasMine }]) => ({
    emoji,
    count,
    hasMine,
  }));
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: t.muted,
      borderWidth: 1,
      borderColor: t.border,
    },
    chipMine: {
      backgroundColor: t.bubbleSelf,
      borderColor: t.primary,
    },
    chipPressed: {
      opacity: 0.7,
    },
    emoji: {
      fontSize: fontSizes.subhead,
    },
    count: {
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.semibold,
      color: t.mutedForeground,
    },
    countMine: {
      color: t.primary,
    },
  });

export const ReactionBubble = React.memo(function ReactionBubble({
  reactions,
  currentUserId,
  onPress,
}: ReactionBubbleProps) {
  const styles = useThemedStyles(createStyles);
  if (reactions.length === 0) return null;

  const grouped = groupReactions(reactions, currentUserId);

  return (
    <View style={styles.wrap}>
      {grouped.map(({ emoji, count, hasMine }) => (
        <Pressable
          key={emoji}
          onPress={onPress}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`${emoji} ${count}${hasMine ? ", inclui sua reação" : ""}`}
          accessibilityHint="Ver quem reagiu"
          style={({ pressed }) => [
            styles.chip,
            hasMine ? styles.chipMine : null,
            pressed ? styles.chipPressed : null,
          ]}
        >
          <Text
            style={styles.emoji}
            maxFontSizeMultiplier={maxFontScale.compact}
          >
            {emoji}
          </Text>
          <Text
            style={[styles.count, hasMine ? styles.countMine : null]}
            maxFontSizeMultiplier={maxFontScale.compact}
          >
            {count}
          </Text>
        </Pressable>
      ))}
    </View>
  );
});
