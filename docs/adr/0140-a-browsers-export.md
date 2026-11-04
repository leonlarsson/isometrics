---
status: proposed
date: 2026-11-04
---

# 0140. A browser's export: everything this site keeps, in one file, added or replacing

## Context and problem statement

Everything the app keeps lives in one browser's localStorage (ADR-0006, ADR-0044): every world, the list of worlds, backups (ADR-0020), Preferences, and memories such as panel sizes, Add to scene's favourites, allowed links (ADR-0119), shared links (ADR-0120) and where the camera was in each world. Moving to another computer or browser, or keeping a copy before clearing site data, meant saving each world to a file one by one and losing the rest. People need one file for all of it, and a safe way to bring it back.

## Decision drivers

- One action for everything, including stores added later, without listing them.
- Never discard user data (ADR-0020): bringing a file in never overwrites a world, and replacing keeps what was there.
- The file is untrusted input (ADR-0119): it can come from anyone.
- Storage is small (about 5 MB): it can fill partway through.

## Considered options

1. Save every world to files (a zip), and nothing else.
2. One JSON file holding every localStorage entry with the app's prefix, exactly as stored, brought back by adding or by replacing.
3. A sync service.

## Decision outcome

Chosen option: **2**. In the app menu (the logo), between Preferences… and the resets: **Export this browser** and **Import a browser’s export…**.

**The format** (`src/editor/browserExport.ts`), named `<app>-browser-<date>.json`:

```json
{ "app": "Isometrics", "kind": "browser", "version": 1, "exportedAt": "2026-11-04T09:00:00.000Z",
  "items": { "isometrics:world:abc": "<the world, as stored>", "isometrics:preferences": "…" } }
```

`items` holds every localStorage key that starts with `<app>:`, its value the stored text unchanged, so a new store is in it without being listed. Exporting saves the open world first, and says what it holds and its total size. `version` goes up only if the format itself changes; what's inside each item follows its own store's rules (worlds are repaired when opened, ADR-0026, ADR-0104).

**Reading a file.** It must be at most 32 MB (checked before it's read), parse as JSON, pass `safeJson` (no `__proto__`, no nesting past 64), say `kind: "browser"`, this app and version 1. Only entries whose key starts with the app's prefix, is at most 256 characters long and whose value is text are kept (at most 10,000); the rest are counted and left out.

**Never imported: what makes this browser trust outside addresses.** A file can come from anyone, and must never let a world read an address without asking (ADR-0119). So the list of addresses this browser reads without asking (`<app>:allowed-links`, `editor/linkTrust.ts`) is never brought in, by Add or Replace: a file's copy is left out and counted with the other left-out entries, Replace leaves this browser's own list as it is (it's neither removed nor in the copy it keeps), and a world from the file asks again before it reads an address, as any world does. The keys are listed in `NEVER_IMPORTED` (`src/editor/browserExport.ts`); a new store that grants trust in outside addresses goes there. The import dialog and the Replace confirmation both say so: "Allowed external sources aren’t brought in: the ones this browser reads stay as they are, and a world from the export asks again before it reads one." Exporting still includes this browser's list, so the file is a full copy, and a Replace's copy of this browser can be downloaded. A file that isn't an export says so in words: a world file is pointed to File → Open file…, a newer version's file to reloading. Worlds are kept as text: nothing in them is opened here, and they're repaired by `repairWorld` when first opened, like any stored world.

**What it holds** is shown first: when it was exported, its size, its worlds by title, how many backups and settings. Then two choices:

- **Add to this browser:** its worlds and backups go beside this browser's; nothing is overwritten. A world this browser already has, word for word, isn't added twice. A world whose id is taken by another world, or whose id isn't one (letters, digits, `_` and `-`, at most 64), gets a new id: it's kept as a copy. A backup whose key is taken moves to the next free time. Settings, the open world and the camera views stay as they are. The list of worlds is written after the worlds and names only those written.
- **Replace this browser’s:** a `ConfirmDialog` with the weight of Wipe everything (ADR-0045): red, a 3-second countdown, saying how many worlds make way and that allowed external sources aren't brought in, with **Export this browser first** beside it. Then:
  1. This browser as it is (everything with the prefix but its backups and allowed external sources, which stay) is kept as one backup, `<app>:browser-backup:<time>`, in the export's own format. File → Backups lists it as "This browser before an import": download it as an export, or add its worlds and backups back. It isn't trimmed with the five newest world backups, and Reset this browser's settings keeps it. If there's no room for it, nothing changes, and the person is told how to make room (export, Wipe everything, import again). A browser that keeps nothing yet needs no copy.
  2. This browser's entries (but backups and its allowed external sources) go, and the file's are written: worlds, then the list of worlds (naming only worlds written) and which world is open (only if it was written), then settings (never `NEVER_IMPORTED`). The file's backups are added beside this browser's, which stay.
  3. All or nothing: if anything can't be written, what was written goes and this browser's entries are put back, and the copy, no longer needed, is deleted; the person is told nothing was replaced. If even that fails, the copy stays and they're told to download it first, and nothing saves until the page reloads.
  4. Saving stops (as after Wipe everything) and the page opens at `/`, as the file left it.

**Storage full while adding:** whatever doesn't fit is left out and counted ("2 worlds and 1 backup weren’t added: the browser’s storage for this site is full"); what was added stays, and importing again adds only what's missing.

### Consequences

- Good: a whole browser moves to another, or is kept as a file, in two clicks, and future stores travel with it.
- Good: neither choice loses anything: Add never overwrites, Replace keeps a copy first and is all or nothing.
- Bad: a Replace needs room for a copy of this browser beside the file; a nearly full browser has to export, wipe and import instead.
- Bad: moving to a new browser doesn't bring the allowed external sources: each world asks again, once, before it reads one. That's the price of never letting a file pre-allow addresses (ADR-0119).
- Bad: added world backups count towards the five kept; the next backup trims the oldest, as always (ADR-0020).
- Bad: another tab of the app still open keeps its world in memory and may autosave it after a Replace; reload other tabs.

## More information

Code: `src/editor/browserExport.ts` (+ tests), `src/editor/fileActions.ts` (`exportThisBrowser`, `pickBrowserExport`, `addBrowserExport`, `replaceWithBrowserExport`), `src/ui/ImportBrowserDialog.tsx`, `src/ui/AppMenu.tsx`, `src/ui/BackupsDialog.tsx`. Related: ADR-0006, ADR-0020, ADR-0044, ADR-0045, ADR-0059, ADR-0119.
