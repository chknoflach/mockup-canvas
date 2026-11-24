import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, resolve } from 'node:path'
import type { CanvasPersistedState } from './types.js'

export const DEFAULT_STATE_ENDPOINT = '/__mockup-canvas/state'
export const DEFAULT_STATE_FILE = '.mockup-canvas/state.json'

function emptyState(): CanvasPersistedState {
  return { notes: [], changedMockups: [] }
}

export function readStateFile(filePath: string): CanvasPersistedState {
  try {
    const raw = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<CanvasPersistedState>
    return {
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      changedMockups: Array.isArray(parsed.changedMockups) ? parsed.changedMockups : [],
    }
  } catch {
    return emptyState()
  }
}

export function writeStateFile(filePath: string, state: CanvasPersistedState): void {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export interface MiddlewareOptions {
  /** Absolute or cwd-relative path to the persisted JSON file. Defaults to ".mockup-canvas/state.json". */
  filePath?: string
  /** URL pathname handled by the middleware. Defaults to "/__mockup-canvas/state". */
  endpoint?: string
}

/**
 * Connect/Node-compatible dev middleware persisting canvas notes and changed-mockup markers to disk
 * so agents in the project worktree can read notes directly and clear them after addressing them.
 */
export function createMockupCanvasMiddleware(options: MiddlewareOptions = {}) {
  const filePath = resolve(process.cwd(), options.filePath ?? DEFAULT_STATE_FILE)
  const endpoint = options.endpoint ?? DEFAULT_STATE_ENDPOINT

  return function mockupCanvasMiddleware(
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): void {
    const pathname = (req.url ?? '').split('?')[0]
    if (pathname !== endpoint) {
      next()
      return
    }

    if (req.method === 'GET') {
      const state = readStateFile(filePath)
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(state))
      return
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf8')
          const parsed = JSON.parse(body) as Partial<CanvasPersistedState>
          const nextState: CanvasPersistedState = {
            notes: Array.isArray(parsed.notes) ? parsed.notes : [],
            changedMockups: Array.isArray(parsed.changedMockups) ? parsed.changedMockups : [],
          }
          writeStateFile(filePath, nextState)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(nextState))
        } catch {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid JSON body' }))
        }
      })
      return
    }

    res.statusCode = 405
    res.end()
  }
}

/** Zero-config Vite plugin that wires up the mockup-canvas state endpoint during `vite dev`. */
export function mockupCanvasPlugin(options: MiddlewareOptions = {}) {
  return {
    name: 'mockup-canvas-state',
    configureServer(server: {
      middlewares: {
        use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void
      }
    }) {
      server.middlewares.use(createMockupCanvasMiddleware(options))
    },
  }
}
