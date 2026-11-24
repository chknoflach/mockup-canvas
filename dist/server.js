import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export const DEFAULT_STATE_ENDPOINT = '/__mockup-canvas/state';
export const DEFAULT_STATE_FILE = '.mockup-canvas/state.json';
function emptyState() {
    return { notes: [], changedMockups: [] };
}
export function readStateFile(filePath) {
    try {
        const raw = readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            notes: Array.isArray(parsed.notes) ? parsed.notes : [],
            changedMockups: Array.isArray(parsed.changedMockups) ? parsed.changedMockups : [],
        };
    }
    catch {
        return emptyState();
    }
}
export function writeStateFile(filePath, state) {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}
/**
 * Connect/Node-compatible dev middleware persisting canvas notes and changed-mockup markers to disk
 * so agents in the project worktree can read notes directly and clear them after addressing them.
 */
export function createMockupCanvasMiddleware(options = {}) {
    const filePath = resolve(process.cwd(), options.filePath ?? DEFAULT_STATE_FILE);
    const endpoint = options.endpoint ?? DEFAULT_STATE_ENDPOINT;
    return function mockupCanvasMiddleware(req, res, next) {
        const pathname = (req.url ?? '').split('?')[0];
        if (pathname !== endpoint) {
            next();
            return;
        }
        if (req.method === 'GET') {
            const state = readStateFile(filePath);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(state));
            return;
        }
        if (req.method === 'PUT' || req.method === 'POST') {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => {
                try {
                    const body = Buffer.concat(chunks).toString('utf8');
                    const parsed = JSON.parse(body);
                    const nextState = {
                        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
                        changedMockups: Array.isArray(parsed.changedMockups) ? parsed.changedMockups : [],
                    };
                    writeStateFile(filePath, nextState);
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(nextState));
                }
                catch {
                    res.statusCode = 400;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                }
            });
            return;
        }
        res.statusCode = 405;
        res.end();
    };
}
/** Zero-config Vite plugin that wires up the mockup-canvas state endpoint during `vite dev`. */
export function mockupCanvasPlugin(options = {}) {
    return {
        name: 'mockup-canvas-state',
        configureServer(server) {
            server.middlewares.use(createMockupCanvasMiddleware(options));
        },
    };
}
//# sourceMappingURL=server.js.map