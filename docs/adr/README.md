# Architecture Decision Records

Why the code is the way it is. Read this before making structural changes; write a new ADR (copy `template.md`) when you make one. See [0001](0001-record-architecture-decisions.md) for the rules.

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | accepted |
| [0002](0002-tanstack-start-on-cloudflare-workers.md) | TanStack Start, deployed to Cloudflare Workers | accepted |
| [0003](0003-scene-as-json-document.md) | A world is one JSON scene document, validated by Zod | accepted |
| [0004](0004-react-three-fiber-orthographic-diorama.md) | React Three Fiber with an orthographic "diorama" camera | accepted |
| [0005](0005-procedural-part-registry.md) | Procedural, parametric parts in a registry | accepted |
| [0006](0006-local-first-persistence.md) | Local-first persistence, no database (yet) | accepted |
| [0007](0007-css-modules-and-design-tokens.md) | CSS Modules with design tokens | accepted |
| [0008](0008-dom-label-layer.md) | Label cards are a DOM overlay positioned by a projector | accepted |
| [0009](0009-editor-interaction-and-history.md) | Grid drag + inspector, snapshot undo with coalescing | accepted |
| [0010](0010-data-binding-by-named-keys.md) | Data binding through named keys; static values for now | accepted |
| [0011](0011-naming-conventions.md) | `T`-prefixed types, `I`-prefixed interfaces (lint-enforced) | accepted |
| [0012](0012-ai-scene-generation-deferred.md) | AI scene generation: deferred, designed for | proposed |
| [0013](0013-biome-lint-and-import-conventions.md) | Biome lint rules and import ordering | accepted |
| [0014](0014-code-layout-braces-and-jsx-spacing.md) | Always-braced `if`, blank lines between JSX siblings | accepted |
| [0015](0015-arrow-functions-and-named-exports.md) | Arrow functions everywhere; named exports only | accepted |
| [0016](0016-tanstack-hotkeys.md) | Keyboard shortcuts use TanStack Hotkeys | accepted |
| [0017](0017-drawable-roads.md) | Drawable roads, which double as vehicle routes | accepted |
| [0018](0018-elevated-roads-and-road-editing.md) | Elevated roads (height per point) and point-level road editing | accepted |
| [0019](0019-product-direction-data-driven-worlds.md) | Product direction: a 3D world builder where data is a core pillar | accepted |
| [0020](0020-never-discard-unreadable-saves.md) | Never discard a saved world the app can't read | accepted |
| [0021](0021-free-form-areas.md) | Free-form areas: water, grass, sand, plazas and raised land | accepted |
| [0022](0022-centre-lane-roads.md) | Roads can make vehicles drive down the centre | accepted |
| [0023](0023-road-width-per-point.md) | Road width per point | accepted |
| [0024](0024-base-ui-component-primitives.md) | Base UI for interactive component primitives | accepted |
| [0025](0025-unified-ui-kit.md) | One UI kit for every panel | accepted |
| [0026](0026-repair-old-worlds.md) | Repair old worlds instead of rejecting them | accepted |
| [0027](0027-inherited-values-and-overrides.md) | Inherited values and overrides look the same everywhere | accepted |
| [0028](0028-map-style-camera-and-click-to-select.md) | Map-style camera; clicks select, drags move the camera | accepted |
| [0029](0029-transform-gizmo-and-keyboard-transforms.md) | Transform gizmo and Blender-style keyboard transforms | accepted |
| [0030](0030-narrow-layout-bottom-sheet.md) | Narrow layout: the scene keeps the screen, panels live in a bottom sheet | accepted |
| [0031](0031-two-way-routes-and-road-drops.md) | Vehicles drive either way; dropping one on a road offers to follow it | accepted |
| [0032](0032-schema-json-with-part-catalogue.md) | /schema.json includes the part catalogue and a format guide | accepted |
| [0033](0033-road-snapping-for-every-free-move.md) | Road snapping for every free move; the gizmo's centre grabs the object | accepted |
| [0034](0034-field-descriptions-and-example-worlds.md) | Field descriptions in the scene schema, and example worlds at /examples | accepted |
| [0035](0035-outliner.md) | An outliner above the inspector; hide and lock are saved with the world | accepted |
| [0036](0036-part-thumbnails.md) | Part thumbnails are rendered in the browser from the parts themselves | accepted |
| [0037](0037-orbit-around-the-cursor.md) | Orbit around the point under the cursor, with a wider tilt | accepted |
| [0038](0038-perspective-camera.md) | A perspective camera next to the orthographic diorama view | accepted |
