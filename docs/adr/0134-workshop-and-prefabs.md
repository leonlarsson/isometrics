---
status: proposed
date: 2026-11-03
---

# 0134. The Workshop and prefabs: objects of one's own, made from shapes, parts and fences

## Context and problem statement

The parts are code: 91 of them, each a file (ADR-0043). People want objects of their own, such as a farmyard, a branded kiosk or a castle gate, and they want them reusable across worlds and placeable like a part. The Shapes category (ADR-0124) gives the building blocks, and the editor already has every tool to arrange them (the gizmo, size handles, colours, lights, fences). The owner (2026-11-03): a modelling station, combined with prefabs, possibly shared by link in KV. A prefab can be made of shapes, any parts and fences. Each placed copy is one object whose design is kept in the world. Whether to share by link is still to decide.

## Decision drivers

- Non-technical people build a prefab with the editor they already know, not a new modelling tool.
- A world stays self-contained: a shared or exported world draws its prefabs anywhere.
- A placed copy behaves like a part: it moves, turns and resizes as one, follows data where objects do, and changing the design changes every copy.
- Old worlds open unchanged, and the format rules hold (ADR-0056, ADR-0104, ADR-0106).

## Decision outcome

### Format
- **The world's prefabs.** A world gains `prefabs`: a list of designs.
  - Each design is `{ id, name, description, entities, fences }`. Its pieces are ordinary objects and fences, laid out around the prefab's origin: the footprint's centre on the ground at (0, 0), its lowest piece at altitude 0, the front facing +Z.
  - Ids start with `prefab_`, which no part kind does (a test checks).
  - Pieces are parts and shapes, never other prefabs: no nesting.
  - The default is `[]`, so old worlds are unchanged.
- **A placed copy** is an object whose `kind` is a prefab's id.
  - `getPart` resolves such a kind to a part made from the world's design (`parts/prefabParts.ts`).
  - Its footprint is the box round the pieces' turned footprints, and its height the highest piece's top. It has no props or colours of its own, and its `Component` draws the pieces as pictures do (`PictureEntity`).
  - Everything that asks a part (selection, the gizmo, placement, footprints, the outliner, Add to scene, label anchors, `/api/worlds/schema`) works unchanged.
  - The world's designs are handed to the parts layer when the scene changes (`setWorldPrefabs`), as the parts layer can't read the store.
- **Data:** a copy follows data as any object does: its size (`scaleFromData`), a table row, its label and details. Pieces keep their own bindings, read from the world's data. `worldBindingMapsOf` covers the pieces, so renaming or deleting a data value reaches them.
- **Repair and the rest of the format:** repair, legacy renames and the parts' upgrades (`repairWorld`) reach the pieces as they reach the world's own objects. `prefabs` is in `PATCH_LISTS`, so patches can change one prefab at a time. Copying and pasting a copy carries its design.

### The Workshop
- **Where it is:** a small world of its own (an editor session that isn't saved as a world) for building a prefab with the whole editor. `whatIsOpen` gains a `workshop` beside `preview`, so `keepsOpenWorld` is false there and nothing is saved, as with a preview.
- **Its world:** a ground sized to the pieces (at least 16 × 16), with the theme, lighting, sky and data of the world it came from, so the pieces look and follow data as they will there.
- **Ways in:**
  - Add to scene's Prefabs: **Make a prefab…**, starting from nothing.
  - The context menu with things selected: **Make a prefab from these…**, which brings the selected objects and fences in, recentred.
  - A copy's properties: **Edit in the Workshop**, which brings in its design.
- **Its bar:** a bar over the view (`FloatingBar`) holds the prefab's name, **Save the prefab** and **Leave without saving**.
  - **Save the prefab** goes back to the world and keeps the design in it, as one undo step: a new design is added, a changed one is updated and its copies follow.
  - A prefab made from a selection replaces those things with one copy where they stood, in the same step.
  - A new prefab is then ready to place, as a part picked in Add to scene is.
  - Prefabs can't be made inside a preview: keep a copy first.

### My prefabs
- Every saved prefab is also kept in this browser's library (`editor/prefabLibrary.ts`, local storage), so it can be placed in any of one's worlds.
- Add to scene's **Prefabs** chip lists this world's prefabs, then **My prefabs** not yet in it. Placing one from the library copies its design into the world.
- A design already in the world is kept as the world has it, never replaced by the library's.
- **Remove from My prefabs** takes one out of the library; worlds that use it keep their copy.

### Sharing (to be decided)
- A prefab can be shared by a public link only when asked, like shared worlds (ADR-0120), using the Isometrics User Prefabs KV namespace:
  - a snapshot under a new random key, never overwritten
  - kept for an hour to 30 days
  - rate-limited
  - the request read through `safeJson`, with a size limit
- Opening `/p/<id>` offers **Add to My prefabs**.
- It's built as a separate step, so it can be left out if the owner decides against it.

### Consequences

- Good: objects of one's own without code, made with the tools people already use, and reusable across worlds.
- Good: copies are one object each, so a world stays light to edit and drawing them together still works (ADR-0086).
- Bad: lights in a prefab's pieces glow and switch, but don't light their surroundings with real lights (ADR-0074), as those are registered per object.
- Bad: a prefab has no colours of its own yet, so all its copies look the same unless their pieces follow data.

## More information

ADR-0124 (shapes and size handles), ADR-0068 (copy and paste), ADR-0120 (worlds shared by link), ADR-0121 (what's open), ADR-0104 (the world's vocabulary). The TODO item "Prefabs" is folded into this.
