# mockup-canvas

Zero-dependency, framework-agnostic multi-page infinite canvas for code-backed design mockups.

## Install

```bash
pnpm add -D github:chknoflach/mockup-canvas#v0.1.0
```

Prebuilt `dist/` assets are committed to the repo, so no install/build scripts are required under pnpm's `allowBuilds` policy.

## Usage

```ts
import { mountMockupCanvas } from 'mockup-canvas'
import 'mockup-canvas/styles.css'

mountMockupCanvas(document.getElementById('root')!, {
  pages: [
    {
      id: 'checkout',
      title: 'Checkout flow',
      groups: [
        {
          title: 'Order summary',
          items: [
            { id: 'A.1', title: 'Default', width: 900, height: 560, src: '?state=order-default' },
            { id: 'A.2', title: 'Mobile', width: 390, height: 640, src: '?state=order-mobile', changed: true },
          ],
        },
      ],
    },
  ],
})
```

### Persisting notes & changed-screen markers (dev server)

In Vite (`vite.config.ts`), add the built-in plugin so notes and turn-change markers persist to `.mockup-canvas/state.json` (gitignored):

```ts
import { mockupCanvasPlugin } from 'mockup-canvas/server'

export default defineConfig({
  plugins: [mockupCanvasPlugin()],
})
```

For non-Vite Node dev servers, mount `createMockupCanvasMiddleware()` from `mockup-canvas/server`.

## Shortcuts

- **Pan / Zoom:** drag canvas, two-finger trackpad scroll, pinch / `Cmd` or `Ctrl` + scroll, or physical keys left of right Shift (`Period` = zoom out, `Slash` = zoom in)
- **Navigate mockups:** `←` `→` `↑` `↓` (preserves zoom when target fits; shrinks to fill-width if overflowing; steady top-edge rail)
- **Fit / Fill width:** tap `Shift` to toggle fit ↔ fill-width on the current mockup
- **Pages:** `Space` toggles page selector (`↑`/`↓` + `Enter`, `Esc` or `Space` to close)
- **Changes mode:** `c` (or top-right toggle) — `←`/`→` step changed screens on the active page, `↓` opens the changed list (`↑`/`↓` + `Enter`, `Esc` to close)
- **Note mode:** `n` (or top-right note icon) — hover outlines the deepest element, click drops `(A)` + focused note input (`Enter` submits, `Shift+Enter` newline, `Esc` closes input then exits note mode)
- **Deep-link:** `?page=<pageId>&mockup=<id>` (or `?mockup=<id>`) opens the page and pans only without changing zoom

## Development

```bash
pnpm install
pnpm dev     # local QA playground at http://127.0.0.1:4173
pnpm check   # typecheck + unit/DOM tests + build
```
