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
| [0039](0039-saved-viewpoints.md) | Saved viewpoints are part of the world, and View mode steps through them | accepted |
| [0040](0040-follow-and-ride-along.md) | The camera can follow a vehicle, or ride along behind it | accepted |
| [0041](0041-text-part-and-bundled-font.md) | A text part: SDF text with a bundled font, and part fields for text and data keys | accepted |
| [0042](0042-traffic-following-and-passing.md) | Vehicles on a road keep their distance and overtake | accepted |
| [0043](0043-one-file-per-part.md) | One file per part, in a folder per palette category | accepted |
| [0044](0044-several-worlds-per-browser.md) | Several worlds per browser, each in its own slot | accepted |
| [0045](0045-wipe-everything.md) | "Wipe everything" deletes all browser data, after two confirmations | accepted |
| [0046](0046-phone-toolbar-and-bars.md) | Phones: a More menu in the toolbar, the sheet toggle in its tab bar, bars at the bottom in View mode | accepted |
| [0047](0047-new-world-dialog.md) | File → New world is a dialog: a blank world with settings, or a starter with a rendered picture | accepted |
| [0048](0048-label-collision-avoidance.md) | Label cards step aside for each other and for the UI, and shrink to chips where there's no room | accepted |
| [0049](0049-larger-grounds.md) | Grounds up to 500 per side: the sun's shadows follow the view, and the camera and grid scale with the ground | accepted |
| [0050](0050-numbered-variants.md) | Parts, road styles and area types have numbered ids, so each can have variants | accepted |
| [0051](0051-add-to-scene.md) | Add to scene remembers favourites, recently used items and folded sections per browser | accepted |
| [0052](0052-time-of-day.md) | Time of day: a sun that moves, a sky that changes, and lights after dark | accepted |
| [0053](0053-legacy-ids.md) | Worlds saved before the numbered ids get the new ids on load | accepted |
| [0054](0054-properties-editor.md) | A Blender-style properties editor: icon tabs on a rail, foldable card panels, label-left fields and a settings search | accepted |
| [0055](0055-collapsible-side-panes.md) | The side panes fold to thin strips, one at a time or both at once | accepted |
| [0056](0056-safe-schema-and-part-changes.md) | Changes to the world format and to parts are checked against old worlds | accepted |
| [0057](0057-save-status.md) | A save status next to the File menu says whether the world is saved | accepted |
| [0058](0058-lights.md) | Lights are a shared system: parts declare them, objects set each one, data can switch them | accepted |
| [0059](0059-fresh-start-offer.md) | After a big update, the app offers once to start fresh | accepted |
| [0060](0060-colours.md) | Colours are a shared system like lights, and can follow data | accepted |
| [0061](0061-when-lights-come-on.md) | Lights switch on at once or gradually, or on a schedule | accepted |
| [0062](0062-camera-settings.md) | The camera remembers where it was per world, worlds have an opening view, and a Camera tab holds its settings | accepted |
| [0063](0063-on-screen.md) | A world says what viewers see over it in View mode: title, subtitle, time of day, label cards, details, viewpoint bar | accepted |
| [0064](0064-multi-select.md) | Selecting several things at once: an active item, the rest, a box, group transforms and Mixed fields | accepted |
| [0065](0065-several-points.md) | Several points of a road, or corners of an area, at once; Shift no longer lifts a point | accepted |
| [0066](0066-whole-road-and-area-gizmo.md) | A selected road or area moves, turns and resizes as a whole | accepted |
| [0067](0067-duplicate-and-move.md) | Duplicating while moving: Ctrl+drag and Shift+D | accepted |
| [0068](0068-copy-and-paste.md) | Copy and paste: things and a panel's settings, as JSON on the system clipboard | accepted |
| [0069](0069-end-to-end-tests.md) | End-to-end tests in a real browser, driven through dev-only hooks | accepted |
| [0070](0070-sky.md) | A sky around the world in perspective, and a backdrop of the world's own behind the diorama | accepted |
| [0071](0071-names-say-what-they-hold.md) | Names say what they hold, and renamed world fields are read under their old names | accepted |
| [0072](0072-rendering-quality-levels.md) | Graphics settings for the 3D view: presets with overrides, a world's sun and shade contrast, real night lights | accepted |
| [0073](0073-effects-composer.md) | The effects composer draws the scene as on the canvas, and the backdrop stays behind it | accepted |
| [0074](0074-real-night-lights.md) | Real night lights: a part's light also lights its surroundings, the nearest ones to the view | accepted |
| [0075](0075-reflective-water.md) | Reflective water: the world mirrored in rippling water, added as reflected light | accepted |
| [0076](0076-colour-grade.md) | A colour grade on the finished picture | accepted |
| [0077](0077-distance-haze.md) | Distance haze in perspective, as its own graphics setting | accepted |
| [0078](0078-moods.md) | Moods: named looks saved in a world, and viewpoints that put one on | accepted |
| [0079](0079-light-and-sky-tabs.md) | Sun & sky splits into Moods, Time & light, and Sky & water | accepted |
| [0080](0080-shading-switcher.md) | A shading switcher in the toolbar: wireframe, Standard, Nice, Ultra | accepted |
| [0081](0081-boat-wakes.md) | Boat wakes: foam behind boats on a route, and waves in Ultra | accepted |
| [0082](0082-leaning-in-turns.md) | Vehicles lean in turns, as far as their kind does | accepted |
| [0083](0083-templates-at-templates.md) | The templates are served at /templates | accepted |
| [0084](0084-render-a-picture.md) | Render a picture: one still, drawn finer than a live view | accepted |
| [0085](0085-title-nameplate.md) | The world's title on a nameplate | accepted |
| [0086](0086-automatic-instancing.md) | Objects that look the same are drawn together (automatic instancing) | accepted |
| [0087](0087-parts-catalogue.md) | A public parts catalogue at /parts | accepted |
| [0088](0088-add-to-scene-for-many-parts.md) | Add to scene for many parts: category chips, families and a list | accepted |
| [0089](0089-colours-are-named.md) | Colours are named, not only shown | accepted |
| [0090](0090-see-through-colours.md) | See-through colours: a transparency setting for glass | accepted |
| [0091](0091-painting-objects.md) | Painting objects with a brush | accepted |
| [0092](0092-big-worlds-stay-fast.md) | Big worlds stay fast: what doesn't change costs nothing | accepted |
| [0093](0093-react-compiler.md) | The React Compiler memoises components | accepted |
| [0094](0094-lights-on-day-and-night.md) | Lights on day and night: traffic signals | proposed |
| [0095](0095-parts-that-follow-the-sun.md) | Parts that follow the sun | proposed |
| [0096](0096-area-corner-heights.md) | Area corners with their own heights: slopes and ramps | proposed |
| [0097](0097-rotation-in-three-axes.md) | Objects turn in all three axes, and go below the ground | proposed |
| [0098](0098-objects-stand-on-the-ground.md) | Objects stand on the ground under them | proposed |
| [0099](0099-label-cards-slide-under-side-panels.md) | Label cards slide under the side panels | proposed |
| [0100](0100-loading-screen.md) | A loading screen while a world opens | proposed |
