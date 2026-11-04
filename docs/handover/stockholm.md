# Handover: the Stockholm template (branch `stockholm`)

View it at https://stockholm-isometrics.ragnarok.workers.dev/templates/stockholm, or locally at `/templates/stockholm`. It's also in File → New world as **Stockholm**. It looks best with Graphics: Nice or Ultra.

## Done

- **The world** (`src/templates/stockholm.ts`, id `stockholm`, category `places`): traced from an aerial picture as shapes only (round three), points on the picture turned into world units by `fromPicture` (about 1.28 m to a pixel, 12.5 m to a unit, x east, z south). The ground is 186 × 124.
  - Islands: Gamla stan (straight along Skeppsbron, the palace in its north-east corner, squared off by Munkbroleden and Slussen), Riddarholmen beside it across its canal with Centralbron between, Helgeandsholmen, Strömsborg, Skeppsholmen (long, north-west to south-east) and Kastellholmen off its end, as low raised land with quay edges over one water area.
  - Shores: Kungsholmen with Stadshuset across a narrow Klara sjö, Norrmalm from Tegelbacken to Blasieholmen, Djurgården's tip, and Södermalm's heights over Söder Mälarstrand and Stadsgården.
- **The city's blocks** (round four; `src/templates/cityBlocks.ts`, unit-tested): Norrmalm, Kungsholmen and Södermalm's heights are perimeter blocks, laid district by district (`DISTRICTS` in the template).
  - Each district has a grid turned as its real streets run, traced from the aerial picture: Kungsholmen 15°, lower Norrmalm along Jakobsgatan 21°, the Opera's quarter 0°, Blasieholmen −38°, Södermalm west of Slussen (Hornsgatan) 15°, and east of it (Götgatan) 4°.
  - Block widths and depths vary column by column and row by row, with streets 1 unit wide between them.
  - Each block is fitted to the largest part that's clear of shores, roads, parks and landmarks, so blocks follow the waterfronts and roads.
  - Each block is built round its edge, edge to edge, with a courtyard inside (`rowsAround`). Every side is cut into buildings of a few houses, each with its own floors (Norrmalm 6–8, Kungsholmen 5–7, Södermalm 4–6), facades and roof: dark metal, a quarter of Södermalm's in red tiles, now and then copper.
  - On Södermalm each building stands on the lowest ground under it.
  - Big buildings stand where the real ones are big: Stockholms centralstation (`palace_01`), the Sheraton (`office_tower_01`) and Maria Magdalena kyrka (`church_01`).
  - Söder Mälarstrand's tall houses stand at the cliff's foot (`layRowsAlong`).
- **Gamla stan:** about 500 houses, laid along its streets by `templates/streetRows.ts` (unit-tested), with the courtyards built over.
  - The lanes aren't roads. The island is cobbled (ADR-0137), so the lanes are the cobbles between the houses.
  - Stortorget (with its well), Järntorget, Kornhamnstorg, Slottsbacken and Riddarholmen are cobbled; Helgeandsholmen and the city are paved; Skeppsholmen is gravelled.
  - The world's `surface.enabled` is on, at half the pattern size for this map's scale, with the cobbles a little finer still.
