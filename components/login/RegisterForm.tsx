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
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

interface RegisterFormProps {
  name: string;
  email: string;
  password: string;
  error: string;
  busy: boolean;
  onChangeName: (value: string) => void;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
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
    backLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    backLinkText: {
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
    },
    pressed: {
      opacity: 0.85,
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });

export function RegisterForm({
  name,
  email,
  password,
  error,
  busy,
  onChangeName,
  onChangeEmail,
  onChangePassword,
  onSubmit,
  onBack,
}: RegisterFormProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.form}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={styles.backLink}
      >
        <Ionicons
          name="chevron-back"
          size={18}
          color={theme.mutedForeground}
        />
        <Text style={styles.backLinkText}>Voltar para login</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        placeholder="Seu nome"
        placeholderTextColor={theme.inputPlaceholder}
        value={name}
        onChangeText={onChangeName}
        autoComplete="name"
      />
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
        autoComplete="password-new"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={onSubmit}
        disabled={
          busy ||
          !name.trim() ||
          !email.trim() ||
          !password.trim()
        }
        style={({ pressed }) => [
          styles.primaryBtn,
          pressed && styles.pressed,
          (busy ||
            !name.trim() ||
            !email.trim() ||
            !password.trim()) &&
            styles.btnDisabled,
        ]}
      >
        <Text style={styles.primaryBtnText}>Criar conta</Text>
      </Pressable>
    </View>
  );
}
