import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { createAdminCardStyles } from "./adminStyles";
import { SectionTitle } from "./SectionTitle";

export function SecuritySection({ onOpenEncryption }: { onOpenEncryption: () => void }) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createAdminCardStyles);

  return (
    <>
      <SectionTitle icon="lock-closed-outline" label="Segurança" />
      <Pressable
        onPress={onOpenEncryption}
        accessibilityRole="button"
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.cardRow}>
          <Ionicons
            name="lock-closed-outline"
            size={22}
            color={theme.foreground}
          />
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>Senha de criptografia</Text>
            <Text style={styles.cardMeta}>
              Proteger backup das chaves no servidor
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.mutedForeground}
          />
        </View>
      </Pressable>
    </>
  );
}
