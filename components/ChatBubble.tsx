import { ReactionBubble } from "@/components/ReactionBubble";
import type { Message, Reaction } from "@/types/chat";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  lineHeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { MaterialIcons } from "@expo/vector-icons";
import React, { useMemo, useRef } from "react";
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AudioBubble } from "./AudioBubble";
import { ImageBubble } from "./ImageBubble";
import { ProfileAvatar } from "./ProfileAvatar";
import { QuotedReply } from "./QuotedReply";

interface ChatBubbleProps {
  message: Message;
  isSelf: boolean;
  isOnline: boolean;
  shouldPlay?: boolean;
  nextInSequenceId?: string;
  playbackRate: 1 | 1.5 | 2;
  onRequestPlay: (messageId: string) => void;
  onAudioFinished: (nextMessageId?: string) => void;
  onPlaybackRateChange: (rate: 1 | 1.5 | 2) => void;
  readReceipt?: "loading" | "sent" | "read";
  senderName?: string;
  senderPhotoUrl?: string | null;
  reactions?: Reaction[];
  currentUserId?: string;
  onReactionPress?: (messageId: string, pageX: number, pageY: number, width: number, height: number) => void;
  onReactionChipPress?: (messageId: string) => void;
  onSenderPress?: (senderId: string) => void;
  onReply?: (message: Message) => void;
  onCopy?: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  canModify?: boolean;
  onQuotedReplyPress?: (replyToMessageId: string) => void;
  onOpenImage?: (uri: string) => void;
  onRetryImage?: (message: Message) => void;
  onRetryAudio?: (message: Message) => void;
  onRetryText?: (message: Message) => void;
  replyAvailable?: boolean;
  highlighted?: boolean;
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const RECEIPT_LABELS: Record<"loading" | "sent" | "read", string> = {
  loading: "enviando",
  sent: "enviada",
  read: "lida",
};

function describeMessageContent(message: Message, audioUnavailable: boolean) {
  if (message.isDeleted) return "Mensagem apagada";
  if (message.type === "image") return "Imagem";
  if (message.type === "audio") {
    return audioUnavailable ? "Áudio indisponível offline" : "Mensagem de voz";
  }
  if (message.decryptionFailed) return "Não foi possível decifrar esta mensagem.";
  return message.content;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    wrapSelf: {
      justifyContent: "flex-end",
    },
    wrapOther: {
      justifyContent: "flex-start",
      alignItems: "flex-end",
    },
    bubble: {
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: "transparent",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: t.shadowOpacity * 0.75,
      shadowRadius: 2,
      elevation: 1,
    },
    column: {
      maxWidth: "80%",
    },
    columnSelf: {
      alignItems: "flex-end",
    },
    columnOther: {
      alignItems: "flex-start",
    },
    reactionRow: {
      marginTop: -spacing.sm,
      zIndex: 1,
    },
    reactionRowSelf: {
      alignItems: "flex-end",
    },
    reactionRowOther: {
      alignItems: "flex-start",
    },
    bubbleSelf: {
      backgroundColor: t.bubbleSelf,
      borderBottomRightRadius: 6,
    },
    bubbleOther: {
      backgroundColor: t.bubbleOther,
      borderBottomLeftRadius: 6,
    },
    bubbleImage: {
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
    },
    bubblePressed: {
      opacity: 0.85,
    },
    bubbleHighlighted: {
      borderColor: t.primary,
    },
    text: {
      fontSize: fontSizes.bodySmall,
      lineHeight: lineHeights.body,
    },
    textSelf: {
      color: t.bubbleSelfForeground,
    },
    textOther: {
      color: t.bubbleOtherForeground,
    },
    encryptedFallback: {
      fontStyle: "italic",
      opacity: 0.75,
    },
    deletedText: {
      fontSize: fontSizes.subhead,
      fontStyle: "italic",
      color: t.mutedForeground,
    },
    editedLabel: {
      fontSize: fontSizes.caption,
      fontStyle: "italic",
      color: t.timestamp,
    },
    retryRow: {
      marginTop: spacing.xs,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    retryText: {
      fontSize: fontSizes.footnote,
      color: t.destructive,
    },
    meta: {
      marginTop: spacing.xs,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    metaSelf: {
      alignItems: "flex-end",
      justifyContent: "flex-end",
    },
    metaOther: {
      alignItems: "flex-start",
    },
    timestamp: {
      fontSize: fontSizes.caption,
      color: t.timestamp,
    },
    receiptIconSlot: {
      width: 16,
      alignItems: "center",
      marginLeft: spacing.xxs,
    },
    senderName: {
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.semibold,
      marginBottom: spacing.xs,
      color: t.timestamp,
    },
    senderPressed: {
      opacity: 0.72,
    },
  });

function ChatBubbleImpl({
  message,
  isSelf,
  isOnline,
  shouldPlay,
  nextInSequenceId,
  playbackRate,
  onRequestPlay,
  onAudioFinished,
  onPlaybackRateChange,
  readReceipt,
  senderName,
  senderPhotoUrl,
  reactions,
  currentUserId,
  onReactionPress,
  onReactionChipPress,
  onSenderPress,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  canModify = false,
  onQuotedReplyPress,
  onRetryImage,
  onRetryAudio,
  onRetryText,
  onOpenImage,
  replyAvailable = true,
  highlighted = false,
}: ChatBubbleProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const selfReadReceipt = isSelf ? readReceipt ?? "sent" : undefined;
  const audioSource =
    message.type === "audio"
      ? message.audioLocalUri ?? message.audioRemoteUrl ?? message.audioUrl
      : undefined;
  const audioUnavailableOffline =
    message.type === "audio" && !message.audioLocalUri && !isOnline;
  const isImage = message.type === "image";
  const fullImageUri = isImage
    ? message.imageLocalUri ??
      message.imageRemoteUrl ??
      message.imageUrl ??
      null
    : null;
  const bubbleRef = useRef<View>(null);
  const swipeX = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !message.isDeleted &&
          gesture.dx > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
        onPanResponderMove: (_, gesture) => {
          swipeX.setValue(Math.min(gesture.dx, 56));
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 48 && !message.isDeleted) {
            onReply?.(message);
          }
          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(swipeX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [message, onReply, swipeX]
  );

  const handleLongPress = () => {
    if (!onReactionPress) return;
    if (message.isDeleted) return;
    bubbleRef.current?.measureInWindow((x, y, width, height) => {
      onReactionPress(message.id, x, y, width, height);
    });
  };

  const handleSenderPress = onSenderPress
    ? () => onSenderPress(message.senderId)
    : undefined;
  const replyToId = message.replyTo?.id;
  const handleQuotedReplyPress =
    onQuotedReplyPress && replyToId && replyAvailable
      ? () => onQuotedReplyPress(replyToId)
      : undefined;
  const handleReactionChipPress = onReactionChipPress
    ? () => onReactionChipPress(message.id)
    : undefined;

  const isDeleted = message.isDeleted === true;
  const isText = message.type === "text";
  const hasPlayableAudio =
    message.type === "audio" && !!audioSource && !audioUnavailableOffline;
  const hasInteractiveContent = !isDeleted && (isImage || hasPlayableAudio);
  const retryHandler =
    message.status !== "failed"
      ? undefined
      : isImage
        ? onRetryImage
        : message.type === "audio"
          ? onRetryAudio
          : onRetryText;

  const accessibilityActions: AccessibilityActionInfo[] = [];
  if (!isDeleted) {
    if (onReply) accessibilityActions.push({ name: "reply", label: "Responder" });
    if (onReactionPress) accessibilityActions.push({ name: "react", label: "Reagir" });
    if (onCopy && isText && message.content) {
      accessibilityActions.push({ name: "copy", label: "Copiar" });
    }
    if (onEdit && isSelf && isText && canModify) {
      accessibilityActions.push({ name: "edit", label: "Editar" });
    }
    if (onDelete && isSelf && canModify) {
      accessibilityActions.push({ name: "delete", label: "Apagar" });
    }
    if (handleQuotedReplyPress) {
      accessibilityActions.push({
        name: "openQuote",
        label: "Ver mensagem respondida",
      });
    }
    if (retryHandler) {
      accessibilityActions.push({ name: "retry", label: "Tentar de novo" });
    }
  }

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case "reply":
        onReply?.(message);
        break;
      case "react":
        handleLongPress();
        break;
      case "copy":
        onCopy?.(message);
        break;
      case "edit":
        onEdit?.(message);
        break;
      case "delete":
        onDelete?.(message);
        break;
      case "openQuote":
        handleQuotedReplyPress?.();
        break;
      case "retry":
        retryHandler?.(message);
        break;
    }
  };

