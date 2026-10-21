---
status: accepted
date: 2026-10-22
---

# 0023. Road width per point

## Context and problem statement

A road has one width along its whole length. Real roads vary: a circuit widens at a hairpin, a street narrows through a gate, a slip road tapers into a junction. Roads are drawn as point lists (ADR-0017) with a height per point (ADR-0018), so width is the natural next per-point value.

## Decision drivers

- Optional: existing roads and points must keep working unchanged.
- Smooth: a width change should ease like heights do, not step.
- Simple to edit: set it on the selected point, with a way back to the road's width.

## Considered options

1. An optional fourth value on a road point: `[x, z, height, width]`.
2. Points as objects (`{ x, z, height, width }`).
3. A separate list of width stations along the road.

## Decision outcome

Chosen option: **an optional fourth value**. It fits the existing tuple format, so old scenes parse as before and nothing needs migrating.

- A point is `[x, z, height]` (uses the road's `width`) or `[x, z, height, width]` (0.4 to 20). `pointWidth(p)` reads it.
- `roadCenterline(points, closed, cornerRadius, width)` eases the width between points with the same smoothstep-by-distance as heights, and returns it as a fourth value on every centre-line point. Segments whose width changes are subdivided like ramps.
- The road surface, deck sides, railings and embankments use the local width. Bend wedges keep reusing the quads' exact corners, so tapered bends stay watertight. Centre-line markings stay thin.
- Editing keeps a point's width when it's moved or raised. A point inserted between widened points takes the width there. Joining roads of different widths gives the absorbed road's points its width.
- The selected point's panel has "Width here", with "Default" to go back to the road's width. The road's own Width slider changes every point without its own width, and says how many points have one.

### Consequences

- Good: varying widths without any change for existing roads.
- Bad: vehicles' lane offset still uses the road's width, so on a much wider or narrower stretch they don't move with the edge. Centre-lane roads (ADR-0022) are unaffected.

## More information

- Code: `pointWidth`, `roadCenterline` and `buildRibbon` in `src/scene/roads.ts`; `setRoadPointWidth` and `withPoint` in `src/editor/store.ts`; `src/ui/RoadPointPanel.tsx`.
- Related: ADR-0017 (drawable roads), ADR-0018 (heights per point), ADR-0022 (centre lanes).
