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

## Notes from building it

Where the code made the design more exact, or simpler:

- **Drawing the pieces:** the parts layer can't reach the fences or the 3D view (dependencies point downward), so `render/PrefabPieces` hands `parts/prefabParts` its way of drawing pieces and measuring fences (`drawPrefabPiecesWith`) instead of the parts reaching up. A copy's pieces are drawn inside its own node, so its meshes are still drawn together with other copies' (ADR-0086).
- **Size:** a copy's footprint is kept centred on its origin (twice the furthest reach either way), since the selection frame and placement are drawn round the origin; a design saved from the Workshop is centred anyway.
- **Pieces follow data:** a copy whose pieces follow data (or a piece's light on a schedule, or the sun) says so through two new part fields, `readsData` and `followsTheHour`, so the view hands it the data and the hour as it does other objects. Pieces read the world's values, and "row.<column>" the row their copy follows.
- **Repair:** a prefab's pieces are each repaired on their own, as the world's objects are, so one bad field resets that field rather than dropping the piece or the prefab. A piece that's a prefab is left out.
- **The other world's parts:** `getPart` knows the open world's prefabs (`setWorldPrefabs`, called by the store whenever `scene.prefabs` changes); code reading another world (world pictures, `validateWorld` on the server, unknown-part warnings while a world opens) asks `partIn(kind, scene.prefabs)`.
- **`whatIsOpen`:** the Workshop is a `workshop` field of an open world, beside `preview`, holding the world it came from (its scene, undo history and view) to go back to. Nothing is saved and the camera isn't remembered while it's open (`keepsOpenWorld`). It keeps the world's data, sources and look; changes to those inside the Workshop are left there, and only its objects and fences become the prefab (roads and areas drawn there aren't kept).
- **The Workshop's world isn't one to pass on:** what acts on the open world as a world (Change this world…, Share a link…, Save to file, Duplicate world, Delete world…) asks one helper, `whyNoWorldAction`, and is greyed out there with "(not in the Workshop)" in its label; Render a picture… stays, as a picture of the prefab is useful. Every way out without saving (Leave without saving, New world, Open file, a recent world, restoring a backup) goes through `leaveWorkshopFirst`: straight out while nothing was built, else the bar's one question first.
- **Gates:** a prefab's fences are fences, gates included (ADR-0133): drawn open or shut from data, their bindings covered by `fenceBindingMapsOf`, kept as they are when pieces are recentred (a gate sits on a stretch, by share).
- **The Ground menu's Add here** lists the world's prefabs, then My prefabs not in it, as Add to scene does.
- **A studio, not a world (after the owner's first try):**
  - The bar is one slim row (`FloatingBar`'s `isCompact`): the prefab's name typed in place, **Show the ground**, **Leave without saving** and **Save the prefab**. What the Workshop is sits in a tooltip that opens its Prefab panel.
  - The ground is off by default: the pieces float with only their soft shadow under them (the ground stays for the pointer), and the choice is remembered per browser. A dashed outline round what's built, a cross at its middle (where a copy stands) and an arrow marked Front (+z) show its base and front.
  - It has a plain daylight, sky, weather and backdrop of its own, with the world's theme and data (this replaces "the look of the world it came from" above).
  - The properties show one **Prefab** tab in place of the world's tabs: name, description, size and Show the ground. The world's tabs aren't the prefab's, so they're not offered there.
- **What sticks in the Workshop:** its camera is remembered per prefab (one for prefabs made from nothing), apart from the world's. What's being built is kept in the tab (session storage) while it's open, so a reload opens the world and the Workshop on it again as it was; built on before the reload, leaving asks first though there's no undo history. Show the ground is remembered per browser.
- **The words for prefabs** are in one place (`ui/prefabWords.ts`): a copy's right-click, its properties and its tile all say **Edit prefab** (changes every copy of it, in the Workshop); other things say **Make a prefab from it…** / **from these…**, greyed with a short reason where they can't.
- **Removing:** **Remove from My prefabs** leaves worlds that use it as they are (a world keeps its own design), and says so. **Remove from this world…** on a prefab's tile takes its design and every copy out of the open world as one undo step, asked first when it has copies; Break apart was left out for now as the simpler sound choice.
- **With main's later features:**
  - A browser's export (ADR-0140) carries My prefabs as content, like worlds rather than a setting. Add merges a file's in beside this browser's (one this browser has, by id, stays as it is here); Replace replaces them with the file's, as it does the worlds. Leaving the Workshop goes through `leaveWorkshopFirst` before Replace, and before an Add that brings settings, since both reload.
  - Stacking (ADR-0138): in the Workshop, pieces stand on each other's tops like any objects. A prefab whose pieces can be stood on (shapes, containers) can be stood on where they are, so things land on a copy's top.
  - Surfaces and junctions (ADR-0136, ADR-0137): the Workshop's world takes their defaults (a plain ground, no roads), and Show the ground draws the ground with its surface.
- **"Ready to place":** saving a new prefab made from nothing puts one copy where one was looking, selected, as clicking a part's tile does, and Add to scene shows the Prefabs chip to place more. From a selection, the copy takes the selection's place instead.
- **Greyed out, not hidden:** Make a prefab…, Make a prefab from these… (from it…, for one thing) and Edit in the Workshop say why when they can't be used: "(keep a copy first)" in a preview, "(not inside the Workshop)" in it.
- **My prefabs:** stored newest first under one key, read through `repairWorld` like any world from outside, and kept by Reset this browser's settings (they're one's designs, not settings). Their tiles are clicked to place, not dragged: placing copies the design in and adds a copy as one undo step, and a drag would have to add the design before the drop. Inside the Workshop they aren't offered.
- **Sharing (built as its own step, to drop if decided against):** `server/userPrefabs.ts` and `/api/user-prefabs` (POST, GET and DELETE by id) follow shared worlds: a snapshot under a new random key, an hour to 30 days, `safeJson`, at most 1 MB, our own words for errors, the `USER_PREFAB_UPLOADS` rate limit, kept only when it reads as written. **Share a link…** is on a prefab's tile menu. `/p/<id>` opens as `/w/<id>` does (a link in `whatIsOpen`, `from: "prefab"`): a preview world with one copy of it, whose bar offers **Add to My prefabs** (then back to one's own world, the Prefabs chip showing) and **Close**. The client's requests are in `editor/userPrefabs.ts`, listed in `outsideRequests.test.ts`.
- **Copy and paste:** a copy's design travels with it on the clipboard; pasting adds it where the world lacks it (a design the world has is kept as it is), and inside the Workshop copies of prefabs are left out.

## More information

ADR-0124 (shapes and size handles), ADR-0068 (copy and paste), ADR-0120 (worlds shared by link), ADR-0121 (what's open), ADR-0104 (the world's vocabulary). The TODO item "Prefabs" is folded into this.
