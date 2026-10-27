---
status: accepted
date: 2026-10-27
---

# 0089. Colours are named, not only shown

## Context and problem statement

Colours are everywhere in the editor: every part's colours, lights, the sky, the backdrop, data colour scales. The colour field showed a swatch and a hex code, and its preset swatches only their colour, with no tooltip. People with colour blindness (the owner among them) can't tell many of them apart, and a hex code doesn't say what a colour is.

## Decision drivers

- Everyone can tell which colour is which, and which one is chosen, without seeing the difference.
- One place to do it: every colour in the app goes through the kit's `ColorField`.

## Considered options

1. **Name every colour:** presets get names, and any colour is described in words.
2. **Tooltips with the hex code on the presets.**
3. **Patterns on the swatches** (stripes, dots).

## Decision outcome

Chosen option: **1**, because a name says what a colour is; a hex code or a pattern doesn't.

- **Presets** (`SWATCHES` in `scene/theme.ts`) each have a plain name ("Blue", "Teal green", "Red-orange", "Dark grey"), shown in a tooltip and in the swatch's accessible name ("Use teal green (#2bb58c)"). The chosen one carries a tick on a badge, not only a ring. A test checks every preset's name is different.
- **Any colour** is described in a few words (`describeColor` in `scene/colorNames.ts`): its hue family ("orange", "teal", "pinkish red"), how light it is ("dark", "light", "pale"), greyness, and browns, beiges, creams, greys, white and black by name. Rough on purpose; tested.
- **The colour field** shows the name before the hex code ("Beige #e8c9a0"), the hex giving way first when the field is narrow, and its popover's free colour row names the colour too.
- **Convention:** a colour shown anywhere comes with its name; state is never shown by colour alone (pair it with text, an icon or a shape).

### Consequences

- Good: every colour setting (parts, lights, sky, data scales) is readable without telling colours apart, from one component.
- Bad: names are approximate; a colour near a boundary may get either neighbour's name.

## More information

`src/ui/fields/ColorField.tsx`, `src/scene/colorNames.ts`, `src/scene/theme.ts`.
