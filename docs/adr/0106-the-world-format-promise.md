---
status: proposed
date: 2026-10-30
---

# 0106. The world format's promise: every world keeps opening, and the version almost never moves

## Context and problem statement

Until now the world format changed in place while the app was a playground (ADR-0026, ADR-0056): `SCENE_VERSION` stayed 1 and worlds were repaired or brought up to date when opened. With the app going public there will be worlds in people's browsers, files they downloaded, files AIs write from `/schema.json` (ADR-0032), and later worlds shared between people (ADR-0006). Each change to the format has to keep all of them working, and people must never be the ones who pay for it: no world that stops opening, no "convert your file" step, no AI-written file that's suddenly wrong.

The question is how the format may change from here, and what the version number is for.

## Decision drivers

- Every world ever saved keeps opening, looking as it did, with nothing lost (ADR-0020).
- Files say `version: 1` today, in browsers, on disks and in what AIs have learned; that shouldn't go stale.
- Changes stay cheap enough that the format can keep getting better.
- A world from a newer version, opened in an older app (a tab left open across a deploy, a shared file), loses as little as possible.

## Considered options

1. Bump `SCENE_VERSION` on every breaking change and migrate older documents step by step.
2. Keep upgrading on load (`upgradeLegacyIds`, `readWorld`), as the renames of ADR-0071 and ADR-0104 did, and keep the version for the rare change that can't be done that way.

## Decision outcome

Chosen option: **2**. The version is a last resort, not the way the format changes.

**Every change of ours is repaired by us.** If a world saved before a change wouldn't read after it, the same change brings it up to date: an upgrade on load, or (rarely) a migration step. Nobody ever converts a file, and no change of ours leans on the general repair (ADR-0026), which resets what it can't read: that's a safety net for what we didn't cause (a damaged file, a mistake in a hand- or AI-written one, a world from a newer version). The tests hold us to it: every saved old world must open with no repairs at all, and every field of the every-field world must arrive (`scene/oldWorlds.test.ts`, `parts/readWorld.test.ts`).

### What a change may do

- **Add a field:** always, with a default that draws existing worlds as they were and a `.describe()`. No version change.
- **Rename or move a field:** always, by bringing the old name or place up to date on load (`scene/legacy.ts`, or `parts/readWorld.ts` for what needs the parts), entries kept for good, with an old-world fixture saved before the change and a test that it arrives (ADR-0056, ADR-0104). No version change.
- **Remove a field:** it's still read on load into whatever replaced it, or, if nothing did, simply ignored (and kept, below). No version change.
- **Loosen a limit or add an option:** always. **Tighten a limit or drop an option:** not on its own: old values would stop validating. Rename the field instead, converting old values on load.
- **Never change what an existing field means.** A new meaning gets a new name, and the old field is converted to it on load. This is the rule that keeps the version still: a file can't say which meaning it was written with, but it can say which name.

### When the version does move

Only for a change that can't be done by the rules above, such as reshaping the whole document. Then `SCENE_VERSION` goes up by one and `migrate.ts` gets a step from the old version, with a test from a saved world of the old version; steps are kept for good and run in order, so a version-1 world opens in any later app. Nobody notices: a migrated world opens and saves in the new version, and its original is kept (ADR-0020). `/schema.json` describes the newest version, and the app still reads every older one.

### Worlds from a newer version

An older app that opens a newer world (a version above its own, or fields it doesn't know) opens what it can and says so (ADR-0026); the original is kept as a backup. Once worlds travel between people (sharing links, ADR-0006), fields it doesn't know are kept as they are instead of dropped, so opening and saving in an older app doesn't strip a newer one (TODO: *Unknown world and object fields*).

### Fresh starts

"Start fresh" (ADR-0059) may be offered after a big change, but it's never a way out of this promise: the worlds it would replace must still open.

### Consequences

- Good: files, saved worlds and what AIs write keep working, with `version: 1` for as long as the rules hold; changes stay as cheap as a table entry and a test.
- Good: the one dangerous change, a field quietly meaning something else, is ruled out.
- Bad: the legacy tables only grow, and names that were never a great idea stay readable forever.

## More information

ADR-0020 (never lose a world), ADR-0026 (repair on load), ADR-0032 (`/schema.json`), ADR-0053 and ADR-0071 (renamed ids and fields), ADR-0056 (safe changes and old-world fixtures), ADR-0059 (fresh starts), ADR-0104 (`readWorld`).
