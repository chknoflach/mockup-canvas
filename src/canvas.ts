import { computePageLayout, type PageLayout } from './layout'
import { createStateStore, inspectMockupElement, nextNoteLetter } from './notes'
import type {
  CanvasNote,
  CanvasPage,
  MockupCanvasConfig,
  MockupCanvasHandle,
  MockupMode,
  NoteElementInfo,
  Viewport,
} from './types'
import {
  buildDeepLink,
  parseDeepLink,
  readStoredScale,
  resolveTarget,
  writeStoredScale,
} from './url'
import {
  clampScale,
  computeFitViewport,
  computePanToTarget,
  interpolateViewport,
  panBy,
  zoomAtPoint,
} from './viewport'

const RECENTER_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M2.5 5.5V3.5a1 1 0 0 1 1-1h2" />
  <path d="M10.5 2.5h2a1 1 0 0 1 1 1v2" />
  <path d="M13.5 10.5v2a1 1 0 0 1-1 1h-2" />
  <path d="M5.5 13.5h-2a1 1 0 0 1-1-1v-2" />
  <circle cx="8" cy="8" r="1.5" />
</svg>`

const NOTE_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3.5 2.5h9a1 1 0 0 1 1 1v7L10 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z" />
  <path d="M10 13.5V10h3.5" />
  <path d="M5.5 6h5M5.5 8.5h3" />
</svg>`

const ENTER_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M13 3.5v4a2 2 0 0 1-2 2H3.5" />
  <path d="M6.5 6.5 3.5 9.5l3 3" />
