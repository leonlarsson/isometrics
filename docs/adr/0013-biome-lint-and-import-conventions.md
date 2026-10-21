---
status: accepted
date: 2026-10-21
---

# 0013. Biome lint rules and import ordering

## Context and problem statement

Humans and agents both write code here. Style and correctness conventions should be enforced by tooling rather than remembered, and `pnpm check` should be the single gate.

## Decision outcome

Biome **2.6+** (`biome.json`) is the only linter and formatter. Biome 2.6 is required because the config uses `linter.rules.preset`.

### Import ordering (`assist.actions.source.organizeImports`)

Imports are sorted into groups separated by blank lines, in this order:

1. Node built-ins and packages (`react`, `three`, `zod` …)
2. Aliased project imports (`#/…`)
3. Parent-relative imports (`../…`)
4. Sibling imports (`./…`)
5. Everything else, which in practice means **stylesheets** (`./X.module.css`), always last

`pnpm check:fix` applies the ordering automatically. Don't hand-order imports against it.

### Lint rules (beyond the `recommended` preset)

Enforced as errors:

- Naming: `TName` type aliases, `IName` interfaces (ADR-0011).
- `noRestrictedTypes`: no generic `IProps`; name props after the component (`IEntityLabelProps`).
- `noRestrictedGlobals`: no global `React.*`; import what you need (`import type { ReactNode } from "react"`).
- `noExplicitAny`: use `unknown` or proper types. The one sanctioned exception is the part registry's `TAnyPart`, which has a `biome-ignore` explaining why.
- `noUnusedVariables` and `noUnusedImports` (unused imports are removed by `check:fix`).
- `noParameterAssign`, `useAsConstAssertion`, `useDefaultParameterLast`, `useSelfClosingElements`, `useSingleVarDeclarator`, `noUnusedTemplateLiteral`, `useNumberNamespace` (`Number.parseFloat`, not `parseFloat`), `noUselessElse`, `noGlobalIsNan`, `noDeprecatedImports`.

Deliberately **off**: `useExhaustiveDependencies` and `useHookAtTopLevel` (hook dependencies are a judgement call; don't add suppressions for them), `noForEach`, `noUselessFragments`, `noNonNullAssertion`, `useImportType`, `useNodejsImportProtocol`, `noDangerouslySetInnerHtml`, and a few a11y rules that conflict with canvas-driven UI (`useKeyWithClickEvents`, `noStaticElementInteractions`, `noSvgWithoutTitle`, `useValidAnchor`). Other a11y rules from the preset stay on.

Override: `suspicious/noFocusedTests` is off for `src/**/*.tsx`, because it mistakes drei's `bounds.fit()`-style APIs for focused tests.

### Consequences

- Good: consistent code from every contributor; most fixes are automatic (`pnpm check:fix`).
- Bad: ties us to Biome ≥ 2.6. Downgrading would mean replacing `preset` with `recommended: true`.
- Unused `biome-ignore` comments fail the check, so remove a suppression when its rule is turned off.
