---
status: proposed
date: 2026-10-26
---

# 0073. The effects composer draws the scene as on the canvas, and the backdrop stays behind it

## Context and problem statement

ADR-0072 puts ambient occlusion, the glow after dark and SMAA in one effects composer behind the Graphics settings, with Standard as the view always was. Built on `postprocessing` and `n8ao`, the first version changed colours that no setting should touch: the painted night lights (lit panes, lamp pools, lenses) are drawn with `toneMapped: false` so they keep their exact colour, and see-through ones blend onto the canvas's sRGB values; a composer that tone-maps the finished picture, or blends in linear light, turned yellow and pink windows beige and made lamp pools bigger. Today's tilt-shift (ADR-0062), drawn through three's own composer and `OutputPass`, has the same fault. ADR-0072 also expected the diorama's backdrop (ADR-0070) to need drawing in the canvas while effects are on, because the composers in the render lab left a rim round the ground.

## Decision drivers

- Standard never changes (ADR-0072), and switching an effect on changes only what the effect does.
- Old worlds look as they did (ADR-0056); the painted lights are part of that look (ADR-0052, ADR-0058).
- Effects (ambient occlusion, the glow, blurs) work best in linear light, as `postprocessing` expects.
- The backdrop is CSS behind a transparent canvas (ADR-0070); copying it into WebGL means copying CSS colour mixing.

## Considered options

1. **Tone-map the finished picture** in the composer (the lab's way, and `OutputPass`).
2. **Draw the scene as on the canvas, then decode:** the composer's first pass draws the scene into its own buffer exactly as three draws onto the canvas (each material tone-mapped, or not, and written as sRGB, so see-through things blend onto sRGB values), decodes it into linear light for the effects, and the last pass encodes it for the canvas again.
3. **Keep the whole chain in sRGB** (effects on display values).

## Decision outcome

Chosen option: **2**.

- three tone-maps materials and writes sRGB only for the canvas and for XR render targets; the scene pass's buffer is flagged as one (`isXRRenderTarget`, colour space sRGB). For a half-float buffer the flag changes nothing else. No other pass draws into that buffer: the composer's own two buffers swap between passes, so flagging one of them would encode another pass's output too.
- The scene pass's buffer has its own depth texture, and ambient occlusion reads that one: the composer would hand N8AO the depth of its own buffers, which never see the scene, and the occlusion would be blank.
- The rest is `postprocessing` as designed: ambient occlusion (N8AO), the glow (bloom × the darkness, off by day), the tilt-shift blur and SMAA in linear light, and the last pass (SMAA, or a copy) encodes for the canvas.
- **The glow uses bloom's Kawase blur, not its mipmap blur,** in two layers: a tight, bright one (small kernel, luminance threshold 0.9) round lit panes, lamps and headlights, and a faint, wide halo (the largest kernel, threshold 0.97) round the brightest; one threshold-0.85 layer veiled whole façades. Fed a scene drawn without multisampling (as with SMAA), the mipmap blur turned one channel of the whole frame to NaN at some low perspective views at night, which the canvas shows as a frame in one or two colours, or black, while panning. The scene pass's output was clean there (checked for NaN, infinities and negatives); the glow pass's output was not, and with the Kawase blur it is, at the same views.
- **Tilt-shift is one of the composer's passes** (two blur passes, the same shader). The view goes through the composer while a graphics setting needs it or the tilt-shift shows, on Standard too, with the canvas's 4× multisampling in the scene pass. three's composer and `OutputPass` are gone, and so is their colour fault.
- **The backdrop stays CSS behind the canvas.** The scene pass keeps the canvas's transparency, so no rim shows; this supersedes ADR-0072's "the diorama's backdrop is drawn in the canvas while effects are on".
- The composer is made inside an effect, not during render: `postprocessing`'s `dispose()` empties a composer, and React's strict mode cleans an effect up and runs it again. It turns the renderer's `autoClear` off; its cleanup turns it back on for R3F's own drawing.
- `scripts/shots.mjs` takes pictures and GPU times of the view for any graphics and world settings (on WSL through Windows' `node.exe`, on the real GPU), so changes to the composer are checked against Standard in pictures.

### Consequences

- Good: Standard, and the composer with no effect on, draw the same picture; the painted lights keep their colours with every setting; tilt-shift no longer shifts them; the backdrop needs no copy.
- Bad: one extra full-screen pass (the decode) whenever the composer draws; the scene pass relies on three's XR-target rule, which a three update could change (the pictures in `scripts/shots.mjs` would show it at once).
- Later: real night lights (ADR-0072) draw through the same scene pass.

## More information

Code: `src/render/Effects.tsx` (the composer, `SceneAsOnCanvasPass`), `src/render/TiltShift.tsx` (the blur shader and when it shows), `src/editor/graphics.ts` (presets and settings), `src/ui/GraphicsPreferences.tsx` (the page), `scripts/shots.mjs`. Related: ADR-0052, ADR-0058, ADR-0062, ADR-0070, ADR-0072.
