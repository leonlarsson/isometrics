---
status: proposed
date: 2026-10-31
---

# 0117. Checking a world: POST /validate, and worlds with their defaults left out

## Context and problem statement

Worlds written by AIs (ADR-0116) go through `readWorld()`, which repairs what it must (ADR-0026) but only counts what it fixed: "3 objects were left out". Nobody can act on that, least of all the AI that wrote it. And a world can open with no repairs at all yet look wrong: a part kind that doesn't exist, a card showing a value that isn't there, an object over the ground's edge. Trying the flow with Claude showed a second problem: asked to change a world, it streamed the whole world back, every default written out, because the prompt carried it that way.

## Decision drivers

- Say what's wrong and where, in words a person or an AI can act on.
- One check, wherever a world arrives: an AI's tool, the paste box, anything else.
- Keep prompts and answers short; prefer a file for anything long.

## Considered options

1. Only the repair report, as before.
2. **A check that lists problems and warnings by path, served at POST /validate and run on paste.**
3. JSON Schema validation alone (`/schema.json` with any validator).

## Decision outcome

Chosen option: **2**. JSON Schema alone (3) can't see what the parts know (part kinds, their props and colours) or references across the world (rows, values, viewpoints).

- `checkWorld()` (`parts/checkWorld.ts`) brings old names up to date like `readWorld`, then lists **problems** (what the strict parse rejects, by path with ids: `entities[2] "shop_north".position`, and ids used twice), each something opening it would repair or leave out, and **warnings** (what opens but won't look as meant: unknown part and vehicle kinds, props and colours a part doesn't have, rows, tables and values that aren't there, an opening viewpoint that isn't, a table whose key column isn't one of its columns, an object over the ground's edge, its footprint turned as it stands). Every template checks out with neither (a test).
- **POST /validate** answers with that check as JSON (any origin may ask; up to 5 MB; a body that isn't JSON is a 400). GET says how to use it. The prompt offers it to AIs that can make HTTP requests; the guide's format section describes it.
- **Build with your AI** runs the same check as an answer is pasted or its file opened (no round trip: the same code, offline too): "Checked: it opens as written, with 12 objects, 3 roads", or the problems and warnings listed, with **Copy the problems for your AI** to send them back. **Open it** still opens it, repaired.
- **Worlds with their defaults left out** (`parts/compactWorld.ts`): the world a change prompt carries leaves out every field at its default (each list item against its schema's defaults, an object's props against its part's), and the prompt asks the AI to answer the same way, **as a file** (`world.json`) when it can make one, else in one code block. Every template reads back as it was (a test).

### Consequences

- Good: AIs and people get problems they can fix, by place; templates are held to the same check.
- Good: change prompts and answers shrink to a fraction; a file avoids a wall of streamed text.
- Bad: warnings are a judgement (an object over the edge may be meant); they never block opening.
- Bad: a change still sends the whole world back. Next: changes as a patch (TODO.md), and handing worlds over by link (TODO.md).

## More information

ADR-0026 (repair on load), ADR-0032 (`/schema.json`), ADR-0104 (`readWorld`), ADR-0116 (Build with your AI).
