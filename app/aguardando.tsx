import { ScreenContainer } from "@/components/ScreenContainer";
import { LoadingDots } from "@/components/LoadingDots";
import { useAuth } from "@/context/AuthContext";
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
import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.muted,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xxl,
    },
    iconWrap: {
      width: 80,
      height: 80,
      borderRadius: radius.pill,
      backgroundColor: t.primaryTint,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xxl,
    },
    title: {
      fontSize: fontSizes.title2,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
      textAlign: "center",
      marginBottom: spacing.md,
    },
    sub: {
      fontSize: fontSizes.bodySmall,
      color: t.mutedForeground,
      textAlign: "center",
      maxWidth: 280,
    },
    dots: {
      marginTop: 28,
    },
    centerOnly: {
      justifyContent: "center",
    },
    switchAccountBtn: {
      marginTop: spacing.huge,
      minHeight: 44,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    switchAccountText: {
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
    },
    pressed: {
      opacity: 0.72,
    },
  });

export default function AguardandoScreen() {
  const router = useRouter();
  const {
    currentUser,
    deviceApproved,
    loading,
    sessionReady,
    logout,
  } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const hasApprovedSession = currentUser != null && deviceApproved === true;

  useEffect(() => {
    if (!loading && sessionReady && deviceApproved === true) {
      router.replace("/");
    }
  }, [deviceApproved, loading, sessionReady, router]);

  const confirmSwitchAccount = () => {
    if (loggingOut) return;
    Alert.alert(
      "Usar outra conta",
      "Deseja sair e entrar com outra conta ou código?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: () => {
            setLoggingOut(true);
            void logout()
              .catch(() => {})
              .finally(() => setLoggingOut(false));
          },
        },
      ],
    );
  };

  if (loading || (currentUser && !sessionReady)) {
    return (
      <ScreenContainer
        style={[styles.screen, styles.centerOnly]}
        edges={["top", "bottom"]}
      >
        <LoadingDots />
      </ScreenContainer>
    );
  }

  if (!currentUser && !hasApprovedSession) {
    return <Redirect href="/login" />;
  }

  if (deviceApproved === true) {
    return <Redirect href="/" />;
  }

  return (
    <ScreenContainer style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.iconWrap}>
        <Ionicons name="time-outline" size={40} color={theme.primary} />
      </View>
      <Text style={styles.title}>Aguardando aprovação do dispositivo</Text>
      <Text style={styles.sub}>
        Peça para um responsável liberar o acesso
      </Text>
      <View style={styles.dots}>
        <LoadingDots />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={confirmSwitchAccount}
        disabled={loggingOut}
        style={({ pressed }) => [
          styles.switchAccountBtn,
          (pressed || loggingOut) && styles.pressed,
        ]}
      >
        {loggingOut ? (
          <ActivityIndicator size="small" color={theme.foreground} />
        ) : (
          <Ionicons name="log-out-outline" size={18} color={theme.foreground} />
        )}
        <Text style={styles.switchAccountText}>Usar outra conta</Text>
      </Pressable>
    </ScreenContainer>
  );
}
