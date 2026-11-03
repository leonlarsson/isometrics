---
status: proposed
date: 2026-11-03
---

# 0131. The welcome's three ways in: build a city, explore Brightwater, build with AI

## Context and problem statement

ADR-0116's welcome had three ways in: **Build a city** (New world on the places), **Show my data** (Build with your AI) and **Explore an example** (New world on the data maps). A later change pointed **Show my data** at New world with **Uses data** on. Three of the ways then opened the same dialog, differing only in a filter and a switch, and the welcome no longer offered building with AI at all. The owner (2026-11-03): Show my data can go; Build a city stays and opens New world, without "no data" on its tile; Build with AI is a tile of its own; Explore an example opens Brightwater.

## Considered options

1. Four tiles, each leading to New world or Build with AI with different settings.
2. Three tiles, each doing something different: New world, Build with AI, and one finished world opened straight away.

## Decision outcome

Chosen option: **2**, the owner's call.

- **Build a city:** New world on the places, **Uses data** off. Its tile says "Start from a blank world or a starter.", and its picture is Lantern Bay.
- **Explore an example:** Brightwater opened straight away as a world of the person's own (`startNewWorld`). On a first visit it takes the place of the unsaved starter behind the welcome.
- **Build with AI:** Build with AI, a new world. There's no world yet (it starts from words), so its picture is not a world. It's a small drawn prompt, with the AI answering under it (the sparkle and three dots), from the theme's tokens; it holds still when reduced motion is asked for. Its title has the sparkle before it in the accent colour (`ChoiceCards`' `titleIcon`), marking it as the way that starts from nothing.
- Showing data isn't a way in of its own. New world's **Uses data**, the Data tab (ADR-0127) and the data maps among New world's starters stay where they are.
- The tiles are in that order, Build with AI last (the owner, 2026-11-03).
- The README and the app menu's Welcome… description name the three.

### Consequences

- Good: each tile leads somewhere different, in one click.
- Good: building with AI is one click from the welcome again, under the name it has everywhere else.
- Bad: the data maps aren't shown from the welcome; they're one step further, in New world.

## More information

Supersedes the welcome's ways in from [ADR-0116](0116-first-run-guide-and-your-own-ai.md); the rest of ADR-0116 stands. `ui/Welcome.tsx`; `e2e/onboarding.spec.ts` checks each tile.
