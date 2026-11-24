import { describe, expect, it } from 'vitest'
import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  computeFillMockup,
  computeFitMockup,
  computeFitViewport,
  computePanToTarget,
  panBy,
  zoomAtPoint,
} from '../src/viewport'

describe('viewport math', () => {
  it('clamps scale within supported bounds', () => {
    expect(clampScale(0.01)).toBe(MIN_SCALE)
    expect(clampScale(99)).toBe(MAX_SCALE)
    expect(clampScale(Number.NaN)).toBe(1)
    expect(clampScale(0.8)).toBe(0.8)
  })

  it('zooms around the cursor anchor without drifting the world point underneath', () => {
    const start = { tx: 100, ty: 50, scale: 1 }
    const anchorX = 400
    const anchorY = 300
    const worldBeforeX = (anchorX - start.tx) / start.scale
    const worldBeforeY = (anchorY - start.ty) / start.scale

    const zoomed = zoomAtPoint(start, 1.5, anchorX, anchorY)
    const worldAfterX = (anchorX - zoomed.tx) / zoomed.scale
    const worldAfterY = (anchorY - zoomed.ty) / zoomed.scale

    expect(worldAfterX).toBeCloseTo(worldBeforeX, 6)
    expect(worldAfterY).toBeCloseTo(worldBeforeY, 6)
  })

  it('pans by exact screen-space delta while leaving scale untouched', () => {
    const next = panBy({ tx: 20, ty: -10, scale: 0.75 }, -45, 30)
    expect(next).toEqual({ tx: -25, ty: 20, scale: 0.75 })
  })

  it('fits and centers all content bounds on recenter without exceeding 1x zoom', () => {
    const largeBounds = { x: 0, y: 0, width: 2000, height: 1200 }
    const fit = computeFitViewport(largeBounds, 1200, 800)
    expect(fit.scale).toBeLessThan(1)
    // Content left and right edges stay inside the viewport
    expect(fit.tx).toBeGreaterThanOrEqual(70)
    expect(fit.tx + largeBounds.width * fit.scale).toBeLessThanOrEqual(1200 - 70)

    const smallBounds = { x: 0, y: 0, width: 300, height: 200 }
    const smallFit = computeFitViewport(smallBounds, 1200, 800)
    expect(smallFit.scale).toBe(1)
  })

  it('pans ONLY to target mockup while strictly preserving current zoom scale', () => {
    const target = { x: 1000, y: 600, width: 400, height: 300 }
    const currentScale = 0.65
    const result = computePanToTarget(target, currentScale, 1280, 800)

    expect(result.scale).toBe(currentScale)
    const screenCenterX = result.tx + (target.x + target.width / 2) * result.scale
    expect(screenCenterX).toBeCloseTo(640, 4)
  })

  it('keeps the top header visible when panning to a mockup taller than the viewport', () => {
    const tallTarget = { x: 200, y: 500, width: 900, height: 1400 }
    const result = computePanToTarget(tallTarget, 1, 1200, 700)
    expect(result.scale).toBe(1)
    const topOnScreen = result.ty + tallTarget.y * result.scale
    expect(topOnScreen).toBeGreaterThanOrEqual(76)
  })

  it('computes distinct fit (contain) and fill (cover) viewports for a single mockup', () => {
    const mockup = { x: 100, y: 100, width: 900, height: 600 }
    const fit = computeFitMockup(mockup, 800, 900)
    const fill = computeFillMockup(mockup, 800, 900)
    expect(fill.scale).toBeGreaterThan(fit.scale)
    expect(fit.tx + mockup.width * fit.scale).toBeLessThanOrEqual(800)
  })
})
