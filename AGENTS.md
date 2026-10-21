# AGENTS.md

Guide for AI agents (and humans) working in this repo.

## What this is

**Isometrics** lets non-technical users build animated 3D "diorama" dashboards: a low-poly scene (warehouse, vans, houses …) with floating data cards. Users place, move, rotate, resize and recolour objects, label them with values, and switch to a clean View mode.

## Read first

- `docs/adr/README.md`: the architecture decisions and why. **Check the relevant ADRs before structural changes.**
- `src/scene/schema.ts`: the scene document, which is the single source of truth (ADR-0003).

## Commands (pnpm)

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on http://localhost:3000 (Vite + Cloudflare workerd) |
| `pnpm test` | Vitest unit tests (`src/**/*.test.ts`) |
| `pnpm typecheck` | Generate routes + `tsc --noEmit` |
| `pnpm check` / `pnpm check:fix` | Biome lint + format + JSX spacing check (`scripts/jsx-spacing.mjs`); `:fix` repairs what it can |
| `pnpm build` / `pnpm deploy` | Production build / deploy to Cloudflare Workers |

Before finishing a change, run `pnpm check && pnpm typecheck && pnpm test`. CI (`.github/workflows/ci.yml`) runs the same three on every push to `main` and on pull requests.

## Layout

```
src/
  scene/      document model: Zod schema, parsing, road geometry, path sampling, formatting, theme palettes (no React)
  parts/      procedural 3D parts + registry (definePart, PARTS)
  templates/  starter scenes
  editor/     Zustand store (history/undo), persistence, shortcuts, theme hooks
  render/     R3F scene: Viewport, CameraRig, EntityNode, RoadMesh + road handles/draw tool, labels (3D side)
  ui/         DOM UI: AppShell, Toolbar, PartsPalette, Inspector panels, LabelLayer, DetailSheet
  routes/     TanStack Start file routes (index = the editor, ssr: false)
  styles.css  design tokens (light/dark) + base styles
scripts/      repo tooling (jsx-spacing check)
docs/adr/     Architecture Decision Records
```

Dependencies point downward: `ui` → `render` → `editor` → `parts` → `scene` → `lib`. `scene/` must stay free of React and three.js so it remains testable and reusable on a server.

## Conventions

- **Naming (lint-enforced, ADR-0011):** type aliases `TName`, interfaces `IName`. Zod schemas are `NameSchema`, with inferred types `type TName = z.output<typeof NameSchema>`. Props interfaces are named after their component (`IEntityLabelProps`); a generic `IProps` is rejected.
- **Biome ≥ 2.6 is the only linter and formatter (ADR-0013).** Tabs, double quotes, line width 100. Run `pnpm check:fix` and let it order imports. Key rules: no `any`, no global `React.*` (import types directly), no unused variables or imports, `Number.parseFloat` over `parseFloat`. `useExhaustiveDependencies` is **off**, so don't add suppressions for it; unused `biome-ignore` comments fail the check.
- Import order (auto-fixed): packages → `#/` aliases → `../` → `./` → stylesheets last, with a blank line between groups.
- **Layout (ADR-0014):** every `if`/`else`/loop body is braced with the body on its own line (Biome `useBlockStatements`). Sibling JSX children (elements, fragments, `{expressions}`) are separated by a blank line, single-line ones included; inline text runs are exempt. Enforced by `scripts/jsx-spacing.mjs`, which is part of `pnpm check`, and fixed by `pnpm check:fix`.
- **Functions and exports (ADR-0015):** define every function as a `const` arrow function and use named exports only. No `function` declarations (not lint-enforced, so follow it by hand; Biome only catches function *expressions*), and no `export default` except in `*.config.*` files. Exception: route files in `src/routes/` keep `export const Route` first, followed by a hoisted `function` component. Arrow functions aren't hoisted, so define helpers before top-level code uses them, and write `<T,>` for unconstrained generics in `.tsx`.
- Imports use the `#/` alias for `src/`.
- **Keyboard (ADR-0016):** all shortcuts go through `@tanstack/react-hotkeys` (`useHotkey` / `useHotkeys`). Editor-wide ones live in `src/editor/useShortcuts.ts`; widget-specific ones use `target: ref`. Never add `keydown` listeners or `onKeyDown` props (not lint-enforced, so follow it by hand). Register `Shift+X` variants explicitly, and give each hotkey `meta: { name }`.
- The product name lives in one constant, `APP_NAME` (`src/lib/app.ts`). Never hard-code it in runtime code; derive variants from it (e.g. `APP_NAME.toLowerCase()`).
- Styling: CSS Modules next to the component, using **only tokens** from `src/styles.css`. 3D colours come from `scenePalettes` in `src/scene/theme.ts`; keep the two in sync (ADR-0007).
- All scene mutations go through the store's `commit()` (or helpers built on it). Pass `{ coalesce: "<stable key>" }` for continuous edits (typing, sliders, drags) so they become a single undo step (ADR-0009).
- Never store runtime/UI state (selection, camera, animation progress) in the scene document.
- Untrusted scene JSON (files, storage, AI) must go through `parseScene()`.

## Common tasks

**Add a part:** create it with `definePart({...})` in the right `src/parts/*.tsx` file. Give the Zod schema a default for every prop, describe the inspector controls in `fields`, follow the axis conventions (origin at the footprint centre on the ground, front +Z, vehicles drive +X), then add it to `PARTS` in `registry.ts`. The palette and inspector pick it up automatically.

**Change the scene format:** edit `schema.ts` with defaults for new fields. While the app is unreleased, change the schema in place: don't bump `SCENE_VERSION` or write migrations (old browser saves just fall back to the template). Once it's released, breaking changes bump the version and migrate in `migrate.ts`, with a test. Write an ADR if the change is conceptual.

**Add a template:** add a `create…Scene()` in `src/templates/` and register it in `templates/index.ts`. The schema test validates every template automatically.

## Verifying visually

Unit tests don't cover rendering. For UI changes, run `pnpm dev` and check the page in a browser. Agents without a browser can use Playwright's headless Chromium. Launch it with `--use-angle=swiftshader --enable-unsafe-swiftshader` so WebGL works. On a bare WSL/Ubuntu machine Chromium may be missing `libnspr4`, `libnss3` and `libasound2t64`. Without sudo, `apt-get download` them, `dpkg -x` them into a temp dir, and run with `LD_LIBRARY_PATH` pointing at its `usr/lib/x86_64-linux-gnu`. Label cards are real DOM buttons (`getByRole("button", { name: /Orders packed/ })`), and the inspector inputs have accessible labels (`Location X`, `Name`, …). Keep Playwright out of the project's dependencies unless an ADR adds e2e tests.

## Commits and PRs

Never add AI attribution: no `Co-Authored-By: Claude …` (or any other AI) trailer, no "Generated with Claude Code" line in commit messages or PR descriptions. Commit as the configured git user only. Don't hard-wrap commit message bodies; use one line per bullet.

## ADR workflow

Write a new ADR (copy `docs/adr/template.md`, next free number) for anything that changes structure, dependencies, data formats, conventions or system-level behaviour, and add it to the index table in `docs/adr/README.md`. Don't edit accepted ADRs; supersede them with a new one.

## Known gaps / next steps

- Label collision avoidance (cards can overlap).
- Live data providers (ADR-0010), sharing links (ADR-0006), AI generation (ADR-0012).
- Road junctions: crossing roads overlap visually, and a vehicle follows a single road (ADR-0017).
- Terrain/mountains with roads tunnelling through them: road heights are already modelled for this (ADR-0018).
- Multi-select; mobile editing layout is basic.
