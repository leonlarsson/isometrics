---
status: accepted
date: 2026-10-23
---

# 0035. An outliner above the inspector; hide and lock are saved with the world

## Context and problem statement

A full world has dozens of objects, roads and areas, and the only way to reach one was to find and click it in the scene (or, for roads and areas, a plain list in the Scene tab). Small or covered things were hard to select, nothing could be renamed without selecting it first, and there was no way to hide clutter while working on something behind it.

## Decision drivers

- Work like Blender, which many users of 3D tools know: the outliner on top, the selection's settings below.
- Hiding and locking should survive a reload and travel with the file; they're part of how a world is set up, not a passing view state.
- Keep the scene usable on phones (ADR-0030).

## Considered options

1. Outliner on top of the right column with a draggable divider, inspector tabs below.
2. A tab next to Add to scene in the left column.
3. A tab in the inspector.

## Decision outcome

Chosen option: **1** (the owner asked for Blender's layout).

- **Layout:** in the wide layout the right column is the outliner (resizable height, persisted per browser like the inspector width) over the inspector. Only its list scrolls; the heading, search and "only things that show data" filter stay put, and group names stick to the top of the list. In the narrow layout it's a **List** tab in the bottom sheet.
- **Rows:** grouped by part category (palette order), then Roads and Areas. Each shows its colour, its name (or the part, style or type when unnamed), its first data value, and eye and lock buttons. Click selects, double-click or F2 renames in place, and hovering a row outlines its item in the world. The Scene tab's road and area lists highlight on hover too.
- **Data:** `hidden` on objects, roads and areas, and `locked` on roads and areas (objects already had it), all `false` by default so old worlds load unchanged (ADR-0026). Hidden items aren't drawn (an object's label card neither), vehicles can't be dropped onto a hidden road, and vehicles already on one keep driving. A locked road or area keeps its shape: no point handles. The hovered row is runtime state (`hovered`), never saved.
- **Keys:** H hides the selection or shows it again (it stays selected, so H toggles), Alt+H shows everything again, F frames the selection with the camera (a driving vehicle frames its route).
- **Kit:** `ListItem` gained `rename`, `muted` and `onHover`, so any list can rename in place and highlight what it lists.

### Consequences

- Good: everything is reachable and nameable from one place, and clutter can be hidden without deleting it.
- Good: hide and lock are in the file, so a world opens the way it was left, and an AI writing a world can use them.
- Bad: the inspector is shorter by the outliner's height; the divider (and the cap that keeps 200px for the inspector) is the answer.
- The Scene tab's road and area lists now duplicate part of the outliner; they can go once the outliner has proven itself.

## More information

ADR-0025 (UI kit), ADR-0030 (narrow layout), ADR-0026 (repair on load). Code: `src/ui/Outliner.tsx`, `src/ui/List.tsx`, `src/render/HoverHighlight.tsx`, `src/editor/framing.ts`.
