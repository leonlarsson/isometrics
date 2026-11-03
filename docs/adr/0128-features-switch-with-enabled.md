---
status: proposed
date: 2026-11-03
---

# 0128. A feature's on/off switch is `enabled`

## Context and problem statement

Features with an on/off switch and settings of their own were groups with `isOn` (ADR-0104): the world's data (`data.isOn`, ADR-0115), a road's flow (`flow.isOn`, ADR-0112), the turntable and tilt-shift (`camera.turntable.isOn`, `camera.tiltShift.isOn`, ADR-0062). The owner (2026-11-03): one word for all of them, and `enabled` says it more clearly for a feature; `isOn` reads like a light's switch (and lights do have their own `whenOn`).

## Decision drivers

- One word, the same for every feature, now and to come.
- Every world ever saved keeps its switches (ADR-0106): a renamed field is converted on load, never lost.
- People and AIs writing worlds read the new word in `/api/worlds/schema`, the guide and the prompt.

## Considered options

1. `enabled` for every feature's switch, older `isOn` converted on load.
2. Keep `isOn`.
3. `isEnabled`, closer to the `is…` rule for states.

## Decision outcome

Chosen option: **1**, the owner's choice.

- `data.enabled`, a road's `flow.enabled`, `camera.turntable.enabled`, `camera.tiltShift.enabled` (and each mood's `tiltShift.enabled`, ADR-0078). Same meanings and defaults as before.
- `upgradeLegacyIds` (`scene/legacy.ts`) renames `isOn` to `enabled` in each of them, and the older names point at the newest: `turntableOn` and `tiltShiftOn` (and a group saved as a bare boolean) go straight to `enabled`. A value already under `enabled` wins. A patch is applied to the world and then read like any world, so an AI's patch saying `isOn` arrives too, unless the world's own `enabled` is under it.
- A new every-field old world (`every-field-500c046.json`, the format just before) has each switch set away from its default; `parts/repairWorld.test.ts` checks they arrive.
- AGENTS.md: a feature with an on/off switch and settings of its own is a group with `enabled: boolean`, every one of them.

### Consequences

- Good: one word for every feature's switch, and it says what it does.
- Bad: the conversion stays for good, as every rename's does; tools written against the old field names read `enabled` from now on.

## More information

`scene/schema.ts`, `scene/legacy.ts`, `src/scene/fixtures/old-worlds/every-field-500c046.json`, `parts/repairWorld.test.ts`, AGENTS.md. Changes that word of ADR-0104, ADR-0062, ADR-0112 and ADR-0115.
