import { ProfileAvatar } from "@/components/ProfileAvatar";
import { formatMessageTime } from "@/lib/formatMessageTime";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  maxFontScale,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import type { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ChatRowProps {
  chatId: string;
  displayName: string;
  avatarName: string;
  avatarPhotoUrl?: string;
  avatarIcon: keyof typeof Ionicons.glyphMap;
  isDeleted: boolean;
  previewText: string | null;
  lastMessageAtMs: number | null;
  unreadCount: number;
  onPress: (chatId: string) => void;
}

function unreadBadgeLabel(count: number) {
  return count > 99 ? "99+" : String(count);
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    rowPressed: {
      backgroundColor: t.muted,
    },
    rowBody: {
      flex: 1,
      minWidth: 0,
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    chatName: {
      flex: 1,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
    },
    time: {
      fontSize: fontSizes.footnote,
      color: t.timestamp,
    },
    previewRow: {
      marginTop: spacing.xs,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      minHeight: 22,
    },
    preview: {
      flex: 1,
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
    },
    previewSpacer: {
      flex: 1,
    },
    unreadBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    unreadBadgeText: {
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.bold,
      color: t.primaryForeground,
    },
    deletedBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
      borderRadius: radius.md,
      backgroundColor: t.muted,
    },
    deletedBadgeText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: t.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    rowDeleted: {
      opacity: 0.7,
    },
  });

function ChatRowImpl({
  chatId,
  displayName,
  avatarName,
  avatarPhotoUrl,
  avatarIcon,
  isDeleted,
  previewText,
  lastMessageAtMs,
  unreadCount,
  onPress,
}: ChatRowProps) {
  const styles = useThemedStyles(createStyles);
  const hasLastMessage = lastMessageAtMs != null;
  const formattedTime = hasLastMessage
    ? formatMessageTime(new Date(lastMessageAtMs))
    : null;
  const accessibilityLabel = [
    displayName,
    isDeleted ? "excluído" : null,
    unreadCount > 0
      ? `${unreadCount} ${unreadCount === 1 ? "mensagem não lida" : "mensagens não lidas"}`
      : null,
    hasLastMessage && previewText ? `última mensagem: ${previewText}` : null,
    formattedTime,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      onPress={() => onPress(chatId)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        isDeleted && styles.rowDeleted,
      ]}
    >
      <ProfileAvatar
        name={avatarName}
        photoUrl={avatarPhotoUrl}
        icon={avatarIcon}
        size={48}
      />
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.chatName} numberOfLines={1}>
            {displayName}
          </Text>
          {isDeleted ? (
            <View style={styles.deletedBadge}>
              <Text
                style={styles.deletedBadgeText}
                maxFontSizeMultiplier={maxFontScale.compact}
              >
                Excluído
              </Text>
            </View>
          ) : null}
          {hasLastMessage ? (
            <Text style={styles.time}>{formattedTime}</Text>
          ) : null}
        </View>
        {(hasLastMessage || unreadCount > 0) && (
          <View style={styles.previewRow}>
            {hasLastMessage ? (
              <Text style={styles.preview} numberOfLines={1}>
                {previewText ?? ""}
              </Text>
            ) : (
              <View style={styles.previewSpacer} />
            )}
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text
                  style={styles.unreadBadgeText}
                  maxFontSizeMultiplier={maxFontScale.compact}
                >
                  {unreadBadgeLabel(unreadCount)}
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Pressable>
  );
}

export const ChatRow = React.memo(ChatRowImpl);
