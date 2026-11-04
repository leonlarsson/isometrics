# Handover: app row and view bar (ADR-0142)

Branch `app-row-view-bar` (PR #46). The top bar is now two rows: an app row across the window, and a view bar over the view. ADR-0142 describes both. `origin/main` was merged in on 2026-11-04, with no conflicts.

## Feedback round 1 (done)

- **Room around hovers:** the app row is now 44px, the same height as the panel headers. The 34px buttons get 5px above and below.
- **Preferences** uses a cog icon (`cog` in `Icon.tsx`) everywhere it appears: the app row, the app menu, the camera menu and the Camera tab.
- **Tools, one at a time:** a Tools cluster with Select (the default), Select with a box and Paint. The one in use shows pressed. Snap to grid is now its own Snapping cluster. I kept the tools in the bar rather than adding a vertical strip; ADR-0142 says why.
- **Right side, grouped by meaning:** View (Views, Overlays, shading), Motion (play), Camera (the camera menu, Re-centre). The gap between groups is wider than the gap inside one. More lists things in the same order.
- **Spacing:** cluster icon buttons are round (30px), and menu buttons inside clusters are slimmer. I measured the fold widths again: at 1280px with the panels open, Edit and View still show their words.
- **Kit:** the rail demo no longer runs over the cluster demo.
- **Root menus:** a proposal only, in `docs/handover/menus-proposal.md`. Nothing is built.
- **Owner's decisions:** the theme stays saved with the world; no present/fullscreen button; the side-panels toggle stays in the app row; the 32px shorter view is accepted.

## e2e

- New tests in `layout.spec.ts`: the view bar's place and how it folds, the tools (one pressed at a time), the bars over the view sitting below it, the home screen, and the phone row.
- `preferences.spec.ts` hides the side panels for the shading-button tests (`hideSidePanels`).
- Specs to run for this change: layout, preferences, camera, worlds, selection, view-mode, transforms, sharing, world-settings.

## Known issues

- The fold widths are hard-coded in `useViewBarFolds.ts`. If you add a button to the view bar, measure them again. The `fits` check in `layout.spec.ts` fails if the bar overflows.
- When the view is very narrow on a desktop, the camera menu's extras (lens, isometric angle) are only in the Camera tab.

## Screenshots

- First round: `/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/topbar/`
- Feedback round: `/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/topbar2/`
  - `{light,dark}-{1440,1280,1100}-{edit,edit-hidden,view}.png`
  - `{light,dark}-900-{edit,view}.png`
  - `{light,dark}-390-{edit,view,home}.png`
  - `{light,dark}-1280-{home,hover-file,more}.png`
  - `kit-{light,dark}.png`
