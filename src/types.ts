export type MockupMode = 'static' | 'active'

export interface MockupItem {
  /** Short unique reference ID shown in the mockup header and used in deep links (e.g. "A.1"). */
  id: string
  /** 1–2 word title shown next to the ID in the unified mockup header. */
  title: string
  /** Frame width in CSS pixels (e.g. 390 for mobile, 1280 for desktop). */
  width: number
  /** Frame height in CSS pixels. */
  height: number
  /** URL loaded inside an isolated iframe (e.g. "?state=checkout-default"). */
  src?: string
  /** Optional direct DOM renderer instead of an iframe; may return a cleanup function. */
  render?: (host: HTMLElement) => void | (() => void)
}

export interface MockupGroup {
  /** Optional stable ID for the group. */
  id?: string
  /** Big-type group header describing what this group is about. */
  title: string
  /** Optional column cap before wrapping mockups to the next row (defaults to a single row). */
  columns?: number
  /** Mockups belonging to this group. */
  items: MockupItem[]
}

export interface CanvasPage {
  /** URL-safe page slug (e.g. "checkout", "passkeys"). */
  id: string
  /** Page label shown in the multi-page switcher. */
  title: string
  /** Logical groups of mockups on this infinite canvas page. */
  groups: MockupGroup[]
}

export interface MockupCanvasConfig {
  /** Pages on this project's canvas (one page per thread). */
  pages: CanvasPage[]
  /** Initial page ID if the URL does not specify one. Defaults to the first page. */
  initialPageId?: string
  /** Color theme override. Defaults to following OS prefers-color-scheme. */
  theme?: 'auto' | 'light' | 'dark'
  /** Storage key for preserving zoom across reloads/deep-links in the same browser session. */
  storageKey?: string
}

export interface Viewport {
  tx: number
  ty: number
  scale: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface MockupCanvasHandle {
  /** Switch to a page by ID; optionally pan (without zooming) to a mockup ID. */
  goTo(options: { pageId?: string; mockupId?: string; animate?: boolean }): void
  /** Zoom and center the view so all mockups on the current page fit cleanly in view. */
  recenter(animate?: boolean): void
  /** Set a specific mockup's static/active mode. */
  setMockupMode(mockupId: string, mode: MockupMode): void
  /** Read the current viewport transform. */
  getViewport(): Viewport
  /** Read the active page ID. */
  getActivePageId(): string | null
  /** Unmount listeners, DOM, and any custom renderers. */
  destroy(): void
}
