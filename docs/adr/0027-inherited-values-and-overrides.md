---
status: accepted
date: 2026-10-22
---

# 0027. Inherited values and overrides look the same everywhere

## Context and problem statement

Many settings have a value that comes from somewhere else until the user changes it: an object's colour comes from its part (per theme), a road's from its style, the ground's from the theme, a road point's width from its road, and how vehicles turn from the scene, then the road. Each field showed this differently: colour and width fields had a "Default" link that only appeared after a change, while the turns selects had an extra "Like the scene (smoothly)" option. Users couldn't tell at a glance which values were their own.

## Decision drivers

- Make it obvious whether a value is inherited or set here, and where an inherited value comes from.
- One way to go back to the inherited value.
- No special options or modes inside controls.

## Decision outcome

In the scene document an inherited value is stored as `null` (the parent's value applies). In the UI every such field takes an `inherit` prop (`IInherit` in `src/ui/fields.tsx`) and follows one pattern:

- The control always shows the **value in effect**, inherited or not.
- While inherited, the label row shows a muted tag naming the source: **Default** (part, style or theme defaults), **From scene**, **From road**, …
- Changing the control sets an override. The tag then becomes **↺ Reset**, whose tooltip says what it goes back to ("Back to the scene's setting (smoothly)").

Fields with `inherit`: `SliderField`, `NumberField`, `SelectField`, `ColorField` (and `Field` for custom controls). Today: entity, road, area and ground colours; road point width; turns on roads and vehicles. New inheritable settings use the same prop.

Labels that merely refer to another setting show its current value instead of describing it (e.g. "In lanes (keep right)", not "on the scene's side").

### Consequences

- Good: users see which values are their own and where the others come from; resetting works the same everywhere.
- Good: selects keep only real choices.
- Bad: inherited fields always carry a small tag, a little more visual weight in long panels.

## More information

- Related: ADR-0025 (UI kit), ADR-0023 (road width per point).
