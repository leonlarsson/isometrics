---
status: proposed
date: 2026-11-08
---

# 0158. A tab stops saving when another tab wipes everything or changes which world is open

## Context and problem statement

Autosave writes the open world to the id stored as open (ADR-0044). That stored id is shared by every tab of the app in the browser. When another tab changes it, a tab still open writes its own world into whichever world is open there now. Another tab changes it by opening or making another world, deleting this one, Import a browser's export → Replace (ADR-0140) or starting fresh after a crash. Once Wipe everything (ADR-0045) clears the storage, the next autosave brings the wiped world back under a new id. Either way the other tab's work is overwritten or a wipe is undone, silently, which ADR-0020 rules out.

## Decision drivers

- Never write over another tab's world, and never bring back a world that was just wiped.
- Say why the tab isn't saving, and what to do, with the fix one click away (ADR-0057).
- Don't get stuck: a tab that stopped can carry on without a reload.
- Small: no change to how worlds are stored, and nothing for a tab that isn't saving a world anyway.

## Considered options

1. **Stop saving in the tab whose open world changed underneath it**, on the browser's `storage` event, with a bar saying why (Save to file, Reload).
2. Each tab keeps its own open world id (in memory or `sessionStorage`), so two tabs can edit two worlds side by side.
3. Leave it, and tell people not to use two tabs.

## Decision outcome

Chosen option: **1**, as planned in TODO.md.

- **When** (`stopReasonOf`, `startAutosave` in `editor/persistence.ts`): a `storage` event (sent only to the other tabs of the site) that clears the storage (`key` null: Wipe everything) or changes the open world's id (`open-world-id`, new value ≠ old). Only while this tab has a world of its own open, or the Workshop, which goes back to one. A tab on the home screen, showing a preview from a link or still starting writes nothing over anything. It reads what's stored when it opens a world.
- **Stopping:** the change waiting for the autosave is dropped, and from then on nothing is written: no world, no index entry, no camera memory (`savingHasStopped`, checked by `render/CameraMemory`). The save status says **Not saved**, with the reason in its menu: `wipedElsewhere` or `changedElsewhere`, next to `full`, `unavailable` and `wiped` (`TNotSavedReason`). Once stopped, the status stays failed whatever else happens.
- **The bar** (`ui/StoppedSavingBar`, over the view): **This tab stopped saving**, why, then **Save to file** (to keep what changed here) and **Reload** (opens what's open now). It can be hidden, and the save status still says Not saved.
- **Carrying on:** this tab opening or making a world (File → Open, New world, Recent worlds) makes it the open one again, and the tab saves again. Then the other tab stops in turn. The last tab to pick a world saves. After this tab's own Wipe everything or Replace, it never saves again until the page reloads, as before.

### Consequences

- Good: a second tab can no longer overwrite another tab's world or undo a wipe. Its edits since the stop are kept until the tab closes and can be saved to a file.
- Good: no change to storage or the world format, and nothing changes for one tab.
- Bad: two tabs can't edit two different worlds side by side. Only the last to open one saves (option 2 would allow it, but every reader of the open world's id, like the camera memory, the Workshop's session and Recent worlds, would need to follow the tab's own id; worth its own ADR if wanted).
- Unchanged: two tabs on the *same* world both save into it, the last write winning, as before.

## More information

`src/editor/persistence.ts`, `src/ui/StoppedSavingBar.tsx`, `src/ui/SaveStatus.tsx`, `src/render/CameraMemory.tsx`; tests in `src/editor/saveStatus.test.ts` and `e2e/worlds.spec.ts` (two tabs of the app). Related: ADR-0020, ADR-0044, ADR-0045, ADR-0057, ADR-0121, ADR-0140.
