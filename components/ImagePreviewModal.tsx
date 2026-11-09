import { useTheme } from "@/theme/ThemeContext";
import { fontSizes, fontWeights, radius, spacing } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { CropEditor } from "@/components/imageEditor/CropEditor";
import {
  applyImageEdits,
  INITIAL_EDIT_STATE,
  readImageSize,
  type EditedImage,
  type ImageEditState,
  type Size,
} from "@/lib/imageEdit";
import React, { useEffect, useState } from "react";
import { showAlert } from "@/components/AppAlert";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ImagePreviewModalProps {
  visible: boolean;
  uri: string | null;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onEdited: (image: EditedImage) => void;
}

interface OriginalImage {
  uri: string;
  size: Size;
}

export function ImagePreviewModal({
  visible,
  uri,
  sending,
  onCancel,
  onConfirm,
  onEdited,
}: ImagePreviewModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [original, setOriginal] = useState<OriginalImage | null>(null);
  const [editState, setEditState] =
    useState<ImageEditState>(INITIAL_EDIT_STATE);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (visible) return;
    setMode("preview");
    setOriginal(null);
    setEditState(INITIAL_EDIT_STATE);
    setProcessing(false);
  }, [visible]);

  const openEditor = async () => {
    if (!uri || processing) return;
    if (original) {
      setMode("edit");
      return;
    }
    setProcessing(true);
    try {
      const size = await readImageSize(uri);
      setOriginal({ uri, size });
      setMode("edit");
    } catch {
      showAlert(
        "Não foi possível editar",
        "Tente escolher a imagem novamente.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const finishEditing = async (state: ImageEditState) => {
    if (!original) return;
    setMode("preview");
    setProcessing(true);
    try {
      const edited = await applyImageEdits(original.uri, original.size, state);
      setEditState(state);
      onEdited(edited);
    } catch {
      showAlert("Não foi possível editar", "Tente novamente.");
    } finally {
      setProcessing(false);
    }
  };

  const handleRequestClose = () => {
    if (mode === "edit") {
      setMode("preview");
      return;
    }
    onCancel();
  };
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      root: {
        flex: 1,
        backgroundColor: t.viewerBackdrop,
      },
      topBar: {
        paddingTop: insets.top + spacing.md,
        paddingHorizontal: spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      imageWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      },
      processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
      },
      iconBtn: {
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.overlayLight,
      },
      image: {
        flex: 1,
        width: "100%",
      },
      bottomBar: {
        paddingHorizontal: spacing.xxl,
        paddingTop: spacing.xxl,
        paddingBottom: insets.bottom + spacing.xxl,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.lg,
      },
      hint: {
        flex: 1,
        color: "#ffffff",
        fontSize: fontSizes.body,
        fontWeight: fontWeights.medium,
      },
      sendBtn: {
        width: 52,
        height: 52,
        borderRadius: radius.pill,
        backgroundColor: t.primary,
        alignItems: "center",
        justifyContent: "center",
      },
      pressed: {
        opacity: 0.85,
        transform: [{ scale: 0.97 }],
      },
    }),
  );
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <GestureHandlerRootView style={styles.root}>
        {mode === "edit" && original ? (
          <CropEditor
            sourceUri={original.uri}
            sourceSize={original.size}
            initialState={editState}
            onCancel={() => setMode("preview")}
            onDone={(state) => void finishEditing(state)}
          />
        ) : (
          <View style={styles.root}>
            <View style={styles.topBar}>
              <Pressable
                onPress={onCancel}
                hitSlop={12}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Cancelar envio da imagem"
              >
                <Ionicons name="close" size={26} color="#ffffff" />
              </Pressable>
              <Pressable
                onPress={() => void openEditor()}
                disabled={processing || sending || !uri}
                hitSlop={12}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Recortar imagem"
                accessibilityState={{ disabled: processing || sending || !uri }}
              >
                <Ionicons name="crop" size={24} color="#ffffff" />
              </Pressable>
            </View>

            <View style={styles.imageWrap}>
              {uri ? (
                <Image
                  source={{ uri }}
                  style={styles.image}
                  contentFit="contain"
                />
              ) : null}
              {processing ? (
                <View style={styles.processingOverlay} pointerEvents="none">
                  <ActivityIndicator size="large" color="#ffffff" />
                </View>
              ) : null}
            </View>

            <View style={styles.bottomBar}>
              <Text style={styles.hint}>Enviar imagem?</Text>
              <Pressable
                onPress={onConfirm}
                disabled={sending || processing}
                accessibilityRole="button"
                accessibilityLabel="Enviar imagem"
                accessibilityState={{ disabled: sending, busy: sending }}
                style={({ pressed }) => [
                  styles.sendBtn,
                  (pressed || sending) && styles.pressed,
                ]}
              >
                {sending ? (
                  <ActivityIndicator color={theme.primaryForeground} />
                ) : (
                  <Ionicons
                    name="send"
                    size={22}
                    color={theme.primaryForeground}
                  />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}
