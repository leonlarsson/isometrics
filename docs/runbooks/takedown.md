# Runbook: taking down shared worlds and prefabs

What to do when something shared by link (ADR-0120, ADR-0134) must go: a report came in (the **Report** link in a shared world's or prefab's preview bar emails `ABUSE_CONTACT`, `src/lib/app.ts`, with the link and its id), or sharing is being abused. ADR-0145 has the why.

Production is `https://isometrics.leonlarsson.com`. A share's id is the 22 characters after `/w/` (a world or a patch) or `/p/` (a prefab):

```
https://isometrics.leonlarsson.com/w/5ttCNb8m9AVF1wwYCij3gA   → world id 5ttCNb8m9AVF1wwYCij3gA
https://isometrics.leonlarsson.com/p/Q2r7Lw0mXyZbC1dEfGhIjK   → prefab id Q2r7Lw0mXyZbC1dEfGhIjK
```

A deleted share stops opening everywhere within about a minute (KV is eventually consistent, and GET answers are cached for 60 seconds).

## Once, before launch: the admin token

The admin token is a Worker secret, never in the repo or in `wrangler.jsonc`. Make a long random one and set it:

```sh
openssl rand -base64 48            # copy the output somewhere safe, e.g. a password manager
pnpm exec wrangler secret put ADMIN_DELETE_TOKEN
# paste the token when asked
```

It must be at least 32 characters, or it's ignored and nothing can be deleted with it. Setting it again replaces it (do that if it may have leaked). To see that it's set: `pnpm exec wrangler secret list`.

## 1. Delete one share (the admin DELETE)

The token is taken in place of the share's own delete key:

```sh
export ADMIN_DELETE_TOKEN='…'      # the secret, from where you keep it

# A world (or a patch):
curl -i -X DELETE \
  -H "Authorization: Bearer $ADMIN_DELETE_TOKEN" \
  https://isometrics.leonlarsson.com/api/user-worlds/<id>

# A prefab:
curl -i -X DELETE \
  -H "Authorization: Bearer $ADMIN_DELETE_TOKEN" \
  https://isometrics.leonlarsson.com/api/user-prefabs/<id>
```

The answer is `200 {"result":"deleted"}`, `404 {"result":"gone"}` (already expired or deleted, or the id is wrong) or `403 {"result":"refused"}` (the token isn't the secret, or the secret isn't set). To look before deleting: `curl https://isometrics.leonlarsson.com/api/user-worlds/<id>`.

## 2. If the API can't do it: delete the KV key

The shares are keys in two KV namespaces, the share's id as the key (ids from `wrangler.jsonc`):

| What | Binding | Namespace id |
|---|---|---|
| Worlds and patches | `USER_WORLDS` | `a74a79e512924e1d8f78cc010d5b7426` |
| Prefabs | `USER_PREFABS` | `6f1ee6e868f74e6eb799f06ea97d9515` |

```sh
# A world (or a patch):
pnpm exec wrangler kv key delete <id> --namespace-id a74a79e512924e1d8f78cc010d5b7426 --remote

# A prefab:
pnpm exec wrangler kv key delete <id> --namespace-id 6f1ee6e868f74e6eb799f06ea97d9515 --remote
```

Without `--remote`, wrangler acts on the local development store, not production. To see a key's metadata first (its title, when it was made and expires): `pnpm exec wrangler kv key list --namespace-id <namespace id> --remote --prefix <id>`. Values are kept gzipped (ADR-0145); older ones are plain JSON.

## 3. Stop all new shares: the kill switch

While `SHARING_DISABLED` is `"true"`, every POST to `/api/user-worlds` and `/api/user-prefabs` answers `503` "Sharing is paused for now. Try again later.", and the app's share dialogs say so and grey out **Create a public link**. Links already shared keep opening; delete them one by one as above. Build with AI's **Hand the world over as a link** fails too (its toast says to turn the link off and put the world in the prompt instead).

The quickest way, without a deploy: Cloudflare dashboard → Workers & Pages → `isometrics` → Settings → Variables and Secrets → `SHARING_DISABLED` → `true` → Deploy. To turn it back on, set it to `false` the same way.

Or in the repo: set `"SHARING_DISABLED": "true"` under `vars` in `wrangler.jsonc` and deploy (`pnpm run deploy`, or push to `main`, which deploys). Note that a deploy from the repo sets the var back to what `wrangler.jsonc` says, so a pause made in the dashboard is undone by the next deploy unless the file says `"true"` too.

To check: `curl -i -X POST -d 'not a world' https://isometrics.leonlarsson.com/api/user-worlds` answers `503` while paused, and `400` (it isn't JSON, so nothing is kept) once sharing is on again.

## Preview builds use production's KV

Pull requests get a preview build (`previews` in `wrangler.jsonc`), and **its KV namespaces are production's**: a preview reads, writes and deletes the very worlds and prefabs people shared on the live site, and code in a pull request runs with them. Before launch, the owner should:

1. Create preview namespaces (this repo's tooling doesn't create Cloudflare resources):
   ```sh
   pnpm exec wrangler kv namespace create "Isometrics User Worlds (previews)"
   pnpm exec wrangler kv namespace create "Isometrics User Prefabs (previews)"
   ```
2. Put their ids in `previews.kv_namespaces` in `wrangler.jsonc`, in place of production's, and remove the WARNING comment above it.
3. Confirm that pull requests from forks are never built or deployed as previews (Cloudflare dashboard → Workers & Pages → `isometrics` → Settings → Builds: the preview branch settings and whether builds run for pull requests from forks), so a stranger's pull request can't run code against any namespace.

Until then, don't merge or preview pull requests from people you don't know.

## The limits, for reference

What a share can hold is in `src/server/shareLimits.ts` (ADR-0145): no text over 2,000 characters; at most 10,000 objects, 1,000 roads, areas and fences, 500 prefabs and 20,000 data rows in a world; a world at most 1.5 MB as kept and a prefab 300 kB; 10 shares a minute from one IPv4 address or IPv6 /64, and 30 checks a minute of `/api/worlds/validate`.
