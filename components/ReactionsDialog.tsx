import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import type { Reaction } from "@/types/chat";
import React, { useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface ReactionsDialogProps {
  visible: boolean;
  reactions: Reaction[];
  currentUserId: string;
  memberNames: Record<string, string>;
  onRemoveReaction: () => void;
  onClose: () => void;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.modalBackdrop,
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.xxxl,
    },
    card: {
      width: "100%",
      maxWidth: 320,
      maxHeight: "80%",
      backgroundColor: t.card,
      borderRadius: radius.xl,
      padding: spacing.xl,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: t.shadowOpacity * 2.5,
      shadowRadius: 12,
      elevation: 10,
    },
    title: {
      fontSize: fontSizes.headline,
      fontWeight: fontWeights.bold,
      color: t.foreground,
      textAlign: "center",
      marginBottom: spacing.lg,
    },
    barRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "flex-end",
      gap: spacing.xs,
      marginBottom: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
    },
    barItem: {
      alignItems: "center",
      gap: spacing.xs,
    },
    barEmoji: {
      fontSize: fontSizes.title2,
    },
    barFill: {
      height: 4,
      borderRadius: radius.pill,
      backgroundColor: t.primary,
      minWidth: 8,
    },
    barCount: {
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.semibold,
      color: t.mutedForeground,
    },
    list: {
      maxHeight: 260,
    },
    entry: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: spacing.md,
    },
    entryLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    entryEmoji: {
      fontSize: fontSizes.title,
    },
    entryName: {
      fontSize: fontSizes.bodySmall,
      color: t.foreground,
      fontWeight: fontWeights.medium,
    },
    removeButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    removeButtonPressed: {
      backgroundColor: t.muted,
    },
    removeText: {
      fontSize: fontSizes.footnote,
      color: t.destructive,
      fontWeight: fontWeights.medium,
    },
    divider: {
      height: 1,
      backgroundColor: t.border,
    },
  });

export function ReactionsDialog({
  visible,
  reactions,
  currentUserId,
  memberNames,
  onRemoveReaction,
  onClose,
}: ReactionsDialogProps) {
  const styles = useThemedStyles(createStyles);
  const { emojiBar, emojiCounts, maxEmojiCount, entries } = useMemo(() => {
    const counts = new Map<string, number>();
    const userOrder: Reaction[] = [];
    for (const r of reactions) {
      counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
      userOrder.push(r);
    }

    const sortedEmojis = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([emoji]) => emoji);

    const ownIdx = userOrder.findIndex((r) => r.userId === currentUserId);
    const own = ownIdx >= 0 ? [userOrder[ownIdx]] : [];
    const others = userOrder.filter((_, i) => i !== ownIdx);

    const entries = [
      ...own.map((r) => ({ ...r, isOwn: true as const })),
      ...others.map((r) => ({ ...r, isOwn: false as const })),
    ];

    return {
      emojiBar: sortedEmojis,
      emojiCounts: counts,
      maxEmojiCount: Math.max(0, ...counts.values()),
      entries,
    };
  }, [reactions, currentUserId]);

  const total = reactions.length;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Fechar reações"
      >
        <Pressable style={styles.card} onPress={() => {}} accessible={false}>
          <Text style={styles.title} accessibilityRole="header">{total} reaç{total !== 1 ? "ões" : "ão"}</Text>

          <View style={styles.barRow}>
            {emojiBar.map((emoji) => {
              const count = emojiCounts.get(emoji) ?? 0;
              const barWidth = emojiBar.length === 1
                ? 100
                : (count / maxEmojiCount) * 100;
              return (
                <View
                  key={emoji}
                  style={styles.barItem}
                  accessible
                  accessibilityLabel={`${emoji} ${count}`}
                >
                  <Text style={styles.barEmoji}>{emoji}</Text>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${Math.max(barWidth, 20)}%` },
                    ]}
                  />
                  <Text style={styles.barCount}>{count}</Text>
                </View>
              );
            })}
          </View>

          <ScrollView style={styles.list} bounces={false}>
            {entries.map((entry, idx) => (
              <React.Fragment key={`${entry.userId}-${entry.emoji}`}>
                {idx > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.entry}>
                  <View style={styles.entryLeft}>
                    <Text style={styles.entryEmoji}>{entry.emoji}</Text>
                    <Text style={styles.entryName}>
                      {entry.isOwn
                        ? "Você"
                        : memberNames[entry.userId] ?? "Participante"}
                    </Text>
                  </View>
                  {entry.isOwn ? (
                    <Pressable
                      onPress={() => {
                        onRemoveReaction();
                        onClose();
                      }}
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover sua reação ${entry.emoji}`}
                      style={({ pressed }) => [
                        styles.removeButton,
                        pressed && styles.removeButtonPressed,
                      ]}
                    >
                      <Text style={styles.removeText}>Toque para remover</Text>
                    </Pressable>
                  ) : null}
                </View>
              </React.Fragment>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
