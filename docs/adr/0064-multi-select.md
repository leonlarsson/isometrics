---
status: accepted
date: 2026-10-25
---

# 0064. Selecting several things at once: an active item and the rest

## Context and problem statement

Only one object, road or area could be selected. Moving a street together with its houses, turning a row of lamps, hiding a district or giving ten buildings the same colour meant doing it one by one. Selection is runtime state (never saved, ADR-0003), and a lot of code reads "the selected object" (the inspector, the gizmo, the keys, the road handles), so the change needs one clear model.

## Decision drivers

- Work like Blender, which many users of 3D tools know: an active item plus others, Shift/Ctrl-click, B for a box.
- Keep every drag that exists working as it does: plain left-drag pans the camera, Ctrl/Shift + left-drag and right-drag orbit (ADR-0062).
- One gesture is one undo step (ADR-0009), and the properties show where selected things differ (like ADR-0027 shows where a value comes from).
- Show nothing in the properties that doesn't apply to every selected thing.

## Considered options

1. Replace the single selection with a list everywhere.
2. Keep the single selection as the **active item** and add a list of everything selected.

For drawing a box: B then drag (Blender); Alt + drag; a Select tool that turns left-drag into a box.

For turning and resizing a group: around the group's centre; each in place.

## Decision outcome

Chosen: **an active item and a list** (2), **B then drag**, **around the group's centre**.

- **The store** keeps `selectedId` / `selectedRoadId` / `selectedAreaId` as the active item (the last one clicked, whose values the properties show) and adds `selectedItems`: everything selected, the active one last. Anything that sets the active item without saying otherwise selects just that (the store enforces it in one place), so all existing code keeps its single-selection meaning. Undo and redo keep the selected things that still exist.
- **Selecting:** a click selects one thing. Shift- or Ctrl-click (Cmd on a Mac) in the world adds a thing or takes it out; in the outliner Ctrl/Cmd-click does the same and Shift-click selects the rows from the active one to the clicked one. Objects, roads and areas can be selected together. A road point or area corner is only ever selected on its own.
- **The box:** B (or the toolbar's Select box button, which is also the way in on phones) and then a drag adds what's inside to the selection; Shift+B, or holding Ctrl/Cmd when letting go, takes it out. An object counts when its centre is inside; a road or area only when all its points are, so a big area under a district isn't picked by accident. Hidden and locked things are left out, so locking the ground's areas keeps them out of the way. While dragging, what letting go would add gets the dashed hover frame (what it would take out turns from solid to dashed), so the box is never a guess. Esc or a right click cancels.
- **Group transforms:** the gizmo, G / R / S, the arrows and Q / E work on the whole selection, around the centre of what they move: moving snaps the distance moved to the grid (the layout stays as it is) and keeps the group on the ground, turning snaps to 15° and turns positions as well as headings, and resizing spreads positions as well as sizes. Roads and areas move, turn and resize as a whole (every point); lifting raises objects and road points (an area's height is a shape setting). Locked things stay put, and a vehicle driving a road moves with its road, not on its own.
- **Group actions:** Delete, Ctrl+D (objects, roads and areas; copied vehicles drive along the copied road when it's copied too), H, hide and lock in the context menu and F (the box around them all) act on everything selected, each as one undo step.
- **The properties** are headed "N objects … selected", and every tab starts with a **Selection** panel listing what's selected by kind with a count (click a kind to keep only those, Ctrl-click to take them out) and the group's actions. Then the settings: the objects' transform, a part's shape when the objects are all the same part, and **every** colour and light any selected object has (colours by id, lights by id and shape), each saying which of the selection it's on ("On 2 of 6 selected: Round tree (2)") and changing only those. So a round tree's Leaves and a pine's Needles both show, rather than only the Trunk they share. A field whose values differ shows the last-selected one's value and a **Mixed** tag in its label row (where Default / From scene go, ADR-0027); changing it sets it on all of them as one undo step. Reset resets all of them. The outliner can show only the selection.

### Consequences

- Good: everything that works on one thing keeps working unchanged; groups are an addition on top.
- Good: one model for clicks, the box, the keys and the properties.
- Bad: two ways of reading the selection (the active item, and the list); code that acts on "the selection" must say which it means.
- Bad: Mixed shows the active value rather than a blank, so it relies on the tag to tell the user values differ.

## More information

- Related: ADR-0009 (undo), ADR-0027 (inherited values), ADR-0030 (phones), ADR-0035 (outliner), ADR-0054 (properties editor), ADR-0058 (lights), ADR-0060 (colours), ADR-0062 (camera controls).
- Code: `src/editor/store.ts` (`selectedItems`, `toggleSelected`, `selectItems`), `src/render/BoxSelect.tsx`, `src/render/GroupGizmo.tsx`, `src/render/transforms.ts` (group drags), `src/ui/GroupInspector.tsx`.
