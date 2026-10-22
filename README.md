# Isometrics

Build animated 3D miniature worlds that show your data: drop in buildings, vehicles and trees, draw roads, bridges, water, parks and raised land, label it all with your numbers, and present the result as a living map of your business.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The app opens with **Brightwater**, a small harbour city that shows off most of the editor (bridge, flyover, hill, stadium, marina, live data cards). Your work autosaves in the browser; the **File** menu starts a new empty world or a template, and opens or saves worlds as `.json` files. The file format is published as JSON Schema at `/schema.json`.

## Using the editor

| Action | How |
|---|---|
| Add an object | Click it in the left **Add to scene** panel (it lands at a free spot), or drag it onto the scene to place it exactly (**Esc** cancels), or search it: press **/**, type (e.g. "boat"), **Enter** adds the first match |
| Select | Click an object or its label card |
| Move | Drag it on the ground (snaps to the grid; hold **Alt** for free placement) or nudge with the arrow keys |
| Rotate | **Q** / **E** (hold Shift for 90°) or the Rotation slider |
| Resize, recolour, reshape | Right-hand **Object** tab |
| Show numbers | **Data** tab for values, then the object's **Label** section to pick which ones appear |
| Draw a road | **Roads** → Road, Dirt path or Hidden route, then click points on the ground; **Enter** to finish, click the first point to make a loop, **Esc** to cancel |
| Reshape a road | Select it and drag its points; drag the small dot between two points to add one; double-click a point (or select it and press **Delete**) to remove it; **Curves** in the panel rounds the corners |
| Bridges and flyovers | Click a road point and set its **Height** in the panel, or **Shift**+drag it up. Choose **Pillars** or **Embankment** and railings under *Elevated sections* |
| Cut, join, extend | Click a point: **Split road here** / **Open loop here**; on an end point **Continue drawing** or **Join with** a nearby road end. Dragging an end onto another road's end also offers to join |
| Moving vehicles | Select a vehicle → **Motion** → *Drive along* a road. **Scene** tab → *Vehicles drive on the* left or right, and *Vehicles turn* smoothly or sharply (each road and vehicle can override it) |
| Duplicate / delete | Ctrl+D / Delete |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z |
| Open / save a world file | Ctrl+O / Ctrl+S, or the **File** menu |
| Pause / play motion | Space |
| Resize the right panel | Drag its left edge (double-click to reset) |
| Present | Switch to **View** in the top bar and click objects for details |

## Development

```bash
pnpm test         # unit tests
pnpm typecheck    # TypeScript
pnpm check        # Biome + JSX spacing check: the gate to pass before committing
pnpm check:fix    # same, fixing what it can
pnpm build        # production build
pnpm run deploy   # build + deploy to Cloudflare Workers (needs `wrangler login`; plain `pnpm deploy` is a different, built-in pnpm command)
```

GitHub Actions (`.github/workflows/ci.yml`) runs `pnpm check`, `pnpm typecheck` and `pnpm test` on every push to `main` and on pull requests.

### Biome and `pnpm check`

Biome is the linter and formatter, and you can call it directly: `pnpm biome check`, `pnpm biome lint`, `pnpm biome format --write`.

`pnpm check` runs Biome **and** `scripts/jsx-spacing.mjs`, which enforces the blank line between JSX siblings. Biome has no rule for that, so a plain `pnpm biome check` skips it. Use `pnpm check` (or `pnpm check:fix`) as the full gate; `pnpm lint:jsx` runs only the spacing check. See [ADR-0013](docs/adr/0013-biome-lint-and-import-conventions.md) and [ADR-0014](docs/adr/0014-code-layout-braces-and-jsx-spacing.md).

See [`AGENTS.md`](AGENTS.md) for the code layout and conventions, and [`docs/adr`](docs/adr/README.md) for the architecture decisions.

## Stack

TanStack Start · React 19 · three.js / React Three Fiber / drei · Zustand + Immer · Zod · CSS Modules · Biome · Vitest · Cloudflare Workers
