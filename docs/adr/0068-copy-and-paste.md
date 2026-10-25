---
status: accepted
date: 2026-10-25
---

# 0068. Copy and paste: things and a panel's settings, as JSON on the system clipboard

## Context and problem statement

With several things selectable (ADR-0064), giving a street of lamps one schedule or ten buildings the same colours still meant setting each value by hand on the selection, and nothing moved between worlds: building a district again in another world meant building it again. Ctrl+C and Ctrl+V did nothing in the world.

## Decision drivers

- Settings travel per panel, so one thing (a schedule, the colours) can be copied without the rest.
- Copies move between worlds, tabs and people, and an AI can write them (ADR-0012, ADR-0032).
- Whatever comes back from the clipboard is untrusted (ADR-0026).
- One paste is one undo step (ADR-0009); keyboard rules (ADR-0016).

## Considered options

1. Per panel, or whole objects only.
2. The system clipboard as JSON, or a clipboard inside the app.
3. Ctrl+C / Ctrl+V for whole things now, or later.

## Decision outcome

Chosen: **per panel**, **the system clipboard as JSON**, **things too**.

- **Format:** `{ "app": "isometrics", "type": "things", "entities": [...], "roads": [...], "areas": [...] }` in the world's format, or `{ "app": "isometrics", "type": "settings", "settings": { "kind": … } }` where the kind is `light` (with its id and shape), `colors` (by id), `label`, `motion`, `shape` (with its part) or `object` (shape, colours, lights and label together). The app name comes from `APP_NAME`.
- **Names:** a copy of a thing with a name of its own is named as a preference says (Preferences → Editing → Names of copies, per browser): by default " copy" is added ("Tower copy"); or they're numbered ("Tower" → "Tower 2", "Gate 5" → "Gate 6", older " copy" endings dropped), unique among their kind (`scene/naming.ts`). It applies to duplicates and pastes alike; pasted into a world where the name is free, a thing keeps it. Unnamed things stay unnamed. A label card titled with the object's name follows the new name. When a single object's gizmo leaves a copy behind (ADR-0067), that copy keeps the name and the one that moves gets the new one.
- **Pasting things** goes through `parseOrRepairScene` like any world from outside: unreadable items are left out (and the user told), legacy ids are upgraded. The copies get new ids; vehicles keep driving a road pasted with them, and park if their road isn't in this world. Ctrl+V centres them on the ground under the mouse pointer while it's over the world (render/PointerSpot, so a paste is aimed and can't hide among the originals); the ground's Paste here centres them on the clicked point; otherwise (the pointer over a panel, a menu's Paste) they land where they were, a step over if the originals are still here. They're kept on the ground and selected.
- **Pasting settings** goes through their schemas and onto the selected objects that have the same thing: a light with the same id and shape (else the target's only light of that shape, so a street lamp's light pastes onto a Light part's), colours by id, a shape or a whole object's settings onto the same part, a label card's values and offset (each keeps its own title and description), motion onto vehicles (along the copied road if this world has it, spaced out). A light card also offers **Paste schedule only**. It says how many took it, or what's needed when none did.
- Both warn when what was pasted follows data values this world doesn't have.
- **Where:** every panel that can be copied (a part's shape, Colours, each light card, Label card, Motion; on several objects too) has a Copy / Paste menu in its header. The right-click menus have Copy (Ctrl+C), Copy settings / Paste settings, and the ground's Paste here.
- **Keys:** Ctrl+C, Ctrl+X and Ctrl+V in Edit mode copy, cut and paste the selected things; Ctrl+V with settings on the clipboard pastes them onto the selection. These use the browser's `copy`, `cut` and `paste` events (`editor/useClipboard.ts`), not hotkeys: only those may write and read the clipboard without asking for permission, and they leave text fields and selected text alone. A menu's Paste reads the clipboard directly, which a browser may ask permission for once; if it refuses, the message points to Ctrl+V.

### Consequences

- Good: settings and whole districts move between objects and worlds; AIs can produce pasteable JSON.
- Good: one validation path for everything that comes in.
- Bad: two ways of reaching the clipboard (events for keys, the async API for menus).

## More information

- Code: `src/editor/clipboard.ts`, `src/editor/useClipboard.ts`, `src/ui/CopyPasteMenu.tsx`.
- Related: ADR-0026 (repairing worlds), ADR-0058 (lights), ADR-0060 (colours), ADR-0064 (several things at once).
