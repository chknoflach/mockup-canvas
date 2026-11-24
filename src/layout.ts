import type { CanvasPage, MockupGroup, MockupItem, Rect } from './types.js'

export const MOCKUP_HEADER_HEIGHT = 34
export const GROUP_HEADER_HEIGHT = 52
export const GROUP_HEADER_GAP = 24
export const ITEM_GAP_X = 48
export const ITEM_GAP_Y = 56
export const GROUP_GAP_Y = 128

export interface PositionedMockup {
  item: MockupItem
  /** Outer box including the unified header and the mockup frame. */
  rect: Rect
  /** Inner frame box (width × height of the mockup itself). */
  frameRect: Rect
}

export interface PositionedGroup {
  group: MockupGroup
  headerPos: { x: number; y: number }
  rect: Rect
  items: PositionedMockup[]
}

export interface PageLayout {
  groups: PositionedGroup[]
  /** Bounding box covering all group headers and mockups on the page. */
  bounds: Rect | null
  byId: Map<string, PositionedMockup>
}

export function computePageLayout(page: CanvasPage): PageLayout {
  const groups: PositionedGroup[] = []
  const byId = new Map<string, PositionedMockup>()

  let cursorY = 0
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const group of page.groups) {
    const groupTop = cursorY
    const itemsTop = groupTop + GROUP_HEADER_HEIGHT + GROUP_HEADER_GAP
    const maxCols =
      group.columns && group.columns > 0 ? Math.floor(group.columns) : Math.max(1, group.items.length)

    const positionedItems: PositionedMockup[] = []
    let col = 0
    let rowX = 0
    let rowY = itemsTop
    let rowMaxHeight = 0
    let groupRight = 0
    let groupBottom = groupTop + GROUP_HEADER_HEIGHT

    for (const item of group.items) {
      if (col > 0 && col >= maxCols) {
        col = 0
        rowX = 0
        rowY += rowMaxHeight + ITEM_GAP_Y
        rowMaxHeight = 0
      }

      const outerHeight = MOCKUP_HEADER_HEIGHT + item.height
      const rect: Rect = {
        x: rowX,
        y: rowY,
        width: item.width,
        height: outerHeight,
      }
      const frameRect: Rect = {
        x: rowX,
        y: rowY + MOCKUP_HEADER_HEIGHT,
        width: item.width,
        height: item.height,
      }

      const positioned: PositionedMockup = { item, rect, frameRect }
      positionedItems.push(positioned)
      byId.set(item.id, positioned)

      groupRight = Math.max(groupRight, rect.x + rect.width)
      groupBottom = Math.max(groupBottom, rect.y + rect.height)
      rowMaxHeight = Math.max(rowMaxHeight, outerHeight)

      rowX += item.width + ITEM_GAP_X
      col += 1
    }

    const groupWidth = Math.max(groupRight, 320)
    const groupRect: Rect = {
      x: 0,
      y: groupTop,
      width: groupWidth,
      height: groupBottom - groupTop,
    }

    groups.push({
      group,
      headerPos: { x: 0, y: groupTop },
      rect: groupRect,
      items: positionedItems,
    })

    minX = Math.min(minX, groupRect.x)
    minY = Math.min(minY, groupRect.y)
    maxX = Math.max(maxX, groupRect.x + groupRect.width)
    maxY = Math.max(maxY, groupRect.y + groupRect.height)

    cursorY = groupBottom + GROUP_GAP_Y
  }

  const bounds: Rect | null =
    groups.length > 0 && Number.isFinite(minX)
      ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
      : null

  return { groups, bounds, byId }
}

export type SpatialDirection = 'left' | 'right' | 'up' | 'down'

function centerOf(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.min(aEnd, bEnd) - Math.max(aStart, bStart) > 0
}

/**
 * Find the visually adjacent mockup in the requested direction on the current page.
 * Prefers mockups aligned on the same row/column and wraps around at edges.
 */
export function findSpatialNeighbor(
  layout: PageLayout,
  currentId: string | null,
  direction: SpatialDirection,
): PositionedMockup | null {
  const all = Array.from(layout.byId.values())
  if (all.length === 0) return null
  if (all.length === 1) return all[0]!

  const current = currentId ? layout.byId.get(currentId) : undefined
  if (!current) {
    return direction === 'left' || direction === 'up' ? all[all.length - 1]! : all[0]!
  }

  const c = centerOf(current.rect)
  const others = all.filter((m) => m.item.id !== current.item.id)
  const horizontal = direction === 'left' || direction === 'right'

  const primaryDelta = (other: PositionedMockup): number => {
    const o = centerOf(other.rect)
    if (direction === 'right') return o.x - c.x
    if (direction === 'left') return c.x - o.x
    if (direction === 'down') return o.y - c.y
    return c.y - o.y
  }

  const perpDistance = (other: PositionedMockup): number => {
    const o = centerOf(other.rect)
    return horizontal ? Math.abs(o.y - c.y) : Math.abs(o.x - c.x)
  }

  const perpOverlaps = (other: PositionedMockup): boolean => {
    if (horizontal) {
      return overlaps(
        current.rect.y,
        current.rect.y + current.rect.height,
        other.rect.y,
        other.rect.y + other.rect.height,
      )
    }
    return overlaps(
      current.rect.x,
      current.rect.x + current.rect.width,
      other.rect.x,
      other.rect.x + other.rect.width,
    )
  }

  // 1. Direct candidates strictly in `direction`
  const forward = others.filter((m) => primaryDelta(m) > 10)
  if (forward.length > 0) {
    const aligned = forward.filter(perpOverlaps)
    const pool = aligned.length > 0 ? aligned : forward
    // For left/right without row overlap, stay on the same row only if wrapping instead of jumping rows diagonally
    if (horizontal && aligned.length === 0) {
      // Fall through to horizontal same-row wrap check below
    } else {
      pool.sort((a, b) => {
        const scoreA = primaryDelta(a) + perpDistance(a) * (aligned.length > 0 ? 0.35 : 1.5)
        const scoreB = primaryDelta(b) + perpDistance(b) * (aligned.length > 0 ? 0.35 : 1.5)
        return scoreA - scoreB
      })
      return pool[0]!
    }
  }

  // 2. Wrap around along the same row (left/right) or across rows (up/down)
  const sameBand = others.filter(perpOverlaps)
  const wrapPool = sameBand.length > 0 ? sameBand : others

  if (direction === 'right') {
    wrapPool.sort((a, b) => a.rect.x - b.rect.x || perpDistance(a) - perpDistance(b))
    return wrapPool[0]!
  }
  if (direction === 'left') {
    wrapPool.sort((a, b) => b.rect.x - a.rect.x || perpDistance(a) - perpDistance(b))
    return wrapPool[0]!
  }
  if (direction === 'down') {
    // Wrap to the topmost row, preferring closest horizontal alignment
    const minY = Math.min(...others.map((m) => m.rect.y))
    const topBand = others.filter((m) => Math.abs(m.rect.y - minY) < 120)
    topBand.sort((a, b) => perpDistance(a) - perpDistance(b))
    return topBand[0] ?? wrapPool[0]!
  }

  // direction === 'up': wrap to the bottommost row, preferring closest horizontal alignment
  const maxY = Math.max(...others.map((m) => m.rect.y))
  const bottomBand = others.filter((m) => Math.abs(m.rect.y - maxY) < 120)
  bottomBand.sort((a, b) => perpDistance(a) - perpDistance(b))
  return bottomBand[0] ?? wrapPool[0]!
}
