import { isRemoteUrl, mediaAuthHeaders } from "@/src/api/client";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { fontWeights, type ThemeTokens } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

type ProfileAvatarProps = {
  name?: string | null;
  photoUrl?: string | null;
  size?: number;
  icon?: keyof typeof Ionicons.glyphMap;
};

function initialsFromName(name?: string | null) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    wrap: {
      overflow: "hidden",
      backgroundColor: t.primaryTint,
      alignItems: "center",
      justifyContent: "center",
    },
    initials: {
      fontWeight: fontWeights.bold,
      color: t.primary,
    },
  });

export function ProfileAvatar({
  name,
  photoUrl,
  size = 40,
  icon = "person-outline",
}: ProfileAvatarProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [imageFailed, setImageFailed] = useState(false);
  const initials = initialsFromName(name);
  const radius = size / 2;
  const shouldShowImage = Boolean(photoUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [photoUrl]);

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
    >
      {shouldShowImage ? (
        <Image
          source={{
            uri: photoUrl ?? undefined,
            headers: isRemoteUrl(photoUrl) ? mediaAuthHeaders() : undefined,
          }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
          transition={120}
          onError={() => setImageFailed(true)}
        />
      ) : initials ? (
        <Text
          style={[
            styles.initials,
            {
              fontSize: Math.max(12, Math.round(size * 0.36)),
            },
          ]}
        >
          {initials}
        </Text>
      ) : (
        <Ionicons
          name={icon}
          size={Math.round(size * 0.5)}
          color={theme.primary}
        />
      )}
    </View>
  );
}
