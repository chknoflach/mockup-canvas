import type { CanvasNote, CanvasPersistedState, NoteElementInfo, Rect } from './types.js'

/** Convert a 0-based index to spreadsheet-style letters: 0 -> "A", 25 -> "Z", 26 -> "AA". */
export function indexToLetter(index: number): string {
  let n = Math.max(0, Math.floor(index))
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

/** Pick the next unused letter among open notes on a page (starts at "A"). */
export function nextNoteLetter(openNotesOnPage: CanvasNote[]): string {
  const used = new Set(openNotesOnPage.map((n) => n.letter))
  let idx = 0
  while (used.has(indexToLetter(idx))) {
    idx += 1
  }
  return indexToLetter(idx)
}

/** Build a compact, human- and agent-readable CSS selector path for an element. */
export function describeElementSelector(el: Element): string {
  const parts: string[] = []
  let cur: Element | null = el
  let depth = 0

  while (cur && depth < 5) {
    const tag = cur.tagName.toLowerCase()
    if (tag === 'html' || tag === 'body') break

    const testId = cur.getAttribute('data-testid')
    if (testId) {
      parts.unshift(`${tag}[data-testid="${testId}"]`)
      break
    }

    if (cur.id) {
      parts.unshift(`${tag}#${cur.id}`)
      break
    }

    // Prefer a semantic data-* attribute if present (e.g. data-inc, data-submit).
    const dataAttr = Array.from(cur.attributes).find(
      (a) => a.name.startsWith('data-') && !a.name.startsWith('data-mc-'),
    )
    if (dataAttr) {
      parts.unshift(
        dataAttr.value ? `${tag}[${dataAttr.name}="${dataAttr.value}"]` : `${tag}[${dataAttr.name}]`,
      )
      depth += 1
      cur = cur.parentElement
      continue
    }

    const classes = Array.from(cur.classList)
      .filter((c) => !c.startsWith('mc-'))
      .slice(0, 2)
    let segment = classes.length > 0 ? `${tag}.${classes.join('.')}` : tag

    if (cur.parentElement) {
      const sameTagSiblings = Array.from(cur.parentElement.children).filter(
        (child) => child.tagName === cur!.tagName,
      )
      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(cur) + 1
        segment += `:nth-of-type(${index})`
      }
    }

    parts.unshift(segment)
    depth += 1
    cur = cur.parentElement
  }

  return parts.join(' > ') || el.tagName.toLowerCase()
}

function getAccessibleLabel(el: Element): string | undefined {
  const aria = el.getAttribute('aria-label')?.trim()
  if (aria) return aria
  const placeholder = el.getAttribute('placeholder')?.trim()
  if (placeholder) return placeholder
  const title = el.getAttribute('title')?.trim()
  if (title) return title
  const name = el.getAttribute('name')?.trim()
  if (name) return name
  return undefined
}

function getTrimmedText(el: Element): string | undefined {
  const raw = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (!raw) return undefined
  return raw.length > 80 ? `${raw.slice(0, 77)}...` : raw
}

export interface InspectedTarget {
  element: NoteElementInfo
  localX: number
  localY: number
}

/**
 * Inspect the deepest element inside a mockup frame at viewport coordinates (clientX, clientY).
 * Works for same-origin iframes and direct DOM renderers without mutating the mockup.
 */
