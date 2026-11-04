# Handover: the Stockholm template (branch `stockholm`)

View it at https://stockholm-isometrics.ragnarok.workers.dev/templates/stockholm, or locally at `/templates/stockholm`. It's also in File → New world as **Stockholm**. It looks best with Graphics: Nice or Ultra.

## Done

- **The world** (`src/templates/stockholm.ts`, id `stockholm`, category `places`): traced from a map as shapes only, in latitude and longitude turned into world units by `fromMap` (12.5 m to a unit, x east, z south).
  - Islands: Gamla stan, Riddarholmen, Helgeandsholmen, Strömsborg, Skeppsholmen and Kastellholmen, as low raised land with quay edges over one water area.
  - Shores: Kungsholmen with Stadshuset, Norrmalm with Kungsträdgården, and Södermalm's heights.
- **Gamla stan:** about 640 houses, laid along its streets by `templates/streetRows.ts` (unit-tested), with the courtyards built over.
  - The lanes aren't roads. The island is cobbled (ADR-0137), so the lanes are the cobbles between the houses.
  - Stortorget (with its well), Järntorget, Kornhamnstorg, Slottsbacken and Riddarholmen are cobbled; Helgeandsholmen and the city are paved; Skeppsholmen is gravelled.
  - The world's `surface.enabled` is on, at half the pattern size for this map's scale, with the cobbles a little finer still.
- **Light to draw (ADR-0143):**
  - The old-town houses (`terraced_row_02`) are one geometry per row with a colour per vertex (`parts/buildings/mergedKit.ts`). A row is three meshes: the houses, the windows lit now and the shop windows. The windows still light a flat at a time and follow data.
  - The mainland's blocks of flats are rows of the same houses round a courtyard (`cityBlock`).
  - Measured on SwiftShader:
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
- **Stacking (ADR-0138):** nothing needed. The stacked shapes (Birger Jarls torn's cone, Kastellet's tower and flag, Skeppsholmskyrkan's dome) already stand on their tops, and editing now keeps them there.

## Left, by priority

1. **Real-GPU cost:** `node.exe scripts/bench.mjs stockholm view,view-ultra,edit` (PERFORMANCE.md).
2. **Data from the TODO idea:** houses on timers, an office tower whose lit panes follow Occupancy, Light parts on an evening schedule, a building coloured by a value.
3. **More of the city:**
   - More of Södermalm: it's sparse in the Slussen view. Add Katarina kyrka.
   - af Chapman as a full-rigged ship.
   - Boats at Strandvägen.
4. **The palaces' windows:** they are still pane rows, one mesh a room. `mergedKit` could make each palace a few meshes too.
5. **README gallery shots:** `node.exe scripts/gallery.mjs`.

## Known issues

- Roads don't follow raised land: Götgatan climbs on an embankment, and Centralbron ends inside Södermalm's cliff, with a tunnel part as its portal.
- Islands are raised land over the water, not holes in it.
- Lit windows rebuild a row's small lit mesh as they come on at dusk.

## Screenshots

In `/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/stockholm2/`, Standard graphics:

- `<view>-13.png` (day), `<view>-18.7.png` (dusk) and `<view>-22.png` (night), for each viewpoint: gamla-stan, overview, stortorget, palace, riddarholmen, stadshuset, centralbron, skeppsbron, slussen and monteliusvagen.
- Cobbles close-ups: `cobbles-stortorget-*` and `cobbles-lanes-*`.
- Junctions: `junction-slussen-*` and `junction-riddarhustorget-*`.
- Before the merged rows: `before-measure-gamla-stan-*`.