  const accessibilityLabel = [
    senderName ? `${senderName}:` : null,
    describeMessageContent(message, audioUnavailableOffline),
    message.isEdited && !isDeleted ? "editada" : null,
    formatTime(message.timestamp),
    message.status === "failed"
      ? "não enviada"
      : selfReadReceipt && !isDeleted
        ? RECEIPT_LABELS[selfReadReceipt]
        : null,
  ]
    .filter(Boolean)
    .join(", ");
  const messageAccessibilityProps = {
    accessible: true,
    accessibilityLabel,
    accessibilityActions,
    onAccessibilityAction: handleAccessibilityAction,
  };

  return (
    <View style={[styles.wrap, isSelf ? styles.wrapSelf : styles.wrapOther]}>
      {!isSelf && senderName ? (
        <Pressable
          onPress={handleSenderPress}
          disabled={!handleSenderPress}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.senderPressed}
        >
          <ProfileAvatar name={senderName} photoUrl={senderPhotoUrl} size={28} />
        </Pressable>
      ) : null}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.column,
          isSelf ? styles.columnSelf : styles.columnOther,
          { transform: [{ translateX: swipeX }] },
        ]}
      >
        <Pressable
          ref={bubbleRef}
          onLongPress={handleLongPress}
          delayLongPress={400}
          {...(hasInteractiveContent
            ? { accessible: false }
            : messageAccessibilityProps)}
          style={({ pressed }) => [
            styles.bubble,
            isSelf ? styles.bubbleSelf : styles.bubbleOther,
            isImage ? styles.bubbleImage : null,
            highlighted ? styles.bubbleHighlighted : null,
            pressed ? styles.bubblePressed : null,
          ]}
        >
          {senderName ? (
            <Text
              style={styles.senderName}
              onPress={handleSenderPress}
              suppressHighlighting
            >
              {senderName}
            </Text>
          ) : null}
          {message.replyTo && !message.isDeleted ? (
            <QuotedReply
              reply={message.replyTo}
              available={replyAvailable}
              isSelf={isSelf}
              onPress={handleQuotedReplyPress}
            />
          ) : null}
          {message.isDeleted ? (
            <Text style={styles.deletedText}>Mensagem apagada</Text>
          ) : isImage ? (
            <ImageBubble
              message={message}
              isSelf={isSelf}
              onPress={() => {
                if (fullImageUri) onOpenImage?.(fullImageUri);
              }}
              onLongPress={handleLongPress}
              onRetry={
                message.status === "failed"
                  ? () => onRetryImage?.(message)
                  : undefined
              }
            />
          ) : message.type === "audio" && audioUnavailableOffline ? (
            <Text
              style={[
                styles.text,
                isSelf
                  ? styles.textSelf
                  : styles.textOther,
              ]}
            >
              Áudio indisponível offline
            </Text>
          ) : message.type === "audio" && audioSource ? (
            <>
              <AudioBubble
                messageId={message.id}
                audioUrl={audioSource}
                audioDuration={message.audioDuration}
                isSelf={isSelf}
                shouldPlay={Boolean(shouldPlay)}
                nextInSequenceId={nextInSequenceId}
                playbackRate={playbackRate}
                onRequestPlay={onRequestPlay}
                onAudioFinished={onAudioFinished}
                onPlaybackRateChange={onPlaybackRateChange}
              />
              {message.status === "failed" && onRetryAudio ? (
                <Pressable
                  style={styles.retryRow}
                  onPress={() => onRetryAudio(message)}
                  hitSlop={8}
                >
                  <MaterialIcons name="error-outline" size={16} color={theme.destructive} />
                  <Text style={styles.retryText}>Não enviado. Tentar de novo</Text>
                </Pressable>
              ) : null}
            </>
          ) : message.decryptionFailed ? (
            <Text
              style={[
                styles.text,
                styles.encryptedFallback,
                isSelf ? styles.textSelf : styles.textOther,
              ]}
            >
              Não foi possível decifrar esta mensagem.
            </Text>
          ) : (
            <>
              <Text
                style={[
                  styles.text,
                  isSelf
                    ? styles.textSelf
                    : styles.textOther,
                ]}
              >
                {message.content}
              </Text>
              {message.status === "failed" && onRetryText ? (
                <Pressable
                  style={styles.retryRow}
                  onPress={() => onRetryText(message)}
                  hitSlop={8}
                >
                  <MaterialIcons name="error-outline" size={16} color={theme.destructive} />
                  <Text style={styles.retryText}>Não enviada. Tentar de novo</Text>
                </Pressable>
              ) : null}
            </>
          )}
          <View
            style={[styles.meta, isSelf ? styles.metaSelf : styles.metaOther]}
            {...(hasInteractiveContent ? messageAccessibilityProps : null)}
          >
            {message.isEdited && !message.isDeleted ? (
              <Text style={styles.editedLabel}>editada</Text>
            ) : null}
            <Text style={styles.timestamp}>{formatTime(message.timestamp)}</Text>
            {selfReadReceipt && !message.isDeleted && message.status !== "failed" ? (
              <View style={styles.receiptIconSlot}>
                <MaterialIcons
                  name={
                    selfReadReceipt === "loading"
                      ? "schedule"
                      : selfReadReceipt === "read"
                        ? "done-all"
                        : "done"
                  }
                  size={14}
                  color={
                    selfReadReceipt === "read" ? theme.primary : theme.timestamp
                  }
                />
              </View>
            ) : null}
          </View>
        </Pressable>
        {reactions && currentUserId && handleReactionChipPress && !message.isDeleted ? (
          <View style={[styles.reactionRow, isSelf ? styles.reactionRowSelf : styles.reactionRowOther]}>
            <ReactionBubble
              reactions={reactions}
              currentUserId={currentUserId}
              onPress={handleReactionChipPress}
            />
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

export const ChatBubble = React.memo(ChatBubbleImpl);
