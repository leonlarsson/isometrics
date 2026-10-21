# Isometrics

Build animated 3D "diorama" dashboards: drop in buildings, vehicles and trees, label them with your numbers, and present the result as a living map of your business.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

The app opens with the **Delivery hub** template. Your work autosaves in the browser; use the toolbar to export or import it as a `.json` file.

## Using the editor

| Action | How |
|---|---|
| Add an object | Click it in the left **Add to scene** panel |
| Select | Click an object or its label card |
| Move | Drag it on the ground (snaps to the grid; hold **Alt** for free placement) or nudge with the arrow keys |
| Rotate | **Q** / **E** (hold Shift for 90°) or the Rotation slider |
| Resize, recolour, reshape | Right-hand **Object** tab |
| Show numbers | **Data** tab for values, then the object's **Label** section to pick which ones appear |
| Moving vehicles | **Scene** tab → Routes, then the vehicle's **Motion** section |
| Duplicate / delete | Ctrl+D / Delete |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z |
| Present | Switch to **View** in the top bar and click objects for details |

## Development

```bash
pnpm test         # unit tests
pnpm typecheck    # TypeScript
pnpm check        # Biome lint + format
pnpm build        # production build
pnpm deploy       # build + deploy to Cloudflare Workers (needs `wrangler login`)
```

See [`AGENTS.md`](AGENTS.md) for the code layout and conventions, and [`docs/adr`](docs/adr/README.md) for the architecture decisions.

## Stack

TanStack Start · React 19 · three.js / React Three Fiber / drei · Zustand + Immer · Zod · CSS Modules · Biome · Vitest · Cloudflare Workers
