import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/context/AuthContext";
import type { MemberProfile } from "@/hooks/useMemberProfiles";
import {
  getChatDisplayName,
  isOtherParticipantDeleted,
} from "@/lib/chatDisplayName";
import { ChatRepository } from "@/lib/ChatRepository";
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
import type { Chat } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface ForwardChatPickerProps {
  topInset: number;
  bottomInset: number;
  memberProfiles: Record<string, MemberProfile>;
  onSelect: (chatId: string) => void;
  onClose: () => void;
}

interface ForwardTarget {
  chat: Chat;
  displayName: string;
  photoUrl: string | null;
  avatarName: string;
}

export function ForwardChatPicker({
  topInset,
  bottomInset,
  memberProfiles,
  onSelect,
  onClose,
}: ForwardChatPickerProps) {
  const { currentUser, tenantId } = useAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [chats, setChats] = useState<Chat[] | null>(null);
  const currentUserId = currentUser?.id;

  useEffect(() => {
    if (!tenantId) {
      setChats([]);
      return;
    }
    let active = true;
    ChatRepository.getLocalChats(tenantId)
      .then((localChats) => {
        if (active) setChats(localChats);
      })
      .catch(() => {
        if (active) setChats([]);
      });
    return () => {
      active = false;
    };
  }, [tenantId]);

  const targets = useMemo<ForwardTarget[]>(() => {
    if (!chats || !currentUserId) return [];
    return chats
      .filter(
        (chat) =>
          chat.participants.includes(currentUserId) &&
          !isOtherParticipantDeleted(chat, currentUserId, memberProfiles)
      )
      .map((chat) => {
        const displayName = getChatDisplayName(
          chat,
          currentUserId,
          memberProfiles
        );
        const otherId = chat.isGroup
          ? undefined
          : chat.participants.find((id) => id !== currentUserId);
        const otherProfile = otherId ? memberProfiles[otherId] : undefined;
        return {
          chat,
          displayName,
          avatarName: otherProfile?.name ?? displayName,
          photoUrl: chat.isGroup
            ? chat.photoUrl ?? null
            : otherProfile?.photoUrl ?? null,
        };
      });
  }, [chats, currentUserId, memberProfiles]);

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Cancelar encaminhamento"
        >
          <Ionicons name="arrow-back" size={24} color={theme.foreground} />
        </Pressable>
        <Text
          style={styles.title}
          maxFontSizeMultiplier={maxFontScale.compact}
          accessibilityRole="header"
        >
          Encaminhar para…
        </Text>
      </View>
      {chats === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={targets}
          keyExtractor={(item) => item.chat.id}
          contentContainerStyle={{ paddingBottom: bottomInset + spacing.lg }}
          ListEmptyComponent={
            <Text style={styles.empty}>Nenhuma conversa disponível.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item.chat.id)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Encaminhar para ${item.displayName}`}
            >
              <ProfileAvatar
                name={item.avatarName}
                photoUrl={item.photoUrl}
                size={44}
                icon={
                  item.chat.isGroup
                    ? "people-outline"
                    : "chatbubble-ellipses-outline"
                }
              />
              <Text
                style={styles.rowName}
                numberOfLines={1}
                maxFontSizeMultiplier={maxFontScale.compact}
              >
                {item.displayName}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.headerBorder,
    },
    headerButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    empty: {
      padding: spacing.xl,
      textAlign: "center",
      color: t.mutedForeground,
      fontSize: fontSizes.subhead,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
    },
    rowPressed: {
      backgroundColor: t.muted,
    },
    rowName: {
      flex: 1,
      fontSize: fontSizes.body,
      color: t.foreground,
    },
  });
