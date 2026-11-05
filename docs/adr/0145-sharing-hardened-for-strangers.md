---
status: proposed
date: 2026-11-05
---

# 0145. Sharing hardened for strangers: limits, gzip in KV, a kill switch and takedowns; screens for browsers that can't draw or keep anything

## Context and problem statement

Sharing by link (ADR-0120, ADR-0134) was built for people sharing their own worlds and AIs handing back answers. A public launch brings visitors who will try to misuse it: a share was a 5 MB, 30-day public text host, limited per IP address (an IPv6 /64 is billions of addresses), stored uncompressed, with no way for the owner to stop sharing or take one down without its delete key, and nothing on a shared world's preview saying who made it. At the same time strangers arrive in browsers the app had never met: WebGL turned off, site data blocked, links mistyped. Those showed the crash screen ("Your world is still saved", which was false) or asked the site for a missing link every 4 seconds for a minute.

## Decision drivers

- A share must not be a cheap place to keep anything but a world, nor able to freeze the tab of whoever opens it.
- Storage cost must be bounded and small.
- The owner must be able to stop all new shares at once, and delete any one, without a deploy.
- Nothing already saved or opened is tightened: the limits are on sharing only (AGENTS.md: never tighten a limit).
- Every entry already in KV must still open.
- A stranger in an unusual browser sees what to do, never a crash.

## Considered options

1. Limits in the schema (strings, lists), as for any world.
2. Limits at share time only (`server/shareLimits.ts`), with gzip in KV, a kill switch var and an admin token secret.
3. Moving shares to R2 or Durable Objects with their own accounting.

## Decision outcome

Chosen option: **2**. The schema is what saved worlds and files are read with: tightening it would break worlds people have (ADR-0026, ADR-0106). Share time is where a stranger's world arrives; there it can be refused in our words. KV stays (ADR-0120's reasons hold); 3 is more machinery than limits need.

- **Who's counted** (`server/rateLimitKey.ts`): the share and check rate limits count an IPv4 address on its own and an IPv6 address by its /64 (`2001:db8:1:2::/64`); an IPv4-mapped IPv6 address is its IPv4 one; anything unreadable shares one key.
- **What a share can hold** (`server/shareLimits.ts`, checked in `server/userWorlds.ts` and `userPrefabs.ts` before anything else is done with it): no text (a value or a key) over **2,000 characters**, refused with its path (`meta.title, a text of 2,001 characters…`); no list over **20,000** items; at most **10,000 objects, 1,000 roads, 1,000 areas, 1,000 fences, 500 prefabs and 20,000 data rows** (every table's rows and past rows together) in a world, counting what a patch adds; at most **2,000 pieces and 200 fences** in a prefab. As kept, a world is at most **1.5 MB** (defaults left out; Stockholm, the biggest template, is about 519 kB) and a prefab **300 kB**. What's sent is still read up to 5 MB (worlds) and 1 MB (prefabs), as a world sent with its defaults written out can be a few times its kept size. Every template and old-world fixture passes, a test checks.
- **Kept gzipped** (`server/storedText.ts`): `CompressionStream("gzip")` in the Worker before `put`, `DecompressionStream` on reading (Stockholm keeps as about 40 kB). The metadata says `encoding: "gzip"`; entries kept before have no encoding and are plain JSON text. Reading goes by the bytes themselves: gzip starts with `1f 8b`, which no JSON text does, so either kind reads whatever its metadata says. GET answers the JSON as before.
- **Metadata** (`fitMetadata`): the title (or a prefab's name) without control characters or line separators, cut by whole characters until the metadata is at most 900 bytes as JSON (KV's limit is 1,024), so no title can make a share fail.
- **The kill switch:** the `SHARING_DISABLED` var (`wrangler.jsonc`, `"false"`): `"true"` (or `1`, `yes`, `on`) and every POST to `/api/user-worlds` and `/api/user-prefabs` answers 503 "Sharing is paused for now. Try again later."; links already shared keep opening. The share dialogs say it in place and grey out Create a public link ("(sharing is paused)").
- **Takedowns:** the `ADMIN_DELETE_TOKEN` secret (`wrangler secret put`, never in the repo, at least 32 characters or it's ignored) is taken in place of a share's delete key by DELETE on both, compared in constant time (both hashed with SHA-256, then compared byte by byte); delete keys are compared the same way now. `docs/runbooks/takedown.md` says how, with `wrangler kv key delete` as the fallback.
- **Someone else's:** a shared world's and a shared prefab's preview bar says "Made by someone else and shared by link, not by Isometrics", with a **Report** link: an email to `ABUSE_CONTACT` (`lib/app.ts`) with the link and id written in. A data source's link names its host after its name: "Name (example.com)", so a name can't pass a link off as another site's.
- **Checking:** POST `/api/worlds/validate` takes at most 2 MB (was 5 MB), has its own rate limit (`WORLD_VALIDATIONS`, 30 a minute) and runs `safeJson` before checking, so nesting too deep is answered in our words.
- **CORS:** GET and DELETE of a shared world or prefab no longer send `Access-Control-Allow-Origin: *`: the app reads them from its own site, and AIs and tools read them as any page, not from another site's page. POST keeps it, as ADR-0120 lets AIs that make requests from a page of their own post their answers.
- **Missing links:** a link this browser didn't share is asked for **4 times**, 4 seconds apart, before the home screen says it can't be opened; one this browser shared, or an AI's answer pasted into Build with AI, still waits out the minute a new link can take.
- **No WebGL 2** (`render/webgl.ts`, checked by the editor's route before anything mounts): "Your browser can't draw 3D here", how to turn on hardware acceleration in Chrome, Edge and Firefox, or try another browser, Try again, and links to `/guide` and `/parts` (whose pictures fall back to colour chips). A context lost while the view is open shows a bar, "The 3D view stopped drawing", with **Reload**.
- **No storage** (`lib/storage.ts`, `storageAvailable()`): whatever reads storage as it loads asks first (looking at `localStorage` throws when site data is blocked). The app opens with a bar over the view, "Nothing will be saved in this browser", with Save to file (it can be hidden until the page reloads); the save status says Not saved from the start, and the crash screen only says a world is saved when the save status says when.

### Consequences

- Good: a share costs at most 1.5 MB of input and about a thirteenth of it to keep; abuse from an IPv6 block counts as one sender; the owner can pause sharing and take anything down in a minute, without a deploy.
- Good: strangers in odd browsers get a screen or a notice that says what's going on.
- Good: nothing already saved, opened from a file or kept in KV changes how it opens.
- Bad: a world bigger than 1.5 MB as kept (or with a text over 2,000 characters) can't be shared by link, only saved to a file.
- Bad: a browser page on another site can no longer read a shared world's JSON; tools and AIs reading it server-side aren't affected.
- Bad: someone else's link that's moments old and hasn't reached their part of the world yet now fails after about 12 seconds instead of a minute; opening it again works.
- Bad: previews of pull requests still use production's KV namespaces until the owner creates preview ones (the runbook says how).

## More information

ADR-0119 (untrusted input), ADR-0120 (worlds shared by link), ADR-0121 (what's open), ADR-0134 (prefabs shared by link). `server/rateLimitKey.ts`, `server/shareLimits.ts`, `server/storedText.ts`, `server/sharingControls.ts`, `lib/report.ts`, `lib/storage.ts`, `render/webgl.ts`, `ui/NoWebGlScreen.tsx`, `ui/BrowserLimitBars.tsx`, `docs/runbooks/takedown.md`.
