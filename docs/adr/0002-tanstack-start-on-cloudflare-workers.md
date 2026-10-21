---
status: accepted
date: 2026-10-21
---

# 0002. TanStack Start, deployed to Cloudflare Workers

## Context and problem statement

We need a React app framework and somewhere to host it. Server needs are small today (none), but likely later: a proxy for AI calls, share links, fetching live data with secrets kept server-side.

## Decision drivers

- Owner preference: TanStack Start and Cloudflare Workers.
- Start simple; add server code only when needed, without switching frameworks.

## Considered options

1. TanStack Start + `@cloudflare/vite-plugin` (Workers)
2. Next.js on Vercel
3. Plain Vite SPA on static hosting

## Decision outcome

Chosen option: **TanStack Start on Cloudflare Workers**, scaffolded with the official TanStack CLI (`--deployment cloudflare`).

- The editor route (`src/routes/index.tsx`) uses `ssr: false`: it is WebGL + `localStorage` only, so server rendering adds nothing.
- Server functions / Worker routes are the place for future server work (see ADR-0006, ADR-0012). Cloudflare bindings (KV, R2, D1) are added to `wrangler.jsonc` only when a feature needs them.

### Consequences

- Good: one codebase for UI and future server logic; cheap, global hosting; `pnpm deploy` ships it.
- Bad: three.js makes a large client chunk (~1 MB); acceptable for an editor, revisit with code-splitting if a lightweight "viewer-only" route is added.
