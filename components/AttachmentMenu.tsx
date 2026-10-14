import { useTheme } from "@/theme/ThemeContext";
import { fontSizes, fontWeights, radius, spacing } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AttachmentMenuProps {
  visible: boolean;
  onClose: () => void;
  onChooseGallery: () => void;
  onChooseCamera: () => void;
}

export function AttachmentMenu({
  visible,
  onClose,
  onChooseGallery,
  onChooseCamera,
}: AttachmentMenuProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      backdrop: {
        flex: 1,
        backgroundColor: t.modalBackdrop,
        justifyContent: "flex-end",
      },
      sheet: {
        backgroundColor: t.background,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        paddingHorizontal: spacing.xxl,
        paddingTop: spacing.xxl,
        paddingBottom: insets.bottom + spacing.xxl,
        flexDirection: "row",
        gap: spacing.xxl,
      },
      option: {
        flex: 1,
        alignItems: "center",
        gap: spacing.sm,
      },
      pressed: {
        opacity: 0.72,
      },
      iconCircle: {
        width: 56,
        height: 56,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
      },
      optionLabel: {
        fontSize: fontSizes.subhead,
        fontWeight: fontWeights.semibold,
        color: t.foreground,
      },
    })
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Fechar menu de anexos"
      >
        <View style={styles.sheet}>
          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              onChooseCamera();
            }}
          >
            <View
              style={[styles.iconCircle, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="camera" size={24} color={theme.primaryForeground} />
            </View>
            <Text style={styles.optionLabel}>Câmera</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            accessibilityRole="button"
            onPress={() => {
              onClose();
              onChooseGallery();
            }}
          >
            <View style={[styles.iconCircle, { backgroundColor: theme.accent }]}>
              <Ionicons name="image" size={24} color={theme.accentForeground} />
            </View>
            <Text style={styles.optionLabel}>Galeria</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
