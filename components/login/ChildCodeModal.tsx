import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { authErrorMessage } from "./authErrorMessage";

interface ChildCodeModalProps {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (code: string) => Promise<void>;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
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
    primaryBtnText: {
      color: t.primaryForeground,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
    },
    ghostBtnText: {
      color: t.mutedForeground,
      fontSize: fontSizes.body,
    },
    pressed: {
      opacity: 0.85,
    },
    btnDisabled: {
      opacity: 0.5,
    },
    modalRoot: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: spacing.xxl,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: t.modalBackdrop,
    },
    modalCard: {
      backgroundColor: t.card,
      borderRadius: radius.lg,
      padding: spacing.xl,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: t.shadowOpacity * 1.5,
      shadowRadius: 12,
      elevation: 8,
    },
    modalTitle: {
      fontSize: fontSizes.headline,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
      marginBottom: spacing.lg,
    },
    modalHint: {
      fontSize: fontSizes.footnote,
      color: t.mutedForeground,
      marginTop: spacing.sm,
    },
    modalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: spacing.md,
      marginTop: spacing.xl,
    },
    modalGhost: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    modalPrimary: {
      backgroundColor: t.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
  });

export function ChildCodeModal({
  visible,
  busy,
  onClose,
  onSubmit,
}: ChildCodeModalProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [childCode, setChildCode] = useState("");
  const [childError, setChildError] = useState("");

  const close = () => {
    onClose();
    setChildError("");
  };

  const handleSubmit = async () => {
    if (!childCode.trim()) return;
    setChildError("");
    try {
      await onSubmit(childCode.trim());
      setChildCode("");
    } catch (e: unknown) {
      setChildError(authErrorMessage(e, "Erro ao entrar"));
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          style={styles.modalOverlay}
          onPress={close}
        />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Entrar como criança</Text>
          <TextInput
            style={styles.input}
            placeholder="Código do usuário"
            placeholderTextColor={theme.inputPlaceholder}
            value={childCode}
            onChangeText={setChildCode}
            autoCapitalize="characters"
          />
          {childError ? (
            <Text style={styles.error}>{childError}</Text>
          ) : null}
          <Text style={styles.modalHint}>
            Peça o código para um responsável
          </Text>
          <View style={styles.modalActions}>
            <Pressable
              accessibilityRole="button"
              onPress={close}
              style={({ pressed }) => [
                styles.modalGhost,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.ghostBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleSubmit()}
              disabled={busy || !childCode.trim()}
              style={({ pressed }) => [
                styles.modalPrimary,
                pressed && styles.pressed,
                (busy || !childCode.trim()) && styles.btnDisabled,
              ]}
            >
              <Text style={styles.primaryBtnText}>Entrar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
