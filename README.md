# Parsec

An interactive 3D atlas of the solar system. Fly to any planet, moon, dwarf
planet, asteroid or comet, watch them move on real orbits, and track the ISS
live over a rendered Earth.

**Live:** <https://parsec-uo4a.onrender.com/>

## Running it

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

`npm run build` produces a static bundle in `frontend/dist`; `npm run lint`
runs ESLint. There is no backend — every data source is called directly from
the browser.

Optional: put a [NASA API key](https://api.nasa.gov/) in `frontend/.env.local`
as `VITE_NASA_API_KEY` to raise the rate limit on the near-Earth-object counter
in the telemetry ticker. Without one it falls back to `DEMO_KEY`.

## How it fits together

```text
frontend/src/
  components/
    SolarSystem3D.jsx    the main scene: planets, moons, belts, orbits, camera
    IssGlobe.jsx         live ISS globe with a real day/night terminator
    SpacecraftViewer.jsx orbit-controlled viewer for spacecraft models
    ObjectCard.jsx       catalog card, with generated art when no photo exists
    ObjectDetailBody.jsx description + stats + distance chart, shared by
                         the desktop panel and the mobile sheet
    DistanceChart.jsx    inline-SVG distance-over-time chart
  data/
    objectCatalog.js     the 70 objects and their stats — single source of truth
                         for both the catalog and the category nav
    objectImages.js      curated, load-verified NASA image per object
  utils/
    proceduralTextures.js painted surface maps for bodies with no photographic
                          texture (Io's sulfur, Europa's linea, Pluto's heart)
    spacecraftModels.js   spacecraft built from primitives, no model downloads
```

### Positions are real

Planet positions come from [astronomy-engine](https://github.com/cosinekitty/astronomy)
(`HelioVector`), so the layout matches the actual sky for the current date;
orbit rings are sampled from the same source. Dwarf planets, asteroids and
Halley use J2000 Keplerian elements. Distances are compressed for legibility —
hence the "not to scale" note in the corner.

Moon orbits are stylised: spacing and speeds are chosen so a system is readable
when you focus its planet, not to scale.

### Assets

Textures are 4K for planets and 2K for moons; the ISS and Vesta meshes are
decimated for the web and load during idle time rather than blocking the first
frame. Bodies without a photographic map are painted procedurally at runtime,
which costs no download at all. Keep an eye on total payload when adding
anything here — the whole point is that the scene starts fast.
