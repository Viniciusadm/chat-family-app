import {
  OVER_MEDIA_BACKDROP,
  OVER_MEDIA_FOREGROUND,
  OVER_MEDIA_MUTED,
  OVER_MEDIA_PRESSED,
  OVER_MEDIA_SURFACE,
} from "@/components/imageViewer/overMediaColors";
import {
  aspectRatioValue,
  centeredCropForAspect,
  denormalizeRect,
  fitRect,
  flipNormalizedRectHorizontally,
  isFullCrop,
  moveCrop,
  normalizeRect,
  resizeCropFromHandle,
  rotateClockwiseOnScreen,
  rotatedSize,
  rotateNormalizedRectClockwise,
  type AspectRatioOption,
  type CropHandle,
  type ImageEditState,
  type Rect,
  type Rotation,
  type Size,
} from "@/lib/imageEdit";
import {
  fontSizes,
  fontWeights,
  maxFontScale,
  radius,
  spacing,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface CropEditorProps {
  sourceUri: string;
  sourceSize: Size;
  initialState: ImageEditState;
  onCancel: () => void;
  onDone: (state: ImageEditState) => void;
}

const FULL_RECT: Rect = { x: 0, y: 0, width: 1, height: 1 };
const MIN_CROP_SIZE = 56;
const HANDLE_TOUCH_SIZE = 44;
const CORNER_LENGTH = 22;
const CORNER_THICKNESS = 4;
const EDGE_BAR_LENGTH = 24;
const STAGE_PADDING = spacing.xxl;
const MASK_COLOR = "rgba(0,0,0,0.6)";
const GRID_COLOR = "rgba(255,255,255,0.5)";
const FRAME_BORDER = 1.5;

const CORNER_HANDLES: CropHandle[] = ["tl", "tr", "br", "bl"];
const EDGE_HANDLES: CropHandle[] = ["t", "r", "b", "l"];

const ASPECT_OPTIONS: { value: AspectRatioOption; label: string }[] = [
  { value: "free", label: "Livre" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "16:9", label: "16:9" },
];

interface CropValues {
  x: SharedValue<number>;
  y: SharedValue<number>;
  width: SharedValue<number>;
  height: SharedValue<number>;
}

interface HandleViewProps {
  handle: CropHandle;
  crop: CropValues;
  offset: Size;
  bounds: SharedValue<Size>;
  aspect: SharedValue<number | null>;
  dragging: SharedValue<number>;
}

function handleAnchor(handle: CropHandle): { fx: number; fy: number } {
  "worklet";
  switch (handle) {
    case "tl":
      return { fx: 0, fy: 0 };
    case "t":
      return { fx: 0.5, fy: 0 };
    case "tr":
      return { fx: 1, fy: 0 };
    case "r":
      return { fx: 1, fy: 0.5 };
    case "br":
      return { fx: 1, fy: 1 };
    case "b":
      return { fx: 0.5, fy: 1 };
    case "bl":
      return { fx: 0, fy: 1 };
    default:
      return { fx: 0, fy: 0.5 };
  }
}

function HandleVisual({ handle }: { handle: CropHandle }) {
  if (handle.length === 1) {
    const horizontal = handle === "t" || handle === "b";
    return (
      <View
        style={[
          styles.edgeBar,
          horizontal
            ? { width: EDGE_BAR_LENGTH, height: CORNER_THICKNESS }
            : { width: CORNER_THICKNESS, height: EDGE_BAR_LENGTH },
        ]}
      />
    );
  }
  const isTop = handle.startsWith("t");
  const isLeft = handle.endsWith("l");
  const inset = HANDLE_TOUCH_SIZE / 2 - CORNER_THICKNESS / 2;
  const vertical = isTop ? { top: inset } : { bottom: inset };
  const horizontal = isLeft ? { left: inset } : { right: inset };
  return (
    <>
      <View
        style={[
          styles.cornerBar,
          vertical,
          horizontal,
          { width: CORNER_LENGTH, height: CORNER_THICKNESS },
        ]}
      />
      <View
        style={[
          styles.cornerBar,
          vertical,
          horizontal,
          { width: CORNER_THICKNESS, height: CORNER_LENGTH },
        ]}
      />
    </>
  );
}

function HandleView({
  handle,
  crop,
  offset,
  bounds,
  aspect,
  dragging,
}: HandleViewProps) {
  const start = useSharedValue<Rect>({ x: 0, y: 0, width: 0, height: 0 });

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onStart(() => {
          start.value = {
            x: crop.x.value,
            y: crop.y.value,
            width: crop.width.value,
            height: crop.height.value,
          };
          dragging.value = withTiming(1, { duration: 120 });
        })
        .onUpdate((event) => {
          const next = resizeCropFromHandle(
            start.value,
            handle,
            event.translationX,
            event.translationY,
            bounds.value,
            MIN_CROP_SIZE,
            aspect.value
          );
          crop.x.value = next.x;
          crop.y.value = next.y;
          crop.width.value = next.width;
          crop.height.value = next.height;
        })
        .onFinalize(() => {
          dragging.value = withTiming(0, { duration: 200 });
        }),
    [handle, crop, bounds, aspect, dragging, start]
  );

  const animatedStyle = useAnimatedStyle(() => {
    const { fx, fy } = handleAnchor(handle);
    return {
      left:
        offset.width +
        crop.x.value +
        crop.width.value * fx -
        HANDLE_TOUCH_SIZE / 2,
      top:
        offset.height +
        crop.y.value +
        crop.height.value * fy -
        HANDLE_TOUCH_SIZE / 2,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[styles.handle, animatedStyle]}
        accessibilityLabel="Ajustar recorte"
      >
        <HandleVisual handle={handle} />
      </Animated.View>
    </GestureDetector>
  );
}

interface ToolButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

function ToolButton({ icon, label, onPress }: ToolButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.toolButton, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={24} color={OVER_MEDIA_FOREGROUND} />
    </Pressable>
  );
}

