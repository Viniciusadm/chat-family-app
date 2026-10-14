import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  lineHeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import type { MessageReplySnapshot } from "@/types/chat";
import { Pressable, StyleSheet, Text, View } from "react-native";

type QuotedReplyProps = {
  reply: MessageReplySnapshot;
  available: boolean;
  isSelf: boolean;
  onPress?: () => void;
};

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    wrap: {
      minWidth: 180,
      maxWidth: 280,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      flexDirection: "row",
      overflow: "hidden",
      marginBottom: spacing.sm,
    },
    wrapSelf: {
      backgroundColor: t.overlayLight,
    },
    wrapOther: {
      backgroundColor: t.background,
    },
    accent: {
      width: 3,
      alignSelf: "stretch",
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
      lineHeight: lineHeights.subhead,
      color: t.mutedForeground,
    },
    unavailable: {
      fontSize: fontSizes.subhead,
      fontStyle: "italic",
      color: t.mutedForeground,
    },
    pressed: {
      opacity: 0.75,
    },
  });

export function QuotedReply({
  reply,
  available,
  isSelf,
  onPress,
}: QuotedReplyProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      disabled={!available || !onPress}
      onPress={onPress}
      accessibilityRole={available && onPress ? "button" : undefined}
      accessibilityLabel={
        available
          ? `Respondendo a ${reply.senderName}: ${reply.preview}`
          : "Mensagem indisponível"
      }
      style={({ pressed }) => [
        styles.wrap,
        isSelf ? styles.wrapSelf : styles.wrapOther,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.accent} />
      <View style={styles.content}>
        {available ? (
          <>
            <Text style={styles.sender} numberOfLines={1}>
              {reply.senderName}
            </Text>
            <Text style={styles.preview} numberOfLines={2}>
              {reply.preview}
            </Text>
          </>
        ) : (
          <Text style={styles.unavailable} numberOfLines={1}>
            Mensagem indisponível
          </Text>
        )}
      </View>
    </Pressable>
  );
}
