import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

interface LoginFormProps {
  email: string;
  password: string;
  error: string;
  busy: boolean;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
  onCreateAccount: () => void;
  onAcceptInvite: () => void;
  onChildLogin: () => void;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    form: {
      gap: spacing.md,
      maxWidth: 400,
      width: "100%",
      alignSelf: "center",
    },
    input: {
      borderWidth: 1,
      borderColor: t.inputBorder,
      borderRadius: radius.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      fontSize: fontSizes.body,
      color: t.foreground,
      backgroundColor: t.background,
    },
    error: {
      fontSize: fontSizes.subhead,
      color: t.destructive,
    },
    primaryBtn: {
      backgroundColor: t.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    primaryBtnText: {
      color: t.primaryForeground,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
    },
    ghostBtn: {
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    ghostBtnText: {
      color: t.mutedForeground,
      fontSize: fontSizes.body,
    },
    outlineBtn: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      alignItems: "center",
    },
    outlineBtnText: {
      color: t.foreground,
      fontSize: fontSizes.body,
    },
    dividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginVertical: spacing.xs,
    },
    divider: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.border,
    },
    dividerText: {
      fontSize: fontSizes.footnote,
      color: t.mutedForeground,
    },
    pressed: {
      opacity: 0.85,
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });

export function LoginForm({
  email,
  password,
  error,
  busy,
  onChangeEmail,
  onChangePassword,
  onSubmit,
  onCreateAccount,
  onAcceptInvite,
  onChildLogin,
}: LoginFormProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.form}>
      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor={theme.inputPlaceholder}
        value={email}
        onChangeText={onChangeEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor={theme.inputPlaceholder}
        value={password}
        onChangeText={onChangePassword}
        secureTextEntry
        autoComplete="password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={onSubmit}
        disabled={
          busy || !email.trim() || !password.trim()
        }
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && styles.pressed,
          (busy || !email.trim() || !password.trim()) &&
            styles.btnDisabled,
        ]}
      >
        <Text style={styles.primaryBtnText}>Entrar</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onCreateAccount}
        disabled={busy}
        style={({ pressed }) => [
          styles.ghostBtn,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.ghostBtnText}>Criar conta</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={onAcceptInvite}
        disabled={busy}
        style={({ pressed }) => [
          styles.ghostBtn,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.ghostBtnText}>Tenho um convite</Text>
      </Pressable>
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.divider} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onChildLogin}
        disabled={busy}
        style={({ pressed }) => [
          styles.outlineBtn,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.outlineBtnText}>Entrar como criança</Text>
      </Pressable>
    </View>
  );
}
