---
status: proposed
date: 2026-10-31
---

# 0120. Worlds shared by link: public snapshots in Cloudflare KV, kept until they expire

## Context and problem statement

Worlds live in one browser. Sharing one meant saving a file and sending it; handing one to an AI meant pasting tens of kilobytes into a chat, and pasting its answer back (ADR-0116, ADR-0118). A link would do both, but anything kept on our servers is public to whoever has its link, and Cloudflare KV, where it would be kept, is eventually consistent: a new key can take up to a minute to reach other locations.

## Decision drivers

- Opt-in only: nothing leaves the browser unless someone asks, and they're told plainly that it's public.
- No accounts: a link is the key to a world, so it must be unguessable, and expire.
- Eventual consistency must never show an old version.
- Not a place to keep anything but worlds: no file hosting.
- A shared world is untrusted: it's checked like any other, and asks before reading anything from outside (ADR-0119), before it's even loaded.

## Considered options

1. Cloudflare KV, a snapshot per share under a random key, with KV's own expiry.
2. KV with one key per world, re-saved in place (an updatable link).
3. R2 (strongly consistent, but expiry only in whole days) or Durable Objects (strong consistency, more machinery).

## Decision outcome

Chosen option: **1**. Never overwriting a key means eventual consistency can only mean "not there yet", which the app waits out, never an old version; KV deletes each key when it expires; and it needs no more than a binding. An updatable link (2) would show an old world for up to a minute after an update; R2 or Durable Objects (3) are more than snapshots need.

- **Storing** (`server/userWorlds.ts`, `POST /api/user-worlds?expiresIn=`): a world that opens exactly as written (`validateWorld` valid: the app's own Zod schema, nothing to repair; one that would need repairs is refused with its problems), kept as read with its defaults left out (`compactWorld`), or a patch (ADR-0118) that is one, checked on its own (`validatePatchAlone`: only the world's fields, lists changed only by `remove`, `change` with ids and `add`, each change's fields that kind of thing's and its values ones they take, and what it adds and the settings it merges checked on an empty world), kept an hour at most and 500 kB at most; anything else is refused with 400 and its problems, where and what. The app reads its own world through `repairWorld` before posting it (repairing what an editing bug might have left, with a warning in the console), so a person sharing is never refused for a problem they didn't make; the API's strictness is for what others post (AIs, scripts). Kept for an hour, a day, 7 days or 30 days (an hour when not said, for an AI handing back its answer), under 22 characters of 128 random bits, with the SHA-256 of a separate delete key in its metadata (the key itself is shown once). At most 5 MB, and 10 shares a minute from one address (a Workers rate limit). Any site or tool may post (CORS `*`), so AIs that make HTTP requests can.
- **Reading** (`GET /api/user-worlds/<id>`): the JSON, `nosniff` and `noindex`, cached for a minute (so a stopped link doesn't linger); a missing one says it may have expired, been deleted, or not arrived yet. **Deleting** (`DELETE`, `Authorization: Bearer <delete key>`).
- **Share a link…** (File menu, and the save status next to it, where saving is managed): says the world is kept on the site's servers and **anyone with the link can open it and make a copy until it expires**, to share nothing private, and that its data and the addresses it reads go with it; you pick how long (7 days by default), and only **Create a public link** makes one. Then: the link to copy, until when, that it's a snapshot (share again to send changes) and may take a minute to open everywhere, and **Stop sharing**. Links shared from this browser are listed with their delete keys (in this browser only), each with Copy and Stop sharing.
- **Opening** (`/w/<id>`, and `/templates/<id>` for a template): redirected to the editor's own page (`/?shared=`, `/?template=`) so cleaning the address afterwards doesn't start the editor over. A shared world is fetched from this site only, asked again every few seconds for up to a minute while it's still arriving (said once, in a note), and read with `repairWorld`. **If it reads anything from outside, a warning names each address before it's loaded**, once the world open now is on screen (never over its loading screen): **Open and allow** (they're allowed and read), **Open** (they wait in the Data tab under Sources, ADR-0119) or **Don't open it**. It's the one question about them: the usual one for a world's outside addresses isn't asked again. It opened as a new world next to the others; since ADR-0121 it opens as a preview, with nothing else loaded.
- **Handing worlds to an AI** (Build with your AI): changing a world, **Hand the world over as a link** (off by default; says the link is public for an hour) puts a link to its JSON in the prompt instead of the world. Any answer can be a link to a world shared on this site, read from it (only this site's links are read); the prompt tells AIs that make HTTP requests they can post their answer and give the link.

### Consequences

- Good: sharing is a link; AI prompts and answers can be links; no accounts, nothing kept past its expiry, nothing uploaded unasked.
- Good: snapshots make eventual consistency harmless.
- Bad: a link is public to whoever gets it, until it expires or is stopped; stopping it takes up to a minute to reach everywhere.
- Bad: the delete keys live only in the browser that shared; another browser can't stop a link.
- Bad: previews of pull requests use the same namespace as production.

## More information

ADR-0116 (Build with your AI), ADR-0117 (checking a world), ADR-0118 (patches), ADR-0119 (untrusted input, addresses that wait for a yes). Bindings in `wrangler.jsonc`: `USER_WORLDS` (KV, "Isometrics User Worlds") and `USER_WORLD_UPLOADS` (rate limit).
