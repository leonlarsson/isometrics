---
name: build-a-part
description: Build a new part (a 3D asset: building, vehicle, tree, street furniture, lamp, boat…) or a batch of them for Isometrics, the way they're built here, with the gotchas that have bitten before and the checks to do before the owner reviews it. Use whenever adding or changing a part in src/parts/.
---

# Building a part

A part is a procedural low-poly 3D object made with `definePart` in `src/parts/<category>/<kind>.tsx`. AGENTS.md (*Add a part*, *Add a light to a part*, *Add or change a part prop*) has the rules; this is the practice: how to build one, what goes wrong, and how to check it. Read the ADRs it names when you touch that area.

**The owner reviews every new part before it's committed.** Build, check it yourself (below), show the pictures, then wait. Fixes to existing parts can be committed as you go.

## 1. Before you start

- **Look at its neighbours.** Read one or two parts of the same kind (a building next to a building) and reuse their kit: `primitives.tsx` (`Box`, `RBox`, `GableRoof`, `Taper`, `Wheel`, `Mat`, `spread`, `jitter`, `shareGeometryAs`), `lights.tsx` (`lightEmission`, `LightLens`, `Headlights`, `LightPool`, `LitWindows`, `WindowGlowOnGround`), and the category kits (`buildings/shopKit.tsx`, `buildings/windowKit.tsx`, `vehicles/boatKit.ts`, `vehicles/raceCarKit.tsx`, `nature/treeSize.ts`, `furniture/furnitureSize.ts`). A piece two parts share goes in a kit next to them.
- **Variant or new kind?** A new look of an existing thing (a second round tree, an old-town lantern for the street lamp) is a variant with the next number (`round_tree_02`), its own file, the same `name`, sharing light ids with its family where they mean the same (so copy and paste of light settings works across it). Something else is a new kind (`birch_01`). Once a family has two variants, objects show as "Round tree 1/2" (ADR-0050); that's expected.
- **Scale.** The world is a miniature at about **3.6 m per unit**: a car is 1.25 long, a lamp post 1.6 tall, a house wall 1.3. Small things true to that are specks, so street furniture is drawn in metres at about 1.5× (`<group scale={UNITS_PER_METRE}>`, `metres()`), like the parcel stack. Check new parts next to a car and a house (section 4).
- **Axes.** Origin at the footprint's centre, on the ground (y = 0). The front faces **+Z** (doors, shop fronts, a sitter's view); vehicles drive towards **+X**. Say which way in the description when it matters ("its front faces +Z").

## 2. The definition

