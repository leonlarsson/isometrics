---
status: proposed
date: 2026-10-31
---

# 0119. Untrusted input: safe JSON, addresses that wait for a yes, and limits everywhere

## Context and problem statement

Worlds come from anyone: files people open, things pasted, answers pasted back from an AI, patches, and POST /api/worlds/validate from any site. A world can also name links and APIs to read. A security review (by hand, and by an independent reviewer reading only the code) found: opening a world made the browser read every address it named, on a timer, without asking, with no cap on how many (tracking whoever opens it, or making every viewer call someone else's server); `__proto__` keys in untrusted JSON could reach object merges; deeply nested JSON could overflow recursion and crash the validate route; bodies and responses were read whole before their size was checked; patches with many entries took quadratic time; row cells were read through the prototype (a column named "constructor"); links from world data weren't limited to web addresses; and pages sent no security headers.

## Decision drivers

- A world from a stranger must not act on its own: no requests, no code, no styles of its own.
- One door for untrusted JSON, so nothing has to remember to check.
- Every input has a size; nothing grows with an attacker's choice past what a world needs.
- Never at the cost of what people do every day: their own links read on their own, real data that happens to be called "constructor".

## Decision outcome

- **Safe JSON** (`scene/safeJson.ts`): a deep copy without `__proto__` keys (assigning one sets a prototype), refusing nesting deeper than 64 levels (worlds nest about a dozen). `readWorld` (so files, storage, backups, paste and AI answers), patches, the clipboard and POST /api/worlds/validate all go through it. `constructor` and `prototype` stay: assigning them makes an ordinary property, nothing walks paths through them, and real data uses them. Merges skip unsafe keys too (`mergePatch`), and row cells are read with `cellOf` (own cells only).
- **Addresses wait for a yes** (`editor/linkTrust.ts`): a browser keeps the addresses it has agreed to read, by exact address. **Every address starts disabled, whatever its host and whoever made the world, templates included.** Reading one yourself (Read a link or API…) and Allow count as yes, nothing else. When a world opens, or a change to it brings new addresses, a dialog says which addresses wait and why, with **Allow and read them**, **Not now** and **Open the Data tab**; the Data tab lists them ("not read until you allow it") with an **Allow** button on its row. **Addresses this browser reads…** (Data tab, Sources) lists every yes, each with Forget. Even allowed, one source per address and at most 10 addresses are read on their own, never more often than once a minute; each is read once when it becomes readable, then on its timer. Reading sends no cookies and no referrer, only `https:`/`http:` addresses are read, nothing on the viewer's own computer or network (localhost, private and link-local addresses, `.local`) unless the app itself runs there (development), and a response over 20 MB is refused while it downloads. The same addresses, before a shared world is opened at all, are for the shared-link work (TODO.md).
- **Links from data** are links only when they're web addresses (`lib/webAddress.ts`), on top of React's own block on `javascript:`.
- **POST /api/worlds/validate**: a body over 5 MB is refused by its declared length or while it's read (`lib/textUpTo.ts`, shared with links); anything that goes wrong in checking is a JSON answer, in our words, never a crash or the server's insides; answers are `nosniff`.
- **Patches** index things by id once, so a patch of tens of thousands of entries applies in linear time (a test).
- **Very big worlds** (over 20,000 objects, or 100,000 table rows with their pasts) are warned of by the check, shown before a pasted answer is opened: they open, but slowly, and may not fit in the browser's storage.
- **Headers**: pages send `X-Frame-Options: DENY` and a CSP with `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`, `nosniff`, a strict referrer policy and no camera, microphone or location; JSON and Markdown routes send `nosniff`. A CSP that restricts scripts needs nonces for the framework's inline scripts (TODO.md).

**One outside contact is accepted:** 3D text (troika, through drei's Text) fetches fonts from `cdn.jsdelivr.net` for characters the bundled Inter lacks (Chinese, Arabic, emoji…), so a world's text can make a browser contact it. Its host is fixed (a world can't choose where it goes) and the owner trusts the CDN, so it stays; troika's `unicodeFontsURL` (`configureTextBuilder`) can point it at the app itself if that changes.

The only network call the app makes is `readLink`'s fetch, behind the approvals above; images are rendered locally, fonts are bundled, `window.open` only opens `/guide`.

Checked and found safe: nothing renders HTML from strings (no `innerHTML`, `eval`); React escapes all text; colours are `#rrggbb` (`HexColorSchema`), and colours from data are matched against strict patterns and turned into `#rrggbb` before use; Zod 4 skips `__proto__` in `z.record`; the regexes have no catastrophic backtracking; the spreadsheet reader is `read-excel-file`, not SheetJS, so its known CVEs don't apply; nothing exports CSV, so formula injection doesn't arise; `window.open` only opens `/guide`.

### Consequences

- Good: a world from a stranger can't make requests until someone says yes, or reach a prototype, or crash the server; limits are where input enters.
- Good: people's own links work as before (typing one is the yes), and so do the templates.
- Bad: a world someone shares with live data needs one click per address the first time.
- Bad: new code that reads untrusted JSON without `readWorld` must call `safeJson` itself (AGENTS.md says so).

## More information

ADR-0026 (repair on load), ADR-0104 (`readWorld`), ADR-0113 (links and APIs), ADR-0117 (checking a world), ADR-0118 (patches).
