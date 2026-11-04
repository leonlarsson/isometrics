# Proposal: the app row's root menus

This is a proposal to think over. Nothing here is built yet.

## Where things are today

The app row has two menus.

- **The logo** (the app menu) holds:
  - help: Welcome…, Guide, Star it on GitHub
  - Preferences…
  - moving this browser's worlds and settings: Export this browser, Import a browser's export…
  - resets: Reset this browser's settings…, Wipe everything…
- **File** holds:
  - starting or opening a world: New world…, Build with AI, Recent worlds, Open file…
  - taking it elsewhere: Share a link…, Save to file, Render a picture…
  - managing worlds: Duplicate, Delete, Backups…

Editing actions (undo, redo, copy and paste, delete, duplicate, select all) are only reachable through keys, the context menus and the view bar. The view's settings are in the view bar.

## Option A: File, Edit, View, Help, like a desktop app

- **Logo menu:** only the app itself: About / Welcome…, Preferences…, and this browser's data (Export, Import, Reset, Wipe). It works like macOS's app menu.
- **File:** unchanged.
- **Edit:** Undo, Redo, then Cut, Copy, Paste, Duplicate, Delete, then Select all and Select with a box, then Snap to grid. Each item shows its shortcut, so the keys become discoverable.
- **View:** Edit mode / View mode, Viewpoints ▸, Overlays ▸, Shading ▸, then Perspective, Isometric angle, Re-centre camera, then Show the side panels and the theme.
- **Help:** Welcome…, Guide, Keyboard shortcuts, Star it on GitHub / report a problem.

**For:**
- People who know desktop apps find things where they expect them.
- Every key gets a menu item, which helps anyone who doesn't know the shortcuts.
- The logo menu shrinks to what's truly the app's.

**Against:**
- It's four menus where there were two: more width in the app row and more to read for non-technical people.
- Edit and View repeat what the view bar already shows, so there are two places for the same switch. That's fine for menus (Blender and Figma do it), but it's more to keep in step.
- On phones it all has to fold back into one menu.

## Option B: File and Help only, everything else stays in the bars

- **The logo:** goes back to being just the logo and name, a link home (the home screen).
- **File:** worlds, as now, plus this browser's data in its last group (Export this browser, Import…, Reset…, Wipe everything…).
- **Help** (a "?" in the tray, next to Preferences): Welcome…, Guide, Keyboard shortcuts, Star it on GitHub.
- **Preferences:** stays a tray button. Nothing else changes: editing stays on keys, context menus and the view bar.

**For:**
- Smaller than today.
- Help gets a recognisable "?" instead of hiding behind the logo.
- Each thing lives in one place.

**Against:**
- Editing actions stay without a menu, so their shortcuts are learnt only from tooltips and the guide.
- File grows a group that isn't about worlds.

## Recommendation

**Option B now,** because it's small, clears up the logo's double role, and fits the app's non-technical audience. **Option A's Edit menu later,** if people ask where copy and paste are.

Either way, a **Keyboard shortcuts** sheet under Help would make the keys discoverable without a full menu bar.
