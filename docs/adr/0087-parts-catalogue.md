---
status: proposed
date: 2026-10-27
---

# 0087. A public parts catalogue at /parts

## Context and problem statement

A library of hundreds of parts is planned (TODO), written in batches. Each new part has to be checked in both themes, by day and at night with its lights on, and people (and AIs writing worlds) need a way to see what parts there are, what each looks like, and what colours, lights and settings it has, without adding each one to a world. `/schema.json` (ADR-0034) lists the parts as data, without pictures; `/kit` (ADR-0025) is for the UI kit and dev only.

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
- A part's details (`?part=<kind>`, so they can be linked): the part turning, its four looks (light and dark, by day and at night), its kind (with a copy button), category, size and whether it can drive along roads, then its colours (with each one's id and default, or that it follows the theme), lights (what each is and when it comes on, with its id) and settings (what each can be and its default, with its prop name). It points to `/schema.json` for the same parts as data.
- The pictures come from the panel's renderer (`render/thumbnails`), now for any size and look: a theme, by day or at night (`palette.night` at 1, so the parts' lights are on, under a dim moonlight). Each set renders once per page, offscreen, in idle moments.
- `ChipGroup` joins the UI kit (ADR-0024): a row of chips, one chosen, on Base UI's ToggleGroup. The Add to scene panel's categories will use it too.
- The Add to scene panel links to it under its search, always in sight, opening a new tab.

### Consequences

- Good: a new part shows up in the catalogue, with pictures, by being in `PARTS`.
- Good: one place to answer "what's in a part?" for people, and the kinds and ids for anyone writing a world.
- Bad: it renders 19 pictures per look it's shown in (more as the library grows); they come in one by one, in idle moments, so the page stays usable.

## More information

Follows the *A big library of parts* item of the TODO. The pictures' renderer now registers three's classes with R3F itself (`extend`), since on this page it can run before any canvas has.
