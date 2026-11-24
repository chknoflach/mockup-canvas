import { describe, expect, it } from 'vitest'
import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  computeFillMockup,
  computeFitMockup,
  computeFitViewport,
  computeNavigateToMockup,
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

  it('matches fit and fill-width when width is tightest, and toggles fit-height vs fill-width for tall portraits', () => {
    // Width-constrained card (B.2 in a tall sidebar): fit and fill-width are identical
    const shortCard = { x: 100, y: 100, width: 520, height: 454 }
    const cardFit = computeFitMockup(shortCard, 800, 980)
    const cardFill = computeFillMockup(shortCard, 800, 980)
    expect(cardFit.scale).toBeCloseTo(cardFill.scale, 6)
    expect(cardFit.tx + shortCard.x * cardFit.scale).toBeCloseTo(16, 4)

    // Tall portrait mockup: fit shows full height, fill-width fills width top-aligned
    const tallPhone = { x: 0, y: 0, width: 390, height: 1400 }
    const phoneFit = computeFitMockup(tallPhone, 800, 980)
    const phoneFill = computeFillMockup(tallPhone, 800, 980)
    expect(phoneFit.scale).toBeLessThan(phoneFill.scale)
    expect(phoneFit.ty + tallPhone.height * phoneFit.scale).toBeLessThanOrEqual(980 - 15)
    expect(phoneFill.ty).toBe(64)
  })

  it('preserves zoom during smart navigation when target fits width, and zooms to fill-width when it overflows', () => {
    const mobile = { x: 0, y: 0, width: 390, height: 674 }
    const desktop = { x: 500, y: 0, width: 900, height: 594 }

    // Stepping from desktop (0.8x) to mobile (390w fits easily in 800px): preserves 0.8x
    const toMobile = computeNavigateToMockup(mobile, 0.8, 800, 980)
    expect(toMobile.scale).toBeCloseTo(0.8, 6)

    // Stepping from zoomed-in mobile (1.8x) to desktop (900w * 1.8 = 1620 > 768): shrinks to fill-width
    const toDesktop = computeNavigateToMockup(desktop, 1.8, 800, 980)
    expect(toDesktop.scale).toBeCloseTo((800 - 32) / 900, 4)
  })
})
