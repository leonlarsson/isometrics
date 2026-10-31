---
status: proposed
date: 2026-10-31
---

# 0114. Stories: a time slider plays the world through its dated values

## Context and problem statement

The owner wants worlds for stories as well as live screens: a world that explains a year. Values and tables already keep the past their sources gave (ADR-0107). Nothing showed the world as it was on a date.

## Decision drivers

- Everything that shows or follows data must follow the date, with no code of its own (bindings by key, ADR-0058, ADR-0108).
- Runtime only: a story never changes the world or makes undo steps.
- Honest: before a value's past starts there's no data, not its first value.

## Considered options

1. Moods or viewpoints that hold copies of values per chapter.
2. A date in the runtime that the data readers apply.

## Decision outcome

Chosen option: **2**. `scene/story.ts` lists every date the data has (`storyDates`) and gives the data as it was on one (`worldDataAt`): each value its last point by then and its past up to then, each table its last rows by then; values whose past starts later are left out and tables emptied (**no data**); values without a past stay as they are. `useWorldData()` and `worldDataNow()` apply the story's date in View mode (`editor/story.ts`, runtime), so cards, tiles, sizes, colours, lights, flows and the time of day all follow it.

In View mode, when the data has two dates or more, the **story bar** (bottom right) has Play / Pause (a date every 0.9 s, stopping at the last), a slider over the dates labelled with the date shown, and **Now**. Cards say the date while a story shows one. Leaving View mode goes back to now. Keeping what arrived keeps it as it is now, whatever date a story shows.

Viewpoints or moods as chapters are left for later.

### Consequences

- Good: any world with dated values is a story with no setup; clusters grow and shrink as the months pass.
- Bad: each step renders everything that follows data; fine for tens of things, to be measured for thousands.

## More information

`scene/story.ts`, `editor/story.ts`, `editor/worldData.ts`, `ui/StoryBar.tsx`, ADR-0107, ADR-0110.
