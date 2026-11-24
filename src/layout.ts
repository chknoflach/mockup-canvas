import type { CanvasPage, MockupGroup, MockupItem, Rect } from './types'

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
