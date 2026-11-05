# Launch checklist

The public launch at https://isometrics.leonlarsson.com: what's done in code, and what only the owner can do. From the launch audits of 2026-11-05 (security, abuse and cost; first impression).

## Before posting

### Cloudflare (owner)

- [ ] **Workers Paid** ($5 a month). Free can't take a front-page day:
  - 10 ms of CPU per request, while a share takes about 500 ms
  - 100k requests a day, while every page's HTML is a Worker request
  - 1,000 KV writes a day, so sharing would stop after the first 1,000 shares
- [ ] **A usage or billing notification** in the dashboard.
- [ ] **The custom domain:** attach `isometrics.leonlarsson.com` to the Worker.
- [ ] **Redirect `isometrics.ragnarok.workers.dev` to it.**
  - Worlds are kept per address, so do this before posting.
  - Bring your own worlds across first: Export this browser on the old address, then import the file on the new one (ADR-0140).
- [ ] **HSTS** in the zone's SSL/TLS settings.
- [ ] **Previews:** pull-request previews use production's KV namespaces, and the repo is public.
  - Create separate preview namespaces.
  - Confirm that pull requests from forks aren't built.
- [ ] **After the hardening PR merges:**
  - `wrangler secret put ADMIN_DELETE_TOKEN`
  - set the abuse contact address (`ABUSE_CONTACT`)
  - read `docs/runbooks/takedown.md`

### GitHub (owner)

- [ ] **Repository description:** "Build animated 3D miniature worlds that show your data, in the browser."
- [ ] **Homepage:** the live address.
- [ ] **Topics:** threejs, react-three-fiber, data-visualization, isometric.

### Pictures (owner, real GPU)

- [ ] **README gallery:** add Stockholm, and shots of the app itself (TODO.md, Before going public): `node.exe scripts/gallery.mjs`.
- [ ] **A short GIF under the README's pitch:** Stockholm's viewpoint tour in View mode.
- [ ] **Starter pictures:** retake them on the real GPU once the first-impression PR lands (its script).
- [ ] **A bench check of the merged lights and Stockholm:**
  ```bash
  node.exe scripts/bench.mjs stockholm view,view-ultra,edit
  ```

## In code

| | What | Where |
|---|---|---|
| Done | Only the published site is indexed. Shared worlds, prefabs and previews never are. `robots.txt`. | `launch-prep` |
| Done | Link previews: an absolute picture, `og:site_name`, `og:image:alt`, `twitter:image`. | `launch-prep` |
| Done | Icons for phones and older browsers. | `launch-prep` |
| Done | A splash while the code loads, and a note when scripts are off. | `launch-prep` |
| Done | The hashed build files cached for a year (`_headers`). | `launch-prep` |
| Done | The banner says "Early preview", explains how to keep a copy, and can be closed. | `launch-prep` |
| Done | The README has the live link and says the source is available, not open. | `launch-prep` |
| In progress | Sharing limits (size, strings, IPv6), stored gzipped, an admin delete, a kill switch, Report on shared worlds, no-WebGL and blocked-storage screens. | `launch-hardening` |
| In progress | Starter pictures made ahead of time, link previews per page, the home screen, built-in templates not asking about sources on open, a shader warm-up, `/guide` lighter. | `launch-first-impression` |

## Decided

- **Banner:** a softer notice that can be closed.
- **Welcome:** stays as it is, with Build a city preselected.
- **Graphics:** new browsers start on Standard.
- **Licence:** all rights reserved, worded as source-available.

## Open

- **Contrast:** white on the accent buttons is 3.6:1, and accent links are 3.1:1 (WCAG AA wants 4.5:1). A darker accent for text and filled buttons (about `#b04a25`) passes. It changes the look everywhere, so it's the owner's call.
- **Trademarks:** the data-map starters name real games (Battlefield, Steam, Escape from Tarkov, ARC Raiders, Delta Force).
- **Weaker starters:** Monaco is the weakest of the places, and Extraction shooters has number pills without labels.
- **Cards on phones:** Brightwater's cards overlap on phones.
