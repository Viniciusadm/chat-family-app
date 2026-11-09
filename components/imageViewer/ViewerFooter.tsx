import { EMOJI_NAMES, QUICK_EMOJIS } from "@/components/ReactionMenu";
import { selectionFeedback } from "@/lib/haptics";
import { fontSizes, maxFontScale, radius, spacing } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  OVER_MEDIA_FOREGROUND,
  OVER_MEDIA_MUTED,
  OVER_MEDIA_PRESSED,
  OVER_MEDIA_SEND,
  OVER_MEDIA_SURFACE,
} from "./overMediaColors";

const PINNED_EMOJIS = ["❤️", "🙏"];

interface ViewerFooterProps {
  bottomInset: number;
  ownReaction: string | null;
  onSendReply?: (text: string) => void;
  onReact: (emoji: string) => void;
}

interface EmojiButtonProps {
  emoji: string;
  selected: boolean;
  onPress: (emoji: string) => void;
}

function EmojiButton({ emoji, selected, onPress }: EmojiButtonProps) {
  return (
    <Pressable
      onPress={() => onPress(emoji)}
      hitSlop={4}
      style={({ pressed }) => [
        styles.emojiButton,
        selected && styles.emojiButtonSelected,
        pressed && styles.emojiButtonPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Reagir com ${EMOJI_NAMES[emoji] ?? emoji}`}
    >
      <Text style={styles.emoji} maxFontSizeMultiplier={maxFontScale.compact}>
        {emoji}
      </Text>
    </Pressable>
  );
}

export function ViewerFooter({
  bottomInset,
  ownReaction,
  onSendReply,
  onReact,
}: ViewerFooterProps) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const hasReplyText = replyText.trim().length > 0;

  const handleSend = () => {
    const trimmed = replyText.trim();
    if (!trimmed || !onSendReply) return;
    onSendReply(trimmed);
    setReplyText("");
  };

  const handleReact = (emoji: string) => {
    selectionFeedback();
    setExpanded(false);
    onReact(emoji);
  };

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + spacing.md }]}>
      {expanded ? (
        <View style={styles.emojiRow}>
          {QUICK_EMOJIS.map((emoji) => (
            <EmojiButton
              key={emoji}
              emoji={emoji}
              selected={ownReaction === emoji}
              onPress={handleReact}
            />
          ))}
        </View>
      ) : null}
      <View style={styles.bar}>
        {onSendReply ? (
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            onFocus={() => setExpanded(false)}
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
        ) : (
          <>
            {PINNED_EMOJIS.map((emoji) => (
              <EmojiButton
                key={emoji}
                emoji={emoji}
                selected={ownReaction === emoji}
                onPress={handleReact}
              />
            ))}
            <Pressable
              onPress={() => setExpanded((value) => !value)}
              hitSlop={4}
              style={({ pressed }) => [
                styles.emojiButton,
                (pressed || expanded) && styles.emojiButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel="Mais reações"
            >
              <Ionicons
                name="happy-outline"
                size={26}
                color={OVER_MEDIA_FOREGROUND}
              />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  emojiRow: {
    flexDirection: "row",
    alignSelf: "flex-end",
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: OVER_MEDIA_SURFACE,
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
  emojiButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiButtonSelected: {
    backgroundColor: OVER_MEDIA_PRESSED,
  },
  emojiButtonPressed: {
    backgroundColor: OVER_MEDIA_PRESSED,
  },
  emoji: {
    fontSize: 26,
  },
});
