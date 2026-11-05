---
status: proposed
date: 2026-11-05
---

# 0146. The built-in worlds' pictures are made ahead of time, and each starter's link previews with its own

## Context and problem statement

ADR-0047 draws each starter's picture in the browser, from the starter itself, in a second WebGL context with its own shaders. That was cheap with a few small starters. Now the welcome draws two on a first visit and File → New world draws all seven (Stockholm among them) and the Blank card's five: on SwiftShader the starter world was ready after 14.5–16 s with the welcome, against 9.1 s without, and New world's cards took about 26 s to fill. The pictures are the same for everyone, so drawing them on every visitor's device is wasted work, and for a public launch it's the first impression. A link to a starter (`/templates/<id>`) also unfurled as the app's root page, with no picture of the starter.

## Decision drivers

- The welcome and New world must show their pictures at once, without a second WebGL context.
- Pictures must never drift from the starters (ADR-0036, ADR-0047): made from the starters themselves, by the same code.
- Anyone can make them again, on a real GPU, after changing a starter.
- A starter's link should preview as that starter, with its picture, from the server's HTML.

## Considered options

1. Keep drawing live, later or smaller.
2. Pictures made ahead of time by a script from the same renderer, shipped as files; live drawing only for what has no file.
3. Hand-made screenshots.

## Decision outcome

Chosen option: **2**.

- **The files:** `scripts/starter-pictures.mjs` opens the dev server in a browser and calls `renderScenePictures` (`render/scenePictures.tsx`, the code that draws a picture live) for every built-in world: each starter and the Blank card at each ground size (`STARTER_PICTURE_SOURCES`, `templates/pictures.ts`). It saves `public/starters/<id>-light.webp` and `<id>-dark.webp` (480 × 300, the cards' 240 × 150 at 2×, transparent) and, for each starter, `<id>-preview.jpg` (1200 × 630 on the light background) for link previews. A page per picture, so a big world's memory is let go before the next. `node.exe` on WSL draws on the real GPU; elsewhere SwiftShader gives the same pictures, slower.
- **Using them:** `useWorldPictures` (`ui/useWorldPictures.tsx`) gives a card a built-in world's file, and draws live (ADR-0047, unchanged) only what has none, or a file that fails to load. The welcome, New world and the home screen use it.
- **Kept honest:** `templates/pictures.test.ts` fails when a built-in world has no files, naming the script. Pictures go stale only when a starter's look changes without the script being run again; AGENTS.md says to run it.
- **Link previews:** `/templates/<id>` says the starter's name, description and picture (`og:image`, absolute from `SITE_URL`). The starters' names and descriptions move to `templates/catalogue.ts`, without their worlds, so a page's head never loads every world to say them; `templates/index.ts` adds each world's `create`. The editor's routes' previews are worked out in the `_editor` route's `head` from the address it matched: the server doesn't load the routes inside one it doesn't render (`ssr: false`), so theirs never reach the HTML. A world or prefab shared by link (`/w/<id>`, `/p/<id>`) previews in fixed words, never the sharer's: their title and text are anyone's to write, and a preview in their words could pass for ours. `/parts` and `/guide` have their own description.

### Consequences

- Good: no WebGL context, no shader compiling and nothing drawn for the welcome's or New world's pictures; on SwiftShader New world's cards fill in about 1.5 s instead of about 26 s, and the welcome no longer delays the starter world.
- Good: a starter's link unfurls with its own picture.
- Bad: about 0.8 MB of pictures in the repository, made again by hand after a starter's look changes (a test catches a missing one, not a stale one).
- Bad: the starters' names and descriptions live apart from their worlds, in the catalogue.

## More information

`scripts/starter-pictures.mjs`, `src/templates/pictures.ts`, `src/templates/catalogue.ts`, `src/ui/useWorldPictures.tsx`, `src/render/scenePictures.tsx`, `src/ui/linkPreviews.ts`, `src/routes/_editor.tsx`. Builds on ADR-0047 (New world's pictures), ADR-0036 (part thumbnails), ADR-0120 and ADR-0134 (worlds and prefabs shared by link), ADR-0126 (templates by address).
