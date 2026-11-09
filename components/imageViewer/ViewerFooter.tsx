import { fontSizes, maxFontScale, radius, spacing } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  OVER_MEDIA_FOREGROUND,
  OVER_MEDIA_MUTED,
  OVER_MEDIA_SEND,
  OVER_MEDIA_SURFACE,
} from "./overMediaColors";

interface ViewerFooterProps {
  bottomInset: number;
  onSendReply?: (text: string) => void;
}

export function ViewerFooter({ bottomInset, onSendReply }: ViewerFooterProps) {
  const [replyText, setReplyText] = useState("");
  const hasReplyText = replyText.trim().length > 0;

  const handleSend = () => {
    const trimmed = replyText.trim();
    if (!trimmed || !onSendReply) return;
    onSendReply(trimmed);
    setReplyText("");
  };

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + spacing.md }]}>
      <View style={styles.bar}>
        {onSendReply ? (
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Responder"
            placeholderTextColor={OVER_MEDIA_MUTED}
            style={styles.replyInput}
            multiline
            maxFontSizeMultiplier={maxFontScale.compact}
            accessibilityLabel="Responder à imagem"
          />
        ) : (
          <Text
            style={styles.replyDisabled}
            numberOfLines={1}
            maxFontSizeMultiplier={maxFontScale.compact}
          >
            Respostas pausadas
          </Text>
        )}
        {hasReplyText && onSendReply ? (
          <Pressable
            onPress={handleSend}
            hitSlop={4}
            style={({ pressed }) => [
              styles.sendButton,
              pressed && styles.sendButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Enviar resposta"
          >
            <Ionicons name="send" size={20} color={OVER_MEDIA_FOREGROUND} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
    minHeight: 56,
    borderRadius: radius.pill,
    backgroundColor: OVER_MEDIA_SURFACE,
  },
  replyInput: {
    flex: 1,
    maxHeight: 120,
    paddingVertical: spacing.sm,
    color: OVER_MEDIA_FOREGROUND,
    fontSize: fontSizes.body,
  },
  replyDisabled: {
    flex: 1,
    color: OVER_MEDIA_MUTED,
    fontSize: fontSizes.body,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: OVER_MEDIA_SEND,
  },
  sendButtonPressed: {
    opacity: 0.85,
  },
});
