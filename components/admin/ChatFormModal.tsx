import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { spacing } from "@/theme/tokens";
import type { AppMember, Chat } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AdminModal } from "./AdminModal";
import { createAdminModalStyles } from "./adminStyles";
import { errorMessage } from "./errorMessage";
import { GroupPhotoEditor } from "./GroupPhotoEditor";

const MIN_PARTICIPANTS = 3;

const MODE_CONFIG = {
  create: {
    title: "Criar conversa",
    submitLabel: "Criar",
    busyLabel: "Criando...",
    errorTitle: "Erro ao criar conversa",
    errorFallback: "Não foi possível criar a conversa.",
    showSpinner: true,
    resetOnSuccess: true,
  },
  edit: {
    title: "Editar conversa",
    submitLabel: "Salvar",
    busyLabel: "Salvando...",
    errorTitle: "Erro ao salvar conversa",
    errorFallback: "Não foi possível salvar a conversa.",
    showSpinner: false,
    resetOnSuccess: false,
  },
} as const;

const styles = StyleSheet.create({
  participantList: {
    maxHeight: 220,
    marginBottom: spacing.sm,
  },
});

type ChatFormModalProps = {
  mode: keyof typeof MODE_CONFIG;
  visible: boolean;
  members: AppMember[];
  initialName?: string;
  initialParticipants?: string[];
  photoChat?: Chat;
  onSubmit: (name: string, participantIds: string[]) => Promise<void>;
  onClose: () => void;
  onUpdatePhoto?: (localUri: string) => Promise<void>;
  onRemovePhoto?: () => Promise<void>;
};

export function ChatFormModal({
  mode,
  visible,
  members,
  initialName = "",
  initialParticipants,
  photoChat,
  onSubmit,
  onClose,
  onUpdatePhoto,
  onRemovePhoto,
}: ChatFormModalProps) {
  const config = MODE_CONFIG[mode];
  const { theme } = useTheme();
  const modalStyles = useThemedStyles(createAdminModalStyles);
  const [name, setName] = useState(initialName);
  const [participants, setParticipants] = useState<string[]>(() =>
    initialParticipants ? [...initialParticipants] : []
  );
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const submitDisabled =
    participants.length < MIN_PARTICIPANTS || saving || !name.trim();

  const close = () => {
    if (saving || photoBusy) return;
    onClose();
  };

  const toggleParticipant = (userId: string) => {
    setParticipants((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (participants.length < MIN_PARTICIPANTS || saving) return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSaving(true);
    try {
      await onSubmit(trimmedName, participants);
      if (config.resetOnSuccess) {
        setName("");
        setParticipants([]);
      }
      onClose();
    } catch (e) {
      Alert.alert(config.errorTitle, errorMessage(e, config.errorFallback));
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    if (!onUpdatePhoto || photoBusy) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita acesso às fotos para escolher uma imagem."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.86,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      setPhotoBusy(true);
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 512 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      await onUpdatePhoto(compressed.uri);
    } catch (e) {
      Alert.alert("Erro na foto", errorMessage(e, "Erro ao enviar foto."));
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleClearPhoto = async () => {
    if (!onRemovePhoto || photoBusy) return;
    setPhotoBusy(true);
    try {
      await onRemovePhoto();
    } catch (e) {
      Alert.alert("Erro na foto", errorMessage(e, "Erro ao remover foto."));
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <AdminModal visible={visible} title={config.title} tall onClose={close}>
      {photoChat ? (
        <GroupPhotoEditor
          chat={photoChat}
          busy={photoBusy}
          onPick={() => void handlePickPhoto()}
          onClear={() => void handleClearPhoto()}
        />
      ) : null}
      <TextInput
        style={modalStyles.input}
        placeholder="Nome do grupo"
        placeholderTextColor={theme.inputPlaceholder}
        value={name}
        onChangeText={setName}
        editable={!saving}
      />
      <Text style={modalStyles.fieldLabel}>Participantes (mínimo 3)</Text>
      <ScrollView style={styles.participantList} nestedScrollEnabled>
        {members.map((m) => {
          const checked = participants.includes(m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => toggleParticipant(m.id)}
              style={modalStyles.checkRow}
              disabled={saving}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: saving }}
            >
              <Ionicons
                name={checked ? "checkbox" : "square-outline"}
                size={22}
                color={checked ? theme.primary : theme.controlBorder}
              />
              <Text style={modalStyles.checkLabel}>{m.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={modalStyles.modalActions}>
        <Pressable
          onPress={close}
          style={modalStyles.modalGhost}
          accessibilityRole="button"
          disabled={saving}
        >
          <Text style={modalStyles.ghostText}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={() => void handleSubmit()}
          disabled={submitDisabled}
          style={[
            modalStyles.modalPrimary,
            config.showSpinner && modalStyles.modalPrimaryRow,
            submitDisabled && modalStyles.btnDisabled,
          ]}
        >
          {config.showSpinner && saving ? (
            <ActivityIndicator size="small" color={theme.primaryForeground} />
          ) : null}
          <Text style={modalStyles.primaryText}>
            {saving ? config.busyLabel : config.submitLabel}
          </Text>
        </Pressable>
      </View>
    </AdminModal>
  );
}
