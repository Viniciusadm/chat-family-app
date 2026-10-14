import { ScreenContainer } from "@/components/ScreenContainer";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Link } from "expo-router";
import { StyleSheet, Text } from "react-native";

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.muted,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xxl,
    },
    code: {
      fontSize: 40,
      fontWeight: fontWeights.bold,
      color: t.foreground,
    },
    msg: {
      marginTop: spacing.lg,
      fontSize: fontSizes.headline,
      color: t.mutedForeground,
      textAlign: "center",
    },
    link: {
      marginTop: spacing.xxl,
    },
    linkText: {
      fontSize: fontSizes.body,
      color: t.primary,
      textDecorationLine: "underline",
    },
  });

export default function NotFoundScreen() {
  const styles = useThemedStyles(createStyles);
  return (
    <ScreenContainer style={styles.screen} edges={["top", "bottom"]}>
      <Text style={styles.code}>404</Text>
      <Text style={styles.msg}>Oops! Página não encontrada</Text>
      <Link href="/" style={styles.link}>
        <Text style={styles.linkText}>Voltar ao início</Text>
      </Link>
    </ScreenContainer>
  );
}
