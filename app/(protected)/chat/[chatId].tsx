import { ChatBubble } from "@/components/ChatBubble";
import { ChatInput, type ChatInputHandle } from "@/components/ChatInput";
import { ImageViewer } from "@/components/ImageViewer";
import { ReactionsDialog } from "@/components/ReactionsDialog";
import { useToast } from "@/components/Toast";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { DaySeparator } from "@/components/chat/DaySeparator";
import {
  MessageActionsMenu,
  type MessageActionsTarget,
} from "@/components/chat/MessageActionsMenu";
import { useAuth } from "@/context/AuthContext";
import { useChatReadReceipts } from "@/hooks/useChatReadReceipts";
import { useChat } from "@/hooks/useChat";
import { useChatJump } from "@/hooks/useChatJump";
import { useConnectivity } from "@/hooks/useConnectivity";
import { useDayBadge } from "@/hooks/useDayBadge";
import { useMemberProfiles } from "@/hooks/useMemberProfiles";
import { useMessages } from "@/hooks/useMessages";
import { useReactions } from "@/hooks/useReactions";
import {
  EDIT_DELETE_WINDOW_MS,
  useSendMessage,
} from "@/hooks/useSendMessage";
import * as Clipboard from "expo-clipboard";
import {
  getChatDisplayName,
  isOtherParticipantDeleted,
} from "@/lib/chatDisplayName";
import { buildChatListItems, type ChatListItem } from "@/lib/chatListItems";
import { lightImpact } from "@/lib/haptics";
import { createReplySnapshot } from "@/lib/messageReply";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  maxFontScale,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import type { Message, MessageReplySnapshot, Reaction } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import type { LocalTimestamp } from "@/lib/localTimestamp";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  KeyboardAvoidingView,
  useKeyboardState,
} from "react-native-keyboard-controller";

const EMPTY_REACTIONS: Reaction[] = [];
const EMPTY_PARTICIPANTS: string[] = [];
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 35 };

function keyExtractor(item: ChatListItem): string {
  return item.id;
}

function readReceiptStatus(
  message: Message,
  currentUserId: string | undefined,
  participants: string[],
  readUpTo: Record<string, LocalTimestamp> | null
): "loading" | "sent" | "read" | undefined {
  if (!currentUserId || message.senderId !== currentUserId) return undefined;
  if (message.status === "loading") return "loading";
  if (participants.length === 0) return "sent";
  const others = participants.filter((p) => p !== message.senderId);
  if (others.length === 0) return "read";
  const ts = message.createdAtMs;
  const allRead = others.every((p) => {
    const r = readUpTo?.[p];
    return r != null && r.toMillis() >= ts;
  });
  return allRead ? "read" : "sent";
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.chatBg,
    },
    messagesWrap: {
      flex: 1,
    },
    listContent: {
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    listContentEmpty: {
      flexGrow: 1,
    },
    emptyState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xxxl,
      transform: [{ scaleY: -1 }],
    },
    emptyTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
      textAlign: "center",
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    dayBadge: {
      position: "absolute",
      top: spacing.sm,
      alignSelf: "center",
      backgroundColor: t.chatHeader,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      zIndex: 2,
    },
    dayBadgeText: {
      color: t.chatHeaderForeground,
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.bold,
      textTransform: "capitalize",
    },
    jumpToLatestButton: {
      position: "absolute",
      right: spacing.lg,
      bottom: spacing.lg,
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.primary,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: t.shadowOpacity * 2,
      shadowRadius: 4,
      elevation: 4,
      zIndex: 3,
    },
    jumpToLatestButtonPressed: {
      opacity: 0.85,
    },
    readOnlyBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      backgroundColor: t.muted,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    readOnlyBannerText: {
      flexShrink: 1,
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
      textAlign: "center",
    },
  });

