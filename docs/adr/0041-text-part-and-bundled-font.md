---
status: accepted
date: 2026-10-23
---

# 0041. A text part: SDF text with a bundled font, and part fields for text and data keys

## Context and problem statement

Worlds need words in the scene itself: titles, street names, signs, and numbers standing in the world rather than on a floating card. Parts (ADR-0005) only had number, switch and select fields, and data could reach an object only through its label card or detail tiles (ADR-0010). Drawing text in WebGL also needs a font from somewhere.

## Decision drivers

- Sharp at every zoom: the camera zooms to 160 px per grid unit.
- Works offline and without third-party requests for ordinary text.
- Data is a core pillar (ADR-0019): text should be able to show a value, and renaming or deleting a data key must keep working (ADR-0010).
- Stay generic: other parts should be able to take text or a data key later.

## Considered options

For the font:

1. Troika SDF text (drei's `<Text>`, already installed) with a bundled font file.
2. Troika with its default fonts, fetched from jsdelivr at runtime.
3. Text drawn with the browser's fonts onto a canvas texture.

For the value: a "Value" field that picks one data key, or `{key}` placeholders inside the text.

## Decision outcome

Chosen: **troika with Inter bundled** (`@fontsource/inter`, Latin, weight 600, woff; troika doesn't read woff2). It's how browser 3D and map apps usually draw text: signed-distance-field glyphs stay sharp at any size and are cheap to draw. Inter is the font the UI already asks for. Characters Inter lacks (other scripts, emoji) fall back to troika's CDN fonts, so they still show.

The **text part** (`src/parts/text.tsx`, kind `text`) lies flat on the ground or stands up (readable from both sides), with a size, an optional plate behind it in the accent colour, and an optional **Value**: one data key whose formatted value follows the text.

Part fields gain two types: `text` (a text box) and `dataKey` (a select of the world's data keys, or none). Renaming or deleting a data key updates `dataKey` props too (`renameDataReferences` in the store, which can see the part registry; `scene/` can't). Parts get the world's data as an optional `data` render prop.

Troika builds glyphs asynchronously, so a part can set `rendersAsync` and call the `onReady` render prop once it's built; the thumbnail renderer (ADR-0036) waits for it before taking the picture.

The `{key}` placeholder idea was dropped for now: picking from a list is easier for non-technical users, and a reference in free text can't be renamed reliably.

### Consequences

- Good: crisp text at any zoom, offline for Latin text, about 31 KB of font.
- Good: the new field types and the data render prop are generic.
- Bad: one weight only; other scripts need the network the first time.
- Bad: the selection frame uses an estimated text width (the real one is only known after troika has laid the text out).

## More information

ADR-0005 (parts), ADR-0010 (data keys), ADR-0019 (data-driven worlds), ADR-0036 (thumbnails).
