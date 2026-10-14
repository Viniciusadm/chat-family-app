import type { Chat } from "@/types/chat";
import { useState } from "react";
import { Alert } from "react-native";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { errorMessage } from "./errorMessage";

type DeleteChatModalProps = {
  visible: boolean;
  chat: Chat | null;
  onClose: () => void;
  deleteChat: (chatId: string) => Promise<void>;
};

export function DeleteChatModal({
  visible,
  chat,
  onClose,
  deleteChat,
}: DeleteChatModalProps) {
  const [deleting, setDeleting] = useState(false);

  const close = () => {
    if (deleting) return;
    onClose();
  };

  const handleConfirm = async () => {
    if (!chat || deleting) return;
    setDeleting(true);
    try {
      await deleteChat(chat.id);
      onClose();
    } catch (e) {
      Alert.alert(
        "Erro ao apagar conversa",
        errorMessage(e, "Não foi possível apagar a conversa.")
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ConfirmDeleteModal
      visible={visible}
      title="Apagar conversa?"
      description="Esta ação não pode ser desfeita. Todas as mensagens desta conversa serão removidas permanentemente."
      busy={deleting}
      onClose={close}
      onConfirm={() => void handleConfirm()}
    />
  );
}
