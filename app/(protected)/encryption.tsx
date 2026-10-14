import { AppHeader } from "@/components/AppHeader";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { validatePasswordStrength } from "@/lib/crypto/passwordKey";
import type { CryptoProgress } from "@/lib/keyBackup";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  lineHeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

type Mode = "idle" | "setup" | "change" | "unlock";

const CRYPTO_FAILURE_MESSAGE =
  "Não foi possível concluir. Verifique sua conexão e tente novamente.";

const PASSWORD_RULES_HINT =
  "Mínimo 8 caracteres com letra maiúscula, minúscula, número e caractere especial.";

function progressTitle(p: CryptoProgress | null): string {
  if (!p) return "Configurando sua senha...";
  switch (p.phase) {
    case "deriving":
      return "Derivando chave...";
    case "backing-up":
      return "Salvando backup das conversas...";
    case "restoring":
      return "Restaurando conversas...";
  }
}

function progressDetail(p: CryptoProgress): string {
  switch (p.phase) {
    case "deriving":
      return `${Math.round(p.percent * 100)}%`;
    case "backing-up":
    case "restoring":
      return `${p.done} de ${p.total}`;
  }
}

function progressPercent(p: CryptoProgress): number {
  switch (p.phase) {
    case "deriving":
      return p.percent;
    case "backing-up":
    case "restoring":
      return p.total === 0 ? 1 : p.done / p.total;
  }
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.background,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    statusBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: t.muted,
      marginBottom: spacing.lg,
    },
    statusText: {
      color: t.foreground,
      fontSize: fontSizes.bodySmall,
      fontWeight: fontWeights.semibold,
    },
    sub: {
      color: t.mutedForeground,
      fontSize: fontSizes.subhead,
      lineHeight: lineHeights.bodySmall,
      marginBottom: spacing.xxl,
    },
    actions: {
      gap: spacing.md,
    },
    form: {
      gap: spacing.md,
    },
    input: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.inputBorder,
      paddingHorizontal: spacing.lg,
      fontSize: fontSizes.body,
      color: t.foreground,
      backgroundColor: t.background,
    },
    primaryBtn: {
      minHeight: 48,
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
    secondaryBtn: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryBtnText: {
      color: t.foreground,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
    },
    dangerBtn: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: "center",
      justifyContent: "center",
    },
    dangerBtnText: {
      color: t.destructive,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.bold,
    },
    cancelBtn: {
      paddingVertical: spacing.md,
      alignItems: "center",
    },
    cancelText: {
      color: t.mutedForeground,
      fontSize: fontSizes.subhead,
    },
    error: {
      color: t.destructive,
      fontSize: fontSizes.subhead,
    },
    hint: {
      color: t.mutedForeground,
      fontSize: fontSizes.footnote,
      lineHeight: lineHeights.footnote,
    },
    pressed: {
      opacity: 0.72,
    },
    progressTrack: {
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: t.muted,
      overflow: "hidden",
      marginTop: spacing.xxl,
      width: "80%",
      alignSelf: "center",
    },
    progressFill: {
      height: "100%",
      backgroundColor: t.primary,
      borderRadius: radius.xs,
    },
    progressLabel: {
      color: t.mutedForeground,
      fontSize: fontSizes.subhead,
      textAlign: "center",
      marginTop: spacing.sm,
    },
  });

