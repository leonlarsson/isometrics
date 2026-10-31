---
status: proposed
date: 2026-10-31
---

# 0118. Changing a world with a patch: the world's own shape, things by id

## Context and problem statement

Change this world with your AI (ADR-0116) asked the AI for the whole world back. Even with defaults left out (ADR-0117), that's tens of kilobytes streamed, copied and pasted to make a lighthouse bigger, and the AI can drift on everything it was meant to leave alone. A change should come back as the change.

## Decision drivers

- Short answers: the change, not the world.
- Written reliably by an AI, in worlds of hundreds of things.
- Readable by anyone who knows the world format, without learning a second language.
- Applied and checked by what's there: `readWorld`, `checkWorld`, one undo step.

## Considered options

1. **JSON Patch (RFC 6902)**, the IETF standard for patching JSON (Kubernetes' `--type=json`, ASP.NET Core's `JsonPatchDocument`, `fast-json-patch`): a list of operations (`add`, `remove`, `replace`, `move`, `copy`, `test`), each pointing at a place by JSON Pointer (`/entities/37/scale`).
2. **JSON Merge Patch (RFC 7396)** alone: the changed fields, shaped like the document; `null` removes.
3. **The world's own shape, things by id**: merge patch for settings, and lists changed by id with `remove`, `change` and `add`.

## Decision outcome

Chosen option: **3**.

JSON Patch (1) names things by their place in a list. An AI writing a patch for a world of hundreds of objects miscounts places, and each removal shifts the places after it, so one slip changes the wrong object without any error. Ids are what an AI gets right, and what the world already names things by. JSON Merge Patch alone (2) can't change one thing in a list: a list is replaced whole, which is the whole world again for `entities`. Option 3 is merge patch where it works and lists merged by id where it doesn't, the same shape Kubernetes chose for the same reason ("strategic merge patch").

- **The format** (`scene/worldPatch.ts`): a patch is shaped like the world, with its field names, plus `"isPatch": true`. A settings group (`lighting`, `meta`, `camera`, …) is merged as JSON Merge Patch: the fields given change, groups inside merge, a list is replaced whole, `null` removes a field so its default applies. A list of things (`entities`, `roads`, `areas`, `fences`, `viewpoints`, `moods`; `data.values` and `data.tables` by `key`, `data.sources` by `id`) takes `remove` (ids), `change` (each a merge patch for the thing with that id) and `add` (whole things with new ids), applied in that order. There's no `set` or `ops` wrapper: the field names say what changes.
- **Applying** (`applyWorldPatch`): to a copy of the world, then read with `readWorld` like any world, and committed as one undo step. What's wrong in a patch (an id that isn't there, an id added twice, a whole list sent, a field that isn't part of a world) is left out and reported; the rest applies.
- **Checking** (`checkPatch`): the patch's own problems, by place in the patch (`patch entities.change[0]`), then the world it makes, checked like any world (ADR-0117), and what it changes in a sentence: "Changes Lighthouse (scale); adds Boat 2; removes Old shed; changes lighting (time)." `POST /api/worlds/validate` takes `{ "world": ..., "patch": ... }`; the format is at `GET /api/worlds/schema/patch`.
- **Build with your AI → Change this world…** asks for a patch (or a whole new world when most of it changes), shows what a pasted patch changes before **Put it in place**, and still takes a whole world. A patch pasted while making a new world says to pick Change this world.

### Consequences

- Good: a change comes back as a few lines; people see what it changes before it's applied; ids make it robust to long lists.
- Good: one shape to learn: a patch reads like the world.
- Bad: not a standard a JSON tool knows; applying it takes our code (small, tested, and the same everywhere it runs).
- Bad: lists without ids (road points, a table's rows, a card's values) are replaced whole: changing one row of a big table sends all its rows. Rows by key could come later.
- Bad: the prompt still carries the whole world, so the AI knows its ids; only the answer shrinks. Handing worlds over by link (TODO.md) is next.

## More information

RFC 6902 (JSON Patch), RFC 6901 (JSON Pointer), RFC 7396 (JSON Merge Patch), Kubernetes strategic merge patch. ADR-0104 (`readWorld`), ADR-0116 (Build with your AI), ADR-0117 (checking a world).
