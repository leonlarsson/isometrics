# Handover: app row and view bar (ADR-0142)

Branch `app-row-view-bar`. The top bar is now two rows. `pnpm check`, `pnpm typecheck` and `pnpm test` (91 files, 1626 tests) pass.

## Done

- **App row** (`src/ui/AppRow.tsx`, 40px, across the window): the logo (app menu), File, AI and the save status on the left. On the right a tray with the side panels' toggle (Edit mode, wide layout only), a new Preferences… button (Ctrl+,) and the theme (only while a world is open). The logo keeps its name and the save status its words down to 700px.
- **View bar** (`src/ui/ViewBar.tsx`, 44px, the same height as the panel headers): at the top of the view's own column, between the side panels. On the left: Edit/View, History and Editing (snap, box select, paint). On the right: Views, Overlays, the shading switcher, and the View cluster (play, camera, Re-centre). The stage sits under it, so the floating bars, the title and the loading screen start below it.
- **Folding** (`src/ui/useViewBarFolds.ts`) goes by the bar's own width, through a ResizeObserver. The steps, in order: shading → one Shading menu (`ShadingMenu`), the Views label, play/Re-centre into More, the Edit/View words, the tools into More, the shading/overlays/camera menus into More, then undo/redo into More. The widths for each mode were measured in the browser. There's a unit test (`useViewBarFolds.test.ts`). At 1280px with the panels open, the Edit/View words still show.
- **Phones (≤700px):** one row as before. The view bar sits inside the app row (`isInline`), and the theme is in its More.
- **Home screen:** shows the app row only.
- Kit: in a cluster, a menu button is now as tall as the icon buttons (`Menu.module.css`), with a demo on `/kit`.
- ADR-0142, AGENTS.md layout line, comments.
- e2e: new helpers `viewBar` and `hideSidePanels` (`e2e/editor.ts`), and new tests in `layout.spec.ts` covering the view bar's place and folds, the bars under it, and the home screen. In `preferences.spec.ts` the side panels are hidden for the shading-button tests: at 1440px the view between the panels is too narrow for those buttons.

## Left, in order

1. **Re-run the e2e specs on a quiet machine.** `layout.spec.ts` and `preferences.spec.ts` pass (18/18). The run of camera, worlds, selection, view-mode, transforms, sharing and world-settings was cut short at 55/70 by the machine's load. Every failure in it was a crashed renderer or a loading-screen timeout, apart from one: in transforms "dragged onto a plateau" the object landed off the target (px off by 7.6). Check that one against `main`. It may be flaky under load, or it may come from the stage now starting 84px down. The tests from world-settings:171 onwards did not run.
2. Look at `/kit` in both themes for the cluster menu button. It has not been checked yet.
3. Decisions for the owner:
   - The theme is saved per world (`scene.theme`), yet it now sits in the app-level tray. Should it become a browser preference?
   - Add a fullscreen/present button to the tray? The app has none today.
   - The side panels' toggle was put in the app row, so it stays under the pointer while the panels fold. Is that the right row?
   - The view is 28px shorter than before (84px of bars instead of 56px).

## Known issues

- The fold widths are hard-coded. If a button is added to the view bar, measure them again: the e2e check `fits` in `layout.spec.ts` fails if the bar overflows.
- Once the view bar folds its menus into More (only when the view is very narrow on a desktop), the camera menu's extras (lens, isometric angle) are reachable only from the Camera tab.

## Screenshots

`/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/topbar/`: `{light,dark}-{1440,1280,1100}-{edit,edit-hidden,view}.png`, `{light,dark}-900-{edit,view}.png`, `{light,dark}-390-{edit,view,home}.png` and `{light,dark}-1280-home.png`.
