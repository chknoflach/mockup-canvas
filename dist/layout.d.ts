import type { CanvasPage, MockupGroup, MockupItem, Rect } from './types';
export declare const MOCKUP_HEADER_HEIGHT = 34;
export declare const GROUP_HEADER_HEIGHT = 52;
export declare const GROUP_HEADER_GAP = 24;
export declare const ITEM_GAP_X = 48;
export declare const ITEM_GAP_Y = 56;
export declare const GROUP_GAP_Y = 128;
export interface PositionedMockup {
    item: MockupItem;
    /** Outer box including the unified header and the mockup frame. */
    rect: Rect;
    /** Inner frame box (width × height of the mockup itself). */
    frameRect: Rect;
}
export interface PositionedGroup {
    group: MockupGroup;
    headerPos: {
        x: number;
        y: number;
    };
    rect: Rect;
    items: PositionedMockup[];
}
export interface PageLayout {
    groups: PositionedGroup[];
    /** Bounding box covering all group headers and mockups on the page. */
    bounds: Rect | null;
    byId: Map<string, PositionedMockup>;
}
export declare function computePageLayout(page: CanvasPage): PageLayout;
export type SpatialDirection = 'left' | 'right' | 'up' | 'down';
/**
 * Find the visually adjacent mockup in the requested direction on the current page.
 * Prefers mockups aligned on the same row/column and wraps around at edges.
 */
export declare function findSpatialNeighbor(layout: PageLayout, currentId: string | null, direction: SpatialDirection): PositionedMockup | null;
//# sourceMappingURL=layout.d.ts.map