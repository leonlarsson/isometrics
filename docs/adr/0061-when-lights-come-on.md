---
status: accepted
date: 2026-10-24
---

# 0061. Lights switch on at once or gradually, or on a schedule

## Context and problem statement

Every light followed the world's darkness (`night`, 0 at 17:00 to 1 at 21:30, back down 04:30–08:00) as its brightness, so street lamps and headlights glowed faintly for hours before they were fully on, and every light in the world changed together. Real lamps switch on at once when it's dark enough (a light sensor), and many lights run on timers (a home's lights 05:00–08:00 and 19:00–00:00, offices until 22:00). This extends the shared lights system (ADR-0058).

## Decision drivers

- Lights look real by default, with no settings needed.
- One setting per question, consistent with the Lights tab (ADR-0058) and inherited values (ADR-0027).
- Old worlds keep opening (ADR-0026, ADR-0056); no extra re-renders while a day runs.

## Considered options

1. Per light: *Comes on: At once / One by one / Gradually* for after-dark lights, and a new When option, *On a schedule*, with a list of periods like a timer.
2. A global world setting for gradual or not, and darkness thresholds per light instead of times.

## Decision outcome

Chosen option: **1**.

- **Comes on** (`comesOn` per light, null = the part's, and `comesOn` on the light spec, "atOnce" unless a part says otherwise), for lights after dark and on a schedule alike:
  - *At once* switches fully on once it's dark enough (a darkness of 0.3), every such light at the same moment. Grouping is the user's, not the app's: lights meant to switch at other times (one street before another, houses at different moments) get a schedule. A window light at once switches all its lit panes together.
  - *One by one* (window lights only; the office tower's default): panes light up one after another as it gets darker, none until a darkness of 0.1 and all of its lit panes by 0.6, each at full brightness, like people coming home.
  - *Gradually* fades in with the darkness, as before.
- **On a schedule** (mode `schedule`, with `schedule`: a list of `{ from, until }` in hours, 0–24): on during its periods, like a timer; a period that ends before it starts runs past midnight (22–2). Comes on applies here too: *at once* is fully on for each whole period, exactly at its times, so lights with the same schedule switch together, like lamps on one timer; *one by one* lights windows over a period's first hour and darkens them over its last (people arriving and going home); *gradually* fades in over the first hour and out over the last. It needs a time of day to run: without one it can still be set up, its hint says it stays off until a time is picked in Sun & sky, and the Lights tab's "It never gets dark here" note offers Open Sun & sky. The world's hour reaches React in 10-minute steps (`useSceneHours`), which objects already re-render on.
- **Settings:** in the Lights tab's *Turns on* group, *Comes on* shows for After dark and On a schedule, and *On between* (`PeriodsField`, new in the kit: a row per period with 24-hour times that are never rewritten while being typed, Add period, and a 24-hour strip where a period's bar can be dragged to move it, its ends to change it, and an empty part to add one, in quarter hours; the drag maths is in `ui/fields/periods.ts`, with tests) for On a schedule, with a hint saying whether it's on now.
- Data switching stays as it was: on or off, day and night, no fade.

### Consequences

- Good: lamps, headlights and windows behave like real ones by default; timers cover homes, offices and shops.
- Bad: worlds look different at dusk than before (lights snap on instead of fading); Gradually brings the old look back per light.

## More information

`src/parts/lightModel.ts` (`resolveLight`, `inPeriod`), `src/ui/LightSettings.tsx`, `src/ui/fields/PeriodsField.tsx`, `src/scene/schema.ts` (`TimePeriodSchema`, `EntityLightSchema`). Related: ADR-0027, ADR-0052, ADR-0058.
