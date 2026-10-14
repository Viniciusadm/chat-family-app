import { useSendMessage } from "@/hooks/useSendMessage";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { lightImpact } from "@/lib/haptics";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import type { Message, MessageReplySnapshot } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { AttachmentMenu } from "./AttachmentMenu";
import { EditPreview } from "./EditPreview";
import { ImagePreviewModal } from "./ImagePreviewModal";
import { ReplyPreview } from "./ReplyPreview";

interface ChatInputProps {
  chatId: string;
  replyTo?: MessageReplySnapshot | null;
  onCancelReply?: () => void;
  onSend?: () => void;
  editingMessage?: Message | null;
  onCancelEdit?: () => void;
}

export interface ChatInputHandle {
  focus: () => void;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    bar: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
      backgroundColor: t.chatInputBg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    inputShell: {
      flex: 1,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: t.inputBorder,
      backgroundColor: t.background,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 44,
      justifyContent: "center",
    },
    input: {
      fontSize: fontSizes.bodySmall,
      color: t.foreground,
      padding: 0,
    },
    roundBtn: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: t.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    attachBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    recordingOverlay: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      right: 52,
      borderRadius: radius.md,
      backgroundColor: t.muted,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      pointerEvents: "none",
    },
    recDot: {
      width: 10,
      height: 10,
      borderRadius: radius.pill,
      backgroundColor: t.recording,
    },
    recText: {
      flex: 1,
      fontSize: fontSizes.subhead,
      fontWeight: fontWeights.semibold,
      color: t.recording,
    },
    recTimer: {
      fontSize: fontSizes.subhead,
      fontWeight: fontWeights.bold,
      color: t.foreground,
      minWidth: 38,
      textAlign: "right",
    },
    pressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    disabled: {
      opacity: 0.5,
    },
  });

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
function ChatInput({
  chatId,
  replyTo = null,
  onCancelReply,
  onSend,
  editingMessage = null,
  onCancelEdit,
}, ref) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    sendText,
    sendAudio,
    sendImage,
    editTextMessage,
    isSending,
  } = useSendMessage(chatId);
  const {
    isRecording,
    recordingSeconds,
    isRecordingActive,
    startRecording,
    stopRecording,
  } = useVoiceRecorder();
  const insets = useSafeAreaInsets();
  const { progress } = useReanimatedKeyboardAnimation();
  const animatedBarStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(
      progress.value,
      [0, 1],
      [spacing.md + insets.bottom, spacing.md],
      "clamp"
    ),
  }));
  const [text, setText] = useState("");
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    uri: string;
    width: number;
    height: number;
  } | null>(null);
  const [imageSending, setImageSending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const editingIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (editingMessage && editingMessage.id !== editingIdRef.current) {
      setText(editingMessage.content);
      editingIdRef.current = editingMessage.id;
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!editingMessage && editingIdRef.current) {
      setText("");
      editingIdRef.current = null;
    }
  }, [editingMessage]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (isRecording) return;
      inputRef.current?.focus();
    },
  }), [isRecording]);

  const handleSendText = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    if (editingMessage) {
      if (trimmed === editingMessage.content) {
        onCancelEdit?.();
        return;
      }
      const target = editingMessage;
      lightImpact();
      setText("");
      onCancelEdit?.();
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      const edited = await editTextMessage(target, trimmed);
      if (!edited) {
        Alert.alert(
          "Não foi possível editar",
          "Mensagens só podem ser editadas até 1 hora depois de enviadas."
        );
      }
      return;
    }
    lightImpact();
    setText("");
    onSend?.();
    onCancelReply?.();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    const selectedReply = replyTo;
    await sendText(trimmed, { replyTo: selectedReply });
  }, [
    text,
    isSending,
    editingMessage,
    onCancelEdit,
    editTextMessage,
    onCancelReply,
    onSend,
    replyTo,
    sendText,
  ]);

  const handleStartRecording = () => {
    if (isSending || isRecording || text.trim()) return;
    void startRecording();
  };

  const openGallery = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permissão necessária",
        "Permita acesso às fotos para enviar imagens."
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
      exif: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setPendingImage({
      uri: asset.uri,
      width: asset.width ?? 0,
      height: asset.height ?? 0,
    });
  }, []);

  const openCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permissão necessária",
        "Permita acesso à câmera para tirar fotos."
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 1,
      exif: false,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    setPendingImage({
      uri: asset.uri,
      width: asset.width ?? 0,
      height: asset.height ?? 0,
    });
  }, []);

  const confirmSendImage = useCallback(async () => {
    if (!pendingImage || imageSending) return;
    const selectedReply = replyTo;
    const payload = pendingImage;
    setImageSending(true);
    lightImpact();
    try {
      onSend?.();
      onCancelReply?.();
      setPendingImage(null);
      await sendImage(payload, { replyTo: selectedReply });
    } finally {
      setImageSending(false);
    }
  }, [pendingImage, imageSending, replyTo, onCancelReply, onSend, sendImage]);

  const stopRecordingAndSend = async () => {
    const selectedReply = replyTo;
    await stopRecording(async ({ uri, durationMillis }) => {
      onSend?.();
      onCancelReply?.();
      await sendAudio({
        uri,
        name: `recording-${Date.now()}.m4a`,
        type: "audio/mp4",
      }, {
        extension: "m4a",
        contentType: "audio/mp4",
        duration: durationMillis > 0 ? durationMillis / 1000 : undefined,
        localUri: uri,
        replyTo: selectedReply,
      });
    });
  };

  const isEditing = editingMessage != null;
  const trimmedText = text.trim();
  const editIsUnchanged = isEditing && trimmedText === editingMessage.content;
  const editSendDisabled =
    isEditing && (isSending || trimmedText.length === 0 || editIsUnchanged);

  return (
    <Animated.View style={[styles.bar, animatedBarStyle]}>
      {isEditing && onCancelEdit ? (
        <EditPreview
          originalText={editingMessage.content}
          onCancel={onCancelEdit}
        />
      ) : replyTo && onCancelReply ? (
        <ReplyPreview reply={replyTo} onCancel={onCancelReply} />
      ) : null}
      <View style={styles.row}>
        {!isEditing ? (
          <Pressable
            onPress={() => setAttachmentMenuVisible(true)}
            disabled={isSending || isRecording}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Anexar imagem"
            accessibilityState={{ disabled: isSending || isRecording }}
            style={({ pressed }) => [
              styles.attachBtn,
              pressed && styles.pressed,
              (isSending || isRecording) && styles.disabled,
            ]}
          >
            <Ionicons
              name="add"
              size={26}
              color={theme.mutedForeground}
            />
          </Pressable>
        ) : null}
        <View style={styles.inputShell}>
          <TextInput
            ref={inputRef}
            value={text}
            placeholder={isEditing ? "Edite a mensagem" : "Digite uma mensagem"}
            placeholderTextColor={theme.inputPlaceholder}
            accessibilityLabel={isEditing ? "Editar mensagem" : "Mensagem"}
            style={styles.input}
            multiline={true}
            editable
            onChangeText={(value) => {
              if (isRecordingActive()) return;
              setText(value);
            }}
          />
        </View>
        {isEditing ? (
          <Pressable
            onPress={() => void handleSendText()}
            disabled={editSendDisabled}
            accessibilityRole="button"
            accessibilityLabel="Salvar edição"
            accessibilityState={{ disabled: editSendDisabled }}
            style={({ pressed }) => [
              styles.roundBtn,
              pressed && styles.pressed,
              editSendDisabled && styles.disabled,
            ]}
          >
            <Ionicons
              name="checkmark"
              size={20}
              color={theme.primaryForeground}
            />
          </Pressable>
        ) : trimmedText && !isRecording ? (
          <Pressable
            onPress={() => void handleSendText()}
            disabled={isSending}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensagem"
            accessibilityState={{ disabled: isSending }}
            style={({ pressed }) => [
              styles.roundBtn,
              pressed && styles.pressed,
              isSending && styles.disabled,
            ]}
          >
            <Ionicons
              name="send"
              size={18}
              color={theme.primaryForeground}
            />
          </Pressable>
        ) : (
          <Pressable
            onPressIn={handleStartRecording}
            onPressOut={() => void stopRecordingAndSend()}
            disabled={isSending}
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? "Gravando mensagem de voz" : "Gravar mensagem de voz"
            }
            accessibilityHint="Mantenha pressionado para gravar e solte para enviar"
            accessibilityState={{ disabled: isSending, busy: isRecording }}
            style={({ pressed }) => [
              styles.roundBtn,
              pressed && !isRecording && styles.pressed,
              isSending && styles.disabled,
            ]}
          >
            <Ionicons
              name="mic"
              size={20}
              color={theme.primaryForeground}
            />
          </Pressable>
        )}
        {isRecording && (
          <View style={styles.recordingOverlay}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>Solte para enviar</Text>
            <Text style={styles.recTimer}>
              {Math.floor(recordingSeconds / 60)}:
              {(recordingSeconds % 60).toString().padStart(2, "0")}
            </Text>
          </View>
        )}
      </View>
      <AttachmentMenu
        visible={attachmentMenuVisible}
        onClose={() => setAttachmentMenuVisible(false)}
        onChooseGallery={() => void openGallery()}
        onChooseCamera={() => void openCamera()}
      />
      <ImagePreviewModal
        visible={pendingImage != null}
        uri={pendingImage?.uri ?? null}
        sending={imageSending}
        onCancel={() => setPendingImage(null)}
        onConfirm={() => void confirmSendImage()}
      />
    </Animated.View>
  );
});
