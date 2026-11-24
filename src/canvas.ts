import { computePageLayout, type PageLayout } from './layout'
import type {
  CanvasPage,
  MockupCanvasConfig,
  MockupCanvasHandle,
  MockupMode,
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

const ANIMATION_MS = 220

export function mountMockupCanvas(
  container: HTMLElement,
  config: MockupCanvasConfig,
): MockupCanvasHandle {
  const { pages } = config
  const storageKey = config.storageKey ?? 'mockup-canvas:scale'

  const root = document.createElement('div')
  root.className = 'mc-root'
  if (config.theme && config.theme !== 'auto') {
    root.dataset.mcTheme = config.theme
  }

  const world = document.createElement('div')
  world.className = 'mc-world'
  root.appendChild(world)

  // Top-left multi-page switcher
  const pagesNav = document.createElement('nav')
  pagesNav.className = 'mc-pages'
  pagesNav.setAttribute('aria-label', 'Canvas pages')
  pagesNav.dataset.mcInteractive = 'true'

  const pageButtons = new Map<string, HTMLButtonElement>()
  for (const page of pages) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mc-page-btn'
    btn.textContent = page.title
    btn.dataset.mcPageId = page.id
    btn.addEventListener('click', () => {
      goTo({ pageId: page.id, animate: false })
    })
    pagesNav.appendChild(btn)
    pageButtons.set(page.id, btn)
  }
  if (pages.length > 0) {
    root.appendChild(pagesNav)
  }

  // Top-right recenter icon control
  const recenterBtn = document.createElement('button')
  recenterBtn.type = 'button'
  recenterBtn.className = 'mc-recenter'
  recenterBtn.setAttribute('aria-label', 'Recenter')
  recenterBtn.title = 'Recenter'
  recenterBtn.dataset.mcInteractive = 'true'
  recenterBtn.innerHTML = RECENTER_ICON_SVG
  recenterBtn.addEventListener('click', () => recenter(true))
  root.appendChild(recenterBtn)

  container.replaceChildren(root)

  // Internal state
  let activePage: CanvasPage | null = null
  let activeLayout: PageLayout | null = null
  let viewport: Viewport = { tx: 0, ty: 0, scale: 1 }
  const pageViewports = new Map<string, Viewport>()
  const mockupModes = new Map<string, MockupMode>()
  const mockupElements = new Map<
    string,
    {
      el: HTMLElement
      staticBtn: HTMLButtonElement
      activeBtn: HTMLButtonElement
      iframe?: HTMLIFrameElement
      contentHost?: HTMLElement
    }
  >()
  let activeCleanups: Array<() => void> = []
  let animRaf: number | null = null
  let spaceHeld = false
  let dragState: { pointerId: number; lastX: number; lastY: number } | null = null

  function getSize(): { width: number; height: number } {
    const rect = root.getBoundingClientRect()
    return {
      width: rect.width || window.innerWidth || 1280,
      height: rect.height || window.innerHeight || 800,
    }
  }

  function applyViewport(next: Viewport): void {
    viewport = { tx: next.tx, ty: next.ty, scale: clampScale(next.scale) }
    world.style.transform = `translate3d(${viewport.tx}px, ${viewport.ty}px, 0) scale(${viewport.scale})`
    root.style.backgroundPosition = `${viewport.tx}px ${viewport.ty}px`
    if (activePage) {
      pageViewports.set(activePage.id, viewport)
    }
    writeStoredScale(viewport.scale, storageKey)
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

    for (const [id, btn] of pageButtons) {
      if (id === page.id) {
        btn.setAttribute('aria-current', 'page')
      } else {
        btn.removeAttribute('aria-current')
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

        // Frame + static shield
        const frame = document.createElement('div')
        frame.className = 'mc-frame'
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

        card.append(header, frame)
        fragment.appendChild(card)

        mockupElements.set(item.id, { el: card, staticBtn, activeBtn, iframe, contentHost })
      }
    }

    world.appendChild(fragment)
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

  // Pointer pan handling
  function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    if (target.closest('[data-mc-interactive="true"]')) return true
    if (!spaceHeld) {
      const activeFrame = target.closest('.mc-mockup[data-mc-mode="active"] .mc-frame')
      if (activeFrame) return true
    }
    return false
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return
    if (e.button === 0 && isInteractiveTarget(e.target)) return
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
    if (!dragState || e.pointerId !== dragState.pointerId) return
    const dx = e.clientX - dragState.lastX
    const dy = e.clientY - dragState.lastY
    dragState.lastX = e.clientX
    dragState.lastY = e.clientY
    applyViewport(panBy(viewport, dx, dy))
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
    // Allow normal inner scrolling only when hovering an active mockup frame without zoom modifier.
    if (!e.ctrlKey && !e.metaKey && e.target instanceof Element) {
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

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        spaceHeld = true
        root.dataset.mcSpace = 'true'
      }
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      spaceHeld = false
      delete root.dataset.mcSpace
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

  root.addEventListener('pointerdown', onPointerDown)
  root.addEventListener('pointermove', onPointerMove)
  root.addEventListener('pointerup', endDrag)
  root.addEventListener('pointercancel', endDrag)
  root.addEventListener('wheel', onWheel, { passive: false })
  root.addEventListener('gesturestart', onGestureStart, { passive: false })
  root.addEventListener('gesturechange', onGestureChange, { passive: false })
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('popstate', onUrlChange)
  window.addEventListener('hashchange', onUrlChange)

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

  return {
    goTo,
    recenter,
    setMockupMode,
    getViewport: () => ({ ...viewport }),
    getActivePageId: () => activePage?.id ?? null,
    destroy() {
      cancelAnimation()
      teardownPage()
      root.removeEventListener('pointerdown', onPointerDown)
      root.removeEventListener('pointermove', onPointerMove)
      root.removeEventListener('pointerup', endDrag)
      root.removeEventListener('pointercancel', endDrag)
      root.removeEventListener('wheel', onWheel)
      root.removeEventListener('gesturestart', onGestureStart)
      root.removeEventListener('gesturechange', onGestureChange)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('popstate', onUrlChange)
      window.removeEventListener('hashchange', onUrlChange)
      root.remove()
    },
  }
}
