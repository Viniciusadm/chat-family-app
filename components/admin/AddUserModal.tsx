import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import type { UserRole } from "@/types/chat";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { AdminModal } from "./AdminModal";
import { createAdminModalStyles } from "./adminStyles";

const ROLE_OPTIONS: { role: UserRole; label: string }[] = [
  { role: "child", label: "Criança" },
  { role: "adult", label: "Adulto" },
];

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    roleRow: {
      flexDirection: "row",
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    roleChip: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      alignItems: "center",
    },
    roleChipOn: {
      borderColor: t.primary,
      backgroundColor: t.primaryTint,
    },
    roleChipText: {
      fontSize: fontSizes.bodySmall,
      color: t.foreground,
    },
    roleChipTextOn: {
      fontWeight: fontWeights.semibold,
      color: t.primary,
    },
  });

type AddUserModalProps = {
  visible: boolean;
  onClose: () => void;
  addUser: (name: string, role: UserRole) => Promise<unknown>;
};

export function AddUserModal({ visible, onClose, addUser }: AddUserModalProps) {
  const { theme } = useTheme();
  const modalStyles = useThemedStyles(createAdminModalStyles);
  const styles = useThemedStyles(createStyles);
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("child");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const canSubmit = !!name.trim() && !adding;

  const close = () => {
    if (adding) return;
    onClose();
    setError("");
  };

  const handleAddUser = async () => {
    if (!name.trim() || adding) return;
    setError("");
    setAdding(true);
    try {
      await addUser(name.trim(), role);
      setName("");
      setRole("child");
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao criar participante");
    } finally {
      setAdding(false);
    }
  };

  return (
    <AdminModal visible={visible} title="Adicionar participante" onClose={close}>
      <TextInput
        style={modalStyles.input}
        placeholder="Nome"
        placeholderTextColor={theme.inputPlaceholder}
        value={name}
        onChangeText={setName}
      />
      <Text style={modalStyles.fieldLabel}>Papel</Text>
      <View style={styles.roleRow}>
        {ROLE_OPTIONS.map((option) => {
          const selected = role === option.role;
          return (
            <Pressable
              key={option.role}
              onPress={() => setRole(option.role)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              style={[styles.roleChip, selected && styles.roleChipOn]}
            >
              <Text
                style={[styles.roleChipText, selected && styles.roleChipTextOn]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={modalStyles.error}>{error}</Text> : null}
      <View style={modalStyles.modalActions}>
        <Pressable
          onPress={close}
          style={modalStyles.modalGhost}
          accessibilityRole="button"
          disabled={adding}
        >
          <Text style={modalStyles.ghostText}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={() => void handleAddUser()}
          disabled={!canSubmit}
          style={[modalStyles.modalPrimary, !canSubmit && modalStyles.btnDisabled]}
        >
          <Text style={modalStyles.primaryText}>
            {adding ? "Criando..." : "Criar"}
          </Text>
        </Pressable>
      </View>
    </AdminModal>
  );
}
