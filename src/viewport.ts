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

/** Zoom and center a single mockup so its entire box fits inside the viewport with breathing room (capped at 1x). */
export function computeFitMockup(
  target: Rect,
  viewportWidth: number,
  viewportHeight: number,
  padding = 48,
): Viewport {
  if (target.width <= 0 || target.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { tx: padding, ty: TOP_CHROME_CLEARANCE, scale: 1 }
  }
  const topPad = Math.max(padding, TOP_CHROME_CLEARANCE)
  const availW = Math.max(1, viewportWidth - padding * 2)
  const availH = Math.max(1, viewportHeight - topPad - padding)

  const scale = clampScale(Math.min(1, availW / target.width, availH / target.height))
  const scaledW = target.width * scale
  const scaledH = target.height * scale

  return {
    scale,
    tx: (viewportWidth - scaledW) / 2 - target.x * scale,
    ty: topPad + (availH - scaledH) / 2 - target.y * scale,
  }
}

/**
 * Fill-width / 100% zoom for a single mockup without horizontal clipping:
 * - Wider than viewport -> fills width edge-to-edge, top-aligned if tall.
 * - Taller than viewport (fits horizontally at 1x) -> 100% actual size, top-aligned.
 * - Already fits at 1x -> scales cleanly to fill the tighter viewport edge with minimal margin.
 */
export function computeFillMockup(
  target: Rect,
  viewportWidth: number,
  viewportHeight: number,
  edgePadding = 12,
): Viewport {
  if (target.width <= 0 || target.height <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    return { tx: edgePadding, ty: TOP_CHROME_CLEARANCE, scale: 1 }
  }
  const topPad = 64
  const availW = Math.max(1, viewportWidth - edgePadding * 2)
  const availH = Math.max(1, viewportHeight - topPad - edgePadding)

  const widthScale = availW / target.width
  const heightScale = availH / target.height
  const fit = computeFitMockup(target, viewportWidth, viewportHeight)

  let scale: number
  if (target.width > availW) {
    scale = clampScale(widthScale)
  } else if (fit.scale < 1) {
    scale = 1
  } else {
    scale = clampScale(Math.min(widthScale, heightScale))
  }

  const scaledW = target.width * scale
  const scaledH = target.height * scale
  const tx = (viewportWidth - scaledW) / 2 - target.x * scale
  const ty =
    scaledH <= availH
      ? topPad + (availH - scaledH) / 2 - target.y * scale
      : topPad - target.y * scale

  return { scale, tx, ty }
}

/**
 * Pan ONLY (never changes scale) to bring a target mockup into view.
 * Horizontally centers the mockup; vertically centers it unless the mockup is taller
 * than the available viewport at the current zoom, in which case its top header stays visible.
 */
export function computePanToTarget(
  target: Rect,
  currentScale: number,
  viewportWidth: number,
  viewportHeight: number,
): Viewport {
  const scale = clampScale(currentScale)
  const centerX = target.x + target.width / 2
  const centerY = target.y + target.height / 2

  const tx = viewportWidth / 2 - centerX * scale

  const scaledH = target.height * scale
  const availH = Math.max(1, viewportHeight - TOP_CHROME_CLEARANCE - 32)
  const ty =
    scaledH <= availH
      ? TOP_CHROME_CLEARANCE + (availH - scaledH) / 2 - target.y * scale
      : TOP_CHROME_CLEARANCE - target.y * scale

  // Guard against degenerate viewports.
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { tx: -centerX * scale, ty: -centerY * scale, scale }
  }

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
