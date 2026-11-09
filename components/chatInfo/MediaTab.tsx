import { getMessageImageUri } from "@/lib/messageImageUri";
import { isRemoteUrl, mediaAuthHeaders } from "@/src/api/client";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import type { Message } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

interface MediaTabProps {
  images: Message[];
  loading: boolean;
  onOpen: (messageId: string) => void;
}

const COLUMNS = 3;
const GAP = 2;
const PAGE_SIZE = 45;

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GAP,
      paddingTop: GAP,
    },
    tile: {
      backgroundColor: t.muted,
    },
    pressed: {
      opacity: 0.8,
    },
    empty: {
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.huge,
      paddingHorizontal: spacing.xl,
    },
    emptyText: {
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
      textAlign: "center",
    },
    more: {
      alignItems: "center",
      paddingVertical: spacing.lg,
    },
    moreText: {
      fontSize: fontSizes.subhead,
      fontWeight: fontWeights.semibold,
      color: t.primary,
    },
  });

export function MediaTab({ images, loading, onOpen }: MediaTabProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [width, setWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const tileSize = width > 0 ? (width - GAP * (COLUMNS - 1)) / COLUMNS : 0;

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  if (loading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (images.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons
          name="images-outline"
          size={40}
          color={theme.mutedForeground}
        />
        <Text style={styles.emptyText}>Nenhuma foto nesta conversa ainda.</Text>
      </View>
    );
  }

  return (
    <View onLayout={handleLayout}>
      <View style={styles.grid}>
        {tileSize > 0
          ? images.slice(0, visibleCount).map((message) => {
              const uri = getMessageImageUri(message);
              if (!uri) return null;
              return (
                <Pressable
                  key={message.id}
                  onPress={() => onOpen(message.id)}
                  style={({ pressed }) => [
                    styles.tile,
                    { width: tileSize, height: tileSize },
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Abrir foto"
                >
                  <Image
                    source={{
                      uri,
                      headers: isRemoteUrl(uri)
                        ? mediaAuthHeaders()
                        : undefined,
                    }}
                    style={{ width: tileSize, height: tileSize }}
                    contentFit="cover"
                    recyclingKey={message.id}
                    transition={120}
                  />
                </Pressable>
              );
            })
          : null}
      </View>
      {images.length > visibleCount ? (
        <Pressable
          onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.moreText}>Mostrar mais</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
