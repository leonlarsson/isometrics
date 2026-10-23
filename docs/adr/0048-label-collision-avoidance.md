---
status: accepted
date: 2026-10-23
---

# 0048. Label cards step aside for each other and for the UI, and shrink to chips where there's no room

## Context and problem statement

Label cards (ADR-0008) sat exactly where their anchors projected, so cards close together on screen covered each other, the world's title and the floating bars. On a phone Brightwater's cards were an unreadable pile. Data is the core pillar (ADR-0019), so cards have to stay readable.

## Decision drivers

- No card hides another, the title, a bar or a sheet.
- Cards stay near their objects and calm: no jumping or flickering while vehicles drive or the camera moves.
- No data disappears.
- Cheap enough to run every frame, without layout thrashing.

## Considered options

1. Fade lower-priority cards that overlap.
2. Move cards aside on screen, with leader lines that follow, and shrink a card to a chip where there's no room.
3. A force-directed layout (cards repel each other).

## Decision outcome

Chosen option: **2**.

- **Layout** (`src/lib/labelLayout.ts`, pure and tested): every frame, cards are placed one at a time in priority order: the selected card, then cards already on their own spot, then nearer ones; cards on driving vehicles last, since they're moving anyway. A card takes its own spot if free, else last frame's spot if still free, else the nearest free spot within 120px (up is cheapest, sideways next, down only a little). Without room it becomes a **chip** (its dot and main value), and if even that doesn't fit, a chip on its own spot.
- **Obstacles:** anything marked `data-label-obstacle` (the world's title, the floating bars, the detail sheet, the narrow layout's bottom sheet) and the area outside the canvas.
- **Calm:** cards glide to a new spot instead of jumping, and a card that just shrank stays a chip for 0.8s.
- **Leader lines move to 2D:** a 3D line can't follow a card that moved aside on screen, so the dashed line is an SVG line in the label layer from the projected pin to the card, set by `LabelProjector`. The pin dot stays in 3D, and each label's `offset` still says where its card would like to sit.
- **Chips:** a second button next to each card (`aria-label` "Title: value"). Hovering a chip shows the whole card in its place; selecting it gives it top priority, so it gets room as a full card.
- **Sizes:** one ResizeObserver records each card's and chip's size, and the projector reads all positions before writing any, so the browser never lays out mid-frame.

### Consequences

- Good: cards no longer cover each other or the UI; phones went from a pile to readable cards; no scene format change.
- Good: the layout is a pure function with unit tests.
- Bad: cards can sit up to 120px from their spot, so leader lines get longer in crowded views.
- Bad: leader lines are drawn over the world (they no longer pass behind buildings), like the cards.
- Bad: a chip shows only the main value; the title is on hover, or once selected.

## More information

`src/lib/labelLayout.ts`, `src/render/LabelProjector.tsx`, `src/render/EntityLabel.tsx`, `src/render/labelRegistry.ts`, `src/ui/LabelLayer.tsx`. Builds on ADR-0008 (DOM label layer) and ADR-0030 (narrow layout).
