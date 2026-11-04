# Handover: the Stockholm template (branch `stockholm`)

View it at https://stockholm-isometrics.ragnarok.workers.dev/templates/stockholm, or locally at `/templates/stockholm`. It's also in File → New world as **Stockholm**. It looks best with Graphics: Nice or Ultra.

## Done

- **The world** (`src/templates/stockholm.ts`, id `stockholm`, category `places`): traced from a map as shapes only, in latitude and longitude turned into world units by `fromMap` (12.5 m to a unit, x east, z south).
  - Islands: Gamla stan, Riddarholmen, Helgeandsholmen, Strömsborg, Skeppsholmen and Kastellholmen, drawn as low raised land with quay edges over one water area (Riddarfjärden, Strömmen and Saltsjön).
  - Shores: Kungsholmen with Stadshuset, Norrmalm from Tegelbacken to Blasieholmen and Strandvägen, with Kungsträdgården, and Södermalm's heights as sloped raised land with peaks, over Söder Mälarstrand, Slussen and Stadsgården.
- **Gamla stan's streets and houses:** Västerlånggatan, Österlånggatan, Stora and Lilla Nygatan, Prästgatan, Svartmangatan, Köpmangatan, Skeppsbron, Munkbroleden, lanes, and the squares (Stortorget with its well, Järntorget, Kornhamnstorg, Mynttorget, Slottsbacken). About 640 houses are laid along the streets by `templates/streetRows.ts` (`layRowsAlong`), with the blocks' courtyards built over. A unit test covers it.
- **New parts** (in `src/parts/buildings/`):
  - `terraced_row_02`: old-town houses, a variant of Terraced houses.
  - `palace_01`: Kungliga slottet; the Riksdag, Operan, the Grand Hôtel and others use it as stand-ins.
  - `church_02`: Storkyrkan.
  - `church_03`: Riddarholmskyrkan, with its iron lattice spire.
  - `church_04`: Tyska kyrkan.
  - `city_hall_01`: Stadshuset, with the three crowns.
  - Shared helpers: `churchKit.tsx`, `PaneRow` / `paneRuns` in `windowKit.tsx`, and `floodlitSurface` in `parts/lights.tsx`.
- **Bridges** are raised roads: Centralbron (into Söderleden's tunnel), Vasabron, Riksbron with Stallbron, Norrbro, Strömbron, Riddarholmsbron, Slussen with Götgatan, Skeppsholmsbron, Kastellholmsbron, Stadshusbron, and Katarinahissen's footbridge.
- **Lights and time:** a two-minute day from 17:30.
  - Lamps and lanterns come on at dusk (wall lanterns in the lanes, lanterns on the old bridges and quays), and windows light one by one.
  - The palace, the churches and Stadshuset are floodlit.
  - Centralbron's traffic has headlights; ferries and the Baltic ferry have lit cabins; beacons stand at the ferry landings.
- **Data:** example numbers, each marked "Example number, not live data".
  - Values: ferry departures and passengers, ferry delay, Centralbron traffic, palace visitors, the Riksdag's offices at work, Stadshuset tours.
  - What follows data: the ferry's cabin brightness (passengers), the beacons' colour (delay), the Riksdag's lit windows (offices at work), and Centralbron's flow density (traffic).
- **Moods** (5) and **viewpoints** (10), from Gamla stan and the overview to Stortorget, the palace from the water, Riddarholmen, Stadshuset, Centralbron, Skeppsbron, Slussen and Monteliusvägen.
- **ADR-0135:** a road flow's `vehicleScale`, so flows suit worlds drawn at map scale. It has a test and a Vehicle size slider.
- **Also:** the templates' overlap test is faster (it was timing out), and there is an e2e test that the starter opens with its landmarks.

## Left, by priority

1. **Memory and cost.** Each house is about a dozen meshes, and a dev-build Chrome on SwiftShader nears 700 MB. A merged geometry per house row (vertex colours, a few meshes per row) would make it much lighter. Measure with `scripts/bench.mjs stockholm` on a real GPU.
2. **Check the e2e test on a machine with memory to spare.** Here it got past its assertions but Chrome was killed (OOM) while drawing, as were other specs. The catalogue spec passed, 9 of 9.
3. **More data from the TODO idea:** houses on timers, an office tower whose lit panes follow Occupancy, Light parts on an evening schedule, a building coloured by a value.
4. **More of the city:**
   - Katarina kyrka and more of Södermalm; Södermalm's rows are plain.
   - af Chapman as a full-rigged ship (now a one-masted stand-in).
   - Boats at Strandvägen.
   - More character for the mainland's apartment blocks.
5. **README gallery shots:** `node.exe scripts/gallery.mjs` with stockholm entries.

## Known issues and engine gaps

- Roads have no junctions, so lanes overlap where they cross (ADR-0017).
- Roads don't follow raised land: Götgatan climbs on an embankment, and Centralbron ends inside Södermalm's cliff with a tunnel part as its portal.
- Islands are raised land drawn over the water, not holes in it.
- Cobbled lanes are roads with their markings off.
- The Overview viewpoint shows all of a large ground (180 × 124).
- The shots were taken on SwiftShader through a production preview: the dev server kept being OOM-killed here.

## Screenshots

In `/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/stockholm/`, taken on Standard graphics:

- `best-gamla-stan-golden-hour.png`
- `best-overview.png`
- `best-stortorget-blue-hour.png`
- `best-palace-from-the-water-dusk.png`
- `best-stadshuset-night.png`
- `best-centralbron-night.png`
- `best-skeppsbron-sunset.png`
- `best-from-monteliusvagen.png`
- `best-with-data-cards.png`
- `best-riddarholmen-dusk-cards.png`

Part checks are in `/tmp/claude-0/-home-user-isometrics/f448b129-321a-5ac7-9e44-79f0cf0b2a2f/scratchpad/parts/`.
