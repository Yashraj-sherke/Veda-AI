import type { BoundingBox } from "@/types/assessment";

/** Converts Gemini's native [ymin, xmin, ymax, xmax] 0-1000 box format. */
export function box2dToBoundingBox(box2d: readonly number[]): BoundingBox {
  const [firstY = 0, firstX = 0, secondY = 0, secondX = 0] = box2d;
  const yMin = Math.min(firstY, secondY) / 1000;
  const xMin = Math.min(firstX, secondX) / 1000;
  const yMax = Math.max(firstY, secondY) / 1000;
  const xMax = Math.max(firstX, secondX) / 1000;

  return clampBoundingBox({
    x: xMin,
    y: yMin,
    width: xMax - xMin,
    height: yMax - yMin,
  });
}

export function clampBoundingBox(box: BoundingBox): BoundingBox {
  const largestCoordinate = Math.max(
    Math.abs(box.x),
    Math.abs(box.y),
    Math.abs(box.width),
    Math.abs(box.height),
  );
  const scale = largestCoordinate > 100 && largestCoordinate <= 1000
    ? 1000
    : largestCoordinate > 10 && largestCoordinate <= 100
      ? 100
      : 1;
  const normalized = {
    x: box.x / scale,
    y: box.y / scale,
    width: box.width / scale,
    height: box.height / scale,
  };
  const x = Math.min(1, Math.max(0, normalized.x));
  const y = Math.min(1, Math.max(0, normalized.y));
  return {
    x,
    y,
    width: Math.min(1 - x, Math.max(0, normalized.width)),
    height: Math.min(1 - y, Math.max(0, normalized.height)),
  };
}

export function boundingBoxToPixels(
  box: BoundingBox,
  containerWidth: number,
  containerHeight: number,
) {
  const safe = clampBoundingBox(box);
  return {
    left: safe.x * containerWidth,
    top: safe.y * containerHeight,
    width: safe.width * containerWidth,
    height: safe.height * containerHeight,
  };
}
