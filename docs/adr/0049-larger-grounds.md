---
status: accepted
date: 2026-10-23
---

# 0049. Grounds up to 500 per side: the sun's shadows follow the view, and the camera and grid scale with the ground

## Context and problem statement

The ground was capped at 200 per side in the schema and 120 on the Scene tab's sliders, for no recorded reason. Bigger grounds broke in several ways: one shadow map covered the whole ground (blurry shadows, gone for small things), the orthographic camera stood a fixed 150 units back (a big ground's near corner fell behind it), the zoom-out limit couldn't show a big ground whole, and the 1-unit grid turned into a moiré, or vanished in triangle-shaped patches, when zoomed out.

## Decision drivers

- Big worlds (a city, a region) should work as well as small ones.
- Shadows should stay sharp wherever you look.
- Nothing about a small world should change.

## Considered options

1. Keep the caps.
2. Raise them and fix each thing that depends on the ground's size.
3. Cascaded shadow maps.

## Decision outcome

Chosen option: **2** (cascades are a lot of machinery for a mostly top-down view).

- **Caps:** 500 per side in the schema and on the Scene tab's sliders; File → New world gets a City preset (240 × 180).
- **Shadows follow the view** (`render/SceneLights`, `followView` in the editor): the sun's shadow camera covers the ground in view around the camera's target instead of the whole ground, growing in steps of about 19% (no crawling while zooming) and moving in whole shadow pixels (no shimmer while panning). Zoomed out far enough, it covers the whole ground as before. The normal bias is at least one shadow pixel, so a coarse map doesn't turn into acne. World pictures keep a sun over the whole ground.
- **Camera:** the orthographic camera stands back far enough for the whole ground (`orthographicDistance`: the ground's diagonal plus 50, at least 150) with a far plane past the other side; in that view distance doesn't change the picture. The zoom-out limit (orthographic) and maximum distance (perspective) come from the ground's diagonal.
- **Grid:** cells step up from 1 to 5, 25 and 125 units as the view zooms out, so lines are never closer than 6px; it no longer fades with distance.
- **Ground depth:** the ground's surface is pushed back in the depth test (polygon offset), so the grid and flat areas a hair above it always win. Over a ground hundreds of units wide its two huge triangles have more depth rounding than that gap.

### Consequences

- Good: worlds up to 500 × 500 frame, zoom, pan and shadow properly; small worlds look as before.
- Good: shadows are sharper on every world when zoomed in.
- Bad: shadows far outside the view (in perspective, beyond about 2.5 view-heights) are dropped.
- Bad: performance now depends on how many objects a big world gets; instancing is a TODO.

## More information

`src/render/SceneLights.tsx`, `src/render/cameraMath.ts`, `src/render/CameraControls.tsx` (`useOrthographicDepth`, zoom limits), `src/render/Ground.tsx`, `src/scene/schema.ts`, `src/ui/ScenePanel.tsx`, `src/ui/NewWorldDialog.tsx`.
