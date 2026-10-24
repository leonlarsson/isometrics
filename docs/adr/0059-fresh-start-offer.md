---
status: accepted
date: 2026-10-24
---

# 0059. After a big update, the app offers once to start fresh

## Context and problem statement

While the app is an experimental playground, updates can change a lot: new settings, new defaults, reworked parts. Old worlds are repaired on load (ADR-0026) and checked against old-world tests (ADR-0056), so they still open, but after a big change the cleanest experience is often to start over. People only find File → Wipe everything (ADR-0045) if they look for it, and nothing tells them when it's worth doing.

## Decision drivers

- The developer can recommend a fresh start after a release, without forcing it.
- People decide, and can keep worlds by saving them to files first (ADR-0020).
- Asked once per recommendation, never on a first visit, never again after a wipe.

## Considered options

1. A fresh-start number in the code; when it goes up, browsers with worlds are offered a wipe once.
2. Wipe automatically after big updates.
3. Only a note in the release notes or the work-in-progress banner.

## Decision outcome

Chosen option: **1**.

- **The number:** `FRESH_START` in `src/editor/wipeOffer.ts` (0 for now). The developer bumps it in a release that warrants a fresh start.
- **Who's asked:** a browser whose last-seen number (`<app>:fresh-start-seen` in localStorage) is lower and that has worlds. A browser with nothing stored (a first visit, or just after a wipe) takes the number silently. Without storage, it's never asked.
- **The offer** (`ui/FreshStartOffer.tsx`), when the app has loaded: "A fresh start is recommended", saying the developer recommends wiping everything the app keeps in this browser, and to save worlds to files first. Buttons: **Save to file**, **Not now** and **Start fresh…**, which opens File → Wipe everything's two confirmations (`ui/WipeEverything.tsx`, now shared by both). Closing it either way records the number, so it isn't asked again until the next bump.
- The kit's `ConfirmDialog` gains a `cancelLabel` ("Not now").

### Consequences

- Good: a big update can come with a clear, optional fresh start, using the same safe wipe flow.
- Bad: people who say Not now carry on with older worlds; repairing them on load is still required.

## More information

`src/editor/wipeOffer.ts` (+ tests), `src/ui/FreshStartOffer.tsx`, `src/ui/WipeEverything.tsx`. Related: ADR-0020, ADR-0026, ADR-0045, ADR-0056.
