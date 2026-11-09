import * as ImageManipulator from "expo-image-manipulator";

export type Rotation = 0 | 90 | 180 | 270;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ImageEditState {
  rotation: Rotation;
  flipped: boolean;
  crop: Rect | null;
}

export type CropHandle = "tl" | "t" | "tr" | "r" | "br" | "b" | "bl" | "l";

export type AspectRatioOption = "free" | "1:1" | "4:3" | "16:9";

export interface EditedImage {
  uri: string;
  width: number;
  height: number;
}

export const INITIAL_EDIT_STATE: ImageEditState = {
  rotation: 0,
  flipped: false,
  crop: null,
};

const FULL_CROP_TOLERANCE = 0.005;

export function aspectRatioValue(option: AspectRatioOption): number | null {
  switch (option) {
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    case "16:9":
      return 16 / 9;
    default:
      return null;
  }
}

export function rotateClockwiseOnScreen(
  rotation: Rotation,
  flipped: boolean
): Rotation {
  return ((rotation + (flipped ? 270 : 90)) % 360) as Rotation;
}

export function rotatedSize(size: Size, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270
    ? { width: size.height, height: size.width }
    : size;
}

export function fitRect(content: Size, box: Size): Rect {
  if (content.width <= 0 || content.height <= 0) {
    return { x: 0, y: 0, width: box.width, height: box.height };
  }
  const scale = Math.min(box.width / content.width, box.height / content.height);
  const width = content.width * scale;
  const height = content.height * scale;
  return {
    x: (box.width - width) / 2,
    y: (box.height - height) / 2,
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

export function moveCrop(start: Rect, dx: number, dy: number, bounds: Size): Rect {
  "worklet";
  return {
    x: clamp(start.x + dx, 0, bounds.width - start.width),
    y: clamp(start.y + dy, 0, bounds.height - start.height),
    width: start.width,
    height: start.height,
  };
}

export function resizeCropFromHandle(
  start: Rect,
  handle: CropHandle,
  dx: number,
  dy: number,
  bounds: Size,
  minSize: number,
  aspect: number | null
): Rect {
  "worklet";
  const movesLeft = handle === "tl" || handle === "l" || handle === "bl";
  const movesRight = handle === "tr" || handle === "r" || handle === "br";
  const movesTop = handle === "tl" || handle === "t" || handle === "tr";
  const movesBottom = handle === "bl" || handle === "b" || handle === "br";
  const right = start.x + start.width;
  const bottom = start.y + start.height;

  if (aspect === null) {
    const left = movesLeft ? clamp(start.x + dx, 0, right - minSize) : start.x;
    const newRight = movesRight
      ? clamp(right + dx, start.x + minSize, bounds.width)
      : right;
    const top = movesTop ? clamp(start.y + dy, 0, bottom - minSize) : start.y;
    const newBottom = movesBottom
      ? clamp(bottom + dy, start.y + minSize, bounds.height)
      : bottom;
    return { x: left, y: top, width: newRight - left, height: newBottom - top };
  }

  const horizontalSign = movesRight ? 1 : -1;
  const verticalSign = movesBottom ? 1 : -1;
  const widthFromX = start.width + horizontalSign * dx;
  const widthFromY = (start.height + verticalSign * dy) * aspect;
  const width =
    Math.abs(widthFromX - start.width) >= Math.abs(widthFromY - start.width)
      ? widthFromX
      : widthFromY;
  const maxWidthX = movesRight ? bounds.width - start.x : right;
  const maxWidthY = (movesBottom ? bounds.height - start.y : bottom) * aspect;
  const minWidth = Math.max(minSize, minSize * aspect);
  const clampedWidth = clamp(width, minWidth, Math.min(maxWidthX, maxWidthY));
  const clampedHeight = clampedWidth / aspect;
  return {
    x: movesRight ? start.x : right - clampedWidth,
    y: movesBottom ? start.y : bottom - clampedHeight,
    width: clampedWidth,
    height: clampedHeight,
  };
}

export function centeredCropForAspect(bounds: Size, aspect: number | null): Rect {
  if (aspect === null) {
    return { x: 0, y: 0, width: bounds.width, height: bounds.height };
  }
  let width = bounds.width;
  let height = width / aspect;
  if (height > bounds.height) {
    height = bounds.height;
    width = height * aspect;
  }
  return {
    x: (bounds.width - width) / 2,
    y: (bounds.height - height) / 2,
    width,
    height,
  };
}

export function normalizeRect(rect: Rect, bounds: Size): Rect {
  return {
    x: rect.x / bounds.width,
    y: rect.y / bounds.height,
    width: rect.width / bounds.width,
    height: rect.height / bounds.height,
  };
}

export function denormalizeRect(rect: Rect, bounds: Size): Rect {
  return {
    x: rect.x * bounds.width,
    y: rect.y * bounds.height,
    width: rect.width * bounds.width,
    height: rect.height * bounds.height,
  };
}

export function rotateNormalizedRectClockwise(rect: Rect): Rect {
  return {
    x: 1 - (rect.y + rect.height),
    y: rect.x,
    width: rect.height,
    height: rect.width,
  };
}

export function flipNormalizedRectHorizontally(rect: Rect): Rect {
  return { ...rect, x: 1 - (rect.x + rect.width) };
}

export function isFullCrop(rect: Rect): boolean {
  return (
    rect.x <= FULL_CROP_TOLERANCE &&
    rect.y <= FULL_CROP_TOLERANCE &&
    rect.x + rect.width >= 1 - FULL_CROP_TOLERANCE &&
    rect.y + rect.height >= 1 - FULL_CROP_TOLERANCE
  );
}

export function toPixelCrop(normalized: Rect, image: Size): Rect {
  const x = clamp(Math.round(normalized.x * image.width), 0, image.width - 1);
  const y = clamp(Math.round(normalized.y * image.height), 0, image.height - 1);
  const width = clamp(
    Math.round(normalized.width * image.width),
    1,
    image.width - x
  );
  const height = clamp(
    Math.round(normalized.height * image.height),
    1,
    image.height - y
  );
  return { x, y, width, height };
}

export function buildManipulatorActions(
  state: ImageEditState,
  sourceSize: Size
): ImageManipulator.Action[] {
  const actions: ImageManipulator.Action[] = [];
  if (state.rotation !== 0) actions.push({ rotate: state.rotation });
  if (state.flipped) {
    actions.push({ flip: ImageManipulator.FlipType.Horizontal });
  }
  if (state.crop && !isFullCrop(state.crop)) {
    const pixelCrop = toPixelCrop(
      state.crop,
      rotatedSize(sourceSize, state.rotation)
    );
    actions.push({
      crop: {
        originX: pixelCrop.x,
        originY: pixelCrop.y,
        width: pixelCrop.width,
        height: pixelCrop.height,
      },
    });
  }
  return actions;
}

export function hasEdits(state: ImageEditState): boolean {
  return (
    state.rotation !== 0 ||
    state.flipped ||
    (state.crop !== null && !isFullCrop(state.crop))
  );
}

export async function readImageSize(uri: string): Promise<Size> {
  const image = await ImageManipulator.ImageManipulator.manipulate(
    uri
  ).renderAsync();
  return { width: image.width, height: image.height };
}

export async function applyImageEdits(
  sourceUri: string,
  sourceSize: Size,
  state: ImageEditState
): Promise<EditedImage> {
  const actions = buildManipulatorActions(state, sourceSize);
  if (actions.length === 0) {
    return { uri: sourceUri, ...sourceSize };
  }
  const result = await ImageManipulator.manipulateAsync(sourceUri, actions, {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: result.uri, width: result.width, height: result.height };
}
