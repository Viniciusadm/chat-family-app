import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { AppMember } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Alert, Pressable, Text } from "react-native";
import { createAdminModalStyles } from "./adminStyles";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";

type DeleteChildModalProps = {
  visible: boolean;
  child: AppMember | null;
  onClose: () => void;
  deleteChildMember: (memberId: string, deleteMessages: boolean) => Promise<void>;
};

export function DeleteChildModal({
  visible,
  child,
  onClose,
  deleteChildMember,
}: DeleteChildModalProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createAdminModalStyles);
  const [deleteMessages, setDeleteMessages] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (visible) return;
    setDeleteMessages(false);
    setDeleting(false);
  }, [visible]);

  const close = () => {
    if (deleting) return;
    onClose();
    setDeleteMessages(false);
  };

  const handleConfirm = async () => {
    if (!child || deleting) return;
    setDeleting(true);
    try {
      await deleteChildMember(child.id, deleteMessages);
      onClose();
      setDeleteMessages(false);
    } catch (e) {
      Alert.alert(
        "Erro ao apagar",
        e instanceof Error ? e.message : "Não foi possível apagar a criança."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ConfirmDeleteModal
      visible={visible}
      title="Apagar criança?"
      description={`Tem certeza que deseja apagar ${child?.name ?? ""}? Esta ação não pode ser desfeita e a criança será deslogada dos dispositivos já conectados.`}
      busy={deleting}
      onClose={close}
      onConfirm={() => void handleConfirm()}
    >
      <Pressable
        onPress={() => setDeleteMessages((value) => !value)}
        style={styles.checkRow}
        disabled={deleting}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: deleteMessages, disabled: deleting }}
      >
        <Ionicons
          name={deleteMessages ? "checkbox" : "square-outline"}
          size={22}
          color={deleteMessages ? theme.primary : theme.controlBorder}
        />
        <Text style={styles.checkLabel}>apagar também as mensagens</Text>
      </Pressable>
    </ConfirmDeleteModal>
  );
}
