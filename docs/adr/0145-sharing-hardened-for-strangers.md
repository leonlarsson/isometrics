---
status: proposed
date: 2026-11-05
---

# 0145. Sharing hardened for strangers: a size cap and a kill switch; screens for browsers that can't draw or keep anything

## Context and problem statement

Sharing by link (ADR-0120, ADR-0134) was built for people sharing their own worlds and AIs handing back answers. A public launch brings visitors who may misuse it: a share was a 5 MB, 30-day public text host, limited per IP address (an IPv6 /64 is billions of addresses), with no way for the owner to stop new shares, and nothing on a shared world's preview saying who made it. At the same time strangers arrive in browsers the app had never met: WebGL turned off, site data blocked, links mistyped. Those showed the crash screen ("Your world is still saved", which was false) or asked the site for a missing link every 4 seconds for a minute. Use is expected to be low, and the site runs on Workers Paid.

## Decision drivers

- Storage cost must be bounded and small.
- The owner must be able to stop all new shares at once without a deploy, and take one down straight from KV.
- Nothing already saved or opened is tightened: the limits are on sharing only (AGENTS.md: never tighten a limit).
- Every entry already in KV must still open.
- A stranger in an unusual browser sees what to do, never a crash.
- No more machinery than low use needs.

## Considered options

1. Limits in the schema, as for any world.
2. A size cap at share time only (`server/shareLimits.ts`) and a kill switch var; takedowns straight from KV.
3. As 2, and kept gzipped in KV (about 13 times smaller).
4. Also caps on texts and lists, an admin token for takedowns and a Report link to an abuse address.
5. Moving shares to R2 or Durable Objects with their own accounting.

## Decision outcome

Chosen option: **2**. The schema is what saved worlds and files are read with: tightening it would break worlds people have (ADR-0026, ADR-0106). Share time is where a stranger's world arrives; there it can be refused in our words. With low use expected, 3 and 4 are more than needed: gzip saves pennies on honest shares and nothing on junk (which doesn't compress), and the owner deletes from KV if something must go. KV stays (ADR-0120's reasons hold); 5 is more machinery than limits need.

- **Who's counted** (`server/rateLimitKey.ts`): the share and check rate limits count an IPv4 address on its own and an IPv6 address by its /64 (`2001:db8:1:2::/64`); an IPv4-mapped IPv6 address is its IPv4 one; anything unreadable shares one key.
- **How big a share can be** (`server/shareLimits.ts`): as kept, a world is at most **2 MB** (defaults left out; 1.5 MB until 2026-11-07; Stockholm, the biggest template, is about 519 kB) and a prefab **300 kB**, refused in our words. What's sent is still read up to 5 MB (worlds) and 1 MB (prefabs), as a world sent with its defaults written out can be a few times its kept size. Every template and old-world fixture is well inside it, a test checks.
- **Metadata** (`fitMetadata`, `server/sharingControls.ts`): the title (or a prefab's name) without control characters or line separators, cut by whole characters until the metadata is at most 900 bytes as JSON (KV's limit is 1,024), so no title can make a share fail.
- **The kill switch:** the `SHARING_DISABLED` var (`wrangler.jsonc`, `"false"`): `"true"` (or `1`, `yes`, `on`) and every POST to `/api/user-worlds` and `/api/user-prefabs` answers 503 "Sharing is paused for now. Try again later."; links already shared keep opening. The share dialogs say it in place and grey out Create a public link ("(sharing is paused)").
- **Someone else's:** a shared world's and a shared prefab's preview bar says "Made by someone else and shared by link, not by Isometrics". A data source's link names its host after its name: "Name (example.com)", so a name can't pass a link off as another site's.
- **Checking:** POST `/api/worlds/validate` takes at most 2 MB (was 5 MB), has its own rate limit (`WORLD_VALIDATIONS`, 30 a minute) and runs `safeJson` before checking, so nesting too deep is answered in our words.
- **CORS:** GET and DELETE of a shared world or prefab no longer send `Access-Control-Allow-Origin: *`: the app reads them from its own site, and AIs and tools read them as any page, not from another site's page. POST keeps it, as ADR-0120 lets AIs that make requests from a page of their own post their answers.
- **Missing links:** a link this browser didn't share is asked for **4 times**, 4 seconds apart, before the home screen says it can't be opened; one this browser shared, or an AI's answer pasted into Build with AI, still waits out the minute a new link can take.
- **No WebGL 2** (`render/webgl.ts`, checked by the editor's route before anything mounts): "Your browser can't draw 3D here", how to turn on hardware acceleration in Chrome, Edge and Firefox, or try another browser, Try again, and links to `/guide` and `/parts` (whose pictures fall back to colour chips). A context lost while the view is open shows a bar, "The 3D view stopped drawing", with **Reload**.
- **No storage** (`lib/storage.ts`, `storageAvailable()`): whatever reads storage as it loads asks first (looking at `localStorage` throws when site data is blocked). The app opens with a bar over the view, "Nothing will be saved in this browser", with Save to file (it can be hidden until the page reloads); the save status says Not saved from the start, and the crash screen only says a world is saved when the save status says when.
- **Previews** of pull requests share production's KV namespaces on purpose.

### Taking a share down

A share's id is the 22 characters after `/w/` (a world or a patch) or `/p/` (a prefab). Delete it straight from KV; it stops opening everywhere within about a minute (KV is eventually consistent, and GET answers are cached for 60 seconds):

```sh
# A world (or a patch): the USER_WORLDS namespace
pnpm exec wrangler kv key delete <id> --namespace-id a74a79e512924e1d8f78cc010d5b7426 --remote

# A prefab: the USER_PREFABS namespace
pnpm exec wrangler kv key delete <id> --namespace-id 6f1ee6e868f74e6eb799f06ea97d9515 --remote
```

Without `--remote`, wrangler acts on the local development store, not production.

To stop all new shares: Cloudflare dashboard → Workers & Pages → `isometrics` → Settings → Variables and Secrets → `SHARING_DISABLED` → `true` → Deploy (and `false` the same way to turn it back on). Or set `"SHARING_DISABLED": "true"` under `vars` in `wrangler.jsonc` and deploy; a deploy from the repo sets the var to what the file says, so a pause made in the dashboard is undone by the next deploy unless the file says `"true"` too.

### Consequences

- Good: a share costs at most 2 MB of input and about a thirteenth of it to keep; abuse from an IPv6 block counts as one sender; the owner can pause sharing in a minute, without a deploy.
- Good: strangers in odd browsers get a screen or a notice that says what's going on.
- Good: nothing already saved, opened from a file or kept in KV changes how it opens.
- Bad: a world bigger than 2 MB as kept can't be shared by link, only saved to a file.
- Bad: no Report link or admin delete: a takedown is a `wrangler` command run by the owner.
- Bad: a browser page on another site can no longer read a shared world's JSON; tools and AIs reading it server-side aren't affected.
- Bad: someone else's link that's moments old and hasn't reached their part of the world yet now fails after about 12 seconds instead of a minute; opening it again works.

## More information

ADR-0119 (untrusted input), ADR-0120 (worlds shared by link), ADR-0121 (what's open), ADR-0134 (prefabs shared by link). `server/rateLimitKey.ts`, `server/shareLimits.ts`, `server/sharingControls.ts`, `lib/storage.ts`, `render/webgl.ts`, `ui/NoWebGlScreen.tsx`, `ui/BrowserLimitBars.tsx`.
