import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { spacing } from "@/theme/tokens";
import type { Chat } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { createAdminCardStyles } from "./adminStyles";

const styles = StyleSheet.create({
  groupPhotoSection: {
    alignItems: "center",
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  groupPhotoActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  groupPhotoBtn: {
    flex: 0,
    paddingHorizontal: spacing.lg,
    marginTop: 0,
    marginBottom: 0,
  },
});

type GroupPhotoEditorProps = {
  chat: Chat;
  busy: boolean;
  onPick: () => void;
  onClear: () => void;
};

export function GroupPhotoEditor({ chat, busy, onPick, onClear }: GroupPhotoEditorProps) {
  const { theme } = useTheme();
  const cardStyles = useThemedStyles(createAdminCardStyles);

  return (
    <View style={styles.groupPhotoSection}>
      <ProfileAvatar
        name={chat.name}
        photoUrl={chat.photoUrl}
        icon="people-outline"
        size={88}
      />
      <View style={styles.groupPhotoActions}>
        <Pressable
          onPress={onPick}
          disabled={busy}
          style={({ pressed }) => [
            cardStyles.outlineBtn,
            styles.groupPhotoBtn,
            pressed && cardStyles.pressed,
            busy && cardStyles.btnDisabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.foreground} />
          ) : (
            <Ionicons name="camera-outline" size={18} color={theme.foreground} />
          )}
          <Text style={cardStyles.outlineBtnText}>
            {chat.photoUrl ? "Trocar foto" : "Adicionar foto"}
          </Text>
        </Pressable>
        {chat.photoUrl ? (
          <Pressable
            onPress={onClear}
            disabled={busy}
            style={({ pressed }) => [
              cardStyles.outlineBtn,
              styles.groupPhotoBtn,
              pressed && cardStyles.pressed,
              busy && cardStyles.btnDisabled,
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={theme.destructive} />
            <Text style={[cardStyles.outlineBtnText, { color: theme.destructive }]}>
              Remover
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
