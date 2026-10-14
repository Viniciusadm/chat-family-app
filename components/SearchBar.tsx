import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  maxFontScale,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";

interface SearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      backgroundColor: t.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    field: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: t.muted,
    },
    input: {
      flex: 1,
      fontSize: fontSizes.bodySmall,
      color: t.foreground,
      paddingVertical: 0,
    },
    clearBtn: {
      width: 24,
      height: 24,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    clearBtnPressed: {
      opacity: 0.6,
    },
  });

export function SearchBar({
  value,
  onChangeText,
  onClear,
  placeholder = "Buscar em mensagens",
}: SearchBarProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handleClear = () => {
    onChangeText("");
    onClear?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <Ionicons name="search" size={18} color={theme.mutedForeground} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.inputPlaceholder}
          style={styles.input}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Campo de busca de mensagens"
          maxFontSizeMultiplier={maxFontScale.compact}
        />
        {value.length > 0 ? (
          <Pressable
            onPress={handleClear}
            accessibilityLabel="Limpar busca"
            accessibilityRole="button"
            hitSlop={10}
            style={({ pressed }) => [
              styles.clearBtn,
              pressed && styles.clearBtnPressed,
            ]}
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={theme.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
