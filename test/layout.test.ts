import { describe, expect, it } from 'vitest'
import { MOCKUP_HEADER_HEIGHT, computePageLayout, findSpatialNeighbor } from '../src/layout'
import type { CanvasPage } from '../src/types'

describe('layout', () => {
  it('stacks groups vertically and arranges mockups horizontally with non-overlapping rects', () => {
    const page: CanvasPage = {
      id: 'checkout',
      title: 'Checkout',
      groups: [
        {
          title: 'Order summary',
          items: [
            { id: 'A.1', title: 'Default', width: 900, height: 500 },
            { id: 'A.2', title: 'Mobile', width: 390, height: 600 },
          ],
        },
        {
          title: 'Payment',
          items: [{ id: 'B.1', title: 'Card', width: 500, height: 400 }],
        },
      ],
    }

    const layout = computePageLayout(page)
    expect(layout.groups).toHaveLength(2)
    expect(layout.bounds).not.toBeNull()

    const a1 = layout.byId.get('A.1')!
    const a2 = layout.byId.get('A.2')!
    const b1 = layout.byId.get('B.1')!

    expect(a1.rect.height).toBe(500 + MOCKUP_HEADER_HEIGHT)
    expect(a2.rect.x).toBeGreaterThan(a1.rect.x + a1.rect.width)
    expect(b1.rect.y).toBeGreaterThan(a2.rect.y + a2.rect.height)
  })

  it('wraps rows when a group specifies columns', () => {
    const page: CanvasPage = {
      id: 'grid',
      title: 'Grid',
      groups: [
        {
          title: 'Cards',
          columns: 2,
          items: [
            { id: 'A.1', title: 'One', width: 300, height: 200 },
            { id: 'A.2', title: 'Two', width: 300, height: 200 },
            { id: 'A.3', title: 'Three', width: 300, height: 200 },
          ],
        },
      ],
    }

    const layout = computePageLayout(page)
    const a1 = layout.byId.get('A.1')!
    const a3 = layout.byId.get('A.3')!

    expect(a3.rect.x).toBe(a1.rect.x)
    expect(a3.rect.y).toBeGreaterThan(a1.rect.y + a1.rect.height)
  })

  it('finds visual neighbors in all 4 directions with edge wrap-around', () => {
    const page: CanvasPage = {
      id: 'checkout',
      title: 'Checkout',
      groups: [
        {
          title: 'Top',
          items: [
            { id: 'A.1', title: 'Desktop', width: 900, height: 500 },
            { id: 'A.2', title: 'Mobile', width: 390, height: 580 },
          ],
        },
        {
          title: 'Bottom',
          items: [
            { id: 'B.1', title: 'Card', width: 520, height: 420 },
            { id: 'B.2', title: 'Failed', width: 520, height: 420 },
          ],
        },
      ],
    }

    const layout = computePageLayout(page)
    // Sideways + wrap
    expect(findSpatialNeighbor(layout, 'A.1', 'right')?.item.id).toBe('A.2')
    expect(findSpatialNeighbor(layout, 'A.2', 'right')?.item.id).toBe('A.1')
    expect(findSpatialNeighbor(layout, 'A.1', 'left')?.item.id).toBe('A.2')
    // Vertical + wrap
    expect(findSpatialNeighbor(layout, 'A.1', 'down')?.item.id).toBe('B.1')
    expect(findSpatialNeighbor(layout, 'B.1', 'down')?.item.id).toBe('A.1')
    expect(findSpatialNeighbor(layout, 'A.1', 'up')?.item.id).toBe('B.1')
    expect(findSpatialNeighbor(layout, 'A.2', 'down')?.item.id).toBe('B.2')
    expect(findSpatialNeighbor(layout, 'B.2', 'up')?.item.id).toBe('A.2')
  })
})
