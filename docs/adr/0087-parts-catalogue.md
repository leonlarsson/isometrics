---
status: accepted
date: 2026-10-27
---

# 0087. A public parts catalogue at /parts

## Context and problem statement

A library of hundreds of parts is planned (TODO), written in batches. Each new part has to be checked in both themes, by day and at night with its lights on, and with its settings, colours and lights changed. People (and AIs writing worlds) need a way to see what parts there are, what each looks like, and what colours, lights and settings it has, without adding each one to a world. `/schema.json` (ADR-0034) lists the parts as data, without pictures; `/kit` (ADR-0025) is for the UI kit and dev only.

## Decision drivers

- Reviewing a batch of new parts at a glance: every part, both themes, day and night.
- A catalogue for people and AIs: what each part is called, looks like, and has, with the names a world's file uses.
- No pictures to keep up to date by hand: they're drawn from the parts themselves, like the panel's (ADR-0036).

## Considered options

1. **Dev only, like /kit:** a review page, left out of the production build.
2. **A public catalogue:** the same page in production, linked from the app.

## Decision outcome

Chosen option: **2, public** (the owner's choice, 2026-10-27).

- `/parts` (`routes/parts.tsx`, `ui/PartsCatalogue.tsx`): a search (names, kinds, categories, descriptions and search words), the categories as chips with counts, and switches for the theme and the time of day (the page wears the theme it shows; it starts in the device's). A grid of cards: a picture, the name, what it is and its kind.
- A part's details (`?part=<kind>`, so they can be linked): the part turning and its four looks (light and dark, by day and at night), its kind (with a copy button), category, size and whether it can drive along roads. Below, the editor's own panels for its settings, colours and lights, to try it out: the same components as the properties (`ui/PartSettings`: `PartShapeSection`, `PartColorsSection`, `PartLightCards`, which take an object's settings and an `onChange`, so the inspector commits a change to the world and the catalogue keeps it in the page), each setting saying what a world's file calls it. The panels start folded each time and don't remember being opened (`Section`'s `remembersOpen`). With no data here, From data is greyed out ("no values yet"); by day it's 12:00 and at night 22:00, for lights on a schedule.
- What's been changed is kept in the link (`&settings=`, an object's `props`, `colors` and `lights`, read through their schemas), so a link shows the part as set up. Reset all puts it back as it comes. Copy as JSON copies it as the editor copies an object (ADR-0068): Ctrl+V in a world adds it, and the object inside is what a world's file holds.
- The turning model and the four looks show the changes; the looks are rendered for the open part on their own (shortly after a change settles), not with the rest of the catalogue's pictures.
- The details take focus themselves when they open (the kit `Dialog`'s `initialFocus="dialog"`), so no button's tooltip pops up.
- `ChipGroup` joins the UI kit (ADR-0024): a row of chips, one chosen, on Base UI's ToggleGroup. The Add to scene panel's categories will use it too.
- The Add to scene panel links to it under its search, always in sight, opening a new tab.

### Consequences

- Good: a new part shows up in the catalogue, with pictures, by being in `PARTS`.
- Good: one place to answer "what's in a part?" for people, and the kinds and ids for anyone writing a world; and to try a part out before adding it.
- Good: the settings panels are one set of components, so the catalogue and the properties can't drift apart.
- Bad: it renders 19 pictures per look it's shown in (more as the library grows); they come in one by one, in idle moments, so the page stays usable.

## More information

Follows the *A big library of parts* item of the TODO. The pictures' renderer now registers three's classes with R3F itself (`extend`), since on this page it can run before any canvas has.
