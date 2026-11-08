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
| [0101](0101-area-peaks.md) | Peaks inside areas: round hills and hollows | proposed |
| [0102](0102-weather.md) | Weather: rain, snow, fog, haze, lightning, and what it does to the ground | proposed |
| [0103](0103-fences.md) | Fences: drawn lines with styles, next to roads and areas | proposed |
| [0104](0104-world-format-before-going-public.md) | The world format before going public: one name per idea, settings where they belong | proposed |
| [0105](0105-every-setting-offers-reset.md) | Every setting offers Reset, and the kit makes sure of it | proposed |
| [0106](0106-the-world-format-promise.md) | The world format's promise: every world keeps opening, and the version almost never moves | proposed |
| [0107](0107-world-data-model.md) | A world's data is values, tables and sources, and what arrives while it's open is kept apart | proposed |
| [0108](0108-things-follow-table-rows.md) | Objects and roads follow a table row, read as `row.<column>` | proposed |
| [0109](0109-sizes-from-data.md) | An object's size and props can follow data, on a straight or log scale | proposed |
| [0110](0110-the-dashboard.md) | The dashboard: trends, watch lines, no data, a legend, the data as tables, and tiles | proposed |
| [0111](0111-building-clusters.md) | Building clusters: one object of many buildings that grows with a number | proposed |
| [0112](0112-roads-that-show-flows.md) | Roads that show flows: vehicles each way, from a value or a row | proposed |
| [0113](0113-links-and-apis.md) | Links and APIs are read in the browser, picked by path, and read again into what arrived | proposed |
| [0114](0114-stories.md) | Stories: a time slider plays the world through its dated values | proposed |
| [0115](0115-a-world-without-data.md) | A world can turn data off, and then nothing about data shows | proposed |
| [0116](0116-first-run-guide-and-your-own-ai.md) | A welcome on the first visit, a guide, and building with your own AI | proposed |
| [0117](0117-checking-a-world.md) | Checking a world, the worlds API, and worlds with their defaults left out | proposed |
| [0118](0118-world-patches.md) | Changing a world with a patch: the world's own shape, things by id | proposed |
| [0119](0119-untrusted-input.md) | Untrusted input: safe JSON, addresses that wait for a yes, and limits everywhere | proposed |
| [0120](0120-worlds-shared-by-link.md) | Worlds shared by link: public snapshots in Cloudflare KV, kept until they expire | proposed |
| [0121](0121-what-is-open-links-previews-and-home.md) | What's open: links that load nothing else, previews kept only when edited, and a home screen | proposed |
| [0122](0122-content-security-policy.md) | A full Content Security Policy, with a nonce for each page | proposed |
| [0123](0123-the-data-tab-and-the-data-window.md) | The Data tab and the Data window: lists by kind, and every path ends in the world | proposed |
| [0124](0124-shapes-and-size-handles.md) | Shapes to build from, and handles that size an object along each axis | proposed |
| [0125](0125-selecting-on-phones-leaves-the-sheet.md) | On phones, selecting leaves the sheet as it is | proposed |
| [0126](0126-ids-in-addresses-use-hyphens.md) | Ids in addresses use hyphens: template ids first | proposed |
| [0127](0127-new-worlds-start-without-data.md) | New worlds start without data; the Data tab stays, one click from turning it on | proposed |
| [0128](0128-features-switch-with-enabled.md) | A feature's on/off switch is `enabled` | proposed |
| [0129](0129-links-open-at-their-own-address.md) | Links open at their own address, without a redirect | proposed |
| [0130](0130-templates-example-spreadsheets.md) | Templates' spreadsheets are example files kept on this site | proposed |
| [0131](0131-welcome-build-with-ai-tile.md) | The welcome's three ways in: build a city, explore Brightwater, build with AI | proposed |
| [0132](0132-deleting-a-world-shows-home.md) | Deleting the open world shows the home screen, never another world | proposed |
| [0133](0133-fence-gates-joining-edges.md) | Fences: gates (open and shut from data), joining two fences, a fence along an area's edge | proposed |
| [0134](0134-workshop-and-prefabs.md) | The Workshop and prefabs: objects of one's own, made from shapes, parts and fences | proposed |
| [0135](0135-flow-vehicle-size.md) | A road flow's vehicles have a size (`flow.vehicleScale`) | proposed |
| [0136](0136-road-junctions.md) | Road junctions: roads meet at junctions, and vehicles drive across the network | proposed |
| [0137](0137-ground-and-area-surfaces.md) | Surfaces with texture: grass, sand, gravel, paving and more on the ground and areas | proposed |
| [0138](0138-objects-stand-on-shapes.md) | Objects stand on the tops of shapes, and a bottom handle lifts the base | proposed |
| [0139](0139-viewpoint-tour.md) | A tour steps through the viewpoints on its own in View mode | proposed |
| [0140](0140-a-browsers-export.md) | A browser's export: everything this site keeps, in one file, added or replacing | proposed |
| [0141](0141-overlays-menu.md) | An Overlays menu beside the shading switcher, and a ground grid overlay | proposed |
| [0142](0142-app-row-and-view-bar.md) | The top bar in two rows: an app row across the window, a view bar over the view | proposed |
| [0143](0143-parts-of-many-pieces-as-one-geometry.md) | Parts of many pieces are built as one geometry, with a colour per vertex | proposed |
| [0144](0144-real-lights-by-the-picture.md) | Real lights chosen by the picture, fading out at the edge; more of them in a still picture | proposed |
| [0145](0145-sharing-hardened-for-strangers.md) | Sharing hardened for strangers: a size cap and a kill switch; screens for browsers that can't draw or keep anything | proposed |
| [0146](0146-starter-pictures-made-ahead-of-time.md) | The built-in worlds' pictures are made ahead of time, and each starter's link previews with its own | proposed |
| [0147](0147-flows-that-drive-on.md) | A road's flow can drive on through junctions: background traffic without placing vehicles | proposed |
| [0148](0148-roads-for-interchanges.md) | Roads for interchanges: smooth curves, one-way roads, pillars that keep clear, raised junctions on pillars | proposed |
| [0149](0149-no-hitches-what-changes-at-once.md) | No hitches: what changes everything at once reaches only what it concerns, spread over frames | proposed |
| [0150](0150-part-pictures-made-ahead-of-time.md) | Add to scene's part pictures are made ahead of time, with a test that catches a part changed since | proposed |
| [0151](0151-weather-per-area.md) | Weather per area: an area can have its own weather (rain, snow, fog, clouds, lightning), following data | proposed |
| [0152](0152-areas-follow-a-table-row.md) | Areas follow a table row: one table of districts drives every area's weather and colour | proposed |
| [0153](0153-tables-over-time.md) | Tables over time: a dated sheet read as a table with a past, and the past shown on the table's page | proposed |
| [0154](0154-pick-order.md) | Pick order: what a click under the pointer goes to, handles on top, and Select what's here | proposed |
| [0155](0155-ground-shapes.md) | The ground's shape: any outline, rounded corners, shapes in one click, handles to drag, its thickness, and hiding it | proposed |
| [0156](0156-shift-pans-ctrl-copies-alt-orbits.md) | Shift + drag pans, Ctrl + drag copies, Alt + drag orbits, the first and last in Preferences | proposed |
| [0157](0157-keys-and-mouse-panel.md) | Keys and mouse: a panel of every key, click and drag, from the hotkey registrations and the preferences | proposed |
