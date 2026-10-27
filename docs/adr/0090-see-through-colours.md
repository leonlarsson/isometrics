---
status: proposed
date: 2026-10-27
---

# 0090. See-through colours: a transparency setting for glass

## Context and problem statement

Some parts have glass with something behind it (the greenhouse, and pavilions, shelters and conservatories to come). How see-through it is was fixed in the part. People want to set it, like a colour.

## Decision drivers

- Only where it means something: a see-through wall or car body isn't an option anyone wants, and see-through things can't be drawn together with their copies (ADR-0086), so they cost more.
- Colours stay `#rrggbb` everywhere: the world format, the colour field and its names (ADR-0089), colours from data and their scales, copy and paste.
- Like every other setting: Default and Reset, saved worlds unchanged, in `/schema.json`, and able to follow data later.

## Considered options

1. **RGBA colours:** an alpha in every colour.
2. **A part prop** (`glassTransparency`) on each part with glass.
3. **A setting of the colour, for colours a part marks see-through.**

## Decision outcome

Chosen option: **3**, because it's where the setting belongs (it's the glass's), it's offered only where it means something, and it leaves colours as they are.

- A part marks a colour `seeThrough: { transparency }` in its `colors` (ADR-0060): see-through, this much until set (0 solid, 1 clear).
- An object's setting for a colour gains `transparency` (null while it's the part's, ADR-0027), next to `color` and `data`; it's ignored for colours that aren't see-through. Saved worlds have none, so they look as they did.
- Parts get `transparency` by colour id in their render props, beside `colors` (`resolveTransparencies` in `parts/colorModel`), and draw the glass with an opacity of 1 − transparency.
- The Look tab (and the panel for several selected objects) shows a **Transparency** slider (0–100%) under a see-through colour's Colour field, with Default and Reset. `/schema.json` says which colours are see-through and their default.
- The greenhouse's Glass is the first, at 65% by default (as it was).

### Consequences

- Good: glass can be set like any colour, without RGBA anywhere; new glass parts get it by marking the colour.
- Good: copy and paste of colours, data renames and the catalogue's try-out carry it, since it's part of the colour setting.
- Bad: one more field in a colour setting, only meaningful for some colours.
- Later: transparency from data (a greenhouse that frosts over), as `data.transparency` in the same setting.

## More information

`src/parts/types.ts` (`IColorSpec.seeThrough`), `src/parts/colorModel.ts`, `src/scene/schema.ts` (`EntityColorSchema.transparency`), `src/ui/PartSettings.tsx`, `src/parts/buildings/greenhouse_01.tsx`. Extends ADR-0060.
