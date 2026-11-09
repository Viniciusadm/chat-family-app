import { ProfileAvatar } from "@/components/ProfileAvatar";
import { isRemoteUrl, mediaAuthHeaders } from "@/src/api/client";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  lineHeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ChatInfoHeroProps {
  name: string;
  subtitle: string;
  photoUrl: string | null;
  icon: keyof typeof Ionicons.glyphMap;
}

const AVATAR_SIZE = 128;

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    root: {
      alignItems: "center",
      paddingHorizontal: spacing.xxl,
      gap: spacing.xs,
    },
    avatarButton: {
      marginBottom: spacing.md,
      borderRadius: radius.pill,
    },
    pressed: {
      opacity: 0.85,
    },
    name: {
      fontSize: fontSizes.largeTitle,
      lineHeight: lineHeights.largeTitle,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
      textAlign: "center",
    },
    subtitle: {
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
      textAlign: "center",
    },
    photoModalRoot: {
      flex: 1,
      backgroundColor: t.viewerBackdrop,
      alignItems: "center",
      justifyContent: "center",
    },
    photoClose: {
      position: "absolute",
      right: spacing.xl,
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.overlayLight,
      zIndex: 2,
    },
    fullPhoto: {
      width: "100%",
      height: "80%",
    },
  });

export function ChatInfoHero({
  name,
  subtitle,
  photoUrl,
  icon,
}: ChatInfoHeroProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [photoOpen, setPhotoOpen] = useState(false);

  return (
    <View style={styles.root}>
      <Pressable
        onPress={() => setPhotoOpen(true)}
        disabled={!photoUrl}
        style={({ pressed }) => [
          styles.avatarButton,
          pressed && styles.pressed,
        ]}
        accessibilityRole="imagebutton"
        accessibilityLabel={
          photoUrl ? `Ver foto de ${name}` : `Foto de ${name}`
        }
      >
        <ProfileAvatar
          name={name}
          photoUrl={photoUrl}
          size={AVATAR_SIZE}
          icon={icon}
        />
      </Pressable>
      <Text style={styles.name} accessibilityRole="header">
        {name}
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <Modal
        visible={photoOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPhotoOpen(false)}
      >
        <Pressable
          style={styles.photoModalRoot}
          onPress={() => setPhotoOpen(false)}
          accessible={false}
        >
          <Pressable
            onPress={() => setPhotoOpen(false)}
            hitSlop={12}
            style={[styles.photoClose, { top: insets.top + spacing.md }]}
            accessibilityRole="button"
            accessibilityLabel="Fechar foto"
          >
            <Ionicons name="close" size={28} color="#ffffff" />
          </Pressable>
          {photoUrl ? (
            <Image
              source={{
                uri: photoUrl,
                headers: isRemoteUrl(photoUrl) ? mediaAuthHeaders() : undefined,
              }}
              style={styles.fullPhoto}
              contentFit="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