- **Props:** a Zod schema with a default for every prop that draws it as designed. Names say what they hold (AGENTS.md *Names say what they hold* and *The world's vocabulary*, ADR-0104): `showsChimney`, `floorCount`, `headTilt`, `beamSecondsPerTurn`, `aimAngle`; switches in the third person, counts in `…Count`, buildings `width` × `depth`, long things `length` × `width`; never a bare noun for a switch or an amount. A field for each editable prop, with sensible min/max/step. Allow the smallest case people will want (a terraced row of **1** house).
- **Colours** (ADR-0060): ids named for what they paint (`walls`, `awning`, `riderTop`), the first `legacy: "color"`, the second `legacy: "accent"`. Theme-following defaults (`(p) => p.foliage`) for things that should change with the theme (trees, grass); fixed hex for things with their own colour (a red barn). Name colours plainly (`"Walls"`, `"Rider's skin"`); a person's skin is a colour setting, never fixed. Glass with something behind it is `seeThrough: { transparency }` (ADR-0090), drawn with `opacity={1 - transparency.<id>}`.
- **Lights** (ADR-0058): see section 3.
- **`footprint` and `height`:** what it covers seen from above (awnings, balconies, a swinging frame included) and its top, at scale 1, for selection, placement and label cards.
- **Description and keywords:** what it is in a few words, plus the words people search for ("gas station", "fuel" for a petrol station).
- Register it in `PARTS` (`registry.ts`) next to its family or category; the order is the order in Add to scene and the catalogue.

## 3. Lights

- **Every light has a visible fixture.** A glow or a pool that appears from nowhere looks wrong (the barn's first lamp was a glowing box in the air). Give it a lamp: a bracket, a shade, a bulb, a lantern, a lens. By day the fixture shows; at night it glows (`lightEmission` or `LightLens`).
- **Glows must face the camera.** The view looks down at about 30°, so an emissive panel on the underside of a head is never seen (the double-armed street lamp's heads stayed dark). Let the visible part glow softly too, or put the emitter where it's seen.
- **Shapes:** `pool` for lamps lighting the ground (`LightPool`), `beam` for headlights and lighthouse beams (its reach is the beam's length, "Beam length" in the Lights tab), `windows` for lit building windows (`LitWindows`), `glow` for surfaces (`lightEmission`), `lens` for small lamps (`LightLens`). `when: "driving"` for vehicle lights only on while it moves. `comesOn: "oneByOne"` for window lights, `"gradually"` for string lights.
- **Overlapping pools add up.** Two heads a metre apart each with a big pool blew out to white; give such a light a lower `strength` and smaller `reach` in its spec.
- **`realLight`** (the lights Nice and Ultra draw at night) is a point light: put it **in front of the emitter**, in the direction it shines, never on or behind a surface it would then light from behind (the floodlight lit its own frame's back). One source per place; several for a light that shines from several places. Long rows of lit windows (a bus, a tram) also get `WindowGlowOnGround` so the street beside them glows on Standard too.
- **Coordinates:** `LightPool`'s `at` is in the part's own space. Inside a group that's already moved (an island, a head), leave `at` out or the offset counts twice.
- Ground glows and headlight beams are left out of clicks and of a part's picture size automatically (`lightOnTheGround`); keep using `LightPool` / `Headlights` rather than drawing your own.

## 4. Geometry gotchas

- **Draw with three's own shapes** (box, cylinder, cone, sphere, icosahedron, torus) so copies are drawn together (ADR-0086). A hand-built geometry gets a key with `shareGeometryAs(geometry, "shape:params")`.
- **`useFrame`:** a mesh whose material or geometry you change each frame needs `userData={{ notInstanced: true }}` (a test checks the file mentions it; if only its turn or position changes, say so in a comment instead, as the lighthouse beam does). And the part says `movesOnItsOwn: true`: objects that stand still work out their matrices once, not every frame, so anything it turns or moves would freeze (ADR-0092; a test checks this too).
- **Don't mix material looks under one key:** a `wireframe` material can batch with a solid one of the same colour. Avoid wireframes; build railings from posts and a rail.
- **Faces in the same plane flicker:** a log's cut ends exactly on the bark's ends, a door exactly on a wall. Offset by a hair (0.003–0.02).
- **Flat shapes are seen from the front only:** `ShapeGeometry` triangles (a greenhouse gable, a sail) and open-ended cylinders (a railing band) vanish from behind. Use `side={THREE.DoubleSide}` for single sheets (sails, gables), or build closed shapes.
- **Cylinders have a corner at +Z:** a flat door on a 16-sided tower is cut by the corner's ridge. Turn the cylinder by π/sides (`thetaStart`) so a flat face looks to the front, and place the door on that face (`radius × cos(π/sides)`).
- **Tapered walls:** something on a tower that narrows sits at the wall's radius **at its own height**, leaning with it; anchor it at the wall's foot and lean it (the lighthouse door and lamp floated on a short tower).
- **Hinges and pivots:** check which way a rotation swings the far edge. A panel hung from its top edge and tilted to face down swings its bottom back into the mast; hinge it at its bottom edge on a bracket instead (the floodlight). Work it out with the rotation matrix, then look from the side.
- **Scaling settings:** what grows with a setting should grow sensibly: a wider greenhouse gets more benches and a steeper roof, a longer planter more shrubs, a longer bus more of everything, and decoration counts are capped (`MOST_FLOWERS`).
- **Lit windows on buildings:** with `LitWindows` and a `paneSize`, draw the glass with `WindowGrid` (`buildings/windowKit`) in the same cells, **behind** the lit panes (they're 0.012 out from the wall; glass that stands prouder hides them).
- **What holds something up reaches it:** a body rests on its bogies, a lamp on its bracket, a frame on its mast. Check the heights add up (the tram's first bogies stopped short of its floor, so the wheels hung under a gap), and look from low down at the side.
- **Real things have their parts:** a balcony has a door onto it and a railing (posts, top rail, bars) on three sides, not a tray; a tram has bogies with wheels and a windscreen at each end; a mast is held up by its rigging (stays and shrouds), with or without sails, and furled sails stay rolled where they're kept; a cyclist's head sits on a neck; a greenhouse is glazed all round, its gables too. Picture the real thing and list what makes it read.

## 5. By kind

- **Buildings:** front +Z; door(s) on the front at ground level; windows that light at night (`windows` with `LitWindows` + `WindowGrid` for many, `glow` boxes for a few); a roof that closes the box (`GableRoof` has its ridge along X; turn it a quarter for a gable to the street); a `realLight` out in the street in front. Width/depth/floors as props when people will want them.
- **Vehicles:** drive +X, `canFollowPath: true`; wheels with `Wheel` (axle along Z) touching the ground; `Headlights` at the front with `when: "driving"`; cabins with lit windows (`glow`) and `WindowGlowOnGround`; both ends right for things that drive either way (trams). A rider or driver if it'd look empty without.
- **Boats:** the hull from `vehicles/boatKit` (bow +X); `wake` (width and how far behind the centre) and a `turnLean`; cabin lights; a masthead or navigation lamp.
- **Trees and plants:** the shared `size` prop (`nature/treeSize`); foliage and trunk from the theme (`p.foliage`, `p.trunk`) unless the species has its own colour; flat-shaded icosahedra and cones; a variant for a different shape of the same tree.
- **Street furniture:** in metres inside `<group scale={UNITS_PER_METRE}>`, length props in world units; sitting faces +Z.
- **Lamps:** a pool with a sensible reach, a visible lamp, a `realLight` at the lamp; settings for height, and for aim or tilt where the light can point (`headTilt`, `aimAngle`) with the pool following where it points.

## 6. Check it before showing it

1. `pnpm check:fix && pnpm check && pnpm typecheck && pnpm test`: the part guards (defaults, colours, lights, the `useFrame` mark) and `/api/worlds/schema` run on every part.
2. **The catalogue, both looks:** a temporary `e2e/debug.spec.ts` that opens `/parts`, picks its category chip, and shoots the page light by day and dark at night (`page.emulateMedia({ colorScheme })`, the "By day"/"At night" chips, wait ~10–20 s for the pictures). Look at every new card.
3. **World scale:** `loadWorld` with the new parts next to `house_01`, `car_01` and `street_lamp_01`, `showView`, by day and at 22:00 (`s.commit((scene) => { scene.lighting.timeSource = "fixed"; scene.lighting.time = 22; })`).
4. **Close-ups from where people will look,** including below, behind and the side, with a perspective camera:
   ```ts
   await page.evaluate((v) => globalThis.__editorStore.getState().showOpeningView({
   	target: v.target, targetAltitude: v.height, azimuth: v.azimuth, elevation: v.elevation,
   	span: v.span, projection: "perspective", fieldOfView: null,
   }), { target: [0, 0], height: 1, azimuth: 200, elevation: 10, span: 3 });
   ```
   Azimuth 0/180 look from the sides (±X), 90/270 from the ends (±Z), ~200 from the front-left. Try the extremes of its settings too (smallest and largest, tilted fully, 1 house).
5. **Night on Ultra** for parts with `realLight`: click the toolbar's `/^Ultra:/` button, then shoot at night; check nothing lights its own back.
6. Run the end-to-end specs it touches (`catalogue`, `add-to-scene`, `vehicles`, `properties`) and delete `e2e/debug.spec.ts`.
7. Update `TODO.md` (the part count and what's done in its category) and, for a new category or kit convention, AGENTS.md.

Then show the owner the pictures and the list of parts with their settings, colours and lights, and wait for the go-ahead to commit. They're colourblind: name colours in words, not only show them.