export function CropEditor({
  sourceUri,
  sourceSize,
  initialState,
  onCancel,
  onDone,
}: CropEditorProps) {
  const insets = useSafeAreaInsets();
  const [rotation, setRotation] = useState<Rotation>(initialState.rotation);
  const [flipped, setFlipped] = useState(initialState.flipped);
  const [aspectOption, setAspectOption] = useState<AspectRatioOption>("free");
  const [normalizedCrop, setNormalizedCrop] = useState<Rect>(
    initialState.crop ?? FULL_RECT
  );
  const [stageSize, setStageSize] = useState<Size | null>(null);

  const cropX = useSharedValue(0);
  const cropY = useSharedValue(0);
  const cropWidth = useSharedValue(0);
  const cropHeight = useSharedValue(0);
  const bounds = useSharedValue<Size>({ width: 0, height: 0 });
  const aspect = useSharedValue<number | null>(null);
  const dragging = useSharedValue(0);
  const moveStart = useSharedValue<Rect>({ x: 0, y: 0, width: 0, height: 0 });

  const crop = useMemo<CropValues>(
    () => ({ x: cropX, y: cropY, width: cropWidth, height: cropHeight }),
    [cropX, cropY, cropWidth, cropHeight]
  );

  const displaySize = rotatedSize(sourceSize, rotation);
  const box = stageSize
    ? fitRect(displaySize, {
        width: Math.max(0, stageSize.width - STAGE_PADDING * 2),
        height: Math.max(0, stageSize.height - STAGE_PADDING * 2),
      })
    : null;
  const boxOffset: Size = box
    ? { width: box.x + STAGE_PADDING, height: box.y + STAGE_PADDING }
    : { width: 0, height: 0 };
  const boxWidth = box?.width ?? 0;
  const boxHeight = box?.height ?? 0;

  useEffect(() => {
    if (boxWidth <= 0 || boxHeight <= 0) return;
    const boxSize = { width: boxWidth, height: boxHeight };
    const rect = denormalizeRect(normalizedCrop, boxSize);
    bounds.value = boxSize;
    cropX.value = rect.x;
    cropY.value = rect.y;
    cropWidth.value = rect.width;
    cropHeight.value = rect.height;
  }, [
    boxWidth,
    boxHeight,
    normalizedCrop,
    bounds,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
  ]);

  useEffect(() => {
    aspect.value = aspectRatioValue(aspectOption);
  }, [aspectOption, aspect]);

  const readCurrentNormalized = (): Rect => {
    if (boxWidth <= 0 || boxHeight <= 0) return normalizedCrop;
    return normalizeRect(
      {
        x: cropX.value,
        y: cropY.value,
        width: cropWidth.value,
        height: cropHeight.value,
      },
      { width: boxWidth, height: boxHeight }
    );
  };

  const handleRotate = () => {
    const next = rotateClockwiseOnScreen(rotation, flipped);
    const ratio = aspectRatioValue(aspectOption);
    setRotation(next);
    if (ratio === null) {
      setNormalizedCrop(rotateNormalizedRectClockwise(readCurrentNormalized()));
      return;
    }
    const nextDisplay = rotatedSize(sourceSize, next);
    setNormalizedCrop(
      normalizeRect(centeredCropForAspect(nextDisplay, ratio), nextDisplay)
    );
  };

  const handleFlip = () => {
    setFlipped((value) => !value);
    setNormalizedCrop(flipNormalizedRectHorizontally(readCurrentNormalized()));
  };

  const handleAspect = (option: AspectRatioOption) => {
    setAspectOption(option);
    const ratio = aspectRatioValue(option);
    setNormalizedCrop(
      ratio === null
        ? FULL_RECT
        : normalizeRect(centeredCropForAspect(displaySize, ratio), displaySize)
    );
  };

  const handleReset = () => {
    setRotation(0);
    setFlipped(false);
    setAspectOption("free");
    setNormalizedCrop({ ...FULL_RECT });
  };

  const handleDone = () => {
    const current = readCurrentNormalized();
    onDone({
      rotation,
      flipped,
      crop: isFullCrop(current) ? null : current,
    });
  };

  const handleStageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStageSize((previous) =>
      previous && previous.width === width && previous.height === height
        ? previous
        : { width, height }
    );
  };

  const moveGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          moveStart.value = {
            x: cropX.value,
            y: cropY.value,
            width: cropWidth.value,
            height: cropHeight.value,
          };
          dragging.value = withTiming(1, { duration: 120 });
        })
        .onUpdate((event) => {
          const next = moveCrop(
            moveStart.value,
            event.translationX,
            event.translationY,
            bounds.value
          );
          cropX.value = next.x;
          cropY.value = next.y;
        })
        .onFinalize(() => {
          dragging.value = withTiming(0, { duration: 200 });
        }),
    [moveStart, cropX, cropY, cropWidth, cropHeight, bounds, dragging]
  );

  const offsetX = boxOffset.width;
  const offsetY = boxOffset.height;

  const frameStyle = useAnimatedStyle(() => ({
    left: offsetX + cropX.value,
    top: offsetY + cropY.value,
    width: cropWidth.value,
    height: cropHeight.value,
  }));

  const gridStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + dragging.value * 0.65,
  }));

  const maskTopStyle = useAnimatedStyle(() => ({
    left: offsetX,
    top: offsetY,
    width: bounds.value.width,
    height: cropY.value,
  }));

  const maskBottomStyle = useAnimatedStyle(() => ({
    left: offsetX,
    top: offsetY + cropY.value + cropHeight.value,
    width: bounds.value.width,
    height: Math.max(0, bounds.value.height - cropY.value - cropHeight.value),
  }));

  const maskLeftStyle = useAnimatedStyle(() => ({
    left: offsetX,
    top: offsetY + cropY.value,
    width: cropX.value,
    height: cropHeight.value,
  }));

  const maskRightStyle = useAnimatedStyle(() => ({
    left: offsetX + cropX.value + cropWidth.value,
    top: offsetY + cropY.value,
    width: Math.max(0, bounds.value.width - cropX.value - cropWidth.value),
    height: cropHeight.value,
  }));

  const quarterTurn = rotation === 90 || rotation === 270;
  const imageWidth = quarterTurn ? boxHeight : boxWidth;
  const imageHeight = quarterTurn ? boxWidth : boxHeight;
  const visibleHandles =
    aspectOption === "free"
      ? [...CORNER_HANDLES, ...EDGE_HANDLES]
      : CORNER_HANDLES;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Cancelar edição"
        >
          <Text
            style={styles.textButtonLabel}
            maxFontSizeMultiplier={maxFontScale.compact}
          >
            Cancelar
          </Text>
        </Pressable>
        <Text
          style={styles.title}
          maxFontSizeMultiplier={maxFontScale.compact}
          accessibilityRole="header"
        >
          Recortar
        </Text>
        <Pressable
          onPress={handleDone}
          hitSlop={8}
          style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Concluir edição"
        >
          <Text
            style={[styles.textButtonLabel, styles.doneLabel]}
            maxFontSizeMultiplier={maxFontScale.compact}
          >
            Concluir
          </Text>
        </Pressable>
      </View>

      <View style={styles.stage} onLayout={handleStageLayout}>
        {box ? (
          <>
            <View
              style={[
                styles.imageBox,
                {
                  left: offsetX,
                  top: offsetY,
                  width: boxWidth,
                  height: boxHeight,
                },
              ]}
              pointerEvents="none"
            >
              <Image
                source={{ uri: sourceUri }}
                contentFit="fill"
                style={{
                  position: "absolute",
                  width: imageWidth,
                  height: imageHeight,
                  left: (boxWidth - imageWidth) / 2,
                  top: (boxHeight - imageHeight) / 2,
                  transform: [
                    { scaleX: flipped ? -1 : 1 },
                    { rotate: `${rotation}deg` },
                  ],
                }}
                accessible
                accessibilityRole="image"
                accessibilityLabel="Imagem sendo recortada"
              />
            </View>
            <Animated.View
              style={[styles.mask, maskTopStyle]}
              pointerEvents="none"
            />
            <Animated.View
              style={[styles.mask, maskBottomStyle]}
              pointerEvents="none"
            />
            <Animated.View
              style={[styles.mask, maskLeftStyle]}
              pointerEvents="none"
            />
            <Animated.View
              style={[styles.mask, maskRightStyle]}
              pointerEvents="none"
            />
            <GestureDetector gesture={moveGesture}>
              <Animated.View
                style={[styles.frame, frameStyle]}
                accessibilityLabel="Mover recorte"
              >
                <Animated.View
                  style={[StyleSheet.absoluteFill, gridStyle]}
                  pointerEvents="none"
                >
                  <View style={[styles.gridLine, styles.gridV1]} />
                  <View style={[styles.gridLine, styles.gridV2]} />
                  <View style={[styles.gridLine, styles.gridH1]} />
                  <View style={[styles.gridLine, styles.gridH2]} />
                </Animated.View>
              </Animated.View>
            </GestureDetector>
            {visibleHandles.map((handle) => (
              <HandleView
                key={handle}
                handle={handle}
                crop={crop}
                offset={boxOffset}
                bounds={bounds}
                aspect={aspect}
                dragging={dragging}
              />
            ))}
          </>
        ) : null}
      </View>

      <View
        style={[styles.toolbar, { paddingBottom: insets.bottom + spacing.lg }]}
      >
        <View style={styles.aspectRow}>
          {ASPECT_OPTIONS.map((option) => {
            const selected = option.value === aspectOption;
            return (
              <Pressable
                key={option.value}
                onPress={() => handleAspect(option.value)}
                style={({ pressed }) => [
                  styles.chip,
                  selected && styles.chipSelected,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Proporção ${option.label}`}
              >
                <Text
                  style={[styles.chipLabel, selected && styles.chipLabelSelected]}
                  maxFontSizeMultiplier={maxFontScale.compact}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.toolRow}>
          <ToolButton
            icon="refresh-outline"
            label="Girar 90 graus"
            onPress={handleRotate}
          />
          <ToolButton
            icon="swap-horizontal-outline"
            label="Espelhar"
            onPress={handleFlip}
          />
          <Pressable
            onPress={handleReset}
            hitSlop={4}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Redefinir edição"
          >
            <Text
              style={styles.textButtonLabel}
              maxFontSizeMultiplier={maxFontScale.compact}
            >
              Redefinir
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: OVER_MEDIA_BACKDROP,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    color: OVER_MEDIA_FOREGROUND,
    fontSize: fontSizes.body,
    fontWeight: fontWeights.semibold,
  },
  textButton: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  textButtonLabel: {
    color: OVER_MEDIA_FOREGROUND,
    fontSize: fontSizes.body,
  },
  doneLabel: {
    fontWeight: fontWeights.semibold,
  },
  pressed: {
    backgroundColor: OVER_MEDIA_PRESSED,
  },
  stage: {
    flex: 1,
  },
  imageBox: {
    position: "absolute",
    overflow: "hidden",
  },
  mask: {
    position: "absolute",
    backgroundColor: MASK_COLOR,
  },
  frame: {
    position: "absolute",
    borderWidth: FRAME_BORDER,
    borderColor: OVER_MEDIA_FOREGROUND,
  },
  gridLine: {
    position: "absolute",
    backgroundColor: GRID_COLOR,
  },
  gridV1: {
    left: "33.33%",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
  gridV2: {
    left: "66.66%",
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
  gridH1: {
    top: "33.33%",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  gridH2: {
    top: "66.66%",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  handle: {
    position: "absolute",
    width: HANDLE_TOUCH_SIZE,
    height: HANDLE_TOUCH_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  cornerBar: {
    position: "absolute",
    backgroundColor: OVER_MEDIA_FOREGROUND,
  },
  edgeBar: {
    backgroundColor: OVER_MEDIA_FOREGROUND,
    borderRadius: CORNER_THICKNESS / 2,
  },
  toolbar: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  aspectRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: OVER_MEDIA_SURFACE,
  },
  chipSelected: {
    backgroundColor: OVER_MEDIA_FOREGROUND,
  },
  chipLabel: {
    color: OVER_MEDIA_MUTED,
    fontSize: fontSizes.subhead,
  },
  chipLabelSelected: {
    color: OVER_MEDIA_BACKDROP,
    fontWeight: fontWeights.semibold,
  },
  toolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toolButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
