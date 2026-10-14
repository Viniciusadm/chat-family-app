import { useTheme } from "@/theme/ThemeContext";
import { fontSizes, fontWeights, radius, spacing } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ImagePreviewModalProps {
  visible: boolean;
  uri: string | null;
  sending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImagePreviewModal({
  visible,
  uri,
  sending,
  onCancel,
  onConfirm,
}: ImagePreviewModalProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
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
    })
  );
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onCancel}
    >
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
        </View>

        {uri ? (
          <Image source={{ uri }} style={styles.image} contentFit="contain" />
        ) : null}

        <View style={styles.bottomBar}>
          <Text style={styles.hint}>Enviar imagem?</Text>
          <Pressable
            onPress={onConfirm}
            disabled={sending}
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
              <Ionicons name="send" size={22} color={theme.primaryForeground} />
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
