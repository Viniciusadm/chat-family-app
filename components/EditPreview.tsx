import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type EditPreviewProps = {
  originalText: string;
  onCancel: () => void;
};

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: radius.md,
      backgroundColor: t.background,
      borderWidth: 1,
      borderColor: t.border,
      marginBottom: spacing.sm,
      overflow: "hidden",
    },
    accent: {
      alignSelf: "stretch",
      width: 3,
      backgroundColor: t.accent,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    textColumn: {
      flex: 1,
    },
    label: {
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.bold,
      color: t.accent,
    },
    preview: {
      marginTop: spacing.xxs,
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
    },
    cancelButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.xs,
      borderRadius: radius.pill,
    },
    cancelButtonPressed: {
      backgroundColor: t.muted,
    },
  });

export function EditPreview({ originalText, onCancel }: EditPreviewProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.wrap}>
      <View style={styles.accent} />
      <View style={styles.content}>
        <Ionicons name="pencil" size={16} color={theme.accent} />
        <View style={styles.textColumn}>
          <Text style={styles.label} numberOfLines={1}>
            Editando mensagem
          </Text>
          <Text style={styles.preview} numberOfLines={1}>
            {originalText}
          </Text>
        </View>
      </View>
      <Pressable
        accessibilityLabel="Cancelar edição"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onCancel}
        style={({ pressed }) => [
          styles.cancelButton,
          pressed ? styles.cancelButtonPressed : null,
        ]}
      >
        <Ionicons name="close" size={18} color={theme.mutedForeground} />
      </Pressable>
    </View>
  );
}
