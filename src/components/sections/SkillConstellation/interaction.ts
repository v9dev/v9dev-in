/**
 * Pure interaction math for the Skill Constellation. No DOM, no React -
 * unit-tested in interaction.test.ts.
 */

/** Discrete parallax depth layers, near -> far. */
const DEPTH_LAYERS = [1, 0.66, 0.4] as const;

/**
 * Stable parallax depth factor for a node, derived from its index so a
 * node keeps the same layer across renders.
 */
export function depthFactor(index: number): number {
  return DEPTH_LAYERS[index % DEPTH_LAYERS.length];
}

interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Normalize a pointer position within a rect to [-1, 1] per axis, clamped. */
export function normalizePointer(
  clientX: number,
  clientY: number,
  rect: RectLike,
): { x: number; y: number } {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const x = rect.width ? clamp(((clientX - rect.left) / rect.width) * 2 - 1) : 0;
  const y = rect.height ? clamp(((clientY - rect.top) / rect.height) * 2 - 1) : 0;
  return { x, y };
}

/**
 * stroke-dasharray / dashoffset that reveals only a `windowPx` span of a
 * path centered on `fraction` (0..1) of `totalLength`, clamped to the
 * path ends. Pattern: zero dash, gap to the window start, the visible
 * span, then a gap covering the remaining path.
 */
export function highlightDash(
  totalLength: number,
  fraction: number,
  windowPx: number,
): { dasharray: string; dashoffset: number } {
  if (totalLength <= 0) return { dasharray: '0 1', dashoffset: 0 };
  const half = windowPx / 2;
  const center = Math.max(0, Math.min(totalLength, fraction * totalLength));
  const start = Math.max(0, center - half);
  const end = Math.min(totalLength, center + half);
  const visible = Math.max(0, end - start);
  return { dasharray: `0 ${start} ${visible} ${totalLength}`, dashoffset: 0 };
}
