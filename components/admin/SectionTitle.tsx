import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    sectionLabel: {
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.semibold,
      color: t.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  });

export function SectionTitle({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.sectionHead}>
      <Ionicons name={icon} size={16} color={theme.primary} />
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}
