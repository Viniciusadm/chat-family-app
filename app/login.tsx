import { ScreenContainer } from "@/components/ScreenContainer";
import { LoadingDots } from "@/components/LoadingDots";
import { ChildCodeModal } from "@/components/login/ChildCodeModal";
import { LoginForm } from "@/components/login/LoginForm";
import { RegisterForm } from "@/components/login/RegisterForm";
import { authErrorMessage } from "@/components/login/authErrorMessage";
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
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ViewMode = "login" | "register";

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    loadingScreen: {
      flex: 1,
      backgroundColor: t.background,
      alignItems: "center",
      justifyContent: "center",
    },
    screen: {
      flex: 1,
      backgroundColor: t.background,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.giant,
      paddingBottom: spacing.xxxl,
      width: "100%",
    },
    logoWrap: {
      alignItems: "center",
      marginBottom: spacing.xxxl,
    },
    logoCircle: {
      width: 64,
      height: 64,
      borderRadius: radius.pill,
      backgroundColor: t.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      marginTop: spacing.md,
      fontSize: fontSizes.largeTitle,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
    },
  });

export default function LoginScreen() {
  const router = useRouter();
  const {
    currentUser,
    deviceApproved,
    loading,
    sessionReady,
    loginWithEmail,
    registerWithEmail,
    loginWithChildCode,
    deletedAccountMessage,
    clearDeletedAccountMessage,
  } = useAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [view, setView] = useState<ViewMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showChildModal, setShowChildModal] = useState(false);

  useEffect(() => {
    if (!deletedAccountMessage) return;
    Alert.alert("Conta removida", deletedAccountMessage);
    clearDeletedAccountMessage();
  }, [clearDeletedAccountMessage, deletedAccountMessage]);

  useEffect(() => {
    if (loading || !sessionReady) return;
    if (deviceApproved === false) {
      router.replace("/aguardando");
    } else if (currentUser && deviceApproved === true) {
      router.replace("/");
    }
  }, [
    loading,
    currentUser,
    deviceApproved,
    sessionReady,
    router,
  ]);

  if (loading) {
    return (
      <ScreenContainer style={styles.loadingScreen} edges={["top", "bottom"]}>
        <LoadingDots />
      </ScreenContainer>
    );
  }

  if (currentUser && deviceApproved === true) {
    return <Redirect href="/" />;
  }

  if (currentUser && deviceApproved === false) {
    return <Redirect href="/aguardando" />;
  }

  const switchView = (next: ViewMode) => {
    setError("");
    setView(next);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setError("");
    setBusy(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (e: unknown) {
      setError(authErrorMessage(e, "Erro ao entrar"));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) return;
    setError("");
    setBusy(true);
    try {
      await registerWithEmail(email.trim(), password, name.trim());
    } catch (e: unknown) {
      setError(authErrorMessage(e, "Erro ao criar conta"));
    } finally {
      setBusy(false);
    }
  };

  const handleChildLogin = async (code: string) => {
    setBusy(true);
    try {
      await loginWithChildCode(code);
      setShowChildModal(false);
      router.replace("/aguardando");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer style={styles.screen} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoWrap}>
          <View style={styles.logoCircle}>
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={36}
              color={theme.primary}
            />
          </View>
          <Text style={styles.title}>Família Chat</Text>
        </View>

        {view === "login" ? (
          <LoginForm
            email={email}
            password={password}
            error={error}
            busy={busy}
            onChangeEmail={setEmail}
            onChangePassword={setPassword}
            onSubmit={() => void handleLogin()}
            onCreateAccount={() => switchView("register")}
            onChildLogin={() => setShowChildModal(true)}
          />
        ) : (
          <RegisterForm
            name={name}
            email={email}
            password={password}
            error={error}
            busy={busy}
            onChangeName={setName}
            onChangeEmail={setEmail}
            onChangePassword={setPassword}
            onSubmit={() => void handleRegister()}
            onBack={() => switchView("login")}
          />
        )}
      </ScrollView>

      <ChildCodeModal
        visible={showChildModal}
        busy={busy}
        onClose={() => setShowChildModal(false)}
        onSubmit={handleChildLogin}
      />
    </ScreenContainer>
  );
}
