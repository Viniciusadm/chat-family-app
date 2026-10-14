import { ScreenContainer } from "@/components/ScreenContainer";
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
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
      marginBottom: spacing.xl,
    },
    title: {
      fontSize: fontSizes.title2,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
      textAlign: "center",
      marginBottom: spacing.sm,
    },
    sub: {
      fontSize: fontSizes.bodySmall,
      color: t.mutedForeground,
      textAlign: "center",
      maxWidth: 320,
      marginBottom: spacing.xxl,
    },
    input: {
      width: "100%",
      maxWidth: 360,
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.inputBorder,
      paddingHorizontal: spacing.lg,
      fontSize: fontSizes.body,
      color: t.foreground,
      backgroundColor: t.background,
    },
    error: {
      color: t.destructive,
      marginTop: spacing.sm,
      textAlign: "center",
    },
    primaryBtn: {
      width: "100%",
      maxWidth: 360,
      minHeight: 48,
      marginTop: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryBtnText: {
      color: t.primaryForeground,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.bold,
    },
    skipBtn: {
      marginTop: spacing.lg,
      padding: spacing.sm,
    },
    skipText: {
      color: t.mutedForeground,
      fontSize: fontSizes.subhead,
    },
    pressed: {
      opacity: 0.72,
    },
  });

export default function EncryptionRestoreScreen() {
  const router = useRouter();
  const {
    currentUser,
    deviceApproved,
    needsPasswordRestore,
    restorePasswordBackups,
    dismissPasswordRestore,
  } = useAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentUser || deviceApproved !== true) {
    return <Redirect href="/login" />;
  }
  if (!needsPasswordRestore) {
    return <Redirect href="/" />;
  }

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await restorePasswordBackups(password);
      if (result.ok) {
        if (result.failedChatIds.length > 0) {
          Alert.alert(
            "Restauração parcial",
            `${result.failedChatIds.length} conversa(s) não puderam ser restauradas e continuarão ilegíveis neste aparelho.`,
          );
        }
        router.replace("/");
        return;
      }
      if (result.reason === "wrong-password") {
        setError("Senha incorreta. Tente novamente.");
      } else if (result.reason === "no-backups") {
        Alert.alert(
          "Sem backups",
          "Não há chaves para restaurar nesta conta. Você poderá conversar normalmente, mas mensagens antigas continuarão ilegíveis.",
        );
        router.replace("/");
      } else {
        setError("Não foi possível restaurar agora. Tente mais tarde.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao restaurar.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  const skip = () => {
    Alert.alert(
      "Pular restauração",
      "Sem a senha, você não poderá ler conversas antigas neste aparelho. Mensagens novas continuarão funcionando. Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar mesmo assim",
          style: "destructive",
          onPress: () => {
            dismissPasswordRestore();
            router.replace("/");
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed-outline" size={36} color={theme.primary} />
      </View>
      <Text style={styles.title}>Restaurar conversas</Text>
      <Text style={styles.sub}>
        Digite a senha de criptografia para restaurar suas conversas neste aparelho.
      </Text>
      <TextInput
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (error) setError(null);
        }}
        placeholder="Senha"
        placeholderTextColor={theme.inputPlaceholder}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
        editable={!busy}
        onSubmitEditing={() => void submit()}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => void submit()}
        disabled={busy || password.length === 0}
        style={({ pressed }) => [
          styles.primaryBtn,
          (pressed || busy || password.length === 0) && styles.pressed,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={theme.primaryForeground} />
        ) : (
          <Text style={styles.primaryBtnText}>Restaurar</Text>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={skip}
        disabled={busy}
        style={styles.skipBtn}
      >
        <Text style={styles.skipText}>Esqueci a senha</Text>
      </Pressable>
    </ScreenContainer>
  );
}
