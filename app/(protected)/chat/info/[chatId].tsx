import { showAlert } from "@/components/AppAlert";
import { ChatFormModal } from "@/components/admin/ChatFormModal";
import { DeleteChatModal } from "@/components/admin/DeleteChatModal";
import {
  ChatInfoActions,
  type ChatInfoAction,
} from "@/components/chatInfo/ChatInfoActions";
import { ChatInfoHero } from "@/components/chatInfo/ChatInfoHero";
import { ChatInfoTabs } from "@/components/chatInfo/ChatInfoTabs";
import { ChatSearchPanel } from "@/components/chatInfo/ChatSearchPanel";
import { MediaTab } from "@/components/chatInfo/MediaTab";
import { MembersTab } from "@/components/chatInfo/MembersTab";
import { SettingsTab } from "@/components/chatInfo/SettingsTab";
import { ImageViewer } from "@/components/ImageViewer";
import { LoadingDots } from "@/components/LoadingDots";
import { MuteChildSheet } from "@/components/MuteChildSheet";
import { useAuth } from "@/context/AuthContext";
import { useAdminData } from "@/hooks/useAdminData";
import { useChat } from "@/hooks/useChat";
import { useChatMedia } from "@/hooks/useChatMedia";
import { useChildMutes } from "@/hooks/useChildMutes";
import { useConversationActions } from "@/hooks/useConversationActions";
import { useMemberProfiles } from "@/hooks/useMemberProfiles";
import { useReactions } from "@/hooks/useReactions";
import { useSendMessage } from "@/hooks/useSendMessage";
import {
  getChatDisplayName,
  isOtherParticipantDeleted,
} from "@/lib/chatDisplayName";
import { getChatMediaSize } from "@/lib/chatStorage";
import {
  childSendBlock,
  findDirectMute,
  findGeneralMute,
} from "@/lib/childMutes";
import { ChatRepository } from "@/lib/ChatRepository";
import { findCommonGroups } from "@/lib/commonGroups";
import {
  getImageFileSize,
  resolveMessageImageFile,
} from "@/lib/messageImageFile";
import { createReplySnapshot } from "@/lib/messageReply";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import type { Message } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type InfoTab = "members" | "media" | "settings";

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.background,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.sm,
      backgroundColor: t.background,
    },
    topBarTitle: {
      flex: 1,
      fontSize: fontSizes.headline,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
    },
    iconBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      backgroundColor: t.muted,
    },
    hero: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl,
      gap: spacing.xxl,
      backgroundColor: t.background,
    },
    content: {
      minHeight: 360,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
  });

