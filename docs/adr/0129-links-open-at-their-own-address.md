---
status: proposed
date: 2026-11-03
---

# 0129. Links open at their own address, without a redirect

## Context and problem statement

A world shared by link (`/w/<id>`, ADR-0120) and a template (`/templates/<id>`, ADR-0083) were redirected to the editor at `/?shared=<id>` and `/?template=<id>` (ADR-0121), because the editor lived only at `/`: leaving a preview cleaned the address there without the router starting the editor over. The address someone clicked then wasn't the one they saw (the owner, 2026-11-03: "seems odd").

## Decision drivers

- The address in the bar is the link that was shared, while that's what's open.
- Keeping a copy, closing the preview or opening another world leaves the editor as it is: no reload, no start over.
- No redirects to keep.

## Considered options

1. The editor at the links' own addresses: one route around `/`, `/w/$id` and `/templates/$id`.
2. Links as `/?shared=` and `/?template=` only, no short addresses.
3. Keep the redirect.

## Decision outcome

Chosen option: **1**.

- The editor (`AppShell`, no server rendering) is a pathless route, `_editor`, around three that draw nothing of their own: `/`, `/w/$id` and `/templates/$id`. Going from one to another (a link back to `/`) changes only the child, so the editor stays mounted, whatever notices the address. It reads the link from the path (`linkInAddress`), and opens it as before (ADR-0121): fetched, asked about if it reads from outside, a preview in View mode.
- The address stays the link while it's being opened or its preview is open, so a reload opens it again. Once anything else is open (a kept copy, another world, the home screen) it goes back to `/` with `history.replaceState`, in place. The router sees the change (with three routes side by side it started the editor over, which the end-to-end tests caught); with one route around them, it doesn't.
- Every id after `/w/` or `/templates/` is read. One that names nothing (an old `lantern_bay`, a mistyped link) lands on the home screen saying it can't be opened, rather than opening the last world under that address; a shared id this site can't have made is refused before anything is fetched.
- `?shared=` and `?template=` aren't read any more, and there are no redirects from them: they were only ever in the address bar while a preview was open.

### Consequences

- Good: the link people click is the address they see, and Edit (keep a copy) still carries on in place.
- Bad: the editor's route is pathless, so its files are `_editor.*.tsx` rather than `index.tsx`.

## More information

`src/routes/_editor.tsx` and its `_editor.index.tsx`, `_editor.w.$id.tsx`, `_editor.templates.$id.tsx`, `src/editor/openLink.ts`, `e2e/sharing.spec.ts`. Changes that point of ADR-0121.
