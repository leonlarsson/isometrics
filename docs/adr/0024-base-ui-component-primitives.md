---
status: accepted
date: 2026-10-22
---

# 0024. Base UI for interactive component primitives

## Context and problem statement

The UI's controls grew ad hoc: hand-rolled buttons, selects, sliders and panels, plus `window.confirm` and `window.alert` for questions. Upcoming work needs real menus (a File menu with a template submenu), dialogs, popovers and tooltips. Building those accessibly by hand (focus trapping, keyboard navigation, ARIA, positioning, dismissal) is a lot of work that is easy to get subtly wrong. The "Unify the UI" item in `TODO.md` also needs one shared set of controls to build on.

## Decision drivers

- Accessibility and keyboard support we don't have to maintain ourselves.
- Keep our own look and the token-based theming of ADR-0007 (light/dark, CSS Modules), with no second styling system.
- Small, tree-shakeable, React 19 compatible, actively maintained.

## Considered options

1. **Base UI** (`@base-ui/react`): unstyled, accessible primitives from the Radix/MUI/Floating UI authors.
2. **Kumo** (`@cloudflare/kumo`): Cloudflare's styled component library, built on Base UI.
3. Keep hand-rolling components.

## Decision outcome

Chosen option: **Base UI**, because it gives the behaviour (focus, keyboard, ARIA, positioning, animations via `data-*` attributes) without imposing styles, so components are styled with CSS Modules and our tokens like everything else. Kumo is built on Base UI too, but it requires Tailwind v4 (superseding ADR-0007), brings Cloudflare's visual identity, and pulls in peer dependencies we don't need (ECharts, Phosphor icons).

Rules:

- Each Base UI primitive is wrapped **once** in `src/ui/` with its styles (`Menu.tsx`, `ConfirmDialog.tsx`, …). Feature components use those wrappers, not `@base-ui/react` directly, so the look stays uniform. Add a wrapper when a new primitive is needed.
- Wrappers style Base UI's state attributes (`[data-highlighted]`, `[data-popup-open]`, `[data-starting-style]` …) in their CSS Module, using only tokens from `src/styles.css`.
- Popups render in portals on `<body>`. The app root (`.shell`) sets `isolation: isolate` so portalled popups always stack above the app.
- Use `ConfirmDialog` instead of `window.confirm` in new code.
- Keyboard shortcuts stay with TanStack Hotkeys (ADR-0016). Base UI's built-in keyboard handling inside its own widgets (arrow keys in a menu, Escape to close) is fine.

### Consequences

- Good: accessible menus and dialogs for little code; one foundation for the "Unify the UI" pass (selects, sliders, tabs, tooltips can move onto Base UI there).
- Good: no change to styling (ADR-0007) or theming.
- Bad: one more runtime dependency; until the unify pass, hand-rolled controls and Base UI wrappers live side by side.

## More information

- First uses: the toolbar's File menu (`src/ui/FileMenu.tsx`) on `Menu`, and replace-world confirmation on `ConfirmDialog`.
- Base UI docs ship with the package: `node_modules/@base-ui/react/docs/`.