export default function ChatInfoScreen() {
  const { chatId = "", open } = useLocalSearchParams<{
    chatId: string;
    open?: "search" | "media";
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, resolvedScheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { currentUser } = useAuth();
  const currentUserId = currentUser?.id ?? "";
  const isAdult = currentUser?.role === "adult";
  const chat = useChat(chatId);
  const memberProfiles = useMemberProfiles();
  const { mutes, now } = useChildMutes();
  const {
    members,
    chats,
    canMutate,
    updateChat,
    updateChatPhoto,
    removeChatPhoto,
    deleteChat,
  } = useAdminData();
  const { images, loading: mediaLoading } = useChatMedia(chatId);
  const { reactions, reactToMessage } = useReactions(chatId);
  const { sendText, forwardImage, deleteMessage, canModifyMessage } =
    useSendMessage(chatId);

  const [tab, setTab] = useState<InfoTab>(
    open === "media" ? "media" : "members",
  );
  const [searching, setSearching] = useState(open === "search");
  const [muteSheetOpen, setMuteSheetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editSession, setEditSession] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [storageBytes, setStorageBytes] = useState<number | null>(null);
  const [viewerMessageId, setViewerMessageId] = useState<string | null>(null);
  const deletedRef = useRef(false);

  const refreshStorage = useCallback(() => {
    if (!chatId) return;
    void getChatMediaSize(chatId)
      .catch(() => 0)
      .then(setStorageBytes);
  }, [chatId]);

  useEffect(() => {
    refreshStorage();
  }, [refreshStorage, images.length]);

  useEffect(() => {
    if (!searching) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setSearching(false);
        return true;
      },
    );
    return () => subscription.remove();
  }, [searching]);

  const chatName = getChatDisplayName(chat, currentUserId, memberProfiles);
  const { exporting, exportConversation, confirmClear } =
    useConversationActions(chatId, chatName, memberProfiles);
  const isGroup = chat?.isGroup === true;
  const otherId =
    chat && !chat.isGroup
      ? chat.participants.find((id) => id !== currentUserId)
      : undefined;
  const otherProfile = otherId ? memberProfiles[otherId] : undefined;
  const isOtherDeleted = isOtherParticipantDeleted(
    chat,
    currentUserId,
    memberProfiles,
  );
  const mutableChildId =
    isAdult && !isOtherDeleted && otherId && otherProfile?.role === "child"
      ? otherId
      : null;
  const childMuteActive = mutableChildId
    ? (findGeneralMute(mutes, mutableChildId, now) ??
        findDirectMute(mutes, mutableChildId, currentUserId, now)) !== null
    : false;
  const sendBlock =
    !isAdult && currentUserId
      ? childSendBlock(mutes, currentUserId, chat, now)
      : null;
  const commonGroups = useMemo(
    () =>
      otherId && currentUserId
        ? findCommonGroups(chats, currentUserId, otherId)
        : [],
    [chats, currentUserId, otherId],
  );
  const viewerImages = useMemo(
    () => [...images].sort((a, b) => a.createdAtMs - b.createdAtMs),
    [images],
  );

  const subtitle = isGroup
    ? `Grupo · ${chat?.participants.length ?? 0} membros`
    : isOtherDeleted
      ? "Conta excluída"
      : otherProfile?.role === "child"
        ? "Criança"
        : "Adulto";

  const getSenderName = useCallback(
    (message: Message) =>
      message.senderId === currentUserId
        ? (currentUser?.name ?? "Você")
        : (memberProfiles[message.senderId]?.name ?? "Participante"),
    [currentUser?.name, currentUserId, memberProfiles],
  );

  const openMessageInChat = useCallback(
    (messageId: string) => {
      setViewerMessageId(null);
      router.dismissTo({
        pathname: "/chat/[chatId]",
        params: { chatId, messageId },
      });
    },
    [chatId, router],
  );

  const handleClear = useCallback(() => {
    confirmClear(refreshStorage);
  }, [confirmClear, refreshStorage]);

  const openEdit = useCallback(() => {
    if (!canMutate) {
      showAlert("Sem conexão", "Conecte-se à internet para editar o grupo.");
      return;
    }
    setEditSession((session) => session + 1);
    setEditOpen(true);
  }, [canMutate]);

  const handleViewerReply = useCallback(
    (message: Message, text: string) => {
      void sendText(text, {
        replyTo: createReplySnapshot(message, getSenderName(message)),
      });
    },
    [getSenderName, sendText],
  );

  const handleViewerDelete = useCallback(
    (message: Message) => {
      showAlert(
        "Apagar mensagem",
        "Tem certeza que deseja apagar esta mensagem? Essa ação não pode ser desfeita.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Apagar",
            style: "destructive",
            onPress: () => {
              void deleteMessage(message).then((deleted) => {
                if (!deleted) {
                  showAlert(
                    "Não foi possível apagar",
                    "Mensagens só podem ser apagadas até 1 hora depois de enviadas.",
                  );
                }
              });
            },
          },
        ],
      );
    },
    [deleteMessage],
  );

  const handleForwardImage = useCallback(
    async (message: Message, targetChatId: string) => {
      if (!isAdult && currentUserId) {
        const targetChat = await ChatRepository.getLocalChat(targetChatId);
        if (childSendBlock(mutes, currentUserId, targetChat, new Date())) {
          return false;
        }
      }
      const fileUri = await resolveMessageImageFile(message).catch(() => null);
      if (!fileUri) return false;
      const size =
        message.imageWidth && message.imageHeight
          ? { width: message.imageWidth, height: message.imageHeight }
          : await getImageFileSize(fileUri).catch(() => null);
      if (!size) return false;
      return forwardImage(targetChatId, { uri: fileUri, ...size });
    },
    [currentUserId, forwardImage, isAdult, mutes],
  );

  if (!chat || !currentUser) {
    return (
      <View style={[styles.screen, styles.center]}>
        <LoadingDots />
      </View>
    );
  }

  const actions: ChatInfoAction[] = [
    {
      key: "search",
      icon: "search",
      label: "Pesquisar",
      onPress: () => setSearching(true),
      accessibilityLabel: "Pesquisar mensagens nesta conversa",
    },
    {
      key: "export",
      icon: "share-social-outline",
      label: "Exportar",
      onPress: () => void exportConversation(),
      accessibilityLabel: "Exportar conversa",
    },
  ];
  if (mutableChildId) {
    actions.push({
      key: "mute",
      icon: childMuteActive ? "volume-mute" : "volume-mute-outline",
      label: "Silenciar",
      active: childMuteActive,
      onPress: () => setMuteSheetOpen(true),
      accessibilityLabel: `Silenciar ${chatName}`,
    });
  }
  if (isAdult && isGroup) {
    actions.push({
      key: "edit",
      icon: "create-outline",
      label: "Editar",
      onPress: openEdit,
      accessibilityLabel: "Editar grupo",
    });
  }

  const tabs = [
    { key: "members" as const, label: isGroup ? "Membros" : "Em comum" },
    { key: "media" as const, label: "Mídias" },
    { key: "settings" as const, label: "Configurações" },
  ];

  return (
    <View style={styles.screen}>
      <StatusBar style={resolvedScheme === "dark" ? "light" : "dark"} />
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => (searching ? setSearching(false) : router.back())}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={searching ? "Fechar busca" : "Voltar"}
        >
          <Ionicons name="arrow-back" size={24} color={theme.foreground} />
        </Pressable>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          {searching ? "Pesquisar" : ""}
        </Text>
      </View>

      {searching ? (
        <ChatSearchPanel
          chatId={chatId}
          chatName={chatName}
          isGroup={isGroup}
          currentUserId={currentUserId}
          memberProfiles={memberProfiles}
          onOpenMessage={openMessageInChat}
        />
      ) : (
        <ScrollView
          stickyHeaderIndices={[1]}
          contentContainerStyle={{
            paddingBottom: insets.bottom + spacing.huge,
          }}
        >
          <View style={styles.hero}>
            <ChatInfoHero
              name={chatName}
              subtitle={subtitle}
              photoUrl={
                isGroup
                  ? (chat.photoUrl ?? null)
                  : (otherProfile?.photoUrl ?? null)
              }
              icon={isGroup ? "people-outline" : "person-outline"}
            />
            <ChatInfoActions actions={actions} />
          </View>
          <ChatInfoTabs tabs={tabs} selected={tab} onSelect={setTab} />
          <View style={styles.content}>
            {tab === "members" ? (
              <MembersTab
                chat={chat}
                currentUserId={currentUserId}
                currentUserIsAdult={isAdult}
                memberProfiles={memberProfiles}
                mutes={mutes}
                now={now}
                commonGroups={commonGroups}
                onAddMembers={isAdult && isGroup ? openEdit : undefined}
                onOpenMember={(memberId) =>
                  router.push({ pathname: "/profile", params: { memberId } })
                }
                onOpenChat={(groupId) =>
                  router.push({
                    pathname: "/chat/[chatId]",
                    params: { chatId: groupId },
                  })
                }
              />
            ) : tab === "media" ? (
              <MediaTab
                images={images}
                loading={mediaLoading}
                onOpen={setViewerMessageId}
              />
            ) : (
              <SettingsTab
                isGroup={isGroup}
                storageBytes={storageBytes}
                exporting={exporting}
                onExport={() => void exportConversation()}
                onClear={handleClear}
                onDeleteGroup={
                  isAdult && isGroup
                    ? () => {
                        if (!canMutate) {
                          showAlert(
                            "Sem conexão",
                            "Conecte-se à internet para apagar o grupo.",
                          );
                          return;
                        }
                        setDeleteOpen(true);
                      }
                    : undefined
                }
              />
            )}
          </View>
        </ScrollView>
      )}

      <ImageViewer
        visible={viewerMessageId !== null}
        images={viewerImages}
        initialMessageId={viewerMessageId}
        currentUserId={currentUserId}
        readOnly={isOtherDeleted}
        canReply={sendBlock === null}
        reactions={reactions}
        memberProfiles={memberProfiles}
        getSenderName={getSenderName}
        canDelete={canModifyMessage}
        onClose={() => setViewerMessageId(null)}
        onSendReply={handleViewerReply}
        onReact={(messageId, emoji) => void reactToMessage(messageId, emoji)}
        onShowInChat={openMessageInChat}
        onDelete={handleViewerDelete}
        onForward={handleForwardImage}
      />

      {mutableChildId ? (
        <MuteChildSheet
          visible={muteSheetOpen}
          childId={mutableChildId}
          childName={chatName}
          showDirectOption
          onClose={() => setMuteSheetOpen(false)}
        />
      ) : null}

      {isAdult && isGroup ? (
        <ChatFormModal
          key={editSession}
          mode="edit"
          visible={canMutate && editOpen}
          members={members}
          initialName={chat.name}
          initialParticipants={chat.participants}
          photoChat={chat}
          onSubmit={async (name, participantIds) => {
            await updateChat(chat.id, name, participantIds);
          }}
          onClose={() => setEditOpen(false)}
          onUpdatePhoto={async (localUri) => {
            await updateChatPhoto(chat.id, localUri);
          }}
          onRemovePhoto={async () => {
            await removeChatPhoto(chat.id);
          }}
        />
      ) : null}

      {isAdult && isGroup ? (
        <DeleteChatModal
          visible={canMutate && deleteOpen}
          chat={chat}
          deleteChat={async (id) => {
            await deleteChat(id);
            deletedRef.current = true;
          }}
          onClose={() => {
            setDeleteOpen(false);
            if (deletedRef.current) router.dismissTo("/");
          }}
        />
      ) : null}
    </View>
  );
}
