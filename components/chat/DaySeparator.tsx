import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    separatorWrap: {
      flexDirection: "row",
      marginVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    separatorLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.border,
    },
    separatorText: {
      marginHorizontal: spacing.sm,
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.semibold,
      color: t.timestamp,
      textTransform: "capitalize",
    },
  });

interface DaySeparatorProps {
  label: string;
}

export const DaySeparator = memo(function DaySeparator({ label }: DaySeparatorProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.separatorWrap}>
      <View style={styles.separatorLine} />
      <Text style={styles.separatorText}>{label}</Text>
      <View style={styles.separatorLine} />
    </View>
  );
});
