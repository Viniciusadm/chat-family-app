import { AppHeader } from "@/components/AppHeader";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ChatRow } from "@/components/ChatRow";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SearchBar } from "@/components/SearchBar";
import { SearchResultItem } from "@/components/SearchResultItem";
import { useAuth } from "@/context/AuthContext";
import { useChats } from "@/hooks/useChats";
import { useMemberProfiles } from "@/hooks/useMemberProfiles";
import { useMessageSearch } from "@/hooks/useMessageSearch";
import {
  getChatDisplayName,
  isOtherParticipantDeleted,
} from "@/lib/chatDisplayName";
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
import type { Chat } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

function chatKeyExtractor(chat: Chat) {
  return chat.id;
}

function lastMessagePreview(lastMessage: NonNullable<Chat["lastMessage"]>) {
  if (lastMessage.type === "audio") return "Áudio";
  if (lastMessage.type === "image") return "Foto";
  return lastMessage.text ?? "";
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.background,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    list: {
      paddingBottom: spacing.xxl,
    },
    listEmpty: {
      flexGrow: 1,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xxxl,
    },
    emptyIconWrap: {
      width: 96,
      height: 96,
      borderRadius: radius.xxl,
      backgroundColor: t.primaryTintStrong,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xxl,
    },
    emptyTitle: {
      fontSize: fontSizes.title,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
      textAlign: "center",
    },
    emptySub: {
      marginTop: spacing.md,
      fontSize: fontSizes.subhead,
      lineHeight: lineHeights.bodySmall,
      color: t.mutedForeground,
      textAlign: "center",
      maxWidth: 280,
    },
    searchEmpty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xxxl,
      paddingTop: spacing.giant,
    },
    searchEmptyTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
      textAlign: "center",
    },
    searchEmptySub: {
      marginTop: spacing.xs,
      fontSize: fontSizes.subhead,
      lineHeight: lineHeights.bodySmall,
      color: t.mutedForeground,
      textAlign: "center",
      maxWidth: 280,
    },
  });

export default function ChatListScreen() {
  const router = useRouter();
  const { chats, loading, refresh } = useChats();
  const [refreshing, setRefreshing] = useState(false);
  const { currentUser } = useAuth();
  const memberProfiles = useMemberProfiles();
  const search = useMessageSearch();
  const chatById = useMemo(
    () => new Map(chats.map((c) => [c.id, c])),
    [chats]
  );
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const canAccessAdmin = currentUser?.role === "adult";
  const currentUserId = currentUser?.id;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [refresh]);

  const openChat = useCallback(
    (chatId: string) => {
      router.push(`/chat/${chatId}`);
    },
    [router]
  );

  const renderChatRow = useCallback(
    ({ item: chat }: ListRenderItemInfo<Chat>) => {
      const otherParticipantId =
        !chat.isGroup && currentUserId
          ? chat.participants.find((id) => id !== currentUserId)
          : undefined;
      const otherProfile = otherParticipantId
        ? memberProfiles[otherParticipantId]
        : undefined;
      const displayName = getChatDisplayName(
        chat,
        currentUserId,
        memberProfiles
      );

      return (
        <ChatRow
          chatId={chat.id}
          displayName={displayName}
          avatarName={otherProfile?.name ?? displayName}
          avatarPhotoUrl={
            chat.isGroup
              ? chat.photoUrl ?? undefined
              : otherProfile?.photoUrl ?? undefined
          }
          avatarIcon={
            chat.isGroup ? "people-outline" : "chatbubble-ellipses-outline"
          }
          isDeleted={isOtherParticipantDeleted(
            chat,
            currentUserId,
            memberProfiles
          )}
          previewText={
            chat.lastMessage ? lastMessagePreview(chat.lastMessage) : null
          }
          lastMessageAtMs={chat.lastMessage?.timestamp.getTime() ?? null}
          unreadCount={chat.unreadCount}
          onPress={openChat}
        />
      );
    },
    [currentUserId, memberProfiles, openChat]
  );

  return (
    <ScreenContainer style={styles.screen} edges={["bottom"]}>
      <AppHeader
        title="Conversas"
        rightActions={[
          {
            key: "profile",
            content: (
              <ProfileAvatar
                name={currentUser?.name}
                photoUrl={currentUser?.photoUrl}
                size={30}
              />
            ),
            onPress: () => router.push("/profile"),
            accessibilityLabel: "Perfil",
          },
          ...(canAccessAdmin
            ? [
                {
                  key: "admin",
                  icon: "settings-outline" as const,
                  onPress: () => router.push("/admin"),
                  accessibilityLabel: "Gerenciamento",
                },
              ]
            : []),
        ]}
      />
      <SearchBar value={search.query} onChangeText={search.setQuery} />
      {search.isSearching ? (
        search.loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : search.error ? (
          <View style={styles.searchEmpty}>
            <Text style={styles.searchEmptyTitle}>
              Não foi possível buscar
            </Text>
            <Text style={styles.searchEmptySub}>
              Tente novamente em alguns instantes.
            </Text>
          </View>
        ) : search.results.length === 0 ? (
          <View style={styles.searchEmpty}>
            <Text style={styles.searchEmptyTitle}>Nenhum resultado</Text>
            <Text style={styles.searchEmptySub}>
              Não encontramos mensagens com “{search.query.trim()}”.
            </Text>
          </View>
        ) : (
          <FlatList
            data={search.results}
            keyExtractor={(r) => r.message.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const chat = chatById.get(item.message.chatId);
              const isMine = item.message.senderId === currentUser?.id;
              const chatName = chat
                ? getChatDisplayName(chat, currentUser?.id, memberProfiles)
                : "Conversa";
              const isGroup = chat?.isGroup ?? false;
              const otherName =
                memberProfiles[item.message.senderId]?.name ?? null;
              const senderLabel = isMine
                ? "Você"
                : isGroup
                  ? otherName
                  : null;
              return (
                <SearchResultItem
                  result={item}
                  chatName={chatName}
                  senderLabel={senderLabel}
                  isMine={isMine}
                  onPress={() =>
                    router.push(
                      `/chat/${item.message.chatId}?messageId=${item.message.id}`
                    )
                  }
                />
              );
            }}
          />
        )
      ) : chats.length === 0 && loading ? (
        <View
          style={styles.center}
          accessibilityLabel="Carregando conversas"
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={chatKeyExtractor}
          contentContainerStyle={[
            styles.list,
            chats.length === 0 && styles.listEmpty,
          ]}
          renderItem={renderChatRow}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
              progressBackgroundColor={theme.card}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={44}
                  color={theme.primary}
                />
              </View>
              <Text style={styles.emptyTitle}>Nenhuma conversa por aqui</Text>
              <Text style={styles.emptySub}>
                Quando alguém iniciar um chat, ele aparecerá nesta lista.
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
}
