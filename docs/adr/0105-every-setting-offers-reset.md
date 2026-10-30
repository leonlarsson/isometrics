---
status: proposed
date: 2026-10-30
---

# 0105. Every setting offers Reset, and the kit makes sure of it

## Context and problem statement

Inherited values (ADR-0027) gave a field Default / From scene and Reset, and the owner asked (2026-10-25) for that on every setting, plain defaults and switches included ("why doesn't fov have a reset button? Everything should offer a reset"). By 2026-10-30, 97 fields still had none (a ground's width and depth, a road's curves, an object's size and turn, the label card's switch…), because `inherit` was an optional prop that was easy to forget.

## Decision drivers

- Every setting can go back to what it was, in one click, with its default named.
- A new field can't forget it.
- Values that are only ever their own (where something stands, which data value a binding follows, a search) aren't forced into a meaningless Reset.

## Considered options

1. Add `inherit` where it's missing, and remind people in AGENTS.md.
2. Make it required: every settings field in the kit takes either `inherit` or `hasNoDefault`, so the type checker lists every field that has neither.

## Decision outcome

Chosen option: **2**.

- The kit's settings fields (`SliderField`, `SwitchField`, `SelectField`, `ColorField`, `NumberField`, `TextField`, `VectorField`, `PeriodsField`, `ComboboxField`, `CheckboxGroupField`, `RadioGroupField`, `SplitField`) take `TResettable`: `inherit`, or `hasNoDefault` for a value with nothing to go back to. `Field` itself, for custom controls, keeps it optional.
- `resetToDefault(value, fallback, onReset, shown?)` makes the usual one: Default while the value equals its default, Reset otherwise, the default in words for Reset's tooltip (on / off, a number, a list) unless `shown` says better. `resetsAgainst(thing, defaults, write)` makes them for a record's settings against a new one's: `inherit={reset("cornerRadius")}`.
- Defaults are what a new thing has (its schema's defaults, a part's prop defaults, a new world's settings), or what it depends on: an object's altitude goes back to standing on the ground under it (ADR-0098), a road's width to its kind's, a raised area's height to its kind's starting height, a corner or peak to the area's height (From area).
- `hasNoDefault`: positions, a thing's kind (what it is, chosen when drawn: Reset would turn a lake into grass), which data value a binding follows, and the worlds list's search.
- In a tight spot (a bar, a panel's header) the inherit says `isCompact`: no Default tag, and Reset as its icon with its tooltip (the paint bar; the label card's Show switch).
- Filters, modes and shortcuts (chip groups for categories, Paint / Erase, a slider's presets) aren't settings and have no Reset.

### Consequences

- Good: every setting in the properties, the dialogs and the paint bar offers Reset; forgetting one fails `pnpm typecheck`.
- Bad: a little more to write per field, kept short by the helpers.

## More information

ADR-0027 (inherited values), ADR-0104 (the world's defaults), `ui/fields/InheritAction.tsx`.
