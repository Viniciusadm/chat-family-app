import { isRemoteUrl, mediaAuthHeaders } from "@/src/api/client";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { radius, spacing } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ImageViewerProps {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_WINDOW_MS = 280;
const TAP_SLOP = 8;
const OVER_MEDIA_FOREGROUND = "#ffffff";

export function ImageViewer({ uri, visible, onClose }: ImageViewerProps) {
  const insets = useSafeAreaInsets();

  const scale = useRef(new Animated.Value(MIN_SCALE)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const scaleValue = useRef(MIN_SCALE);
  const translateXValue = useRef(0);
  const translateYValue = useRef(0);

  const pinchBaseDistance = useRef(0);
  const pinchBaseScale = useRef(MIN_SCALE);
  const panBaseX = useRef(0);
  const panBaseY = useRef(0);
  const gestureHadPinch = useRef(false);
  const lastTapTimestamp = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const scaleListener = scale.addListener(({ value }) => {
      scaleValue.current = value;
    });
    const translateXListener = translateX.addListener(({ value }) => {
      translateXValue.current = value;
    });
    const translateYListener = translateY.addListener(({ value }) => {
      translateYValue.current = value;
    });
    return () => {
      scale.removeListener(scaleListener);
      translateX.removeListener(translateXListener);
      translateY.removeListener(translateYListener);
    };
  }, [scale, translateX, translateY]);

  useEffect(() => {
    if (visible) {
      scale.setValue(MIN_SCALE);
      translateX.setValue(0);
      translateY.setValue(0);
    }
    lastTapTimestamp.current = 0;
    return () => {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
    };
  }, [visible, scale, translateX, translateY]);

  const panResponder = useMemo(() => {
    const resetTransform = () => {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: MIN_SCALE,
          useNativeDriver: true,
        }),
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const handleTap = () => {
      const now = Date.now();
      if (now - lastTapTimestamp.current < DOUBLE_TAP_WINDOW_MS) {
        lastTapTimestamp.current = 0;
        if (singleTapTimer.current) {
          clearTimeout(singleTapTimer.current);
          singleTapTimer.current = null;
        }
        if (scaleValue.current > MIN_SCALE + 0.01) {
          resetTransform();
        } else {
          Animated.spring(scale, {
            toValue: DOUBLE_TAP_SCALE,
            useNativeDriver: true,
          }).start();
        }
        return;
      }
      lastTapTimestamp.current = now;
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null;
        if (scaleValue.current <= MIN_SCALE + 0.01) {
          onCloseRef.current();
        }
      }, DOUBLE_TAP_WINDOW_MS);
    };

    const startPinch = (touches: readonly { pageX: number; pageY: number }[]) => {
      const [t1, t2] = touches;
      pinchBaseDistance.current = Math.hypot(
        t2.pageX - t1.pageX,
        t2.pageY - t1.pageY,
      );
      pinchBaseScale.current = scaleValue.current;
      gestureHadPinch.current = true;
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        pinchBaseDistance.current = 0;
        pinchBaseScale.current = scaleValue.current;
        panBaseX.current = translateXValue.current;
        panBaseY.current = translateYValue.current;
        gestureHadPinch.current = false;

        if (evt.nativeEvent.touches.length >= 2) {
          startPinch(evt.nativeEvent.touches);
        }
      },
      onPanResponderMove: (evt, gesture) => {
        const touches = evt.nativeEvent.touches;
        if (touches.length >= 2) {
          if (pinchBaseDistance.current === 0) {
            startPinch(touches);
          }
          const [t1, t2] = touches;
          const distance = Math.hypot(
            t2.pageX - t1.pageX,
            t2.pageY - t1.pageY,
          );
          const ratio = distance / (pinchBaseDistance.current || 1);
          const next = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, pinchBaseScale.current * ratio),
          );
          scale.setValue(next);
          return;
        }
        if (pinchBaseDistance.current !== 0) {
          pinchBaseDistance.current = 0;
          panBaseX.current = translateXValue.current - gesture.dx;
          panBaseY.current = translateYValue.current - gesture.dy;
        }
        if (scaleValue.current > MIN_SCALE + 0.01) {
          translateX.setValue(panBaseX.current + gesture.dx);
          translateY.setValue(panBaseY.current + gesture.dy);
        }
      },
      onPanResponderRelease: (_evt, gesture) => {
        const isTap =
          !gestureHadPinch.current &&
          Math.abs(gesture.dx) < TAP_SLOP &&
          Math.abs(gesture.dy) < TAP_SLOP;

        if (isTap) {
          handleTap();
          return;
        }

        lastTapTimestamp.current = 0;
        if (scaleValue.current <= MIN_SCALE + 0.05) {
          resetTransform();
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        lastTapTimestamp.current = 0;
        resetTransform();
      },
    });
  }, [scale, translateX, translateY]);

  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      root: {
        flex: 1,
        backgroundColor: t.viewerBackdrop,
        alignItems: "center",
        justifyContent: "center",
      },
      header: {
        position: "absolute",
        top: insets.top + spacing.md,
        right: spacing.xl,
        zIndex: 2,
      },
      close: {
        width: 44,
        height: 44,
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.overlayLight,
      },
      imageWrap: {
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
      },
      image: {
        width: "100%",
        height: "82%",
      },
    }),
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Fechar imagem"
          >
            <Ionicons name="close" size={28} color={OVER_MEDIA_FOREGROUND} />
          </Pressable>
        </View>
        {uri ? (
          <Animated.View
            {...panResponder.panHandlers}
            accessible
            accessibilityRole="image"
            accessibilityLabel="Imagem em tela cheia"
            style={[
              styles.imageWrap,
              {
                transform: [
                  { translateX },
                  { translateY },
                  { scale },
                ],
              },
            ]}
          >
            <Image
              source={{
                uri,
                headers: isRemoteUrl(uri) ? mediaAuthHeaders() : undefined,
              }}
              style={styles.image}
              contentFit="contain"
              transition={120}
            />
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}
