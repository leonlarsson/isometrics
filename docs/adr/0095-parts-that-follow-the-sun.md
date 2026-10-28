---
status: proposed
date: 2026-10-28
---

# 0095. Parts that follow the sun

## Context and problem statement

Solar panels on trackers turn to face the sun through the day (the owner's idea, 2026-10-28). Parts don't know where the sun is: the hour reaches only objects with a light on a schedule, so a running day doesn't redraw thousands of objects (ADR-0092).

## Decision drivers

- Objects that don't follow the sun pay nothing for it (ADR-0092).
- Parts stay free of the editor's store (`parts` sits below `editor`).
- The world's own sun direction (Light tab overrides) counts, not only the hour's.

## Considered options

1. **The sun in every object's render props:** every object draws again on every step of the day.
2. **A part says when it follows the sun** (`followsTheSun(props)`), and only those objects get the hour and the sun.
3. **A `useFrame` in the part reading the live hour:** smooth, but the part would reach into the editor, and it would move on its own every frame (ADR-0092).

## Decision outcome

Chosen option: **2**.

- `followsTheSun?: (props) => boolean` on a part definition; while it says so, the object follows the world's hour like one with a scheduled light (render/Viewport's `EntityWithSun`), and gets `sun` (azimuth and elevation in degrees, below 0 at night) in its render props from `sunAt(lighting, hour)` in `scene/sun`, which takes the world's own sun direction when set.
- The hour steps for React a world minute at a time (at most about four times a second, `editor/dayClock`), so a following object turns in small steps; its matrices settle on each render as any changed object's do.
- Solar panels (`solar_panels_01`) are the first: **Turn to follow the sun** puts the rows on a tube, tilting to face the sun's height (up to 55°), lying flat while it's down; without it they stand at their **Fixed tilt**. In pictures of the part, which have no sun, they show the fixed tilt.

### Consequences

- Good: costs nothing for the rest of the world; any part can follow the sun later (a sunflower field, a heliostat, a sundial's shadow).
- Bad: steps rather than glides on a very fast day.
- Later: following the sun's direction too (dual-axis trackers), once a part can know which way it's turned in the world.
