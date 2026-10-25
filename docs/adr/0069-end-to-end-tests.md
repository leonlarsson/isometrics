---
status: accepted
date: 2026-10-25
---

# 0069. End-to-end tests in a real browser, driven through dev-only hooks

## Context and problem statement

Most of the editor is interaction: clicks and drags in a WebGL view, keys, menus, panels. Unit tests cover the logic (the store, geometry, the scene format) but not whether the UI is wired to it, and every UI change was checked by hand, each time rebuilding a throwaway Playwright setup. Several regressions and near-misses (dead camera keys, modifiers, clipboard paths) were only caught that way.

## Decision drivers

- Catch broken flows before they deploy (pushing to `main` deploys).
- Stay quick enough to run on every push, and simple enough for agents to extend.
- Don't add test-only code to production builds.

## Considered options

1. End-to-end tests with Playwright against the dev server, set up and checked through the store.
2. Against a production build, with a test hook compiled into it.
3. Pixel snapshots of the view.

## Decision outcome

Chosen: **Playwright against the dev server** (1).

- `@playwright/test` is a dev dependency; `pnpm e2e` runs `e2e/*.spec.ts`, one file per area (opening and saving, worlds and files, selecting, transforms, properties, roads and areas, vehicles, camera and viewpoints, world settings, View mode, clipboard, Add to scene, layout and phones, Preferences). `playwright.config.ts` reuses a dev server on :3000 or starts one, and uses the full Chromium build in its new headless mode (`channel: "chromium"`; the headless shell crashes on Pointer Lock) with SwiftShader for WebGL.
- Tests reach the app through two hooks that exist only in development: `globalThis.__editorStore` (the editor store, already kept there for hot reload) to set up and to check results, and `globalThis.__editorView` (render/PointerSpot) with `screenOf(point)`, where a world point is on screen, and `pose()`, the live camera, so tests click handles and objects exactly and wait for glides. Production builds have neither.
- Shared helpers live in `e2e/editor.ts`; each test gets a fresh browser context (the starter world) and fails on uncaught page errors. Tests assert on store state rather than pixels (software WebGL makes pixels flaky), one test per user-facing flow rather than per option: about 90 tests, about 6 minutes with three browsers. Logic stays in unit tests.
- CI runs them in a job split over three machines (`--shard`), next to check, typecheck and unit tests, with the report uploaded on failure.

### Consequences

- Good: every area's main flows are checked on every push; agents check their changes with the same helpers (AGENTS.md → Verifying visually).
- Bad: minutes per run, and some timing sensitivity (glides, the clipboard); tests depend on accessible names, which is also good for accessibility.
- Bad: Cloudflare deploys on push without waiting for CI; making deploys wait is a separate decision.

## More information

- Related: ADR-0003 (the scene document), ADR-0016 (keyboard), ADR-0056 (old-world checks, which a future visual comparison could use).
- Code: `playwright.config.ts`, `e2e/`, `src/render/PointerSpot.tsx`, `.github/workflows/ci.yml`.
