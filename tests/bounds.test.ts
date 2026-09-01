import { describe, expect, it } from "vitest";
import { boundingBoxToPixels, box2dToBoundingBox, clampBoundingBox } from "@/lib/mapping/bounds";

describe("normalized answer bounds", () => {
  it("scales the same region to different viewer sizes", () => {
    const box = { x: 0.1, y: 0.25, width: 0.75, height: 0.2 };
    expect(boundingBoxToPixels(box, 800, 1000)).toEqual({ left: 80, top: 250, width: 600, height: 200 });
    expect(boundingBoxToPixels(box, 400, 500)).toEqual({ left: 40, top: 125, width: 300, height: 100 });
  });

  it("clamps malformed model coordinates to the page", () => {
    const result = clampBoundingBox({ x: -0.1, y: 0.9, width: 1.2, height: 0.4 });
    expect(result).toMatchObject({
      x: 0,
      y: 0.9,
      width: 1,
    });
    expect(result.height).toBeCloseTo(0.1);
  });

  it("normalizes percentage coordinates returned by a model", () => {
    expect(clampBoundingBox({ x: 10, y: 25, width: 75, height: 20 })).toEqual({
      x: 0.1,
      y: 0.25,
      width: 0.75,
      height: 0.2,
    });
  });

  it("normalizes 0-1000 vision coordinates returned by a model", () => {
    expect(clampBoundingBox({ x: 100, y: 250, width: 750, height: 200 })).toEqual({
      x: 0.1,
      y: 0.25,
      width: 0.75,
      height: 0.2,
    });
  });

  it("converts Gemini box_2d coordinates without swapping the axes", () => {
    expect(box2dToBoundingBox([420, 120, 610, 880])).toEqual({
      x: 0.12,
      y: 0.42,
      width: 0.76,
      height: 0.19,
    });
  });

  it("repairs reversed box_2d corners", () => {
    expect(box2dToBoundingBox([610, 880, 420, 120])).toEqual({
      x: 0.12,
      y: 0.42,
      width: 0.76,
      height: 0.19,
    });
  });
});
