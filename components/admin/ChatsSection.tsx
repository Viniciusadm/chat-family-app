import { ProfileAvatar } from "@/components/ProfileAvatar";
import { getChatDisplayName } from "@/lib/chatDisplayName";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { AppMember, Chat } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { createAdminCardStyles } from "./adminStyles";
import { SectionTitle } from "./SectionTitle";

type ChatsSectionProps = {
  chats: Chat[];
  members: AppMember[];
  currentUserId: string;
  canMutate: boolean;
  onCreateChat: () => void;
  onEditChat: (chat: Chat) => void;
  onDeleteChat: (chat: Chat) => void;
};

export function ChatsSection({
  chats,
  members,
  currentUserId,
  canMutate,
  onCreateChat,
  onEditChat,
  onDeleteChat,
}: ChatsSectionProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createAdminCardStyles);
  const memberProfiles = Object.fromEntries(
    members.map((member) => [member.id, { name: member.name }])
  );

  return (
    <>
      <SectionTitle icon="chatbubbles-outline" label="Conversas" />
      {chats.map((chat) => {
        const displayName = getChatDisplayName(
          chat,
          currentUserId,
          memberProfiles
        );

        return (
          <View key={chat.id} style={styles.card}>
            <View style={styles.cardRow}>
              <ProfileAvatar
                name={displayName}
                photoUrl={chat.isGroup ? chat.photoUrl : undefined}
                icon={chat.isGroup ? "people-outline" : "chatbubble-outline"}
                size={40}
              />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{displayName}</Text>
                <Text style={styles.cardMeta}>
                  {chat.participants.length} membros
                </Text>
              </View>
              {canMutate && chat.isGroup ? (
                <>
                  <Pressable
                    onPress={() => onEditChat(chat)}
                    style={styles.iconAct}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar conversa ${displayName}`}
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={22}
                      color={theme.primary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => onDeleteChat(chat)}
                    style={styles.iconAct}
                    hitSlop={4}
                    accessibilityRole="button"
                    accessibilityLabel={`Apagar conversa ${displayName}`}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={22}
                      color={theme.destructive}
                    />
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        );
      })}
      {canMutate ? (
        <Pressable
          onPress={onCreateChat}
          accessibilityRole="button"
          style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color={theme.foreground}
          />
          <Text style={styles.outlineBtnText}>Criar conversa</Text>
        </Pressable>
      ) : null}
    </>
  );
}
