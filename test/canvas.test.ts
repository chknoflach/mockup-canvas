// @vitest-environment jsdom
/// <reference types="vite/client" />
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountMockupCanvas } from '../src/canvas'
import stylesCss from '../src/styles.css?raw'
import type { CanvasPage } from '../src/types'

const PAGES: CanvasPage[] = [
  {
    id: 'checkout',
    title: 'Checkout flow',
    groups: [
      {
        title: 'Order summary',
        items: [
          { id: 'A.1', title: 'Default', width: 900, height: 560, src: '?state=order-default' },
          { id: 'A.2', title: 'Mobile', width: 390, height: 640, src: '?state=order-mobile' },
        ],
      },
      {
        title: 'Payment states',
        items: [{ id: 'B.1', title: 'Card form', width: 520, height: 500, src: '?state=card-form' }],
      },
    ],
  },
  {
    id: 'passkeys',
    title: 'Passkey setup',
    groups: [
      {
        title: 'Enrollment',
        items: [{ id: 'C.1', title: 'Admin list', width: 860, height: 520, src: '?state=admin-list' }],
      },
    ],
  },
]

describe('mountMockupCanvas', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    window.history.replaceState(null, '', '/')
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('defaults every mockup to static with unified header (ID, title, static/active toggle)', () => {
    const container = document.getElementById('root')!
    const handle = mountMockupCanvas(container, { pages: PAGES })

    const cards = container.querySelectorAll<HTMLElement>('.mc-mockup')
    expect(cards.length).toBe(3)

    const first = cards[0]!
    expect(first.dataset.mcMode).toBe('static')
    expect(first.querySelector('.mc-mockup-id')?.textContent).toBe('A.1')
    expect(first.querySelector('.mc-mockup-title')?.textContent).toBe('Default')

    const [staticBtn, activeBtn] = Array.from(first.querySelectorAll<HTMLButtonElement>('.mc-toggle-btn'))
    expect(staticBtn?.getAttribute('aria-pressed')).toBe('true')
    expect(activeBtn?.getAttribute('aria-pressed')).toBe('false')

    activeBtn?.click()
    expect(first.dataset.mcMode).toBe('active')
    expect(activeBtn?.getAttribute('aria-pressed')).toBe('true')
    expect(staticBtn?.getAttribute('aria-pressed')).toBe('false')

    handle.destroy()
  })

  it('renders big-type group headers and switches pages via side-panel and responsive dropdown', () => {
    const container = document.getElementById('root')!
    const handle = mountMockupCanvas(container, { pages: PAGES })

    const groupTitles = Array.from(container.querySelectorAll('.mc-group-header')).map((el) => el.textContent)
    expect(groupTitles).toEqual(['Order summary', 'Payment states'])

    // Switch via side-panel list
    const sidePasskeyBtn = container.querySelector<HTMLButtonElement>(
      '[data-mc-page-source="sidebar"][data-mc-page-id="passkeys"]',
    )!
    sidePasskeyBtn.click()
    expect(handle.getActivePageId()).toBe('passkeys')
    expect(container.querySelectorAll('.mc-mockup').length).toBe(1)
    expect(container.querySelector('.mc-mockup-id')?.textContent).toBe('C.1')
    expect(container.querySelector('.mc-dropdown-label')?.textContent).toBe('Passkey setup')

    // Switch back via responsive top-left dropdown
    const trigger = container.querySelector<HTMLButtonElement>('.mc-dropdown-trigger')!
    const menu = container.querySelector<HTMLElement>('.mc-dropdown-menu')!
    expect(menu.hidden).toBe(true)
    trigger.click()
    expect(menu.hidden).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    const dropCheckoutBtn = container.querySelector<HTMLButtonElement>(
      '[data-mc-page-source="dropdown"][data-mc-page-id="checkout"]',
    )!
    dropCheckoutBtn.click()
    expect(handle.getActivePageId()).toBe('checkout')
    expect(menu.hidden).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.mc-dropdown-label')?.textContent).toBe('Checkout flow')

    // Escape closes an open dropdown
    trigger.click()
    expect(menu.hidden).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(menu.hidden).toBe(true)

    handle.destroy()
  })

  it('deep-links to a target mockup by panning ONLY without changing zoom scale', () => {
    const container = document.getElementById('root')!
    const handle = mountMockupCanvas(container, { pages: PAGES })

    // Simulate user zooming to a custom scale via ctrl+wheel
    const rootEl = container.querySelector('.mc-root')!
    rootEl.dispatchEvent(
      new WheelEvent('wheel', { ctrlKey: true, deltaY: -60, clientX: 500, clientY: 300, cancelable: true }),
    )
    const zoomedScale = handle.getViewport().scale
    expect(zoomedScale).not.toBe(1)

    // Now deep-link to a mockup on another page: scale MUST stay identical
    handle.goTo({ pageId: 'passkeys', mockupId: 'C.1', animate: false })
    expect(handle.getActivePageId()).toBe('passkeys')
    expect(handle.getViewport().scale).toBeCloseTo(zoomedScale, 6)

    // And deep-link to another mockup on checkout: scale still stays identical
    handle.goTo({ mockupId: 'B.1', animate: false })
    expect(handle.getActivePageId()).toBe('checkout')
    expect(handle.getViewport().scale).toBeCloseTo(zoomedScale, 6)

    handle.destroy()
  })

  it('recenters to fit all mockups on the current page via the top-right recenter button', () => {
    vi.useFakeTimers()
    try {
      const container = document.getElementById('root')!
      const handle = mountMockupCanvas(container, { pages: PAGES })
      const initial = handle.getViewport()

      const rootEl = container.querySelector('.mc-root')!
      rootEl.dispatchEvent(new WheelEvent('wheel', { deltaX: 500, deltaY: 400, cancelable: true }))
      const panned = handle.getViewport()
      expect(panned.tx).not.toBe(initial.tx)

      const recenterBtn = container.querySelector<HTMLButtonElement>('.mc-recenter')!
      recenterBtn.click()
      vi.advanceTimersByTime(300)

      const recentered = handle.getViewport()
      expect(recentered.tx).toBeCloseTo(initial.tx, 2)
      expect(recentered.ty).toBeCloseTo(initial.ty, 2)
      expect(recentered.scale).toBeCloseTo(initial.scale, 4)

      handle.destroy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('captures wheel events over static mockups and passes them through when active', () => {
    const container = document.getElementById('root')!
    const handle = mountMockupCanvas(container, { pages: PAGES })
    const frame = container.querySelector<HTMLElement>('[data-mc-mockup-id="A.1"] .mc-frame')!

    const beforeStatic = handle.getViewport()
    const staticWheel = new WheelEvent('wheel', { deltaX: 40, deltaY: 60, bubbles: true, cancelable: true })
    frame.dispatchEvent(staticWheel)
    expect(staticWheel.defaultPrevented).toBe(true)
    expect(handle.getViewport().tx).toBe(beforeStatic.tx - 40)

    handle.setMockupMode('A.1', 'active')
    const beforeActive = handle.getViewport()
    const activeWheel = new WheelEvent('wheel', { deltaX: 40, deltaY: 60, bubbles: true, cancelable: true })
    frame.dispatchEvent(activeWheel)
    expect(activeWheel.defaultPrevented).toBe(false)
    expect(handle.getViewport().tx).toBe(beforeActive.tx)

    handle.destroy()
  })

  it('toggles note mode via button and "n" shortcut, places lettered notes, and marks changed mockups', () => {
    const container = document.getElementById('root')!
    const pagesWithChange: CanvasPage[] = [
      {
        ...PAGES[0]!,
        groups: [
          {
            ...PAGES[0]!.groups[0]!,
            items: [
              PAGES[0]!.groups[0]!.items[0]!,
              { ...PAGES[0]!.groups[0]!.items[1]!, changed: true },
            ],
          },
        ],
      },
    ]

    const handle = mountMockupCanvas(container, { pages: pagesWithChange, stateEndpoint: false })

    // Changed mockup pill state on A.2, plain on A.1
    const a1Id = container.querySelector<HTMLElement>('[data-mc-mockup-id="A.1"] .mc-mockup-id')!
    const a2Id = container.querySelector<HTMLElement>('[data-mc-mockup-id="A.2"] .mc-mockup-id')!
    expect(a1Id.dataset.mcChanged).toBeUndefined()
    expect(a2Id.dataset.mcChanged).toBe('true')

    // Dynamic changed marking
    handle.setChangedMockups(['A.1'])
    expect(a1Id.dataset.mcChanged).toBe('true')

    // Toggle note mode with 'n' shortcut
    expect(handle.isNoteMode()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }))
    expect(handle.isNoteMode()).toBe(true)

    // Clicking a mockup in note mode drops letter (A) and opens the floating input
    const shield = container.querySelector<HTMLElement>('[data-mc-mockup-id="A.1"] .mc-static-shield')!
    shield.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 120, clientY: 140, bubbles: true }))

    const popover = container.querySelector<HTMLElement>('.mc-note-popover')!
    expect(popover.hidden).toBe(false)
    expect(container.querySelector('[data-mc-note-draft="true"]')?.textContent).toBe('A')

    const input = container.querySelector<HTMLTextAreaElement>('.mc-note-input')!
    expect(document.activeElement).toBe(input)
    input.value = 'Tighten spacing here'
    container.querySelector<HTMLButtonElement>('.mc-note-submit')!.click()

    expect(popover.hidden).toBe(true)
    const saved = handle.getNotes()
    expect(saved).toHaveLength(1)
    expect(saved[0]?.letter).toBe('A')
    expect(saved[0]?.mockupId).toBe('A.1')
    expect(saved[0]?.text).toBe('Tighten spacing here')
    expect(saved[0]?.status).toBe('open')

    // Second note gets letter (B) and allows empty optional note
    shield.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 200, clientY: 180, bubbles: true }))
    expect(container.querySelector('[data-mc-note-draft="true"]')?.textContent).toBe('B')
    expect(document.activeElement).toBe(input)
    container.querySelector<HTMLButtonElement>('.mc-note-submit')!.click()
    expect(handle.getNotes().map((n) => n.letter)).toEqual(['A', 'B'])

    // Escape while focused in the note input closes ONLY the popover and keeps note mode active
    shield.dispatchEvent(new MouseEvent('pointerdown', { button: 0, clientX: 240, clientY: 220, bubbles: true }))
    expect(popover.hidden).toBe(false)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(popover.hidden).toBe(true)
    expect(handle.isNoteMode()).toBe(true)

    // Second Escape (with no note popup open) exits note mode
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(handle.isNoteMode()).toBe(false)

    handle.destroy()
  })

  it('uses arrow keys for spatial mockup navigation by default and switches to changes mode via "c" or toggle', () => {
    const container = document.getElementById('root')!
    const pagesWithChanges: CanvasPage[] = [
      {
        ...PAGES[0]!,
        groups: [
          {
            ...PAGES[0]!.groups[0]!,
            items: [
              PAGES[0]!.groups[0]!.items[0]!,
              { ...PAGES[0]!.groups[0]!.items[1]!, changed: true },
            ],
          },
          PAGES[0]!.groups[1]!,
        ],
      },
      {
        ...PAGES[1]!,
        groups: [
          {
            ...PAGES[1]!.groups[0]!,
            items: [{ ...PAGES[1]!.groups[0]!.items[0]!, changed: true }],
          },
        ],
      },
    ]

    const handle = mountMockupCanvas(container, { pages: pagesWithChanges, stateEndpoint: false })

    const changedGroup = container.querySelector<HTMLElement>('.mc-changed-group')!
    expect(changedGroup.hidden).toBe(false)
    expect(handle.isChangesMode()).toBe(false)
    // Middle segment shows only the dot (no count text)
    expect(container.querySelector('.mc-changed-list-btn')?.textContent?.trim()).toBe('')

    // Zoom to a custom scale first so we prove navigation pans ONLY without changing zoom
    const rootEl = container.querySelector('.mc-root')!
    rootEl.dispatchEvent(
      new WheelEvent('wheel', { ctrlKey: true, deltaY: -50, clientX: 500, clientY: 300, cancelable: true }),
    )
    const customScale = handle.getViewport().scale

    // Normal mode (changesMode OFF): arrow keys navigate spatially on the current page
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(new URLSearchParams(window.location.search).get('mockup')).toBe('A.1')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(new URLSearchParams(window.location.search).get('mockup')).toBe('A.2')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(new URLSearchParams(window.location.search).get('mockup')).toBe('A.1')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(new URLSearchParams(window.location.search).get('mockup')).toBe('B.1')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    expect(new URLSearchParams(window.location.search).get('mockup')).toBe('A.1')
    expect(handle.getViewport().scale).toBeCloseTo(customScale, 6)

    // Press 'c' to enter Changes mode
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }))
    expect(handle.isChangesMode()).toBe(true)

    // In Changes mode: Right/Left step across changed screens with full wrap-around
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(handle.getActivePageId()).toBe('checkout')
    expect(new URLSearchParams(window.location.search).get('mockup')).toBe('A.2')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(handle.getActivePageId()).toBe('passkeys')
    expect(new URLSearchParams(window.location.search).get('mockup')).toBe('C.1')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(handle.getActivePageId()).toBe('checkout')
    expect(new URLSearchParams(window.location.search).get('mockup')).toBe('A.2')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(handle.getActivePageId()).toBe('passkeys')
    expect(new URLSearchParams(window.location.search).get('mockup')).toBe('C.1')

    // Down arrow opens the changed list; Up/Down navigate with wrap-around WITHOUT panning; Enter confirms
    const menu = container.querySelector<HTMLElement>('.mc-changed-menu')!
    const beforeMenu = handle.getViewport()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(menu.hidden).toBe(false)
    expect(menu.querySelector<HTMLElement>('[data-mc-highlighted="true"]')?.dataset.mcChangedTarget).toBe('C.1')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(menu.querySelector<HTMLElement>('[data-mc-highlighted="true"]')?.dataset.mcChangedTarget).toBe('A.2')
    expect(handle.getActivePageId()).toBe('passkeys')
    expect(handle.getViewport()).toEqual(beforeMenu)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(menu.hidden).toBe(true)
    expect(handle.getActivePageId()).toBe('checkout')
    expect(new URLSearchParams(window.location.search).get('mockup')).toBe('A.2')
    expect(handle.getViewport().scale).toBeCloseTo(customScale, 6)

    // Escape exits changes mode when menu is closed
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(handle.isChangesMode()).toBe(false)

    handle.destroy()
  })

  it('contains zero blur() calls anywhere in styles.css', () => {
    expect(stylesCss).not.toMatch(/blur\s*\(/i)
  })
})
