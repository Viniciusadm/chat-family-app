import type { MessageReplySnapshot } from "@/types/chat";
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
import { Pressable, StyleSheet, Text, View } from "react-native";

type ReplyPreviewProps = {
  reply: MessageReplySnapshot;
  onCancel: () => void;
};

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radius.md,
      backgroundColor: t.background,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: spacing.sm,
      overflow: "hidden",
    },
    accent: {
      alignSelf: "stretch",
      width: 3,
      backgroundColor: t.primary,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    sender: {
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.bold,
      color: t.primary,
    },
    preview: {
      marginTop: spacing.xxs,
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
    },
    cancelButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.xs,
      borderRadius: radius.pill,
    },
    cancelButtonPressed: {
      backgroundColor: t.muted,
    },
  });

export function ReplyPreview({ reply, onCancel }: ReplyPreviewProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.wrap}>
      <View style={styles.accent} />
      <View style={styles.content}>
        <Text style={styles.sender} numberOfLines={1}>
          {reply.senderName}
        </Text>
        <Text style={styles.preview} numberOfLines={1}>
          {reply.preview}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="Cancelar resposta"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onCancel}
        style={({ pressed }) => [
          styles.cancelButton,
          pressed ? styles.cancelButtonPressed : null,
        ]}
      >
        <Ionicons name="close" size={18} color={theme.mutedForeground} />
      </Pressable>
    </View>
  );
}
