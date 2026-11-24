import type { CanvasPage } from './types';
export interface DeepLinkTarget {
    pageId: string | null;
    mockupId: string | null;
}
/**
 * Parse a deep-link target from search params (?page=...&mockup=...) or hash (#page/mockup or #mockup).
 * Query params win over hash when both are present.
 */
export declare function parseDeepLink(search: string, hash: string): DeepLinkTarget;
/** Resolve a deep-link target against the available pages, locating the owning page if only mockupId is given. */
export declare function resolveTarget(pages: CanvasPage[], target: DeepLinkTarget, fallbackPageId?: string): {
    page: CanvasPage | null;
    mockupId: string | null;
};
/** Build a shareable deep-link URL pointing to a page and optional mockup ID. */
export declare function buildDeepLink(options: {
    pageId?: string;
    mockupId?: string;
    baseUrl?: string;
}): string;
export declare function readStoredScale(storageKey?: string): number | null;
export declare function writeStoredScale(scale: number, storageKey?: string): void;
//# sourceMappingURL=url.d.ts.map