- **Light to draw (ADR-0143):**
  - The old-town houses (`terraced_row_02`) are one geometry per row with a colour per vertex (`parts/buildings/mergedKit.ts`). A row is three meshes: the houses, the windows lit now and the shop windows. The windows still light a flat at a time and follow data.
  - The mainland's blocks are rows of the same houses round a courtyard.
  - Round four, in the opening view on SwiftShader (Standard): 7,124 meshes and 445 draws a frame before, 7,798 meshes and 442 draws after. That's 773 rows in all, 550 of them the city's. The draws stay flat because every row shares one material.
  - On a real GPU (the owner's bench, round three): Ultra 6.2–6.4 ms a frame, 663 draws.
  - Measured on SwiftShader in round two (before the city's blocks were filled in):
    - meshes: 26,568 → 6,994
    - JavaScript heap: 759 → 378 MB
    - Chrome's page: 1,065 → 648 MB
    - draws a frame: 538 → 488
- **Roads meet at junctions (ADR-0136):**
  - Every bridge landing on Strömgatan.
  - Riddarhustorget, where Vasabron, Riddarholmsbron and Munkbroleden meet.
  - Slottskajen, where Strömbron meets Skeppsbron.
  - Blasieholmen, at Skeppsholmsbron.
  - Tegelbacken: Centralbron, Stadshusbron and Strömgatan.
  - Slussen's two ends: Skeppsbron, Munkbroleden and Slussen in the north; Slussen, Götgatan, Söder Mälarstrand and Stadsgårdsleden in the south.
  - Who drives through: Centralbron's buses and lorry keep to it (`drivesThroughJunctions: false`); the red buses and cars on the quays drive on across the network. Centralbron's flow stays on its road, as flows do.
- **New parts:**
  - `flagpole_01`: a pole and a thin flag, plain or with a Nordic cross (Kastellet's).
  - `palace_01`: Kungliga slottet; the Riksdag, Operan and others use it as stand-ins.
  - `church_02`: Storkyrkan.
  - `church_03`: Riddarholmskyrkan's lattice spire.
  - `church_04`: Tyska kyrkan.
  - `city_hall_01`: Stadshuset, with the three crowns.
  - `terraced_row_02`: old-town houses.
- **Bridges** are raised roads. **Lights** run on a two-minute evening from 17:30: lanterns, windows lighting one by one, floodlit landmarks, headlights, ferry cabins and beacons.
- **Data:** example numbers, each marked "Example number, not live data".
  - Values: ferries, Centralbron's traffic, the palace's visitors, the Riksdag, Stadshuset.
  - What follows data: the ferry's cabin brightness, the beacons' colour, the Riksdag's lit windows, and Centralbron's flow density.
- **Moods** (5) and **viewpoints** (10).
- **ADR-0135:** a road flow's `vehicleScale`.
- **Round three's fixes:** Kastellet's flag is `flagpole_01`, a thin cloth; Götgatan has a point a unit up the slope, each on the ground (`onSoder`); Kornhamnstorg stops at Munkbroleden; Tyska kyrkan's side gables, Storkyrkan's tower top, the city hall's wings and the old-town rows' neighbouring roofs no longer have faces in one plane.
- **Stacking (ADR-0138):** nothing needed. The stacked shapes (Birger Jarls torn's cone, Kastellet's tower and flag, Skeppsholmskyrkan's dome) already stand on their tops, and editing now keeps them there.

## Left, by priority

1. **Real-GPU cost:** re-run `node.exe scripts/bench.mjs stockholm view,view-ultra,edit` (PERFORMANCE.md) after round four. It has 773 rows (was 534), with draws about the same on SwiftShader.
   - **The first open's stall** (the owner's one cold run, an 823 ms p90) looks like Chrome's empty shader cache, not something in the template. On a production build in a fresh browser (SwiftShader), Stockholm links 32 programs to Brightwater's 21, and compiling and linking them all takes under 0.3 s.
   - The 11 extra programs are tilt-shift's passes (6) and the surface patterns' and vertex-coloured rows' material variants. On Windows' ANGLE, compiling them cold can take seconds; after that, the cache makes it quick.
   - An engine-wide fix would compile the programs behind the loading screen (`renderer.compileAsync`). It isn't a template change.
2. **Data from the TODO idea:** houses on timers, an office tower whose lit panes follow Occupancy, Light parts on an evening schedule, a building coloured by a value.
3. **More of the city:**
   - Södermalm east of Götgatan is still thin: the plateau narrows there between Stadsmuseet, Götgatan and Katarinahissen. Katarina kyrka stands off the map, south of it.
   - The stone blocks' roofs are pitched along each row (the old-town houses' roof). A mansard or a flat roof behind a parapet would read more like Norrmalm's stone blocks.
   - Upper Norrmalm (Klara, Hötorget) beyond the picture's top edge is laid on its neighbours' grids (Jakobsgatan's and the Opera quarter's), not traced.
   - af Chapman as a full-rigged ship.
   - Boats at Strandvägen.
4. **The palaces' windows:** they are still pane rows, one mesh a room. `mergedKit` could make each palace a few meshes too.
5. **README gallery shots:** `node.exe scripts/gallery.mjs`.

## Known issues

- Roads don't follow raised land by themselves: Götgatan climbs on an embankment and is given a point a unit, each on the ground; Centralbron ends inside Södermalm's cliff, with a tunnel part as its portal.
- Real lights only near the view's centre leave a bright circle at night (an engine limit, not the template's).
- Islands are raised land over the water, not holes in it.
- Lit windows rebuild a row's small lit mesh as they come on at dusk.

## Screenshots

Round four, in `/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/stockholm4/`, Standard graphics:

- The overview from round three's angle: `before-overview-13.png`, `after-overview-13.png` and `after-overview-21.5.png`.
- Close-ups, before and after: `{before,after}-norrmalm-13.png`, `-norrmalm-close-13.png`, `-kungsholmen-13.png`, `-sodermalm-13.png`, `-sodermalm-close-13.png` (after also at 21.5).
- The viewpoints that show the mainland: `after-view-{gamla-stan,overview,palace,stadshuset,centralbron,slussen,monteliusvagen}-{13,21.5}.png`.

Round three, in `/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/stockholm3/`, Standard graphics:

- The overview from the owner's angle, before and after: `before-overview-like-15-13.png`, `after-overview-like-15-{13,18.7,21.5}.png`.
- The five bugs: `before-bug{1..5}-*-owner.png` (the owner's pictures) and `after-bug1-flag-13.png`, `after-bug2-gotgatan-13.png`, `after-bug3-kornhamnstorg-13.png`, `after-bug4-tyska-kyrkan-13.png`, `after-bug5-storkyrkan-13.png`.
- Every viewpoint by day and night: `after-view-<view>-13.png` and `after-view-<view>-21.5.png`; districts: `after-skeppsholmen-13.png`, `after-norrmalm-13.png`, `after-sodermalm-13.png`.

Round two, in `/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/stockholm2/`, Standard graphics:

- `<view>-13.png` (day), `<view>-18.7.png` (dusk) and `<view>-22.png` (night), for each viewpoint: gamla-stan, overview, stortorget, palace, riddarholmen, stadshuset, centralbron, skeppsbron, slussen and monteliusvagen.
- Cobbles close-ups: `cobbles-stortorget-*` and `cobbles-lanes-*`.
- Junctions: `junction-slussen-*` and `junction-riddarhustorget-*`.
- Before the merged rows: `before-measure-gamla-stan-*`.
