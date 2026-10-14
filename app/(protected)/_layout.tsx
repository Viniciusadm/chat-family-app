import { LoadingDots } from "@/components/LoadingDots";
import { useAuth } from "@/context/AuthContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { ThemeTokens } from "@/theme/tokens";
import { Redirect, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.background,
    },
  });

export default function ProtectedLayout() {
  const {
    currentUser,
    deviceApproved,
    loading,
    sessionReady,
    needsPasswordRestore,
  } = useAuth();
  const styles = useThemedStyles(createStyles);
  const hasApprovedSession = currentUser != null && deviceApproved === true;

  if (loading || (currentUser && !sessionReady)) {
    return (
      <View style={styles.center}>
        <LoadingDots />
      </View>
    );
  }

  if (!currentUser && !hasApprovedSession) {
    return <Redirect href="/login" />;
  }

  if (deviceApproved === false) {
    return <Redirect href="/aguardando" />;
  }

  if (deviceApproved === true && needsPasswordRestore) {
    return <Redirect href="/encryption-restore" />;
  }

  if (!hasApprovedSession) {
    return (
      <View style={styles.center}>
        <LoadingDots />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
