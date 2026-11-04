# Handover: the Stockholm template (branch `stockholm`)

View it at https://stockholm-isometrics.ragnarok.workers.dev/templates/stockholm, or locally at `/templates/stockholm`. It's also in File → New world as **Stockholm**. It looks best with Graphics: Nice or Ultra.

## Done

- **The world** (`src/templates/stockholm.ts`, id `stockholm`, category `places`): traced from an aerial picture as shapes only (round three), points on the picture turned into world units by `fromPicture` (about 1.28 m to a pixel, 12.5 m to a unit, x east, z south). The ground is 186 × 124.
  - Islands: Gamla stan (straight along Skeppsbron, the palace in its north-east corner, squared off by Munkbroleden and Slussen), Riddarholmen beside it across its canal with Centralbron between, Helgeandsholmen, Strömsborg, Skeppsholmen (long, north-west to south-east) and Kastellholmen off its end, as low raised land with quay edges over one water area.
  - Shores: Kungsholmen with Stadshuset across a narrow Klara sjö, Norrmalm from Tegelbacken to Blasieholmen, Djurgården's tip, and Södermalm's heights over Söder Mälarstrand and Stadsgården.
- **The city's blocks** (`src/templates/cityBlocks.ts`, unit-tested): Norrmalm, Kungsholmen and Södermalm's heights are filled with stone blocks laid on a grid wherever there's land clear of roads, parks, landmarks and the cliffs; big blocks of four rows first, then small ones of two rows in the gaps, at several shifts of the grid. On Södermalm each row stands on the lowest ground under it. Söder Mälarstrand's tall houses stand at the cliff's foot (`layRowsAlong`).
- **Gamla stan:** about 500 houses, laid along its streets by `templates/streetRows.ts` (unit-tested), with the courtyards built over.
  - The lanes aren't roads. The island is cobbled (ADR-0137), so the lanes are the cobbles between the houses.
  - Stortorget (with its well), Järntorget, Kornhamnstorg, Slottsbacken and Riddarholmen are cobbled; Helgeandsholmen and the city are paved; Skeppsholmen is gravelled.
  - The world's `surface.enabled` is on, at half the pattern size for this map's scale, with the cobbles a little finer still.
- **Light to draw (ADR-0143):**
  - The old-town houses (`terraced_row_02`) are one geometry per row with a colour per vertex (`parts/buildings/mergedKit.ts`). A row is three meshes: the houses, the windows lit now and the shop windows. The windows still light a flat at a time and follow data.
  - The mainland's blocks of flats are rows of the same houses round a courtyard (`cityBlock`).
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

1. **Real-GPU cost:** `node.exe scripts/bench.mjs stockholm view,view-ultra,edit` (PERFORMANCE.md). Round three added about 290 rows of city blocks (534 rows in all); the renderer peaked at about 950 MB on SwiftShader while shooting every viewpoint.
2. **Data from the TODO idea:** houses on timers, an office tower whose lit panes follow Occupancy, Light parts on an evening schedule, a building coloured by a value.
3. **More of the city:**
   - Södermalm east of Götgatan is still thin: the plateau narrows there between Stadsmuseet, Götgatan and Katarinahissen. Add Katarina kyrka.
   - The city's blocks are all on north-south grids; Kungsholmen's and Södermalm's streets could turn as the real ones do.
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

Round three, in `/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/stockholm3/`, Standard graphics:

- The overview from the owner's angle, before and after: `before-overview-like-15-13.png`, `after-overview-like-15-{13,18.7,21.5}.png`.
- The five bugs: `before-bug{1..5}-*-owner.png` (the owner's pictures) and `after-bug1-flag-13.png`, `after-bug2-gotgatan-13.png`, `after-bug3-kornhamnstorg-13.png`, `after-bug4-tyska-kyrkan-13.png`, `after-bug5-storkyrkan-13.png`.
- Every viewpoint by day and night: `after-view-<view>-13.png` and `after-view-<view>-21.5.png`; districts: `after-skeppsholmen-13.png`, `after-norrmalm-13.png`, `after-sodermalm-13.png`.

Round two, in `/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/stockholm2/`, Standard graphics:

- `<view>-13.png` (day), `<view>-18.7.png` (dusk) and `<view>-22.png` (night), for each viewpoint: gamla-stan, overview, stortorget, palace, riddarholmen, stadshuset, centralbron, skeppsbron, slussen and monteliusvagen.
- Cobbles close-ups: `cobbles-stortorget-*` and `cobbles-lanes-*`.
- Junctions: `junction-slussen-*` and `junction-riddarhustorget-*`.
- Before the merged rows: `before-measure-gamla-stan-*`.
