import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  maxFontScale,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

export interface ChatInfoTab<T extends string> {
  key: T;
  label: string;
}

interface ChatInfoTabsProps<T extends string> {
  tabs: ChatInfoTab<T>[];
  selected: T;
  onSelect: (key: T) => void;
}

const INDICATOR_INSET = spacing.xl;

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    bar: {
      flexDirection: "row",
      backgroundColor: t.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: spacing.lg,
    },
    label: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.medium,
      color: t.mutedForeground,
    },
    labelSelected: {
      color: t.foreground,
      fontWeight: fontWeights.semibold,
    },
    indicator: {
      position: "absolute",
      bottom: 0,
      left: 0,
      height: 3,
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
      backgroundColor: t.primary,
    },
  });

export function ChatInfoTabs<T extends string>({
  tabs,
  selected,
  onSelect,
}: ChatInfoTabsProps<T>) {
  const styles = useThemedStyles(createStyles);
  const [width, setWidth] = useState(0);
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === selected),
  );
  const position = useRef(new Animated.Value(selectedIndex)).current;
  const tabWidth = tabs.length > 0 ? width / tabs.length : 0;

  useEffect(() => {
    Animated.spring(position, {
      toValue: selectedIndex,
      damping: 20,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  }, [position, selectedIndex]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      style={styles.bar}
      onLayout={handleLayout}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const isSelected = tab.key === selected;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onSelect(tab.key)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[styles.label, isSelected && styles.labelSelected]}
              maxFontSizeMultiplier={maxFontScale.compact}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
      {tabWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: tabWidth - INDICATOR_INSET * 2,
              transform: [
                {
                  translateX: Animated.add(
                    Animated.multiply(position, tabWidth),
                    INDICATOR_INSET,
                  ),
                },
              ],
            },
          ]}
        />
      ) : null}
    </View>
  );
}
