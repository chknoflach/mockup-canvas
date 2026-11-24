import { describe, expect, it } from 'vitest'
import type { CanvasPage } from '../src/types'
import { buildDeepLink, parseDeepLink, resolveTarget } from '../src/url'

const PAGES: CanvasPage[] = [
  {
    id: 'checkout',
    title: 'Checkout',
    groups: [
      {
        title: 'Summary',
        items: [
          { id: 'A.1', title: 'Default', width: 800, height: 500 },
          { id: 'A.2', title: 'Mobile', width: 390, height: 600 },
        ],
      },
    ],
  },
  {
    id: 'passkeys',
    title: 'Passkeys',
    groups: [
      {
        title: 'Setup',
        items: [{ id: 'C.1', title: 'Admin', width: 800, height: 500 }],
      },
    ],
  },
]

describe('url deep-linking', () => {
  it('parses query parameters and hash forms', () => {
    expect(parseDeepLink('?page=checkout&mockup=A.2', '')).toEqual({
      pageId: 'checkout',
      mockupId: 'A.2',
    })
    expect(parseDeepLink('', '#passkeys/C.1')).toEqual({
      pageId: 'passkeys',
      mockupId: 'C.1',
    })
    expect(parseDeepLink('', '#C.1')).toEqual({
      pageId: null,
      mockupId: 'C.1',
    })
  })

  it('locates the owning page when only mockupId is supplied', () => {
    const resolved = resolveTarget(PAGES, { pageId: null, mockupId: 'C.1' })
    expect(resolved.page?.id).toBe('passkeys')
    expect(resolved.mockupId).toBe('C.1')
  })

  it('builds canonical deep-link URLs', () => {
    const link = buildDeepLink({
      pageId: 'checkout',
      mockupId: 'A.2',
      baseUrl: 'http://127.0.0.1:4173/?foo=1#old',
    })
    expect(link).toBe('http://127.0.0.1:4173/?foo=1&page=checkout&mockup=A.2')
  })
})
