import type { Rect, Viewport } from './types'

export const MIN_SCALE = 0.15
export const MAX_SCALE = 2.5
export const DEFAULT_FIT_PADDING = 72
export const TOP_CHROME_CLEARANCE = 76

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/** Zoom toward a screen-space anchor point so the world point under the cursor stays fixed. */
export function zoomAtPoint(
  viewport: Viewport,
  targetScale: number,
  anchorX: number,
  anchorY: number,
): Viewport {
  const nextScale = clampScale(targetScale)
  const ratio = nextScale / viewport.scale
  return {
    scale: nextScale,
    tx: anchorX - (anchorX - viewport.tx) * ratio,
    ty: anchorY - (anchorY - viewport.ty) * ratio,
  }
}

/** Pan by a screen-space delta (e.g. pointer drag or trackpad scroll). */
export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return {
    scale: viewport.scale,
    tx: viewport.tx + dx,
    ty: viewport.ty + dy,
  }
}

/** Zoom and center the viewport so the entire content bounding box fits inside the view. */
export function computeFitViewport(
  bounds: Rect | null,
  viewportWidth: number,
  viewportHeight: number,
  padding = DEFAULT_FIT_PADDING,
): Viewport {
  if (!bounds || bounds.width <= 0 || bounds.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { tx: padding, ty: TOP_CHROME_CLEARANCE, scale: 1 }
  }

  const topPad = Math.max(padding, TOP_CHROME_CLEARANCE)
  const availW = Math.max(1, viewportWidth - padding * 2)
  const availH = Math.max(1, viewportHeight - topPad - padding)

  // Fit all content cleanly without blowing small pages up past 100%.
  const scale = clampScale(Math.min(1, availW / bounds.width, availH / bounds.height))
  const scaledW = bounds.width * scale
  const scaledH = bounds.height * scale

  const tx = (viewportWidth - scaledW) / 2 - bounds.x * scale
  const ty = topPad + (availH - scaledH) / 2 - bounds.y * scale

  return { tx, ty, scale }
}

const MOCKUP_EDGE_PADDING = 16
const MOCKUP_TOP_PADDING = 72

function resolveTopY(
  scaledH: number,
  viewportHeight: number,
  edgePadding: number,
  anchorTopY?: number,
): number {
  const maxTopY = Math.max(MOCKUP_TOP_PADDING, viewportHeight - scaledH - edgePadding)
  if (anchorTopY === undefined || !Number.isFinite(anchorTopY)) {
    return MOCKUP_TOP_PADDING
  }
  return Math.max(MOCKUP_TOP_PADDING, Math.min(anchorTopY, maxTopY))
}

/** Zoom a single mockup so the full element is visible, aligned to the consistent top rail. */
export function computeFitMockup(
  target: Rect,
  viewportWidth: number,
  viewportHeight: number,
  edgePadding = MOCKUP_EDGE_PADDING,
): Viewport {
  if (target.width <= 0 || target.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { tx: edgePadding, ty: MOCKUP_TOP_PADDING, scale: 1 }
  }
  const availW = Math.max(1, viewportWidth - edgePadding * 2)
  const availH = Math.max(1, viewportHeight - MOCKUP_TOP_PADDING - edgePadding)

  const scale = clampScale(Math.min(availW / target.width, availH / target.height))
  const scaledW = target.width * scale

  return {
    scale,
    tx: (viewportWidth - scaledW) / 2 - target.x * scale,
    ty: MOCKUP_TOP_PADDING - target.y * scale,
  }
}

/** Zoom a single mockup to fill width cleanly, aligned to the consistent top rail. */
export function computeFillMockup(
  target: Rect,
  viewportWidth: number,
  viewportHeight: number,
  edgePadding = MOCKUP_EDGE_PADDING,
  anchorTopY?: number,
): Viewport {
  if (target.width <= 0 || target.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { tx: edgePadding, ty: MOCKUP_TOP_PADDING, scale: 1 }
  }
  const availW = Math.max(1, viewportWidth - edgePadding * 2)

  const scale = clampScale(availW / target.width)
  const scaledW = target.width * scale
  const scaledH = target.height * scale

  const tx = (viewportWidth - scaledW) / 2 - target.x * scale
  const ty = resolveTopY(scaledH, viewportHeight, edgePadding, anchorTopY) - target.y * scale

  return { scale, tx, ty }
}

/**
 * Navigate to a target mockup while preserving current zoom whenever the target fits horizontally;
 * if the target is wider than the viewport at the current zoom, zooms out to fill-width so nothing clips left/right.
 * Preserves the top-edge rail rather than vertically re-centering screens of different heights.
 */
export function computeNavigateToMockup(
  target: Rect,
  currentScale: number,
  viewportWidth: number,
  viewportHeight: number,
  edgePadding = MOCKUP_EDGE_PADDING,
  anchorTopY?: number,
): Viewport {
  const safeScale = clampScale(currentScale)
  if (target.width <= 0 || target.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return computePanToTarget(target, safeScale, viewportWidth, viewportHeight, anchorTopY)
  }
  const availW = Math.max(1, viewportWidth - edgePadding * 2)
  if (target.width * safeScale > availW) {
    return computeFillMockup(target, viewportWidth, viewportHeight, edgePadding, anchorTopY)
  }
  return computePanToTarget(target, safeScale, viewportWidth, viewportHeight, anchorTopY)
}

/**
 * Pan ONLY (never changes scale) to bring a target mockup into view, keeping a consistent top-edge rail.
 */
export function computePanToTarget(
  target: Rect,
  currentScale: number,
  viewportWidth: number,
  viewportHeight: number,
  anchorTopY?: number,
): Viewport {
  const scale = clampScale(currentScale)
  const centerX = target.x + target.width / 2
  const centerY = target.y + target.height / 2

  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { tx: -centerX * scale, ty: -centerY * scale, scale }
  }

  const tx = viewportWidth / 2 - centerX * scale
  const scaledH = target.height * scale
  const topY = resolveTopY(scaledH, viewportHeight, MOCKUP_EDGE_PADDING, anchorTopY)
  const ty = topY - target.y * scale

  return { tx, ty, scale }
}

export function interpolateViewport(from: Viewport, to: Viewport, t: number): Viewport {
  const k = Math.min(1, Math.max(0, t))
  const ease = 1 - Math.pow(1 - k, 3)
  return {
    tx: from.tx + (to.tx - from.tx) * ease,
    ty: from.ty + (to.ty - from.ty) * ease,
    scale: from.scale + (to.scale - from.scale) * ease,
  }
}
