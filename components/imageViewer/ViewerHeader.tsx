import {
  fontSizes,
  fontWeights,
  maxFontScale,
  radius,
  spacing,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  OVER_MEDIA_BAR,
  OVER_MEDIA_FOREGROUND,
  OVER_MEDIA_MUTED,
  OVER_MEDIA_PRESSED,
} from "./overMediaColors";

interface ViewerHeaderProps {
  topInset: number;
  title: string;
  subtitle: string;
  onBack: () => void;
  onSave: () => void;
  onForward: () => void;
  onOpenMenu: () => void;
}

interface HeaderActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

function HeaderAction({ icon, label, onPress }: HeaderActionProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={24} color={OVER_MEDIA_FOREGROUND} />
    </Pressable>
  );
}

export function ViewerHeader({
  topInset,
  title,
  subtitle,
  onBack,
  onSave,
  onForward,
  onOpenMenu,
}: ViewerHeaderProps) {
  return (
    <View style={[styles.bar, { paddingTop: topInset + spacing.sm }]}>
      <HeaderAction icon="arrow-back" label="Voltar" onPress={onBack} />
      <View style={styles.titleWrap}>
        <Text
          style={styles.title}
          numberOfLines={1}
          maxFontSizeMultiplier={maxFontScale.compact}
        >
          {title}
        </Text>
        <Text
          style={styles.subtitle}
          numberOfLines={1}
          maxFontSizeMultiplier={maxFontScale.compact}
        >
          {subtitle}
        </Text>
      </View>
      <HeaderAction
        icon="download-outline"
        label="Salvar na galeria"
        onPress={onSave}
      />
      <HeaderAction
        icon="arrow-redo-outline"
        label="Encaminhar"
        onPress={onForward}
      />
      <HeaderAction
        icon="ellipsis-vertical"
        label="Mais opções"
        onPress={onOpenMenu}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: OVER_MEDIA_BAR,
    gap: spacing.xs,
  },
  titleWrap: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  title: {
    color: OVER_MEDIA_FOREGROUND,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  subtitle: {
    color: OVER_MEDIA_MUTED,
    fontSize: fontSizes.footnote,
  },
  action: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: {
    backgroundColor: OVER_MEDIA_PRESSED,
  },
});
