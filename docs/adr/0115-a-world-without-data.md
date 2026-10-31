---
status: proposed
date: 2026-10-31
---

# 0115. A world can turn data off, and then nothing about data shows

## Context and problem statement

Data is a core pillar (ADR-0019), so the editor offers it everywhere: a Data tab for the world and for each thing, **From data** in every setting that can follow a value, values on cards, tiles and a story bar in View mode. Some people only want to build a city. For them all of that is noise, and "no values yet" notes on every tab say they're doing something wrong.

## Decision drivers

- People who want a city builder shouldn't meet data at every turn.
- Never discard user data (ADR-0020): turning data off mustn't lose a world's values, tables, sources or bindings.
- It's a choice about the world (a plain city, or a map of data), and should travel with it: a world file opened elsewhere looks the same.
- One switch, not a setting per panel.

## Considered options

1. A preference in this browser (Preferences), hiding data in every world.
2. A setting of the world, `data.isOn`.
3. Hiding data only while a world has none.

## Decision outcome

Chosen option: **2, a setting of the world**, because it says what kind of world it is, and travels with it. Option 3 would hide the way in for people who want data (AGENTS.md: don't hide what isn't available yet); option 1 makes the same file look different in two browsers.

`data.isOn` (default `true`, so every saved world is as it was) is the World tab's **Uses data** switch, and a choice for a blank world in File → New world (and the welcome's Build a city, ADR-0116). Off:

- the Data tabs (the world's and every thing's) are gone, **From data** isn't offered (settings show their hand field only: `DataDrivenField`, lights' Turns on, Time follows), and the notes about data say nothing;
- cards show their titles only, the detail sheet its description, roads don't open a flow sheet, and View mode has no tiles, story bar or Map / Data switch; the outliner has no "Only things that show data";
- things are drawn as set by hand: the world's data reads as empty (`useWorldData`, `worldDataNow`), so bindings fall back as they do without values, and links and APIs aren't read;
- the values, tables, sources and bindings stay in the world, and come back when it's on again.

### Consequences

- Good: a plain city builder with one switch; nothing lost; old worlds unchanged.
- Good: hiding follows a few shared pieces (`useUsesData`, `DataDrivenField`, `FollowDataNote`, the inspector's tab list), so new data UI built from them hides by itself.
- Bad: data UI that doesn't go through those pieces has to check `useUsesData()` itself.
- Bad: a setting picked as From data before turning data off shows its hand value while off, which can differ from what the data drew.

## More information

`scene/schema.ts` (`WorldDataSchema.isOn`), `editor/worldData.ts` (`useUsesData`, the empty data while off), `ui/Inspector.tsx` (`DATA_TABS`), `ui/WorldTabs.tsx`, `ui/NewWorldDialog.tsx`. ADR-0019 (data as a pillar), ADR-0107 (the world's data).
