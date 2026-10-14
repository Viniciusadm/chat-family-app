import { AppHeader } from "@/components/AppHeader";
import { LoadingDots } from "@/components/LoadingDots";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { ThemePicker } from "@/components/ThemePicker";
import { useAuth } from "@/context/AuthContext";
import { useConnectivity } from "@/hooks/useConnectivity";
import { useMemberProfiles } from "@/hooks/useMemberProfiles";
import { isRemoteUrl, mediaAuthHeaders } from "@/src/api/client";
import { uploadProfilePhoto, deleteProfilePhoto } from "@/src/api/media";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

function roleLabel(role: string) {
  return role === "adult" ? "Adulto" : "Criança";
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.background,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: spacing.xxl,
      paddingTop: 36,
    },
    avatarWrap: {
      width: 132,
      height: 132,
      borderRadius: radius.pill,
      overflow: "hidden",
    },
    savingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.modalBackdrop,
    },
    name: {
      marginTop: spacing.lg,
      fontSize: fontSizes.title2,
      fontWeight: fontWeights.bold,
      color: t.foreground,
      textAlign: "center",
    },
    meta: {
      marginTop: spacing.xs,
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
    },
    actions: {
      alignSelf: "stretch",
      marginTop: spacing.xxxl,
      gap: spacing.md,
    },
    primaryBtn: {
      minHeight: 48,
      borderRadius: radius.md,
      backgroundColor: t.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    primaryBtnText: {
      color: t.primaryForeground,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.bold,
    },
    dangerBtn: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
    },
    dangerBtnText: {
      color: t.destructive,
      fontSize: fontSizes.body,
      fontWeight: fontWeights.bold,
    },
    photoModalRoot: {
      flex: 1,
      backgroundColor: t.viewerBackdrop,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.lg,
    },
    photoModalHeader: {
      position: "absolute",
      top: spacing.giant,
      right: spacing.xl,
      zIndex: 2,
    },
    photoClose: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.overlayLight,
    },
    fullPhoto: {
      width: "100%",
      height: "82%",
    },
    logoutBtn: {
      alignSelf: "stretch",
      marginTop: spacing.xxl,
    },
    pressed: {
      opacity: 0.72,
    },
  });

