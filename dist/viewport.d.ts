import type { Rect, Viewport } from './types';
export declare const MIN_SCALE = 0.15;
export declare const MAX_SCALE = 2.5;
export declare const DEFAULT_FIT_PADDING = 72;
export declare const TOP_CHROME_CLEARANCE = 76;
export declare function clampScale(scale: number): number;
/** Zoom toward a screen-space anchor point so the world point under the cursor stays fixed. */
export declare function zoomAtPoint(viewport: Viewport, targetScale: number, anchorX: number, anchorY: number): Viewport;
/** Pan by a screen-space delta (e.g. pointer drag or trackpad scroll). */
export declare function panBy(viewport: Viewport, dx: number, dy: number): Viewport;
/** Zoom and center the viewport so the entire content bounding box fits inside the view. */
export declare function computeFitViewport(bounds: Rect | null, viewportWidth: number, viewportHeight: number, padding?: number): Viewport;
/** Zoom a single mockup so the full element is visible, aligned to the consistent top rail. */
export declare function computeFitMockup(target: Rect, viewportWidth: number, viewportHeight: number, edgePadding?: number): Viewport;
/** Zoom a single mockup to fill width cleanly, aligned to the consistent top rail. */
export declare function computeFillMockup(target: Rect, viewportWidth: number, viewportHeight: number, edgePadding?: number, anchorTopY?: number): Viewport;
/**
 * Navigate to a target mockup while preserving current zoom whenever the target fits horizontally;
 * if the target is wider than the viewport at the current zoom, zooms out to fill-width so nothing clips left/right.
 * Preserves the top-edge rail rather than vertically re-centering screens of different heights.
 */
export declare function computeNavigateToMockup(target: Rect, currentScale: number, viewportWidth: number, viewportHeight: number, edgePadding?: number, anchorTopY?: number): Viewport;
/**
 * Pan ONLY (never changes scale) to bring a target mockup into view, keeping a consistent top-edge rail.
 */
export declare function computePanToTarget(target: Rect, currentScale: number, viewportWidth: number, viewportHeight: number, anchorTopY?: number): Viewport;
export declare function interpolateViewport(from: Viewport, to: Viewport, t: number): Viewport;
//# sourceMappingURL=viewport.d.ts.map