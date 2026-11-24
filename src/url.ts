import type { CanvasPage } from './types.js'

export interface DeepLinkTarget {
  pageId: string | null
  mockupId: string | null
}

/**
 * Parse a deep-link target from search params (?page=...&mockup=...) or hash (#page/mockup or #mockup).
 * Query params win over hash when both are present.
 */
export function parseDeepLink(search: string, hash: string): DeepLinkTarget {
  const params = new URLSearchParams(search)
  let pageId = params.get('page')?.trim() || null
  let mockupId = params.get('mockup')?.trim() || null

  const cleanHash = hash.replace(/^#/, '').trim()
  if (cleanHash && (!pageId || !mockupId)) {
    const slash = cleanHash.indexOf('/')
    if (slash !== -1) {
      const hashPage = decodeURIComponent(cleanHash.slice(0, slash)).trim()
      const hashMockup = decodeURIComponent(cleanHash.slice(slash + 1)).trim()
      if (!pageId && hashPage) pageId = hashPage
      if (!mockupId && hashMockup) mockupId = hashMockup
    } else if (!mockupId) {
      mockupId = decodeURIComponent(cleanHash)
    }
  }

  return { pageId, mockupId }
}

/** Resolve a deep-link target against the available pages, locating the owning page if only mockupId is given. */
export function resolveTarget(
  pages: CanvasPage[],
  target: DeepLinkTarget,
  fallbackPageId?: string,
): { page: CanvasPage | null; mockupId: string | null } {
  if (pages.length === 0) return { page: null, mockupId: null }

  // If page is explicitly named and exists, prefer it.
  if (target.pageId) {
    const explicit = pages.find((p) => p.id === target.pageId)
    if (explicit) {
      const hasMockup = target.mockupId
        ? explicit.groups.some((g) => g.items.some((i) => i.id === target.mockupId))
        : false
      return { page: explicit, mockupId: hasMockup ? target.mockupId : null }
    }
  }

  // If only mockupId is given (or page didn't match), locate the page containing that mockup.
  if (target.mockupId) {
    const owner = pages.find((p) =>
      p.groups.some((g) => g.items.some((i) => i.id === target.mockupId)),
    )
    if (owner) {
      return { page: owner, mockupId: target.mockupId }
    }
  }

  const fallback = fallbackPageId ? pages.find((p) => p.id === fallbackPageId) : undefined
  return { page: fallback ?? pages[0] ?? null, mockupId: null }
}

/** Build a shareable deep-link URL pointing to a page and optional mockup ID. */
export function buildDeepLink(options: {
  pageId?: string
  mockupId?: string
  baseUrl?: string
}): string {
  const base = options.baseUrl ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/')
  const url = new URL(base)
  if (options.pageId) {
    url.searchParams.set('page', options.pageId)
  } else {
    url.searchParams.delete('page')
  }
  if (options.mockupId) {
    url.searchParams.set('mockup', options.mockupId)
  } else {
    url.searchParams.delete('mockup')
  }
  url.hash = ''
  return url.toString()
}

const DEFAULT_STORAGE_KEY = 'mockup-canvas:scale'

export function readStoredScale(storageKey = DEFAULT_STORAGE_KEY): number | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

export function writeStoredScale(scale: number, storageKey = DEFAULT_STORAGE_KEY): void {
  try {
    if (Number.isFinite(scale) && scale > 0) {
      window.sessionStorage.setItem(storageKey, String(scale))
    }
  } catch {
    // Ignore storage errors in restricted contexts.
  }
}