export default function ProfileScreen() {
  const router = useRouter();
  const { memberId } = useLocalSearchParams<{ memberId?: string }>();
  const { currentUser, setCurrentUserPhoto, logout } = useAuth();
  const { isOnline } = useConnectivity();
  const memberProfiles = useMemberProfiles();
  const [saving, setSaving] = useState(false);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!currentUser) {
    return (
      <ScreenContainer style={styles.screen} edges={["bottom"]}>
        <View style={styles.center}>
          <LoadingDots />
        </View>
      </ScreenContainer>
    );
  }

  const isOwnProfile = !memberId || memberId === currentUser.id;
  const viewedProfile = isOwnProfile ? currentUser : memberProfiles[memberId];
  const canMutatePhoto = isOwnProfile && isOnline;

  if (!viewedProfile) {
    return (
      <ScreenContainer style={styles.screen} edges={["bottom"]}>
        <AppHeader title="Perfil" onBack={() => router.back()} />
        <View style={styles.center}>
          <LoadingDots />
        </View>
      </ScreenContainer>
    );
  }

  const choosePhoto = async () => {
    if (saving || !canMutatePhoto) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
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

    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    if (asset.width !== asset.height) {
      Alert.alert(
        "Foto inválida",
        "A foto precisa ser cortada em formato quadrado antes do envio."
      );
      return;
    }

    setSaving(true);
    try {
      const uploaded = await uploadProfilePhoto({
        uri: asset.uri,
        name: "profile.jpg",
        type: asset.mimeType ?? "image/jpeg",
      });
      await setCurrentUserPhoto(uploaded.url, uploaded.path ?? null);
    } catch (e) {
      Alert.alert(
        "Erro ao salvar foto",
        e instanceof Error ? e.message : "Não foi possível salvar a foto."
      );
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async () => {
    if (saving || !canMutatePhoto || !currentUser.photoUrl) return;
    setSaving(true);
    try {
      await deleteProfilePhoto();
      await setCurrentUserPhoto(null, null);
    } catch (e) {
      Alert.alert(
        "Erro ao remover foto",
        e instanceof Error ? e.message : "Não foi possível remover a foto."
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    if (loggingOut) return;
    Alert.alert("Sair", "Deseja sair da sua conta neste aparelho?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => {
          setLoggingOut(true);
          void logout()
            .catch(() => {})
            .finally(() => setLoggingOut(false));
        },
      },
    ]);
  };

  return (
    <ScreenContainer style={styles.screen} edges={["bottom"]}>
      <AppHeader title="Perfil" onBack={() => router.back()} />
      <View style={styles.content}>
        <Pressable
          onPress={() => {
            if (viewedProfile.photoUrl) setPhotoModalVisible(true);
          }}
          disabled={!viewedProfile.photoUrl}
          accessibilityRole={viewedProfile.photoUrl ? "imagebutton" : "image"}
          accessibilityLabel={`Foto de perfil de ${viewedProfile.name}`}
          accessibilityHint={
            viewedProfile.photoUrl ? "Toque duas vezes para ampliar" : undefined
          }
          accessibilityState={{ busy: saving && isOwnProfile }}
          style={({ pressed }) => [
            styles.avatarWrap,
            pressed && styles.pressed,
          ]}
        >
          <ProfileAvatar
            name={viewedProfile.name}
            photoUrl={viewedProfile.photoUrl}
            size={132}
          />
          {saving && isOwnProfile ? (
            <View style={styles.savingOverlay}>
              <ActivityIndicator color="#ffffff" />
            </View>
          ) : null}
        </Pressable>

        <Text style={styles.name}>{viewedProfile.name}</Text>
        <Text style={styles.meta}>{roleLabel(viewedProfile.role)}</Text>

        {canMutatePhoto ? (
          <View style={styles.actions}>
            <Pressable
              onPress={() => void choosePhoto()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              style={({ pressed }) => [
                styles.primaryBtn,
                (pressed || saving) && styles.pressed,
              ]}
            >
              <Ionicons
                name="image-outline"
                size={18}
                color={theme.primaryForeground}
              />
              <Text style={styles.primaryBtnText}>
                {currentUser.photoUrl ? "Trocar foto" : "Adicionar foto"}
              </Text>
            </Pressable>

            {currentUser.photoUrl ? (
              <Pressable
                onPress={() => void removePhoto()}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ disabled: saving }}
                style={({ pressed }) => [
                  styles.dangerBtn,
                  (pressed || saving) && styles.pressed,
                ]}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={theme.destructive}
                />
                <Text style={styles.dangerBtnText}>Remover foto</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {isOwnProfile ? <ThemePicker /> : null}

        {isOwnProfile ? (
          <Pressable
            onPress={confirmLogout}
            disabled={loggingOut}
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
            accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
            style={({ pressed }) => [
              styles.dangerBtn,
              styles.logoutBtn,
              (pressed || loggingOut) && styles.pressed,
            ]}
          >
            {loggingOut ? (
              <ActivityIndicator color={theme.destructive} />
            ) : (
              <Ionicons
                name="log-out-outline"
                size={18}
                color={theme.destructive}
              />
            )}
            <Text style={styles.dangerBtnText}>Sair</Text>
          </Pressable>
        ) : null}
      </View>

      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <Pressable
          style={styles.photoModalRoot}
          onPress={() => setPhotoModalVisible(false)}
          accessible={false}
        >
          <View style={styles.photoModalHeader}>
            <Pressable
              onPress={() => setPhotoModalVisible(false)}
              hitSlop={12}
              style={styles.photoClose}
              accessibilityRole="button"
              accessibilityLabel="Fechar foto"
            >
              <Ionicons name="close" size={28} color="#ffffff" />
            </Pressable>
          </View>
          {viewedProfile.photoUrl ? (
            <Image
              source={{
                uri: viewedProfile.photoUrl,
                headers: isRemoteUrl(viewedProfile.photoUrl)
                  ? mediaAuthHeaders()
                  : undefined,
              }}
              style={styles.fullPhoto}
              contentFit="contain"
            />
          ) : null}
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
