---
status: proposed
date: 2026-10-26
---

# 0076. A colour grade on the finished picture

## Context and problem statement

The render lab's colour grade (saturation, contrast, a vignette) gave its Ultra pictures much of their richness, but on a real GPU it turned saturated colours black (ADR-0072: the gold tower, yellow cars). It graded before tone mapping, on high values, and pushed some channels below zero. The top graphics setting should have a grade (ADR-0072: zero holding back), without that fault.

## Decision drivers

- No colour may come out black or wrong: Standard's colours are the reference.
- Night should read warmer round lights and cooler in the shade, as photographs of towns at night do.
- Opt-in, per browser.

## Considered options

1. **postprocessing's HueSaturation and BrightnessContrast effects** (the lab's way, before tone mapping).
2. **A grade pass of our own at the end of the composer**, on the tone-mapped picture in display (sRGB) values, clamped at each step.
3. **A colour lookup table** (LUT): flexible, but needs authored tables per theme and time of day.

## Decision outcome

Chosen option: **2**.

- A graphics setting, **Colour grade** (`useColorGrade`; Ultra on). When on, the composer runs and its last effect before SMAA is the grade (`render/Effects.tsx`): saturation ×1.14 round each pixel's luminance, contrast ×1.08 round mid-grey, a soft round vignette, and with the time of day's darkness shadows towards a cool blue and lit areas towards warm.
- It works on the finished, tone-mapped picture converted to display values, and clamps to zero after each step, so no colour can go below black.

### Consequences

- Good: richer colour by day, depth from the vignette, warm lights against cool shade at night; saturated colours stay as they are.
- Bad: one more full-screen pass; the look is fixed (no per-world grading).
- Later: a LUT per theme or a per-world grade, if worlds want their own look.

## More information

Code: `src/render/Effects.tsx` (`colorGradePass`), `src/editor/graphics.ts`, `src/ui/GraphicsPreferences.tsx`. Related: ADR-0072, ADR-0073.
