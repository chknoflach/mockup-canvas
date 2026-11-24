import type { IncomingMessage, ServerResponse } from 'node:http';
import type { CanvasPersistedState } from './types';
export declare const DEFAULT_STATE_ENDPOINT = "/__mockup-canvas/state";
export declare const DEFAULT_STATE_FILE = ".mockup-canvas/state.json";
export declare function readStateFile(filePath: string): CanvasPersistedState;
export declare function writeStateFile(filePath: string, state: CanvasPersistedState): void;
export interface MiddlewareOptions {
    /** Absolute or cwd-relative path to the persisted JSON file. Defaults to ".mockup-canvas/state.json". */
    filePath?: string;
    /** URL pathname handled by the middleware. Defaults to "/__mockup-canvas/state". */
    endpoint?: string;
}
/**
 * Connect/Node-compatible dev middleware persisting canvas notes and changed-mockup markers to disk
 * so agents in the project worktree can read notes directly and clear them after addressing them.
 */
export declare function createMockupCanvasMiddleware(options?: MiddlewareOptions): (req: IncomingMessage, res: ServerResponse, next: () => void) => void;
/** Zero-config Vite plugin that wires up the mockup-canvas state endpoint during `vite dev`. */
export declare function mockupCanvasPlugin(options?: MiddlewareOptions): {
    name: string;
    configureServer(server: {
        middlewares: {
            use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void;
        };
    }): void;
};
//# sourceMappingURL=server.d.ts.map