export default function EncryptionSettingsScreen() {
  const router = useRouter();
  const {
    currentUser,
    hasBackupPassword,
    backupUnlocked,
    cryptoInProgress,
    cryptoProgress,
    setupBackupPassword,
    changeBackupPassword,
    disableBackupPassword,
    unlockBackupPassword,
    lockBackupPassword,
  } = useAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>("idle");
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentUser || currentUser.role !== "adult") {
    return (
      <ScreenContainer style={styles.screen} edges={["bottom"]}>
        <AppHeader title="Senha de criptografia" onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.sub}>Apenas adultos podem configurar.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const reset = () => {
    setOldPassword("");
    setPassword("");
    setConfirm("");
    setError(null);
  };

  const submitSetup = () => {
    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      setError(strengthError);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setError(null);
    const pwd = password;
    reset();
    setMode("idle");
    void (async () => {
      try {
        await setupBackupPassword(pwd);
        showToast("Senha criada");
      } catch {
        Alert.alert("Erro", CRYPTO_FAILURE_MESSAGE);
      }
    })();
  };

  const submitChange = () => {
    const strengthError = validatePasswordStrength(password);
    if (strengthError) {
      setError(strengthError);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setError(null);
    const oldPwd = oldPassword;
    const newPwd = password;
    reset();
    setMode("idle");
    void (async () => {
      try {
        const result = await changeBackupPassword(oldPwd, newPwd);
        if (result.ok) {
          showToast("Senha alterada");
        } else if (result.reason === "wrong-password") {
          setMode("change");
          setError("Senha atual incorreta.");
        } else {
          Alert.alert("Erro", "Sem senha configurada.");
        }
      } catch {
        Alert.alert("Erro", CRYPTO_FAILURE_MESSAGE);
      }
    })();
  };

  const submitUnlock = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const result = await unlockBackupPassword(password);
      if (result.ok) {
        reset();
        setMode("idle");
      } else if (result.reason === "wrong-password") {
        setError("Senha incorreta.");
      } else {
        setError("Sem senha configurada.");
      }
    } catch {
      setError(CRYPTO_FAILURE_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = () => {
    Alert.alert(
      "Desativar senha",
      "Os backups serão apagados do servidor. Você não poderá restaurar conversas em outro aparelho até criar uma nova senha. Continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desativar",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await disableBackupPassword();
              } catch (e) {
                Alert.alert("Erro", e instanceof Error ? e.message : "Falha ao desativar.");
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const renderStatus = () => {
    if (!hasBackupPassword) {
      return (
        <View style={styles.statusBox}>
          <Ionicons name="lock-open-outline" size={22} color={theme.mutedForeground} />
          <Text style={styles.statusText}>Sem senha configurada</Text>
        </View>
      );
    }
    return (
      <View style={styles.statusBox}>
        <Ionicons
          name={backupUnlocked ? "shield-checkmark-outline" : "shield-outline"}
          size={22}
          color={backupUnlocked ? theme.primary : theme.mutedForeground}
        />
        <Text style={styles.statusText}>
          Senha configurada{backupUnlocked ? " (desbloqueada nesta sessão)" : ""}
        </Text>
      </View>
    );
  };

  return (
    <ScreenContainer style={styles.screen} edges={["bottom"]}>
      <AppHeader title="Senha de criptografia" onBack={() => router.back()} />
      <View style={styles.content}>
        {cryptoInProgress ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.statusText, { marginTop: spacing.xl, textAlign: "center" }]}>
              {progressTitle(cryptoProgress)}
            </Text>
            <Text style={[styles.sub, { textAlign: "center", marginTop: spacing.sm, marginBottom: 0 }]}>
              Você pode sair desta tela, mas não feche o app.
            </Text>
            {cryptoProgress ? (
              <>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progressPercent(cryptoProgress) * 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressLabel}>
                  {progressDetail(cryptoProgress)}
                </Text>
              </>
            ) : null}
          </View>
        ) : (
          <>
            {renderStatus()}
            <Text style={styles.sub}>
              A senha protege o backup das chaves das conversas no servidor. O servidor nunca vê
              a senha nem as chaves abertas. Se esquecer, conversas antigas não poderão ser
              restauradas em outros aparelhos.
            </Text>
            {mode === "idle" ? (
          <View style={styles.actions}>
            {!hasBackupPassword ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  reset();
                  setMode("setup");
                }}
                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              >
                <Text style={styles.primaryBtnText}>Criar senha</Text>
              </Pressable>
            ) : (
              <>
                {!backupUnlocked ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      reset();
                      setMode("unlock");
                    }}
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.primaryBtnText}>Desbloquear nesta sessão</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={lockBackupPassword}
                    style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                  >
                    <Text style={styles.secondaryBtnText}>Bloquear agora</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    reset();
                    setMode("change");
                  }}
                  style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.secondaryBtnText}>Alterar senha</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={confirmDisable}
                  disabled={busy}
                  style={({ pressed }) => [styles.dangerBtn, pressed && styles.pressed]}
                >
                  <Text style={styles.dangerBtnText}>Desativar senha</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <View style={styles.form}>
            {mode === "change" ? (
              <TextInput
                value={oldPassword}
                onChangeText={setOldPassword}
                placeholder="Senha atual"
                placeholderTextColor={theme.inputPlaceholder}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                style={styles.input}
              />
            ) : null}
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={mode === "unlock" ? "Senha" : "Nova senha"}
              placeholderTextColor={theme.inputPlaceholder}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!busy}
              style={styles.input}
            />
            {mode !== "unlock" ? (
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirmar senha"
                placeholderTextColor={theme.inputPlaceholder}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!busy}
                style={styles.input}
              />
            ) : null}
            {mode !== "unlock" ? (
              <Text style={styles.hint}>{PASSWORD_RULES_HINT}</Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (mode === "setup") submitSetup();
                else if (mode === "change") submitChange();
                else void submitUnlock();
              }}
              disabled={busy}
              style={({ pressed }) => [
                styles.primaryBtn,
                (pressed || busy) && styles.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={theme.primaryForeground} />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {mode === "setup" ? "Salvar" : mode === "change" ? "Alterar" : "Desbloquear"}
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                reset();
                setMode("idle");
              }}
              disabled={busy}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
            )}
          </>
        )}
      </View>
    </ScreenContainer>
  );
}
