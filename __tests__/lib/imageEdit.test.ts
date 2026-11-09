import {
  applyImageEdits,
  buildManipulatorActions,
  centeredCropForAspect,
  fitRect,
  flipNormalizedRectHorizontally,
  isFullCrop,
  moveCrop,
  resizeCropFromHandle,
  rotateClockwiseOnScreen,
  rotatedSize,
  rotateNormalizedRectClockwise,
  toPixelCrop,
} from "@/lib/imageEdit";
import * as ImageManipulator from "expo-image-manipulator";

jest.mock("expo-image-manipulator", () => ({
  FlipType: { Horizontal: "horizontal", Vertical: "vertical" },
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(),
  ImageManipulator: { manipulate: jest.fn() },
}));

const bounds = { width: 300, height: 200 };

describe("geometry helpers", () => {
  it("swaps dimensions for quarter turns", () => {
    expect(rotatedSize({ width: 40, height: 30 }, 90)).toEqual({
      width: 30,
      height: 40,
    });
    expect(rotatedSize({ width: 40, height: 30 }, 180)).toEqual({
      width: 40,
      height: 30,
    });
  });

  it("fits content inside a box keeping the ratio", () => {
    expect(fitRect({ width: 400, height: 200 }, { width: 200, height: 200 })).toEqual({
      x: 0,
      y: 50,
      width: 200,
      height: 100,
    });
  });

  it("rotates counterclockwise in data when flipped so the screen turns clockwise", () => {
    expect(rotateClockwiseOnScreen(0, false)).toBe(90);
    expect(rotateClockwiseOnScreen(0, true)).toBe(270);
    expect(rotateClockwiseOnScreen(270, false)).toBe(0);
  });
});

describe("moveCrop", () => {
  it("keeps the crop inside the bounds", () => {
    const start = { x: 10, y: 10, width: 100, height: 100 };
    expect(moveCrop(start, 500, -50, bounds)).toEqual({
      x: 200,
      y: 0,
      width: 100,
      height: 100,
    });
  });
});

describe("resizeCropFromHandle", () => {
  const start = { x: 50, y: 50, width: 100, height: 100 };

  it("resizes freely from the bottom-right corner", () => {
    expect(resizeCropFromHandle(start, "br", 20, 10, bounds, 40, null)).toEqual({
      x: 50,
      y: 50,
      width: 120,
      height: 110,
    });
  });

  it("respects the minimum size", () => {
    const rect = resizeCropFromHandle(start, "tl", 200, 200, bounds, 40, null);
    expect(rect.width).toBe(40);
    expect(rect.height).toBe(40);
    expect(rect.x + rect.width).toBe(150);
  });

  it("stops at the image edges", () => {
    const rect = resizeCropFromHandle(start, "r", 1000, 0, bounds, 40, null);
    expect(rect.x + rect.width).toBe(300);
    expect(rect.height).toBe(100);
  });

  it("keeps the aspect ratio when locked", () => {
    const rect = resizeCropFromHandle(start, "br", 60, 0, bounds, 40, 2);
    expect(rect.width / rect.height).toBeCloseTo(2);
    expect(rect.x).toBe(50);
    expect(rect.y).toBe(50);
  });

  it("limits a locked crop to the available space", () => {
    const rect = resizeCropFromHandle(start, "br", 1000, 1000, bounds, 40, 1);
    expect(rect.width).toBe(150);
    expect(rect.height).toBe(150);
  });
});

describe("centeredCropForAspect", () => {
  it("returns the largest centered rect for the ratio", () => {
    expect(centeredCropForAspect(bounds, 1)).toEqual({
      x: 50,
      y: 0,
      width: 200,
      height: 200,
    });
  });

  it("covers everything when free", () => {
    expect(centeredCropForAspect(bounds, null)).toEqual({
      x: 0,
      y: 0,
      ...bounds,
    });
  });
});

describe("normalized crop transforms", () => {
  const rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };

  it("rotates clockwise", () => {
    const rotated = rotateNormalizedRectClockwise(rect);
    expect(rotated.x).toBeCloseTo(0.4);
    expect(rotated.y).toBeCloseTo(0.1);
    expect(rotated.width).toBeCloseTo(0.4);
    expect(rotated.height).toBeCloseTo(0.3);
  });

  it("returns to the original after four rotations", () => {
    let current = rect;
    for (let i = 0; i < 4; i += 1) current = rotateNormalizedRectClockwise(current);
    expect(current.x).toBeCloseTo(rect.x);
    expect(current.y).toBeCloseTo(rect.y);
  });

  it("flips horizontally", () => {
    expect(flipNormalizedRectHorizontally(rect).x).toBeCloseTo(0.6);
  });

  it("detects a full crop", () => {
    expect(isFullCrop({ x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    expect(isFullCrop(rect)).toBe(false);
  });

  it("converts to integer pixels within the image", () => {
    expect(
      toPixelCrop({ x: 0.5, y: 0.5, width: 0.6, height: 0.6 }, { width: 101, height: 51 })
    ).toEqual({ x: 51, y: 26, width: 50, height: 25 });
  });
});

describe("buildManipulatorActions", () => {
  it("rotates, flips and crops in that order using the rotated size", () => {
    const actions = buildManipulatorActions(
      {
        rotation: 90,
        flipped: true,
        crop: { x: 0, y: 0, width: 0.5, height: 0.5 },
      },
      { width: 400, height: 200 }
    );
    expect(actions).toEqual([
      { rotate: 90 },
      { flip: "horizontal" },
      { crop: { originX: 0, originY: 0, width: 100, height: 200 } },
    ]);
  });

  it("returns no actions for an untouched image", () => {
    expect(
      buildManipulatorActions(
        { rotation: 0, flipped: false, crop: { x: 0, y: 0, width: 1, height: 1 } },
        { width: 10, height: 10 }
      )
    ).toEqual([]);
  });
});

describe("applyImageEdits", () => {
  it("skips the manipulator when there is nothing to change", async () => {
    const result = await applyImageEdits(
      "file:///a.jpg",
      { width: 10, height: 20 },
      { rotation: 0, flipped: false, crop: null }
    );
    expect(result).toEqual({ uri: "file:///a.jpg", width: 10, height: 20 });
    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  });

  it("returns the manipulated image", async () => {
    jest
      .mocked(ImageManipulator.manipulateAsync)
      .mockResolvedValue({ uri: "file:///b.jpg", width: 20, height: 10 });
    const result = await applyImageEdits(
      "file:///a.jpg",
      { width: 10, height: 20 },
      { rotation: 90, flipped: false, crop: null }
    );
    expect(result).toEqual({ uri: "file:///b.jpg", width: 20, height: 10 });
  });
});
