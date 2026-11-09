import { getMessageImageUri } from "@/lib/messageImageUri";
import { isRemoteUrl, mediaAuthHeaders } from "@/src/api/client";
import type { Message } from "@/types/chat";
import { Image } from "expo-image";
import React, { useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

interface ImagePagerProps {
  images: Message[];
  index: number;
  onIndexChange: (index: number) => void;
  onToggleChrome: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const PAGE_GAP = 16;
const SWIPE_DISTANCE_RATIO = 0.2;
const SWIPE_VELOCITY = 600;
const EDGE_RESISTANCE = 0.3;
const PAGE_ANIMATION_MS = 220;
const ZOOM_EPSILON = 0.01;

function aspectRatioOf(message: Message | undefined): number {
  if (!message?.imageWidth || !message.imageHeight) return 0;
  return message.imageWidth / message.imageHeight;
}

function ViewerImage({ message }: { message: Message }) {
  const uri = getMessageImageUri(message);
  if (!uri) return null;
  return (
    <Image
      source={{
        uri,
        headers: isRemoteUrl(uri) ? mediaAuthHeaders() : undefined,
      }}
      style={styles.image}
      contentFit="contain"
      transition={120}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Imagem em tela cheia"
    />
  );
}

interface PagerPageProps {
  message: Message;
  left: number;
  width: number;
  height: number;
  isActive: boolean;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
}

const PagerPage = React.memo(function PagerPage({
  message,
  left,
  width,
  height,
  isActive,
  scale,
  translateX,
  translateY,
}: PagerPageProps) {
  const zoomStyle = useAnimatedStyle(() => ({
    transform: isActive
      ? [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { scale: scale.value },
        ]
      : [{ translateX: 0 }, { translateY: 0 }, { scale: MIN_SCALE }],
  }));

  return (
    <View style={[styles.page, { left, width, height }]}>
      <Animated.View style={[styles.fill, zoomStyle]}>
        <ViewerImage message={message} />
      </Animated.View>
    </View>
  );
});

export function ImagePager({
  images,
  index,
  onIndexChange,
  onToggleChrome,
}: ImagePagerProps) {
  const { width, height } = useWindowDimensions();
  const pageStride = width + PAGE_GAP;

  const position = useSharedValue(-index * pageStride);
  const currentIndex = useSharedValue(index);
  const pageCount = useSharedValue(images.length);
  const currentImage = images[index];
  const currentImageId = currentImage?.id;
  const currentAspectRatio = aspectRatioOf(currentImage);
  const aspectRatio = useSharedValue(currentAspectRatio);

  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    currentIndex.value = index;
    position.value = -index * pageStride;
    aspectRatio.value = currentAspectRatio;
    scale.value = MIN_SCALE;
    translateX.value = 0;
    translateY.value = 0;
  }, [
    index,
    currentImageId,
    currentAspectRatio,
    pageStride,
    currentIndex,
    position,
    aspectRatio,
    scale,
    translateX,
    translateY,
  ]);

  useEffect(() => {
    pageCount.value = images.length;
  }, [images.length, pageCount]);

  const gesture = useMemo(() => {
    const maxOffsets = (targetScale: number) => {
      "worklet";
      const ratio = aspectRatio.value;
      let contentWidth = width;
      let contentHeight = height;
      if (ratio > 0) {
        if (width / height > ratio) {
          contentWidth = height * ratio;
        } else {
          contentHeight = width / ratio;
        }
      }
      return {
        x: Math.max(0, (contentWidth * targetScale - width) / 2),
        y: Math.max(0, (contentHeight * targetScale - height) / 2),
      };
    };

    const clamp = (value: number, limit: number) => {
      "worklet";
      return Math.min(limit, Math.max(-limit, value));
    };

    const settleTranslation = () => {
      "worklet";
      const limits = maxOffsets(scale.value);
      translateX.value = withTiming(clamp(translateX.value, limits.x));
      translateY.value = withTiming(clamp(translateY.value, limits.y));
    };

    const resetZoom = () => {
      "worklet";
      scale.value = withTiming(MIN_SCALE);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
    };

    const pinch = Gesture.Pinch()
      .onStart(() => {
        savedScale.value = scale.value;
      })
      .onUpdate((event) => {
        scale.value = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE * 0.8, savedScale.value * event.scale)
        );
      })
      .onEnd(() => {
        if (scale.value <= MIN_SCALE + ZOOM_EPSILON) {
          resetZoom();
          return;
        }
        settleTranslation();
      });

    const pan = Gesture.Pan()
      .minDistance(8)
      .averageTouches(true)
      .onStart(() => {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      })
      .onUpdate((event) => {
        if (scale.value > MIN_SCALE + ZOOM_EPSILON) {
          translateX.value = savedTranslateX.value + event.translationX;
          translateY.value = savedTranslateY.value + event.translationY;
          return;
        }
        if (event.numberOfPointers > 1) return;
        const atStart = currentIndex.value === 0 && event.translationX > 0;
        const atEnd =
          currentIndex.value === pageCount.value - 1 && event.translationX < 0;
        const offset =
          atStart || atEnd
            ? event.translationX * EDGE_RESISTANCE
            : event.translationX;
        position.value = -currentIndex.value * pageStride + offset;
      })
      .onEnd((event) => {
        if (scale.value > MIN_SCALE + ZOOM_EPSILON) {
          settleTranslation();
          return;
        }
        const from = currentIndex.value;
        let target = from;
        const threshold = width * SWIPE_DISTANCE_RATIO;
        if (
          (event.translationX < -threshold ||
            event.velocityX < -SWIPE_VELOCITY) &&
          from < pageCount.value - 1
        ) {
          target = from + 1;
        } else if (
          (event.translationX > threshold ||
            event.velocityX > SWIPE_VELOCITY) &&
          from > 0
        ) {
          target = from - 1;
        }
        currentIndex.value = target;
        position.value = withTiming(
          -target * pageStride,
          { duration: PAGE_ANIMATION_MS },
          (finished) => {
            if (finished && target !== from) {
              scheduleOnRN(onIndexChange, target);
            }
          }
        );
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((event) => {
        if (scale.value > MIN_SCALE + ZOOM_EPSILON) {
          resetZoom();
          return;
        }
        const limits = maxOffsets(DOUBLE_TAP_SCALE);
        scale.value = withSpring(DOUBLE_TAP_SCALE);
        translateX.value = withSpring(
          clamp((width / 2 - event.x) * (DOUBLE_TAP_SCALE - 1), limits.x)
        );
        translateY.value = withSpring(
          clamp((height / 2 - event.y) * (DOUBLE_TAP_SCALE - 1), limits.y)
        );
      });

    const singleTap = Gesture.Tap().onEnd(() => {
      scheduleOnRN(onToggleChrome);
    });

    return Gesture.Race(
      Gesture.Simultaneous(pinch, pan),
      Gesture.Exclusive(doubleTap, singleTap)
    );
  }, [
    width,
    height,
    pageStride,
    aspectRatio,
    currentIndex,
    pageCount,
    position,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
    onIndexChange,
    onToggleChrome,
  ]);

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value }],
  }));

  const visibleIndexes = [index - 1, index, index + 1].filter(
    (i) => i >= 0 && i < images.length
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.root} collapsable={false}>
        <Animated.View style={[StyleSheet.absoluteFill, trackStyle]}>
          {visibleIndexes.map((pageIndex) => (
            <PagerPage
              key={images[pageIndex].id}
              message={images[pageIndex]}
              left={pageIndex * pageStride}
              width={width}
              height={height}
              isActive={pageIndex === index}
              scale={scale}
              translateX={translateX}
              translateY={translateY}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  page: {
    position: "absolute",
    top: 0,
  },
  fill: {
    flex: 1,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