</svg>`

const CHEVRON_ICON_SVG = `<svg class="mc-dropdown-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M3 4.5 6 7.5 9 4.5" />
</svg>`

const ANIMATION_MS = 220
const DEFAULT_STATE_ENDPOINT = '/__mockup-canvas/state'
const STATE_POLL_MS = 3000

interface MockupDomEntry {
  el: HTMLElement
  idLink: HTMLAnchorElement
  frame: HTMLElement
  hoverOutline: HTMLElement
  pinsLayer: HTMLElement
  staticBtn: HTMLButtonElement
  activeBtn: HTMLButtonElement
  iframe?: HTMLIFrameElement
  contentHost?: HTMLElement
  configChanged: boolean
  title: string
}

interface ActivePopover {
  noteId: string | null
  isNew: boolean
  pageId: string
  mockupId: string
  mockupTitle: string
  letter: string
  x: number
  y: number
  element: NoteElementInfo
}

export function mountMockupCanvas(
  container: HTMLElement,
  config: MockupCanvasConfig,
): MockupCanvasHandle {
  const { pages } = config
  const storageKey = config.storageKey ?? 'mockup-canvas:scale'
  const stateEndpoint =
    config.stateEndpoint === undefined ? DEFAULT_STATE_ENDPOINT : config.stateEndpoint
  const store = createStateStore(stateEndpoint)

  const shell = document.createElement('div')
  shell.className = 'mc-shell'
  if (config.theme && config.theme !== 'auto') {
    shell.dataset.mcTheme = config.theme
  }

  const root = document.createElement('div')
  root.className = 'mc-root'

  const world = document.createElement('div')
  world.className = 'mc-world'
  root.appendChild(world)

  // Desktop left scrolling side-panel
  const sidebar = document.createElement('aside')
  sidebar.className = 'mc-sidebar'
  sidebar.setAttribute('aria-label', 'Canvas pages')

  const sidebarList = document.createElement('nav')
  sidebarList.className = 'mc-sidebar-list'
  sidebar.appendChild(sidebarList)

  // Responsive top-left floating dropdown
  const dropdown = document.createElement('div')
  dropdown.className = 'mc-dropdown'
  dropdown.dataset.mcInteractive = 'true'

  const dropdownTrigger = document.createElement('button')
  dropdownTrigger.type = 'button'
  dropdownTrigger.className = 'mc-dropdown-trigger'
  dropdownTrigger.setAttribute('aria-haspopup', 'listbox')
  dropdownTrigger.setAttribute('aria-expanded', 'false')

  const dropdownLabel = document.createElement('span')
  dropdownLabel.className = 'mc-dropdown-label'
  dropdownTrigger.appendChild(dropdownLabel)
  dropdownTrigger.insertAdjacentHTML('beforeend', CHEVRON_ICON_SVG)

  const dropdownMenu = document.createElement('div')
  dropdownMenu.className = 'mc-dropdown-menu'
  dropdownMenu.setAttribute('role', 'listbox')
  dropdownMenu.setAttribute('aria-label', 'Canvas pages')
  dropdownMenu.hidden = true

  dropdown.append(dropdownTrigger, dropdownMenu)

  function setDropdownOpen(open: boolean): void {
    dropdownMenu.hidden = !open
    dropdownTrigger.setAttribute('aria-expanded', String(open))
  }

  dropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation()
    setDropdownOpen(dropdownMenu.hidden)
  })

  const pageButtons = new Map<string, HTMLButtonElement[]>()
  for (const page of pages) {
    const createPageButton = (source: 'sidebar' | 'dropdown') => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'mc-page-item'
      btn.textContent = page.title
      btn.dataset.mcPageId = page.id
      btn.dataset.mcPageSource = source
      if (source === 'dropdown') {
        btn.setAttribute('role', 'option')
      }
      btn.addEventListener('click', () => {
        setDropdownOpen(false)
        goTo({ pageId: page.id, animate: false })
      })
      return btn
    }

    const sideBtn = createPageButton('sidebar')
    const dropBtn = createPageButton('dropdown')
    sidebarList.appendChild(sideBtn)
    dropdownMenu.appendChild(dropBtn)
    pageButtons.set(page.id, [sideBtn, dropBtn])
  }

  if (pages.length > 0) {
    shell.appendChild(sidebar)
    root.appendChild(dropdown)
  }

  // Top-right controls: Note mode toggle + Recenter
  const controls = document.createElement('div')
  controls.className = 'mc-controls'
  controls.dataset.mcInteractive = 'true'

  const noteModeBtn = document.createElement('button')
  noteModeBtn.type = 'button'
  noteModeBtn.className = 'mc-icon-btn mc-note-toggle'
  noteModeBtn.setAttribute('aria-label', 'Note mode (N)')
  noteModeBtn.setAttribute('aria-pressed', 'false')
  noteModeBtn.title = 'Note mode (N)'
  noteModeBtn.innerHTML = NOTE_ICON_SVG
  noteModeBtn.addEventListener('click', () => setNoteMode(!noteMode))

  const recenterBtn = document.createElement('button')
  recenterBtn.type = 'button'
  recenterBtn.className = 'mc-icon-btn mc-recenter'
  recenterBtn.setAttribute('aria-label', 'Recenter')
  recenterBtn.title = 'Recenter'
  recenterBtn.innerHTML = RECENTER_ICON_SVG
  recenterBtn.addEventListener('click', () => recenter(true))

  controls.append(noteModeBtn, recenterBtn)
  root.appendChild(controls)

  // Floating screen-space note input (just the input + bottom-right enter icon)
  const popoverEl = document.createElement('div')
  popoverEl.className = 'mc-note-popover'
  popoverEl.dataset.mcInteractive = 'true'
  popoverEl.hidden = true

  const popoverTextarea = document.createElement('textarea')
  popoverTextarea.className = 'mc-note-input'
  popoverTextarea.placeholder = 'Note (optional)…'
  popoverTextarea.rows = 3

  const popoverDeleteBtn = document.createElement('button')
  popoverDeleteBtn.type = 'button'
  popoverDeleteBtn.className = 'mc-note-delete'
  popoverDeleteBtn.setAttribute('aria-label', 'Remove note')
  popoverDeleteBtn.title = 'Remove note'
  popoverDeleteBtn.textContent = '×'

  const popoverSubmitBtn = document.createElement('button')
  popoverSubmitBtn.type = 'button'
  popoverSubmitBtn.className = 'mc-note-submit'
  popoverSubmitBtn.setAttribute('aria-label', 'Save note')
  popoverSubmitBtn.title = 'Save note (Enter)'
  popoverSubmitBtn.innerHTML = ENTER_ICON_SVG

  popoverEl.append(popoverTextarea, popoverDeleteBtn, popoverSubmitBtn)
  root.appendChild(popoverEl)

  shell.appendChild(root)
  container.replaceChildren(shell)

  // Internal state
  let activePage: CanvasPage | null = null
  let activeLayout: PageLayout | null = null
  let viewport: Viewport = { tx: 0, ty: 0, scale: 1 }
  const pageViewports = new Map<string, Viewport>()
  const mockupModes = new Map<string, MockupMode>()
  const mockupElements = new Map<string, MockupDomEntry>()
  let activeCleanups: Array<() => void> = []
  let animRaf: number | null = null
  let spaceHeld = false
  let noteMode = false
  let notes: CanvasNote[] = []
  let dynamicChangedMockups = new Set<string>()
  let activePopover: ActivePopover | null = null
  let hoveredMockupId: string | null = null
  let dragState: { pointerId: number; lastX: number; lastY: number } | null = null

  function getSize(): { width: number; height: number } {
    const rect = root.getBoundingClientRect()
    return {
      width: rect.width || window.innerWidth || 1280,
      height: rect.height || window.innerHeight || 800,
    }
  }

  function persistState(): void {
    void store.save({
      notes: [...notes],
      changedMockups: Array.from(dynamicChangedMockups),
    })
  }

  function positionPopover(): void {
    if (!activePopover || !activeLayout) return
    const pos = activeLayout.byId.get(activePopover.mockupId)
    if (!pos) return
    const { width, height } = getSize()
    const pinScreenX = viewport.tx + (pos.frameRect.x + activePopover.x) * viewport.scale
    const pinScreenY = viewport.ty + (pos.frameRect.y + activePopover.y) * viewport.scale

    const popW = 280
    const popH = 140
    let left = pinScreenX + 18
    if (left + popW > width - 16) {
      left = Math.max(16, pinScreenX - popW - 18)
    }
    const top = Math.max(60, Math.min(height - popH - 16, pinScreenY - 20))

    popoverEl.style.left = `${Math.round(left)}px`
    popoverEl.style.top = `${Math.round(top)}px`
  }

  function applyViewport(next: Viewport): void {
    viewport = { tx: next.tx, ty: next.ty, scale: clampScale(next.scale) }
    world.style.transform = `translate3d(${viewport.tx}px, ${viewport.ty}px, 0) scale(${viewport.scale})`
    root.style.backgroundPosition = `${viewport.tx}px ${viewport.ty}px`
    if (activePage) {
      pageViewports.set(activePage.id, viewport)
    }
    writeStoredScale(viewport.scale, storageKey)
    if (activePopover) {
      positionPopover()
    }
  }

  function cancelAnimation(): void {
    if (animRaf !== null) {
      cancelAnimationFrame(animRaf)
      animRaf = null
    }
  }

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  function animateTo(target: Viewport, animate: boolean): void {
    cancelAnimation()
    if (!animate || prefersReducedMotion() || typeof requestAnimationFrame !== 'function') {
      applyViewport(target)
      return
    }
    const start = { ...viewport }
    const startTime = performance.now()
    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / ANIMATION_MS)
      applyViewport(interpolateViewport(start, target, progress))
      if (progress < 1) {
        animRaf = requestAnimationFrame(step)
      } else {
        animRaf = null
      }
    }
    animRaf = requestAnimationFrame(step)
  }

  function syncUrl(pageId: string, mockupId?: string | null): void {
    if (typeof window === 'undefined' || !window.history?.replaceState) return
    try {
      const nextUrl = buildDeepLink({
        pageId,
        mockupId: mockupId ?? undefined,
        baseUrl: window.location.href,
      })
      if (nextUrl !== window.location.href) {
        window.history.replaceState(null, '', nextUrl)
      }
    } catch {
      // Ignore in opaque origins (e.g. srcdoc or file://).
    }
  }

  function clearHoverOutline(): void {
    if (hoveredMockupId) {
      const prev = mockupElements.get(hoveredMockupId)
      if (prev) prev.hoverOutline.hidden = true
      hoveredMockupId = null
    }
  }

  function closePopover(): void {
    activePopover = null
    popoverEl.hidden = true
    renderNotePins()
  }

  function openPopover(pop: ActivePopover, initialText: string): void {
    activePopover = pop
    popoverTextarea.value = initialText
    popoverDeleteBtn.hidden = pop.isNew
    popoverEl.hidden = false
    renderNotePins()
    positionPopover()
    popoverTextarea.focus({ preventScroll: true })
    popoverTextarea.setSelectionRange(initialText.length, initialText.length)
    queueMicrotask(() => {
      if (activePopover === pop && !popoverEl.hidden) {
        popoverTextarea.focus({ preventScroll: true })
      }
    })
  }

  function submitPopover(): void {
    if (!activePopover) return
    const text = popoverTextarea.value.trim()
    if (activePopover.isNew) {
      const created: CanvasNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        letter: activePopover.letter,
        pageId: activePopover.pageId,
        mockupId: activePopover.mockupId,
        mockupTitle: activePopover.mockupTitle,
        x: activePopover.x,
        y: activePopover.y,
        text,
        element: activePopover.element,
        status: 'open',
        createdAt: new Date().toISOString(),
      }
      notes = [...notes, created]
    } else if (activePopover.noteId) {
      notes = notes.map((n) => (n.id === activePopover!.noteId ? { ...n, text } : n))
    }
    persistState()
    closePopover()
  }

  function deleteActiveNote(): void {
    if (!activePopover?.noteId) {
      closePopover()
      return
    }
    notes = notes.filter((n) => n.id !== activePopover!.noteId)
    persistState()
    closePopover()
  }

  popoverSubmitBtn.addEventListener('click', submitPopover)
  popoverDeleteBtn.addEventListener('click', deleteActiveNote)
  popoverTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      submitPopover()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      closePopover()
    }
  })

  function setNoteMode(enabled: boolean): void {
    noteMode = enabled
    root.dataset.mcNoteMode = enabled ? 'true' : 'false'
    noteModeBtn.setAttribute('aria-pressed', String(enabled))
    if (!enabled) {
      clearHoverOutline()
    }
  }

  function renderChangedStates(): void {
    for (const [id, entry] of mockupElements) {
      const changed = entry.configChanged || dynamicChangedMockups.has(id)
      if (changed) {
        entry.idLink.dataset.mcChanged = 'true'
        entry.idLink.title = 'Changed in last turn'
        entry.idLink.setAttribute('aria-label', `${id} (changed in last turn)`)
      } else {
        delete entry.idLink.dataset.mcChanged
        entry.idLink.removeAttribute('title')
        entry.idLink.removeAttribute('aria-label')
      }
    }
  }

  function renderNotePins(): void {
    if (!activePage) return
    const openOnPage = notes.filter((n) => n.pageId === activePage!.id && n.status === 'open')

    for (const [mockupId, entry] of mockupElements) {
      entry.pinsLayer.replaceChildren()
      const mockupNotes = openOnPage.filter((n) => n.mockupId === mockupId)

      for (const note of mockupNotes) {
        const pin = document.createElement('button')
        pin.type = 'button'
        pin.className = 'mc-note-pin'
        pin.dataset.mcInteractive = 'true'
        pin.dataset.mcNoteId = note.id
        pin.dataset.mcNoteLetter = note.letter
        pin.textContent = note.letter
        pin.title = note.text ? `${note.letter}: ${note.text}` : `${note.letter}: ${note.element.selector}`
        pin.style.left = `${note.x}px`
        pin.style.top = `${note.y}px`
        pin.addEventListener('click', (e) => {
          e.stopPropagation()
          openPopover(
            {
              noteId: note.id,
              isNew: false,
              pageId: note.pageId,
              mockupId: note.mockupId,
              mockupTitle: note.mockupTitle,
              letter: note.letter,
              x: note.x,
              y: note.y,
              element: note.element,
            },
            note.text,
          )
        })
        entry.pinsLayer.appendChild(pin)
      }

      // Show draft pin immediately while the user is typing a new note
      if (activePopover?.isNew && activePopover.mockupId === mockupId) {
        const draftPin = document.createElement('span')
        draftPin.className = 'mc-note-pin'
        draftPin.dataset.mcNoteDraft = 'true'
        draftPin.textContent = activePopover.letter
        draftPin.style.left = `${activePopover.x}px`
        draftPin.style.top = `${activePopover.y}px`
        entry.pinsLayer.appendChild(draftPin)
      }
    }
  }

  function setMockupMode(mockupId: string, mode: MockupMode): void {
    mockupModes.set(mockupId, mode)
    const entry = mockupElements.get(mockupId)
    if (!entry) return
    entry.el.dataset.mcMode = mode
    entry.staticBtn.setAttribute('aria-pressed', String(mode === 'static'))
    entry.activeBtn.setAttribute('aria-pressed', String(mode === 'active'))
    if (entry.iframe) {
      entry.iframe.tabIndex = mode === 'active' ? 0 : -1
    }
    if (entry.contentHost) {
      if (mode === 'static') {
        entry.contentHost.setAttribute('inert', '')
      } else {
        entry.contentHost.removeAttribute('inert')
      }
    }
  }

  function teardownPage(): void {
    clearHoverOutline()
    closePopover()
    for (const cleanup of activeCleanups) {
      try {
        cleanup()
      } catch {
        // Keep teardown resilient.
      }
    }
    activeCleanups = []
    mockupElements.clear()
    world.replaceChildren()
  }

  function renderPage(page: CanvasPage): PageLayout {
    teardownPage()
    activePage = page
    const layout = computePageLayout(page)
    activeLayout = layout

    dropdownLabel.textContent = page.title
    for (const [id, buttons] of pageButtons) {
      for (const btn of buttons) {
        if (id === page.id) {
          btn.setAttribute('aria-current', 'page')
          if (btn.getAttribute('role') === 'option') {
            btn.setAttribute('aria-selected', 'true')
          }
        } else {
          btn.removeAttribute('aria-current')
          if (btn.getAttribute('role') === 'option') {
            btn.setAttribute('aria-selected', 'false')
          }
        }
      }
    }

    const fragment = document.createDocumentFragment()

    for (const posGroup of layout.groups) {
      const groupHeading = document.createElement('h2')
      groupHeading.className = 'mc-group-header'
      groupHeading.textContent = posGroup.group.title
      groupHeading.style.left = `${posGroup.headerPos.x}px`
      groupHeading.style.top = `${posGroup.headerPos.y}px`
      fragment.appendChild(groupHeading)

      for (const posItem of posGroup.items) {
        const { item, rect } = posItem
        const mode: MockupMode = mockupModes.get(item.id) ?? 'static'

        const card = document.createElement('section')
        card.className = 'mc-mockup'
        card.dataset.mcMockupId = item.id
        card.dataset.mcMode = mode
        card.style.left = `${rect.x}px`
        card.style.top = `${rect.y}px`
        card.style.width = `${rect.width}px`

        // Unified header
        const header = document.createElement('header')
        header.className = 'mc-mockup-header'

        const meta = document.createElement('div')
        meta.className = 'mc-mockup-meta'

        const idLink = document.createElement('a')
        idLink.className = 'mc-mockup-id'
        idLink.textContent = item.id
        idLink.href = buildDeepLink({ pageId: page.id, mockupId: item.id })
        idLink.dataset.mcInteractive = 'true'
        idLink.addEventListener('click', (e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          goTo({ pageId: page.id, mockupId: item.id, animate: true })
        })

        const titleSpan = document.createElement('span')
        titleSpan.className = 'mc-mockup-title'
        titleSpan.textContent = item.title

        meta.append(idLink, titleSpan)

        // Right-aligned static / active toggle (defaults to static)
        const toggle = document.createElement('div')
        toggle.className = 'mc-toggle'
        toggle.setAttribute('role', 'group')
        toggle.setAttribute('aria-label', `${item.id} interaction mode`)
        toggle.dataset.mcInteractive = 'true'

        const staticBtn = document.createElement('button')
        staticBtn.type = 'button'
        staticBtn.className = 'mc-toggle-btn'
        staticBtn.dataset.mcValue = 'static'
        staticBtn.textContent = 'Static'
        staticBtn.setAttribute('aria-pressed', String(mode === 'static'))
        staticBtn.addEventListener('click', () => setMockupMode(item.id, 'static'))

        const activeBtn = document.createElement('button')
        activeBtn.type = 'button'
        activeBtn.className = 'mc-toggle-btn'
        activeBtn.dataset.mcValue = 'active'
        activeBtn.textContent = 'Active'
        activeBtn.setAttribute('aria-pressed', String(mode === 'active'))
        activeBtn.addEventListener('click', () => setMockupMode(item.id, 'active'))

        toggle.append(staticBtn, activeBtn)
        header.append(meta, toggle)

        // Frame + static shield + note overlays
        const frame = document.createElement('div')
        frame.className = 'mc-frame'
        frame.dataset.mcFrameMockupId = item.id
        frame.style.width = `${item.width}px`
        frame.style.height = `${item.height}px`

        let iframe: HTMLIFrameElement | undefined
        let contentHost: HTMLElement | undefined

        if (item.render) {
          contentHost = document.createElement('div')
          contentHost.className = 'mc-frame-content'
          if (mode === 'static') contentHost.setAttribute('inert', '')
          const cleanup = item.render(contentHost)
          if (typeof cleanup === 'function') {
            activeCleanups.push(cleanup)
          }
          frame.appendChild(contentHost)
        } else if (item.src) {
          iframe = document.createElement('iframe')
          iframe.className = 'mc-frame-content'
          iframe.title = `${item.id} ${item.title}`
          iframe.src = item.src
          iframe.width = String(item.width)
          iframe.height = String(item.height)
          iframe.tabIndex = mode === 'active' ? 0 : -1
          frame.appendChild(iframe)
        }

        const shield = document.createElement('div')
        shield.className = 'mc-static-shield'
        shield.setAttribute('aria-hidden', 'true')
        frame.appendChild(shield)

        const hoverOutline = document.createElement('div')
        hoverOutline.className = 'mc-hover-outline'
        hoverOutline.hidden = true
        frame.appendChild(hoverOutline)

        const pinsLayer = document.createElement('div')
        pinsLayer.className = 'mc-note-pins'
        frame.appendChild(pinsLayer)

        card.append(header, frame)
        fragment.appendChild(card)

        mockupElements.set(item.id, {
          el: card,
          idLink,
          frame,
          hoverOutline,
          pinsLayer,
          staticBtn,
          activeBtn,
          iframe,
          contentHost,
          configChanged: Boolean(item.changed),
          title: item.title,
        })
      }
    }

    world.appendChild(fragment)
    renderChangedStates()
    renderNotePins()
    return layout
  }

  function recenter(animate = true): void {
    if (!activeLayout) return
    const { width, height } = getSize()
    const target = computeFitViewport(activeLayout.bounds, width, height)
    animateTo(target, animate)
    if (activePage) {
      syncUrl(activePage.id, null)
    }
  }

  function goTo(options: { pageId?: string; mockupId?: string; animate?: boolean }): void {
    const resolved = resolveTarget(
      pages,
      { pageId: options.pageId ?? null, mockupId: options.mockupId ?? null },
      activePage?.id ?? config.initialPageId,
    )
    if (!resolved.page) return

    const pageChanged = activePage?.id !== resolved.page.id
    if (pageChanged) {
      renderPage(resolved.page)
    }

    const { width, height } = getSize()

    if (resolved.mockupId && activeLayout) {
      const targetItem = activeLayout.byId.get(resolved.mockupId)
      if (targetItem) {
        // Deep-linking pans ONLY — current zoom scale is strictly preserved.
        const targetViewport = computePanToTarget(targetItem.rect, viewport.scale, width, height)
        animateTo(targetViewport, options.animate ?? !pageChanged)
        syncUrl(resolved.page.id, resolved.mockupId)
        return
      }
    }

    const saved = pageViewports.get(resolved.page.id)
    if (saved) {
      animateTo(saved, options.animate ?? false)
    } else {
      animateTo(computeFitViewport(activeLayout?.bounds ?? null, width, height), false)
    }
    syncUrl(resolved.page.id, null)
  }

  function findMockupEntryFromTarget(target: EventTarget | null): [string, MockupDomEntry] | null {
    if (!(target instanceof Element)) return null
    const frame = target.closest<HTMLElement>('[data-mc-frame-mockup-id]')
    const mockupId = frame?.dataset.mcFrameMockupId
    if (!mockupId) return null
    const entry = mockupElements.get(mockupId)
    return entry ? [mockupId, entry] : null
  }

  // Pointer handling (pan in normal mode; element highlight + click-to-note in note mode)
  function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    if (target.closest('[data-mc-interactive="true"]')) return true
    if (!spaceHeld && !noteMode) {
      const activeFrame = target.closest('.mc-mockup[data-mc-mode="active"] .mc-frame')
      if (activeFrame) return true
    }
    return false
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    if (e.button === 0 && isInteractiveTarget(e.target)) return

    // In note mode, left-click on a mockup places a note pin instead of dragging the canvas
    if (noteMode && e.button === 0 && !spaceHeld && activePage) {
      const hit = findMockupEntryFromTarget(e.target)
      if (hit) {
        e.preventDefault()
        e.stopPropagation()
        const [mockupId, entry] = hit
        const inspected = inspectMockupElement({
          frameEl: entry.frame,
          iframe: entry.iframe,
          contentHost: entry.contentHost,
          clientX: e.clientX,
          clientY: e.clientY,
          scale: viewport.scale,
        })
        const frameRect = entry.frame.getBoundingClientRect()
        const localX = inspected?.localX ?? Math.round((e.clientX - frameRect.left) / viewport.scale)
        const localY = inspected?.localY ?? Math.round((e.clientY - frameRect.top) / viewport.scale)
        const element: NoteElementInfo = inspected?.element ?? {
          tag: 'frame',
          selector: `[data-mc-mockup-id="${mockupId}"]`,
          rect: { x: Math.max(0, localX - 16), y: Math.max(0, localY - 16), width: 32, height: 32 },
        }

        const openOnPage = notes.filter((n) => n.pageId === activePage!.id && n.status === 'open')
        const letter = nextNoteLetter(openOnPage)
        clearHoverOutline()
        openPopover(
          {
            noteId: null,
            isNew: true,
            pageId: activePage.id,
            mockupId,
            mockupTitle: entry.title,
            letter,
            x: localX,
            y: localY,
            element,
          },
          '',
        )
        return
      }
    }

    cancelAnimation()
    dragState = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY }
    root.dataset.mcDragging = 'true'
    if (typeof root.setPointerCapture === 'function') {
      try {
        root.setPointerCapture(e.pointerId)
      } catch {
        // Synthetic events in tests may not have an active pointer.
      }
    }
  }

  const onPointerMove = (e: PointerEvent) => {
    if (dragState && e.pointerId === dragState.pointerId) {
      const dx = e.clientX - dragState.lastX
      const dy = e.clientY - dragState.lastY
      dragState.lastX = e.clientX
      dragState.lastY = e.clientY
      applyViewport(panBy(viewport, dx, dy))
      return
    }

    if (!noteMode || spaceHeld || !popoverEl.hidden) {
      clearHoverOutline()
      return
    }

    const hit = findMockupEntryFromTarget(e.target)
    if (!hit) {
      clearHoverOutline()
      return
    }

    const [mockupId, entry] = hit
    const inspected = inspectMockupElement({
      frameEl: entry.frame,
      iframe: entry.iframe,
      contentHost: entry.contentHost,
      clientX: e.clientX,
      clientY: e.clientY,
      scale: viewport.scale,
    })

    if (!inspected) {
      clearHoverOutline()
      return
    }

    if (hoveredMockupId && hoveredMockupId !== mockupId) {
      clearHoverOutline()
    }
    hoveredMockupId = mockupId
    const { rect } = inspected.element
    entry.hoverOutline.style.left = `${rect.x}px`
    entry.hoverOutline.style.top = `${rect.y}px`
    entry.hoverOutline.style.width = `${rect.width}px`
    entry.hoverOutline.style.height = `${rect.height}px`
    entry.hoverOutline.hidden = false
  }

  const endDrag = (e: PointerEvent) => {
    if (!dragState || e.pointerId !== dragState.pointerId) return
    dragState = null
    delete root.dataset.mcDragging
    if (typeof root.releasePointerCapture === 'function') {
      try {
        root.releasePointerCapture(e.pointerId)
      } catch {
        // Ignore if capture was already released.
      }
    }
  }

  // Trackpad pan (two-finger scroll) + pinch/Cmd/Ctrl zoom toward cursor
  const onWheel = (e: WheelEvent) => {
    if (e.target instanceof Element && e.target.closest('[data-mc-interactive="true"]')) {
      return
    }
    if (!noteMode && !e.ctrlKey && !e.metaKey && e.target instanceof Element) {
      const activeFrame = e.target.closest('.mc-mockup[data-mc-mode="active"] .mc-frame')
      if (activeFrame) return
    }

    e.preventDefault()
    cancelAnimation()

    const deltaFactor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    const dx = e.deltaX * deltaFactor
    const dy = e.deltaY * deltaFactor

    if (e.ctrlKey || e.metaKey) {
      const rect = root.getBoundingClientRect()
      const anchorX = e.clientX - rect.left
      const anchorY = e.clientY - rect.top
      const clampedDy = Math.max(-120, Math.min(120, dy))
      const zoomFactor = Math.exp(-clampedDy * 0.008)
      applyViewport(zoomAtPoint(viewport, viewport.scale * zoomFactor, anchorX, anchorY))
    } else {
      applyViewport(panBy(viewport, -dx, -dy))
    }
  }

  const isTypingTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (!popoverEl.hidden) {
        closePopover()
        return
      }
      if (!dropdownMenu.hidden) {
        setDropdownOpen(false)
        return
      }
      if (noteMode) {
        setNoteMode(false)
        return
      }
    }

    if (isTypingTarget(e.target)) return

    if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.repeat) {
      e.preventDefault()
      setNoteMode(!noteMode)
      return
    }

    if (e.code === 'Space' && !e.repeat) {
      spaceHeld = true
      root.dataset.mcSpace = 'true'
      clearHoverOutline()
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      spaceHeld = false
      delete root.dataset.mcSpace
    }
  }

  const onDocumentPointerDown = (e: PointerEvent) => {
    if (!dropdownMenu.hidden && e.target instanceof Node && !dropdown.contains(e.target)) {
      setDropdownOpen(false)
    }
    if (
      !popoverEl.hidden &&
      e.target instanceof Node &&
      !popoverEl.contains(e.target) &&
      !(e.target instanceof Element && e.target.closest('.mc-note-pin'))
    ) {
      closePopover()
    }
  }

  // Safari trackpad pinch support
  let gestureStartScale = 1
  const onGestureStart = (e: Event) => {
    e.preventDefault()
    cancelAnimation()
    gestureStartScale = viewport.scale
  }
  const onGestureChange = (e: Event) => {
    e.preventDefault()
    const ge = e as Event & { scale?: number; clientX?: number; clientY?: number }
    if (typeof ge.scale !== 'number') return
    const rect = root.getBoundingClientRect()
    const anchorX = (ge.clientX ?? rect.width / 2) - rect.left
    const anchorY = (ge.clientY ?? rect.height / 2) - rect.top
    applyViewport(zoomAtPoint(viewport, gestureStartScale * ge.scale, anchorX, anchorY))
  }

  const onUrlChange = () => {
    const target = parseDeepLink(window.location.search, window.location.hash)
    if (target.pageId || target.mockupId) {
      goTo({
        pageId: target.pageId ?? undefined,
        mockupId: target.mockupId ?? undefined,
        animate: true,
      })
    }
  }

  // Sync persisted notes + changedMockups from disk/localStorage so agent updates appear live
  async function syncPersistedState(): Promise<void> {
    if (activePopover) return
    const loaded = await store.load()
    const prevKey = JSON.stringify({ notes, changed: Array.from(dynamicChangedMockups) })
    const nextKey = JSON.stringify({ notes: loaded.notes, changed: loaded.changedMockups })
    if (prevKey === nextKey) return
    notes = loaded.notes
    dynamicChangedMockups = new Set(loaded.changedMockups)
    renderChangedStates()
    renderNotePins()
  }

  const onWindowFocus = () => {
    void syncPersistedState()
  }

  const pollInterval =
    stateEndpoint && typeof window !== 'undefined'
      ? window.setInterval(() => {
          if (document.visibilityState === 'visible') {
            void syncPersistedState()
          }
        }, STATE_POLL_MS)
      : null

  root.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('pointermove', onPointerMove)
  root.addEventListener('pointerup', endDrag)
  root.addEventListener('pointercancel', endDrag)
  root.addEventListener('pointerleave', clearHoverOutline)
  root.addEventListener('wheel', onWheel, { passive: false })
  root.addEventListener('gesturestart', onGestureStart, { passive: false })
  root.addEventListener('gesturechange', onGestureChange, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('popstate', onUrlChange)
  window.addEventListener('hashchange', onUrlChange)
  window.addEventListener('focus', onWindowFocus)
  document.addEventListener('pointerdown', onDocumentPointerDown)

  // Initial mount from URL (or default page fit)
  const initialTarget = parseDeepLink(window.location.search, window.location.hash)
  const initialResolved = resolveTarget(pages, initialTarget, config.initialPageId)
  if (initialResolved.page) {
    const layout = renderPage(initialResolved.page)
    const { width, height } = getSize()
    if (initialResolved.mockupId) {
      const item = layout.byId.get(initialResolved.mockupId)
      if (item) {
        const preservedScale = readStoredScale(storageKey) ?? 1
        applyViewport(computePanToTarget(item.rect, preservedScale, width, height))
        syncUrl(initialResolved.page.id, initialResolved.mockupId)
      } else {
        applyViewport(computeFitViewport(layout.bounds, width, height))
        syncUrl(initialResolved.page.id, null)
      }
    } else {
      applyViewport(computeFitViewport(layout.bounds, width, height))
      syncUrl(initialResolved.page.id, null)
    }
  }

  void syncPersistedState()

  return {
    goTo,
    recenter,
    setMockupMode,
    setNoteMode,
    isNoteMode: () => noteMode,
    setChangedMockups(mockupIds: string[]) {
      dynamicChangedMockups = new Set(mockupIds)
      renderChangedStates()
      persistState()
    },
    getNotes: () => [...notes],
    getViewport: () => ({ ...viewport }),
    getActivePageId: () => activePage?.id ?? null,
    destroy() {
      cancelAnimation()
      teardownPage()
      if (pollInterval !== null) {
        window.clearInterval(pollInterval)
      }
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', endDrag)
      root.removeEventListener('pointercancel', endDrag)
      root.removeEventListener('pointerleave', clearHoverOutline)
      root.removeEventListener('wheel', onWheel)
      root.removeEventListener('gesturestart', onGestureStart)
      root.removeEventListener('gesturechange', onGestureChange)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('popstate', onUrlChange)
      window.removeEventListener('hashchange', onUrlChange)
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('pointerdown', onDocumentPointerDown)
      shell.remove()
    },
  }
}
