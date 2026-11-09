import { SearchBar } from "@/components/SearchBar";
import { SearchResultItem } from "@/components/SearchResultItem";
import { useMessageSearch } from "@/hooks/useMessageSearch";
import type { MemberProfile } from "@/hooks/useMemberProfiles";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { fontSizes, spacing, type ThemeTokens } from "@/theme/tokens";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface ChatSearchPanelProps {
  chatId: string;
  chatName: string;
  isGroup: boolean;
  currentUserId: string;
  memberProfiles: Record<string, MemberProfile>;
  onOpenMessage: (messageId: string) => void;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    center: {
      alignItems: "center",
      paddingVertical: spacing.huge,
      paddingHorizontal: spacing.xl,
    },
    hint: {
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
      textAlign: "center",
    },
    list: {
      paddingBottom: spacing.huge,
    },
  });

export function ChatSearchPanel({
  chatId,
  chatName,
  isGroup,
  currentUserId,
  memberProfiles,
  onOpenMessage,
}: ChatSearchPanelProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const search = useMessageSearch({ chatId });

  return (
    <View style={styles.root}>
      <SearchBar
        value={search.query}
        onChangeText={search.setQuery}
        placeholder={`Buscar em ${chatName}`}
        autoFocus
      />
      {!search.isSearching ? (
        <View style={styles.center}>
          <Text style={styles.hint}>
            Digite pelo menos 2 letras para buscar nas mensagens desta conversa.
          </Text>
        </View>
      ) : search.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.primary} />
        </View>
      ) : search.results.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.hint}>Nenhuma mensagem encontrada.</Text>
        </View>
      ) : (
        <FlatList
          data={search.results}
          keyExtractor={(result) => result.message.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isMine = item.message.senderId === currentUserId;
            const senderLabel = isMine
              ? "Você"
              : isGroup
                ? (memberProfiles[item.message.senderId]?.name ?? null)
                : null;
            return (
              <SearchResultItem
                result={item}
                chatName={chatName}
                senderLabel={senderLabel}
                isMine={isMine}
                onPress={() => onOpenMessage(item.message.id)}
              />
            );
          }}
        />
      )}
    </View>
  );
}
