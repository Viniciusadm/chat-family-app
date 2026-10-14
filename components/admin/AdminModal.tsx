import { useThemedStyles } from "@/theme/useThemedStyles";
import type { ReactNode } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { createAdminModalStyles } from "./adminStyles";

type AdminModalProps = {
  visible: boolean;
  title: string;
  tall?: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function AdminModal({
  visible,
  title,
  tall = false,
  onClose,
  children,
}: AdminModalProps) {
  const styles = useThemedStyles(createAdminModalStyles);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <Pressable
          style={styles.modalOverlay}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={onClose}
        />
        <View style={[styles.modalCard, tall && styles.modalTall]}>
          <Text style={styles.modalTitle}>{title}</Text>
          {children}
        </View>
      </View>
    </Modal>
  );
}