export function inspectMockupElement(options: {
  frameEl: HTMLElement
  iframe?: HTMLIFrameElement
  contentHost?: HTMLElement
  clientX: number
  clientY: number
  scale: number
}): InspectedTarget | null {
  const { frameEl, iframe, contentHost, clientX, clientY, scale } = options
  const frameRect = frameEl.getBoundingClientRect()
  if (frameRect.width <= 0 || frameRect.height <= 0 || scale <= 0) return null

  const localX = (clientX - frameRect.left) / scale
  const localY = (clientY - frameRect.top) / scale
  if (localX < 0 || localY < 0 || localX > frameRect.width / scale || localY > frameRect.height / scale) {
    return null
  }

  if (iframe) {
    try {
      const doc = iframe.contentDocument
      if (!doc || typeof doc.elementFromPoint !== 'function') return null
      const hit = doc.elementFromPoint(localX, localY)
      if (!hit || hit === doc.documentElement) return null
      const r = hit.getBoundingClientRect()
      const rect: Rect = {
        x: Math.round(r.left),
        y: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      }
      return {
        localX: Math.round(localX),
        localY: Math.round(localY),
        element: {
          tag: hit.tagName.toLowerCase(),
          selector: describeElementSelector(hit),
          text: getTrimmedText(hit),
          ariaLabel: getAccessibleLabel(hit),
          rect,
        },
      }
    } catch {
      // Cross-origin iframe fallback: target the click point itself.
      return {
        localX: Math.round(localX),
        localY: Math.round(localY),
        element: {
          tag: 'iframe',
          selector: 'iframe',
          rect: { x: Math.round(localX) - 16, y: Math.round(localY) - 16, width: 32, height: 32 },
        },
      }
    }
  }

  if (contentHost && typeof document.elementsFromPoint === 'function') {
    const stack = document.elementsFromPoint(clientX, clientY)
    const hit = stack.find((el) => el !== contentHost && contentHost.contains(el))
    if (!hit) return null
    const r = hit.getBoundingClientRect()
    const rect: Rect = {
      x: Math.round((r.left - frameRect.left) / scale),
      y: Math.round((r.top - frameRect.top) / scale),
      width: Math.round(r.width / scale),
      height: Math.round(r.height / scale),
    }
    return {
      localX: Math.round(localX),
      localY: Math.round(localY),
      element: {
        tag: hit.tagName.toLowerCase(),
        selector: describeElementSelector(hit),
        text: getTrimmedText(hit),
        ariaLabel: getAccessibleLabel(hit),
        rect,
      },
    }
  }

  return null
}

const LOCAL_STATE_KEY = 'mockup-canvas:state'

function normalizeState(raw: unknown): CanvasPersistedState {
  if (!raw || typeof raw !== 'object') {
    return { notes: [], changedMockups: [] }
  }
  const rec = raw as Record<string, unknown>
  const notes = Array.isArray(rec.notes) ? (rec.notes as CanvasNote[]) : []
  const changedMockups = Array.isArray(rec.changedMockups)
    ? rec.changedMockups.filter((v): v is string => typeof v === 'string')
    : []
  return { notes, changedMockups }
}

export interface StateStore {
  load(): Promise<CanvasPersistedState>
  save(state: CanvasPersistedState): Promise<void>
}

export function createStateStore(endpoint: string | false, storageKey = LOCAL_STATE_KEY): StateStore {
  let useRemote = Boolean(endpoint)

  const readLocal = (): CanvasPersistedState => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      return raw ? normalizeState(JSON.parse(raw)) : { notes: [], changedMockups: [] }
    } catch {
      return { notes: [], changedMockups: [] }
    }
  }

  const writeLocal = (state: CanvasPersistedState): void => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // Ignore storage errors.
    }
  }

  return {
    async load(): Promise<CanvasPersistedState> {
      if (useRemote && endpoint && typeof fetch === 'function') {
        try {
          const res = await fetch(endpoint, { headers: { Accept: 'application/json' } })
          if (res.ok) {
            const parsed = normalizeState(await res.json())
            writeLocal(parsed)
            return parsed
          }
          if (res.status === 404 || res.status === 405) {
            useRemote = false
          }
        } catch {
          useRemote = false
        }
      }
      return readLocal()
    },

    async save(state: CanvasPersistedState): Promise<void> {
      writeLocal(state)
      if (useRemote && endpoint && typeof fetch === 'function') {
        try {
          const res = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state, null, 2),
          })
          if (res.status === 404 || res.status === 405) {
            useRemote = false
          }
        } catch {
          useRemote = false
        }
      }
    },
  }
}
