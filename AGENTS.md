> **For the AI: how to use this file**
> Read at the start of any work in `mockup-canvas`. Follows `~/dev/AGENTS.md` and `~/dev/agent-resources/rules/design.md`.

# mockup-canvas

Zero-dependency, framework-agnostic multi-page infinite canvas for code-backed design mockups.

## Architecture

Each concern lives in one module under `src/`:
- `viewport.ts` — pure pan/zoom math, zoom-at-point, recenter fit, pan-only deep-link positioning.
- `layout.ts` — deterministic group + mockup positioning and page bounds.
- `url.ts` — deep-link parsing (`?page=&mockup=` and `#page/mockup`), URL building, session zoom persistence.
- `canvas.ts` — DOM lifecycle, pointer/wheel/pinch handling, `static`/`active` overlay isolation, page switcher, recenter control.
- `styles.css` — minimal light/dark canvas chrome; **zero `blur(` anywhere**.

## Gates

Run `pnpm check` (`typecheck`, `test`, `build`). Run `pnpm dev` to launch the interactive QA playground.