export default function ChatScreen() {
  const { chatId, messageId: deepLinkMessageId } = useLocalSearchParams<{
    chatId: string;
    messageId?: string;
  }>();
  const router = useRouter();
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const currentUserId = currentUser?.id;
  const { isOnline } = useConnectivity();
  const chat = useChat(chatId ?? "");
  const { messages, loading, loadOlder, revealMessage } = useMessages(chatId ?? "", {
    focusMessageId: deepLinkMessageId,
  });
  const { reactions, reactToMessage } = useReactions(chatId ?? "");
  const memberProfiles = useMemberProfiles();
  const visibleMessages = useMemo(
    () => (loading ? [] : messages),
    [loading, messages]
  );
  const chatTitle = getChatDisplayName(chat, currentUserId, memberProfiles);
  const isOtherDeleted = isOtherParticipantDeleted(
    chat,
    currentUserId,
    memberProfiles
  );
  const headerTitle = isOtherDeleted ? `${chatTitle} · Excluído` : chatTitle;
  const isGroupChat = chat?.isGroup === true;
  const participants = chat?.participants ?? EMPTY_PARTICIPANTS;
  const { readUpTo } = useChatReadReceipts(
    chatId ?? "",
    visibleMessages,
    chat?.readUpTo
  );
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const inputRef = useRef<ChatInputHandle>(null);
  const listRef = useRef<FlatList<ChatListItem>>(null);

  const {
    retryImageMessage,
    retryAudioMessage,
    retryTextMessage,
    deleteMessage,
    canModifyMessage,
  } = useSendMessage(chatId);

  const [activeAudioMessageId, setActiveAudioMessageId] = useState<string | null>(null);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [replyTo, setReplyTo] = useState<MessageReplySnapshot | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [viewerImageUri, setViewerImageUri] = useState<string | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const [reactionTarget, setReactionTarget] = useState<MessageActionsTarget | null>(null);
  const [reactionsDialogMessageId, setReactionsDialogMessageId] = useState<string | null>(null);

  const audioSequenceMap = useMemo(() => {
    const sequence = new Map<string, string | undefined>();
    for (let i = 0; i < visibleMessages.length; i += 1) {
      const current = visibleMessages[i];
      if (current.type !== "audio") continue;
      const next = visibleMessages[i + 1];
      if (
        next &&
        next.type === "audio" &&
        next.senderId === current.senderId
      ) {
        sequence.set(current.id, next.id);
      } else {
        sequence.set(current.id, undefined);
      }
    }
    return sequence;
  }, [visibleMessages]);

  const messagesById = useMemo(() => {
    return new Map(visibleMessages.map((message) => [message.id, message]));
  }, [visibleMessages]);


  useEffect(() => {
    setActiveAudioMessageId(null);
    setReplyTo(null);
    setEditingMessage(null);
    setImageViewerVisible(false);
    setViewerImageUri(null);
  }, [chatId]);

  useEffect(() => {
    if (!editingMessage) return;
    const fresh = messagesById.get(editingMessage.id);
    if (!fresh) return;
    if (fresh.isDeleted) {
      setEditingMessage(null);
      return;
    }
    if (Date.now() - fresh.timestamp.getTime() > EDIT_DELETE_WINDOW_MS) {
      setEditingMessage(null);
    }
  }, [editingMessage, messagesById]);

  const chatListData = useMemo<ChatListItem[]>(
    () => buildChatListItems(visibleMessages),
    [visibleMessages]
  );

  const {
    activeDayLabel,
    badgeOpacity,
    showJumpToLatest,
    handleScrollActivity,
    handleScrollPositionSettled,
    handleUserScrollStart,
    handleViewableItemsChanged,
  } = useDayBadge(chatId, chatListData);

  const { highlightedMessageId, jumpToMessage, handleScrollToIndexFailed } =
    useChatJump({
      chatId,
      chatListData,
      deepLinkMessageId,
      listRef,
      revealMessage,
    });

  const keepComposerFocused = useCallback(() => {
    if (!isKeyboardVisible) return;
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [isKeyboardVisible]);

  const jumpToLatestMessages = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const getSenderName = useCallback(
    (message: Message) => {
      if (message.senderId === currentUserId) {
        return currentUser?.name ?? "Você";
      }

      return memberProfiles[message.senderId]?.name ?? "Participante";
    },
    [currentUser?.name, currentUserId, memberProfiles]
  );

  const handleReplySelect = useCallback(
    (message: Message) => {
      setReplyTo(createReplySnapshot(message, getSenderName(message)));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
    [getSenderName]
  );

  const clearReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const clearEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleEditPress = useCallback((message: Message) => {
    setReplyTo(null);
    setEditingMessage(message);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const handleDeletePress = useCallback(
    (message: Message) => {
      Alert.alert(
        "Apagar mensagem",
        "Tem certeza que deseja apagar esta mensagem? Essa ação não pode ser desfeita.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Apagar",
            style: "destructive",
            onPress: () => {
              if (editingMessage?.id === message.id) {
                setEditingMessage(null);
              }
              void deleteMessage(message).then((deleted) => {
                if (!deleted) {
                  Alert.alert(
                    "Não foi possível apagar",
                    "Mensagens só podem ser apagadas até 1 hora depois de enviadas."
                  );
                }
              });
            },
          },
        ]
      );
    },
    [deleteMessage, editingMessage]
  );

  const handleCopyMessage = useCallback(async (message: Message) => {
    if (message.type !== "text" || !message.content) return;
    await Clipboard.setStringAsync(message.content);
    showToast("Mensagem copiada");
  }, [showToast]);

  const handleCopyMessageAction = useCallback(
    (message: Message) => {
      void handleCopyMessage(message);
    },
    [handleCopyMessage]
  );

  const handleReactionPress = useCallback(
    (messageId: string, x: number, y: number, width: number, height: number) => {
      lightImpact();
      setReactionTarget({ messageId, x, y, width, height });
    },
    []
  );

  const handleQuickEmojiSelect = useCallback(
    (emoji: string) => {
      if (!reactionTarget) return;
      void reactToMessage(reactionTarget.messageId, emoji);
      setReactionTarget(null);
    },
    [reactionTarget, reactToMessage]
  );

  const openReactionsDialog = useCallback((messageId: string) => {
    setReactionsDialogMessageId(messageId);
  }, []);

  const handleAudioFinished = useCallback((nextMessageId?: string) => {
    setActiveAudioMessageId(nextMessageId ?? null);
  }, []);

  const openMemberProfile = useCallback(
    (memberId: string) => {
      router.push({
        pathname: "/profile",
        params: { memberId },
      });
    },
    [router]
  );

  const openImageViewer = useCallback((uri: string) => {
    setViewerImageUri(uri);
    setImageViewerVisible(true);
  }, []);

  const closeImageViewer = useCallback(() => {
    setImageViewerVisible(false);
  }, []);

  const closeReactionMenu = useCallback(() => {
    setReactionTarget(null);
  }, []);

  const closeReactionsDialog = useCallback(() => {
    setReactionsDialogMessageId(null);
  }, []);

  const handleRemoveOwnReaction = useCallback(() => {
    if (isOtherDeleted) return;
    if (!reactionsDialogMessageId || !currentUserId) return;
    const msgReactions = reactions[reactionsDialogMessageId] ?? [];
    const own = msgReactions.find((r) => r.userId === currentUserId);
    if (own) {
      void reactToMessage(reactionsDialogMessageId, own.emoji);
    }
  }, [
    isOtherDeleted,
    reactionsDialogMessageId,
    currentUserId,
    reactions,
    reactToMessage,
  ]);

  const memberNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const [id, profile] of Object.entries(memberProfiles)) {
      names[id] = profile.name;
    }
    return names;
  }, [memberProfiles]);

  const dialogReactions = reactionsDialogMessageId
    ? (reactions[reactionsDialogMessageId] ?? EMPTY_REACTIONS)
    : EMPTY_REACTIONS;

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatListItem>) => {
      if (item.type === "separator") {
        return <DaySeparator label={item.label} />;
      }

      const message = item.message;
      const showSender = isGroupChat && message.senderId !== currentUserId;

      return (
        <ChatBubble
          message={message}
          isSelf={message.senderId === currentUserId}
          isOnline={isOnline}
          shouldPlay={activeAudioMessageId === message.id}
          nextInSequenceId={audioSequenceMap.get(message.id)}
          playbackRate={audioPlaybackRate}
          onRequestPlay={setActiveAudioMessageId}
          onAudioFinished={handleAudioFinished}
          onPlaybackRateChange={setAudioPlaybackRate}
          senderName={
            showSender
              ? memberProfiles[message.senderId]?.name ?? "Participante"
              : undefined
          }
          senderPhotoUrl={
            showSender
              ? memberProfiles[message.senderId]?.photoUrl ?? null
              : null
          }
          readReceipt={readReceiptStatus(
            message,
            currentUserId,
            participants,
            readUpTo
          )}
          reactions={reactions[message.id] ?? EMPTY_REACTIONS}
          currentUserId={currentUserId}
          onReactionPress={isOtherDeleted ? undefined : handleReactionPress}
          onReactionChipPress={isOtherDeleted ? undefined : openReactionsDialog}
          onReply={isOtherDeleted ? undefined : handleReplySelect}
          onCopy={handleCopyMessageAction}
          onEdit={isOtherDeleted ? undefined : handleEditPress}
          onDelete={isOtherDeleted ? undefined : handleDeletePress}
          canModify={
            message.senderId === currentUserId && canModifyMessage(message)
          }
          onRetryImage={isOtherDeleted ? undefined : retryImageMessage}
          onRetryAudio={isOtherDeleted ? undefined : retryAudioMessage}
          onRetryText={isOtherDeleted ? undefined : retryTextMessage}
          highlighted={highlightedMessageId === message.id}
          replyAvailable={
            !message.replyTo || messagesById.has(message.replyTo.id)
          }
          onQuotedReplyPress={jumpToMessage}
          onSenderPress={showSender ? openMemberProfile : undefined}
          onOpenImage={openImageViewer}
        />
      );
    },
    [
      activeAudioMessageId,
      audioPlaybackRate,
      audioSequenceMap,
      canModifyMessage,
      currentUserId,
      handleAudioFinished,
      handleCopyMessageAction,
      handleDeletePress,
      handleEditPress,
      handleReactionPress,
      handleReplySelect,
      highlightedMessageId,
      isGroupChat,
      isOnline,
      isOtherDeleted,
      jumpToMessage,
      memberProfiles,
      messagesById,
      openImageViewer,
      openMemberProfile,
      openReactionsDialog,
      participants,
      reactions,
      readUpTo,
      retryAudioMessage,
      retryImageMessage,
      retryTextMessage,
    ]
  );

  if (!chatId || !currentUserId) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <ChatHeader
        chat={chat}
        currentUserId={currentUserId}
        memberProfiles={memberProfiles}
        chatTitle={chatTitle}
        headerTitle={headerTitle}
        onBack={() => router.back()}
      />
      <View style={styles.messagesWrap}>
        {activeDayLabel ? (
          <Animated.View
            style={[styles.dayBadge, { opacity: badgeOpacity }]}
            pointerEvents="none"
          >
            <Text
              style={styles.dayBadgeText}
              maxFontSizeMultiplier={maxFontScale.compact}
            >
              {activeDayLabel}
            </Text>
          </Animated.View>
        ) : null}
        <FlatList
          ref={listRef}
          key={chatId}
          inverted
          data={chatListData}
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.5}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.listContent,
            chatListData.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={40}
                  color={theme.mutedForeground}
                />
                <Text style={styles.emptyTitle}>Nenhuma mensagem ainda</Text>
                <Text style={styles.emptySubtitle}>
                  Envie a primeira mensagem para começar a conversa.
                </Text>
              </View>
            )
          }
          keyboardDismissMode="none"
          keyboardShouldPersistTaps="always"
          onTouchStart={keepComposerFocused}
          onScrollBeginDrag={handleUserScrollStart}
          onMomentumScrollBegin={handleUserScrollStart}
          onScroll={handleScrollActivity}
          onScrollEndDrag={handleScrollPositionSettled}
          onMomentumScrollEnd={handleScrollPositionSettled}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          scrollEventThrottle={16}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={11}
          renderItem={renderItem}
        />
        {loading ? (
          <View
            style={styles.loadingOverlay}
            pointerEvents="none"
            accessibilityLabel="Carregando mensagens"
            accessibilityLiveRegion="polite"
          >
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : null}
        <ReactionsDialog
          visible={reactionsDialogMessageId !== null}
          reactions={dialogReactions}
          currentUserId={currentUserId}
          memberNames={memberNames}
          onRemoveReaction={handleRemoveOwnReaction}
          onClose={closeReactionsDialog}
        />
        {showJumpToLatest ? (
          <Pressable
            accessibilityLabel="Voltar para mensagens atuais"
            accessibilityRole="button"
            onPress={jumpToLatestMessages}
            style={({ pressed }) => [
              styles.jumpToLatestButton,
              pressed ? styles.jumpToLatestButtonPressed : null,
            ]}
          >
            <Ionicons
              name="chevron-down"
              size={24}
              color={theme.primaryForeground}
            />
          </Pressable>
        ) : null}
      </View>
      {isOtherDeleted ? (
        <View style={styles.readOnlyBanner}>
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color={theme.mutedForeground}
          />
          <Text style={styles.readOnlyBannerText}>
            Este usuário foi excluído. As mensagens são apenas leitura.
          </Text>
        </View>
      ) : (
        <ChatInput
          ref={inputRef}
          chatId={chatId}
          replyTo={replyTo}
          onCancelReply={clearReply}
          onSend={jumpToLatestMessages}
          editingMessage={editingMessage}
          onCancelEdit={clearEdit}
        />
      )}
    </KeyboardAvoidingView>
      <ImageViewer
        uri={viewerImageUri}
        visible={imageViewerVisible}
        onClose={closeImageViewer}
      />
      {reactionTarget && !isOtherDeleted ? (
        <MessageActionsMenu
          target={reactionTarget}
          message={messagesById.get(reactionTarget.messageId)}
          currentUserId={currentUserId}
          canModifyMessage={canModifyMessage}
          onEmojiSelect={handleQuickEmojiSelect}
          onClose={closeReactionMenu}
          onReply={handleReplySelect}
          onCopy={handleCopyMessageAction}
          onEdit={handleEditPress}
          onDelete={handleDeletePress}
        />
      ) : null}
    </View>
  );
}
