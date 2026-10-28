---
status: proposed
date: 2026-10-27
---

# 0093. The React Compiler memoises components

## Context and problem statement

Much of the editor's time on a change went to components rendering again with nothing new to show: the properties' tab rail, tooltips, icons and buttons under a parent that rendered. Memoising them by hand (`memo`, `useMemo`, `useCallback` everywhere) is noisy and easy to get wrong.

## Decision drivers

- What didn't change shouldn't render again (ADR-0092).
- No hand-written memoisation in every component.

## Considered options

1. Memoise by hand where profiling shows a cost.
2. **The React Compiler** (stable, through Babel: `babel-plugin-react-compiler` with `@rolldown/plugin-babel` and plugin-react's `reactCompilerPreset`).
3. The compiler's Rust port in plugin-react (`compiler: true`, `oxc-transform-react`): faster builds, but experimental.

## Decision outcome

Chosen: **the React Compiler through Babel**, in `vite.config.ts`. Dragging an object in Brightwater went from about 15 ms a frame to about 10 ms.

### Consequences

- Good: components and hooks are memoised for us; the code stays as written.
- Good: components must follow the Rules of React, which the compiler checks; one that breaks them is left as it was, not broken.
- Bad: it treats a module's variables as unchanging inside components, effects included, and miscompiled code that kept a module variable's value before changing it (Render a picture never finished). Module state is changed in plain functions outside components; `PERFORMANCE.md` has the rule.
- Bad: Babel runs over every component in development and builds, which is slower than the plain transform. The Rust port can replace it once it's stable.
- Memoising by hand still has its place where it's about identity across a long list (the outliner's chunks, `EntityNode`'s props).

## More information

ADR-0092. https://react.dev/learn/react-compiler
