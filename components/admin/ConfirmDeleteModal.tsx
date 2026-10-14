import { useThemedStyles } from "@/theme/useThemedStyles";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { AdminModal } from "./AdminModal";
import { createAdminModalStyles } from "./adminStyles";

type ConfirmDeleteModalProps = {
  visible: boolean;
  title: string;
  description: ReactNode;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children?: ReactNode;
};

export function ConfirmDeleteModal({
  visible,
  title,
  description,
  busy,
  onClose,
  onConfirm,
  children,
}: ConfirmDeleteModalProps) {
  const styles = useThemedStyles(createAdminModalStyles);

  return (
    <AdminModal visible={visible} title={title} onClose={onClose}>
      <Text style={styles.deleteDesc}>{description}</Text>
      {children}
      <View style={styles.modalActions}>
        <Pressable
          onPress={onClose}
          style={styles.modalGhost}
          accessibilityRole="button"
          disabled={busy}
        >
          <Text style={styles.ghostText}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          style={[styles.modalDanger, busy && styles.btnDisabled]}
          disabled={busy}
        >
          <Text style={styles.primaryText}>
            {busy ? "Apagando..." : "Apagar"}
          </Text>
        </Pressable>
      </View>
    </AdminModal>
  );
}
