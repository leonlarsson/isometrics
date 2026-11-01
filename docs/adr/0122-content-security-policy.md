---
status: proposed
date: 2026-11-01
---

# 0122. A full Content Security Policy, with a nonce for each page

## Context and problem statement

The editor shows text that comes from outside: worlds from files, links, AIs and other people, with titles, names, card text and data. React escapes it, and ADR-0119 checks what comes in, but if a bug ever let such text into the page as HTML, the browser would run any script in it. The pages sent only part of a Content Security Policy (no framing, no plugins, no changing the base address or where forms post); which scripts may run wasn't restricted, because the framework writes inline scripts into each page.

## Decision drivers

- A slip somewhere must not become someone else's script running in the editor.
- Nothing may stop loading: the 3D text's worker, its fonts, pictures, shared links, data from any address.
- No hand-maintained hashes of the framework's scripts, which change with each build.

## Considered options

1. Keep the partial policy.
2. A policy with `'unsafe-inline'` scripts.
3. A full policy with a fresh nonce per page for the framework's inline scripts.

## Decision outcome

Chosen option: **3** (`server/contentSecurityPolicy.ts`, set in `router.tsx`). Option 2 would let exactly the scripts it's meant to stop run.

- For each page the server makes a nonce, sends the policy with it, and gives it to the router, which puts it on every inline script it writes (and on the head's).
- **Scripts:** this site's files, inline scripts with the page's nonce, and `blob:` (the 3D text's layout worker, troika, loads its functions as blobs with `importScripts`; a blob can only come from script already running here). No eval.
- **Workers** from this site and blobs; **styles** from this site and inline (React's `style` props; styles can't run code); **images** from this site, data URLs and blobs (pictures of parts and worlds, a rendered picture); **fonts** from this site and data URLs.
- **Connections:** this site and any web address. Worlds read links and APIs from anywhere by design (ADR-0113); what's read is gated in the app (`readLink` and the addresses this browser allowed, ADR-0119, ADR-0121). The 3D text's fonts come from cdn.jsdelivr.net this way.
- No framing, no plugins, no changing the base address or where forms post (as before).
- **Zod** probes for eval with `Function("")` and logs a violation when it's refused; a one-line inline script in the head sets `globalThis.__zod_globalConfig = { jitless: true }` before any module runs, so it doesn't try.
- **Development** sends only the parts that don't touch scripts and styles: Vite's dev server writes inline scripts of its own (hot reload) with no nonce. So the policy is checked against a production build (`pnpm build`, `pnpm preview`): the editor, a shared world with 3D text, rendering a picture, the parts catalogue and the guide load with no violations and no errors.

### Consequences

- Good: text that slipped into the page as HTML still couldn't run as script.
- Good: the policy is one function, with a test, and its reasons next to each part.
- Bad: something new that loads from elsewhere (a script from a CDN, another kind of worker) has to be added there, and checked in a production build, since development doesn't enforce scripts.

## More information

ADR-0119 (untrusted input), ADR-0121 (outside requests only through readLink), ADR-0113 (links and APIs). `src/server/contentSecurityPolicy.ts`, `src/router.tsx`, `src/routes/__root.tsx`.
