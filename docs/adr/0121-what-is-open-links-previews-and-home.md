---
status: proposed
date: 2026-11-01
---

# 0121. What's open: links that load nothing else, previews kept only when edited, and a home screen

## Context and problem statement

Opening a shared link (ADR-0120) first loaded the browser's last world, then fetched the linked one, asked about its outside addresses over the other world, and loaded a second time. Every opened link also became a world in the list straight away (twice for two clicks), and a link that failed, or a world not opened, fell back to a world nobody asked for. Whether a world was open, opening, or just a link being fetched was spread over a `ready` flag in `AppShell`, the `openingWorld` counter and each dialog's own timing.

And outside addresses are a privacy matter (ADR-0119): reading one tells it who's looking. It must be impossible for any code path to read one before this browser has said yes to it.

## Decision drivers

- A link opens that world and nothing else.
- The one decision that matters before a shared world is built is about its outside addresses; anything else is friction.
- A stranger's world shouldn't clutter one's own until one wants it.
- Never fall back to a world nobody asked for.
- Zero requests to an address before it's allowed, enforced in one place, checked by a test.

## Considered options

1. Keep loading the last world, and ask over it (as before).
2. One "what's open" state in the store; links fetched with nothing else loaded, opened as previews; a home screen for when nothing is open.
3. The same, but with autosave off for every world (a world saved only on request).

## Decision outcome

Chosen option: **2**. Option 3 would put people's own work at risk to solve a problem only links have (ADR-0020); turning autosave off stays an idea of its own in `TODO.md`.

- **What's open** (`editor/whatIsOpen.ts`, the store's `whatIsOpen`, runtime only): `starting`, `link` (being fetched, or asking), `home` (and why), or `world` with `preview` set while it's a world from a link that isn't kept. The loading screen, the home screen, the toolbar, the File menu, saving and the dialogs all go by it; the world's panes, view and dialogs mount only once a world is open, so nothing of the starter world the store begins with shows while a link opens.
- **Links** (`editor/openLink.ts`): `/w/<id>` and `/templates/<id>` redirect to `/?shared=` and `/?template=`, and the editor loads nothing else. The loading screen says it's fetching (and that a new link can take a minute to arrive). A template, or a shared world that reads nothing from outside, opens straight away. A shared world that reads from addresses this browser hasn't allowed waits, unbuilt, over its own loading card, for one answer: **Open and allow**, **Open** (they wait in the Data tab under Sources) or **Don't open it**. That answer is the only question about them. A link to a patch (ADR-0118, kept for handing changes back from an AI) isn't opened: there's no world for it to change, and read as a world it would be an empty one, so the home screen says why and where such links go (Build with your AI → Change this world).
- **Previews:** a world from a link opens in View mode and isn't kept: no autosave, no camera memory, not in the list. A bar says so, with **Keep a copy** and **Close**; **Edit** asks to keep a copy first ("Keep a copy and edit" / "Stay in View"). Kept, it becomes a world of one's own with a title no other has, as it is on screen. The address keeps `?shared=` while the preview is open, so a reload opens it again; it goes once anything else is open.
- **The home screen:** no world open, like an empty editor window. Why, when there's something to say (a link that failed, one not opened, a preview closed, no worlds left), New world…, Open file…, Build with your AI…, one's worlds to open, the welcome and the guide. It shows for a failed link, **Don't open it**, a closed preview with no world of one's own to go back to, and when the last world is deleted (and on start while there are none left). Preferences → Editing → **When the app opens**: open the last world (the default) or show the home screen. A first visit, and a browser after Wipe everything, still open the starter world.
- **Outside requests:** `readLink` is the only code that requests an address outside this site, and it refuses one this browser hasn't allowed before anything is sent, whoever calls it. Read a link or API… allows the typed address before reading it (taken back if reading fails). `editor/outsideRequests.test.ts` reads the source: no other file may call `fetch` (or XHR, EventSource, WebSocket, sendBeacon), and the share links' code only at paths on this site.

### Consequences

- Good: a link costs one load, shows only its own world, and leaves nothing behind unless kept.
- Good: what's open is one value; new screens and dialogs read it instead of working out timing.
- Good: reading an outside address without a yes would need a change the test catches.
- Bad: a world from a link is lost on closing the tab unless kept (said in its bar; reloading reopens it while the link lasts).
- Bad: one more screen to keep in step with the File menu.

## More information

- ADR-0119 (addresses wait for a yes), ADR-0120 (share links), ADR-0100 (the loading screen), ADR-0044 (several worlds), ADR-0057 (the save status).
- `editor/whatIsOpen.ts`, `editor/openLink.ts`, `ui/HomeScreen.tsx`, `ui/PreviewBar.tsx`, `ui/KeepPreviewDialog.tsx`, `ui/LinkQuestion.tsx`, `editor/readLink.ts`, `editor/outsideRequests.test.ts`.
