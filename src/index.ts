export { mountMockupCanvas } from './canvas'
export {
  computePageLayout,
  findSpatialNeighbor,
  MOCKUP_HEADER_HEIGHT,
  GROUP_HEADER_HEIGHT,
  type SpatialDirection,
} from './layout'
export { describeElementSelector, indexToLetter, inspectMockupElement, nextNoteLetter } from './notes'
export { buildDeepLink, parseDeepLink, resolveTarget } from './url'
export {
  clampScale,
  computeFillMockup,
  computeFitMockup,
  computeFitViewport,
  computePanToTarget,
  panBy,
  zoomAtPoint,
  MIN_SCALE,
  MAX_SCALE,
} from './viewport'
export type {
  CanvasNote,
  CanvasPage,
  CanvasPersistedState,
  MockupCanvasConfig,
  MockupCanvasHandle,
  MockupGroup,
  MockupItem,
  MockupMode,
  NoteElementInfo,
  NoteStatus,
  Rect,
  Viewport,
} from './types'
