---
status: accepted
date: 2026-10-21
---

# 0007. CSS Modules with design tokens (Tailwind possible later)

## Context and problem statement

We need styling for the editor UI and label cards, with light and dark themes. A move to Tailwind later is possible.

## Decision outcome

- Component styles live in co-located `*.module.css` files.
- **All colours, radii and shadows come from CSS custom properties** in `src/styles.css`. Light is the default on `:root`; dark overrides apply under `:root[data-theme="dark"]`. `useThemeAttribute()` sets `data-theme` from the scene's theme preference (`system | light | dark`).
- 3D colours can't use CSS variables, so the scene palette is mirrored in `src/scene/theme.ts` (`scenePalettes`). Keep both in sync when changing themes.
- Biome parses CSS Modules (`css.parser.cssModules`).

### Consequences

- Good: themes stay in one place; switching to Tailwind later means mapping tokens to the Tailwind theme, not rewriting colour values.
- Bad: two palettes (CSS and TS) must be kept in sync by hand.
