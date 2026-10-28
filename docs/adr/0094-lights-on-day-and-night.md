---
status: proposed
date: 2026-10-28
---

# 0094. Lights on day and night: traffic signals

## Context and problem statement

A part's lights come on by themselves after dark, or after dark while driving (ADR-0058). A traffic light's lamps are lit day and night, and take turns. A signal is also a natural way to show a status (red, amber, green from a value), so its lamps should be lights, with the Lights tab's colour, strength and data settings. The owner asked that they show lit by day without glowing in the sun.

## Decision drivers

- Lamps that are lit by day too, but glow only after dark (the owner, 2026-10-28).
- Data can set each lamp, like any light's "on" (ADR-0058, ADR-0019).
- On and off, and how bright, stay with `resolveLights`, not in the part.

## Considered options

1. **A signal setting** (Cycling / Red / Amber / Green) with lamps that aren't lights: simple, but data can't drive it (props don't follow data).
2. **Lights with a new `when: "always"`, and a cycle in the part** that picks which of the lit lamps shows.
3. **Lights set to Always by each object:** "on" glows at full strength by day, and every new traffic light would need its three lamps set.

## Decision outcome

Chosen option: **2**.

- A light spec can say `when: "always"`: by itself it's on day and night, at `DAYLIGHT_LEVEL` (0.2) of its strength by day, rising to full as it gets dark (`parts/lightModel`). Drawn with `lightEmission`, a lit lamp shows its colour by day and glows at night. Off, scheduled or from data, it behaves as any light.
- The Lights tab calls its default **Day and night** ("Like a traffic signal: lit by day, glowing after dark."), and doesn't offer "Comes on" for it, which it has no use for. **Always** remains: glowing fully, by day too. `/schema.json` says "on day and night".
- The traffic light (`traffic_light_01`) has Red, Amber and Green lights. While it **cycles through its signals** (its default), the part shows each lit lamp in its part of the cycle: green, amber, then red, over **Seconds per cycle**, with a **Head start** so two lights at a crossing can take opposite turns. The cycle runs on the motion clock, so pausing holds it. With cycling off, each lamp shows while its light is on: that's how data sets the signal.

### Consequences

- Good: a status light from data with nothing new in the data model: each lamp's "From data" switch.
- Good: any later part with lights lit by day (a shop's sign, a beacon) can use `when: "always"`.
- Bad: the cycle decides which lamp shows, so a part does choose here, on top of `resolveLights`; with data driving the lamps, cycling must be switched off, which the part's description says.
- Later: the signal from one value (a status of red, amber or green, or a number on thresholds) instead of three switches, once props or parts can follow data more generally.
