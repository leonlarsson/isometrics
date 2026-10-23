---
status: accepted
date: 2026-10-23
---

# 0047. File → New world is a dialog: a blank world with settings, or a starter with a rendered picture

## Context and problem statement

The File menu had New empty world (always 40 × 30, the default theme and driving side) and a New from a template submenu that listed the starters by name only. Changing the ground size or driving side meant finding them in the Scene tab afterwards, and you couldn't see a starter before opening it. Photoshop's New Document dialog solves the same problem: presets with pictures on one side, settings on the other.

## Decision drivers

- One clear way in: blank and starters side by side.
- The settings that shape a world from the start are set before it opens.
- Pictures must never drift from the starters (as for part pictures, ADR-0036).
- Data is a core pillar (ADR-0019): show what data a starter brings.

## Considered options

1. Keep the menu items and add a settings step for blank worlds only.
2. A dialog with starter cards and a settings panel; pictures pre-rendered as PNGs and shipped.
3. The same dialog with pictures rendered in the browser from the starters themselves.

## Decision outcome

Chosen option: **3**.

- **Dialog:** File → New world… replaces both menu items. Cards on the left (`ChoiceCards`, a new kit component on Base UI's RadioGroup): **Blank**, then every template. The panel on the right has the name (the placeholder is the starter's title, or "Untitled world") and, for Blank, a ground size preset (Corner 24 × 18, Blocks 40 × 30, District 80 × 60, Town 120 × 90, each saying what it fits), theme and driving side; for a starter, its description and what it holds, data first ("14 data values on 7 label cards", objects/roads/areas, viewpoints, ground size). Create, or double-clicking a card, opens it as a new world beside the others (ADR-0044). Every card's panel is laid out in the same spot and only the picked one shows, so the dialog keeps one size whichever is picked. On phones the cards are two to a row with the panel underneath.
- **Ground presets, not sliders:** a bare "40 × 30" means little until you know how big a house is. The Blank card's picture follows the preset and shows a house, a tree and a car in the middle that stay the same size while the ground grows around them (they aren't in the world it creates). Any exact size is set later in the Scene tab.
- **Choices last the session:** the dialog keeps its picks while the page is open (it stays mounted in the File menu), but nothing is stored: they're quick to set again, and not worth a storage key.
- **Pictures:** `useScenePictures` (`src/render/scenePictures.tsx`) renders each world once per theme in an offscreen R3F root, like the part thumbnails: ground, areas, roads and objects where they stand when the world opens (driving vehicles at their start on the road), with the scene's lights and shadows, framed from the default angle. It starts when the dialog first opens, and cards show an empty picture frame until theirs arrives.
- **Render bodies:** to draw a world that isn't the open one, `RoadMesh` and `AreaMesh` are split into `RoadBody` / `AreaBody` (how it looks, from props alone) and the editor wrappers (selection, clicks, store). The scene's lights moved to `SceneLights`.
- **Kit:** `RadioGroupField` (one of a few options, all visible, each with a muted note), and `Dialog` takes an optional main action (`confirm`, with Cancel beside it) and `wide` for two columns.

### Consequences

- Good: settings up front, starters you can see, and nothing to maintain: a new template gets its card and picture automatically.
- Good: the road and area bodies can render any world, e.g. future previews of saved worlds or files.
- Bad: the first opening renders the pictures (a second or two on a software renderer, much less on a GPU), briefly using a second WebGL context.
- Bad: no label cards in the pictures (they're DOM, ADR-0008).

## More information

`src/ui/NewWorldDialog.tsx`, `src/ui/ChoiceCards.tsx`, `src/render/scenePictures.tsx`, `src/render/RoadMesh.tsx`, `src/render/AreaMesh.tsx`, `src/render/SceneLights.tsx`, `src/templates/empty.ts`. Related: ADR-0036 (part thumbnails), ADR-0044 (several worlds), ADR-0019 (data).
