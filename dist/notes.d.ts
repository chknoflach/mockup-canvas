import type { CanvasNote, CanvasPersistedState, NoteElementInfo } from './types.js';
/** Convert a 0-based index to spreadsheet-style letters: 0 -> "A", 25 -> "Z", 26 -> "AA". */
export declare function indexToLetter(index: number): string;
/** Pick the next unused letter among open notes on a page (starts at "A"). */
export declare function nextNoteLetter(openNotesOnPage: CanvasNote[]): string;
/** Build a compact, human- and agent-readable CSS selector path for an element. */
export declare function describeElementSelector(el: Element): string;
export interface InspectedTarget {
    element: NoteElementInfo;
    localX: number;
    localY: number;
}
/**
 * Inspect the deepest element inside a mockup frame at viewport coordinates (clientX, clientY).
 * Works for same-origin iframes and direct DOM renderers without mutating the mockup.
 */
export declare function inspectMockupElement(options: {
    frameEl: HTMLElement;
    iframe?: HTMLIFrameElement;
    contentHost?: HTMLElement;
    clientX: number;
    clientY: number;
    scale: number;
}): InspectedTarget | null;
export interface StateStore {
    load(): Promise<CanvasPersistedState>;
    save(state: CanvasPersistedState): Promise<void>;
}
export declare function createStateStore(endpoint: string | false, storageKey?: string): StateStore;
//# sourceMappingURL=notes.d.ts.map