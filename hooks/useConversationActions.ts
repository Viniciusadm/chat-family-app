import { showAlert } from "@/components/AppAlert";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import type { MemberProfile } from "@/hooks/useMemberProfiles";
import {
  exportFileName,
  formatConversationExport,
} from "@/lib/conversationExport";
import { MessageRepository } from "@/lib/MessageRepository";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useCallback, useRef, useState } from "react";

export function useConversationActions(
  chatId: string,
  chatName: string,
  memberProfiles: Record<string, MemberProfile>,
) {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);

  const exportConversation = useCallback(async () => {
    if (exportingRef.current || !chatId) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      const messages = await MessageRepository.getMessagesForExport(chatId);
      if (messages.length === 0) {
        showAlert(
          "Nada para exportar",
          "Esta conversa ainda não tem mensagens.",
        );
        return;
      }
      const text = formatConversationExport(messages, (senderId) =>
        senderId === currentUser?.id
          ? (currentUser?.name ?? "Você")
          : (memberProfiles[senderId]?.name ?? "Participante"),
      );
      const fileUri = `${FileSystem.cacheDirectory}${encodeURIComponent(
        exportFileName(chatName),
      )}`;
      await FileSystem.writeAsStringAsync(fileUri, text);
      await Sharing.shareAsync(fileUri, {
        mimeType: "text/plain",
        dialogTitle: "Exportar conversa",
      });
    } catch {
      showAlert("Não foi possível exportar", "Tente novamente em instantes.");
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }, [chatId, chatName, currentUser?.id, currentUser?.name, memberProfiles]);

  const confirmClear = useCallback(
    (onCleared?: () => void) => {
      showAlert(
        "Limpar conversa?",
        "As mensagens, fotos e áudios desta conversa serão apagados só deste aparelho. Os outros participantes continuam vendo tudo.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Limpar",
            style: "destructive",
            onPress: () => {
              void MessageRepository.clearLocalConversation(chatId)
                .then(() => {
                  showToast("Conversa limpa neste aparelho");
                  onCleared?.();
                })
                .catch(() =>
                  showAlert("Não foi possível limpar", "Tente novamente."),
                );
            },
          },
        ],
      );
    },
    [chatId, showToast],
  );

  return { exporting, exportConversation, confirmClear };
}
