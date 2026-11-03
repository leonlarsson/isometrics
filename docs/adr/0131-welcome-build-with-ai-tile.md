---
status: proposed
date: 2026-11-03
---

# 0131. The welcome has four ways in: Build with AI is a tile of its own

## Context and problem statement

ADR-0116's welcome had three ways in, with **Show my data** going to Build with your AI. A later change pointed **Show my data** at New world with **Uses data** on instead, so a person could build a data world by hand; building with AI became an option inside New world. That left **Build a city** and **Show my data** opening the same dialog with one switch apart, and the welcome no longer offered building with AI at all. The owner (2026-11-03): make Build with AI a tile of its own, and keep Show my data as it was.

## Considered options

1. Show my data opens Build with AI again (ADR-0116 as written).
2. Show my data starts from the data (a blank world, straight to adding data), with Build with AI its own tile.
3. Build with AI its own tile; Show my data stays New world with data on.

## Decision outcome

Chosen option: **3**, the owner's call.

- The welcome (`ui/Welcome.tsx`) has four tiles: **Build a city** (New world on the places, **Uses data** off), **Show my data** (New world, every starter, **Uses data** on), **Build with AI** (Build with AI, a new world; its picture is Shape Castle) and **Explore an example** (New world on the data maps).
- New world keeps its own **Build with AI…**; the File menu's Build with AI is unchanged.
- The README, the guide and the app menu's Welcome… description name the four.

### Consequences

- Good: building with AI is one click from the welcome again, under the name it has everywhere else.
- Bad: Build a city and Show my data still open the same dialog, differing in the switch and the starters shown.

## More information

Supersedes the welcome's ways in from [ADR-0116](0116-first-run-guide-and-your-own-ai.md); the rest of ADR-0116 stands. `e2e/onboarding.spec.ts` checks each tile.
