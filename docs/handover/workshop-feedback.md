# Handover: the owner's feedback on the Workshop (PR #37, `workshop-prefabs`)

State at the end of this round (2026-11-04).

## The merge of main

Done. origin/main, with #40 (viewpoint tour, ADR-0139) and #41 (Overlays menu, ADR-0141), is merged in (`97294ca`). The only conflict was the ADR index, which now lists 0133, 0134, 0139 and 0141. `pnpm check`, `pnpm typecheck` and `pnpm test` pass after it.

## The five points

1. **The Workshop bar: done.**
   - One slim row (`FloatingBar`'s new `isCompact`): the prefab's name typed in place, a tooltip saying what the Workshop is (clicking it opens the Prefab panel), Show the ground, Leave without saving and Save the prefab.
   - The world's title card is hidden in the Workshop, and the bar keeps clear of the compass.
2. **A bespoke prefab editor: done.**
   - The ground is off by default: the pieces float with only their soft shadow under them (a `shadowMaterial`). The ground is still there for clicks. The choice is remembered per browser.
   - `render/WorkshopMarker` draws a dashed footprint outline, a cross at the origin and an arrow marked Front (+z).
   - The Workshop has a plain daylight, sky, weather and backdrop of its own, with the world's theme and data; the time-of-day chip and viewpoint bar are off there.
   - The properties show one Prefab tab (`ui/WorkshopPrefabTab`: name, description, size and Show the ground) in place of the world's tabs.
   - Add to scene opens on Shapes.
   - Left to tune: the Front arrow is still small at a far zoom (it could scale with the camera, as the gizmo does), and the description field shows a "Default" tag when empty.
3. **What sticks in the Workshop: done.**
   - The camera is remembered per prefab (`workshopViewKey` in `editor/cameraMemory`, saved by `render/CameraMemory`), and flushed when entering and leaving.
   - What's being built is kept in the tab (`editor/workshopSession`, session storage), so a reload opens the world and the Workshop on it again. Leaving after a reload asks first.
   - Show the ground is remembered per browser.
4. **Context menu wording: done.**
   - A prefab's copy says **Edit prefab** ("Changes every copy of it, in the Workshop") in its right-click, its properties and its tile's menu. The words live in one place, `ui/prefabWords.ts`.
   - Other things say **Make a prefab from it…** / **Make a prefab from these…** with a short line, greyed with a short reason where they can't be used.
5. **Removing: done, without Break apart.**
   - **Remove from My prefabs** says "Worlds that use it keep it", and its toast points to **Remove from this world…**.
   - **Remove from this world…** on a prefab's tile takes the design and every copy out of the world, asked first when it has copies, as one undo step (`removePrefabFromWorld` in `editor/prefabLibrary`).
   - **Break apart** wasn't built. To add it, replace each copy with its pieces moved by the copy's position, y-turn and scale (and fences' points the same way), in one commit, as a second button in that confirmation.

## Checks

- Unit tests: 1673. `editor/workshopSession.test.ts` and `editor/saveStatus.test.ts` failed only on timeouts in one full run while the machine was out of memory. Run on their own afterwards, both files passed (8/8).
- e2e: `e2e/prefabs.spec.ts` was updated for this round (Show the ground, Edit prefab from a copy's right-click, Remove from this world…) but couldn't be run in full here: Chrome kept being killed for lack of memory in the shared container. **Run it before merging:** `pnpm e2e e2e/prefabs.spec.ts`.

## Screenshots

In the session's scratchpad, from this round, before the last tweaks to the bar and the arrow:
- `r3-workshop-{light,dark}.png`
- `r3-workshop-ground-{light,dark}.png`
- `r3-copy-menu-{light,dark}.png`
- `r3-tile-menu-{light,dark}.png`
- `r3-workshop-menu-{light,dark}.png`
