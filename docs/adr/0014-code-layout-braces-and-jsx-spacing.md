---
status: accepted
date: 2026-10-21
---

# 0014. Code layout: always-braced `if`, blank lines between JSX siblings

## Context and problem statement

The repo owner prefers code where control flow and JSX structure are easy to scan. Two layout rules aren't covered by the formatter's defaults.

## Decision outcome

1. **Every `if` / `else` / loop body is a braced block, with the body on its own line.** There are no one-line `if (x) return;` forms. This is enforced by Biome `style/useBlockStatements` (error, safe autofix); the formatter then puts the body on its own line.

   ```ts
   if (!entity) {
   	return null;
   }
   ```

2. **A blank line between sibling JSX children.** Elements, fragments and `{expressions}` that sit on separate lines are separated by an empty line, single-line ones included. Text runs are exempt, so inline content such as `<Icon /> Add` or a sentence containing `{"…"}` stays as written. A JSX comment (`{/* … */}`) sits directly on top of the block it describes, with no blank line after it.

   ```tsx
   <main className={styles.stage}>
   	<SceneTitle />

   	{ready && <Viewport />}

   	<DetailSheet />
   </main>
   ```

   Biome has no rule for this, so `scripts/jsx-spacing.mjs` (TypeScript-AST based) enforces it:
   - `pnpm check` runs it and fails on violations.
   - `pnpm check:fix` inserts the missing blank lines (Biome's formatter preserves them).
   - `pnpm lint:jsx` runs only this check.

### Consequences

- Good: consistent, scannable code; both rules are fixed automatically.
- Bad: JSX gets taller. The custom script must be kept working when the TypeScript version changes; it only uses stable `ts.createSourceFile` / node-kind APIs.
