---
status: accepted
date: 2026-10-24
---

# 0060. Colours are a shared system like lights, and can follow data

## Context and problem statement

A part's colours were spread over four fields of its definition (`defaultColor`, `defaultAccent`, `colorLabel`, `accentLabel`, with `"Unused"` meaning "no second colour"), and objects stored exactly two, `color` and `accent`. A part couldn't have a third colour without a one-off field type, and colours couldn't follow data, although data is a core pillar (ADR-0019) and colouring things by a value (a heatmap of occupancy) is one of the clearest ways to show it. Lights had just become a shared system with data bindings (ADR-0058), so colours should work the same way and reuse its pieces.

## Decision drivers

- One model for every part, with as many colours as it needs, named for what they paint.
- Colours can follow data, through the same bindings as lights.
- Old worlds keep their colours (ADR-0026, ADR-0056), and the format stays clear for AIs (ADR-0034).
- Shared code: the settings, the data note and the binding plumbing are written once.

## Considered options

1. A `colors` map by colour id on objects, parts declaring a list of colours (like lights).
2. Keep `color`/`accent` on objects and add a map only for extra colours and data.

## Decision outcome

Chosen option: **1**.

- **Parts declare their colours** (`colors: IColorSpec[]` in `definePart`): an id named for what it paints (`roof`, `facade`, `livery`), a name for the Look tab and a default (hex, or from the theme). The first is its main colour (label pins, swatches). Parts draw with `colors.<id>`, typed from the ids they declare. The old fields and the `color` field type are gone.
- **Objects store a setting per colour, by id** (`entity.colors`, `EntityColorSchema`): `color` (null = the part's) and `data`, a map by setting like a light's (`{ "color": binding }`). Only colours that differ are stored.
- **Old worlds:** `color` and `accent` stay in the format, read for the colour whose `legacy` names them (each part's first and second), until `colors` sets it. Setting or resetting that colour in the Look tab moves the value over and clears the old field, so Reset goes back to the part's. Old-world tests check every object keeps its colours.
- **Data:** a colour binding reads a value holding a CSS colour as it is, and places a number on a colour scale: `lowColor` at `low` (0) and `highColor` at `high` (100), mixed in between (new binding options, defaults green #2bb58c and red #e0483b). Lights' colour bindings get the scale too. `parts/colorModel.ts` resolves each colour: data, else as set, else the old field, else the part's default.
- **Shared pieces,** used by lights and colours alike, and by anything that follows data next:
  - `DataDrivenField`: Source (By hand / From data, greyed out without data values) and then the hand field or `DataBindingFields`.
  - `FollowDataNote`: the "… can follow data" note, while the world has no values, with Open the Data tab.
  - `bindingMapsOf` (`scene/dataBindings.ts`): every binding on an object, for data renames and deletes and for redrawing when a value changes.
- **Look tab:** a group per colour (`FieldGroup`, titled with its name): Source, then Colour, or the data value with Low value, Low colour, High value and High colour, and a hint saying the colour now.
- `/schema.json` lists each kind's colours with their defaults and explains the map and colour data with examples; the templates write `colors` (`paint()` in `templates/paint.ts`).

### Consequences

- Good: any part can gain a colour by adding it to its list; colours can show data, including heatmaps.
- Good: lights and colours share the data UI and plumbing, so the next data-driven setting is mostly wiring.
- Bad: `color` and `accent` stay in the format as read-only fields for old worlds.

## More information

`src/parts/colorModel.ts`, `src/parts/dataBinding.ts`, `src/scene/dataBindings.ts`, `src/ui/DataDrivenField.tsx`, `src/ui/FollowDataNote.tsx`, `src/ui/DataBindingFields.tsx`, `EntityInspector.tsx` (LookTab). Related: ADR-0019, ADR-0026, ADR-0027, ADR-0034, ADR-0056, ADR-0058.
