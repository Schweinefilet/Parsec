# CLAUDE.md

Orientation for an agent landing in this repo cold. Read this, then reach for
[README.md](README.md) when you need depth on a subsystem — it is a real
architecture doc, not a stub.

## What this is

**P4RSEC** (p4rsec.com) — an interactive 3D atlas of the solar system. A
static single-page React app: fly to any planet, moon, dwarf planet, asteroid
or comet on real orbits, scrub the whole system through time, overlay its
gravity, and track the ISS and other spacecraft live over a rendered Earth.
There is **no backend** — every data source is called straight from the
browser. The interface speaks English, Vietnamese and Arabic (right-to-left).

## Where things are

Everything is under [frontend/](frontend/) (Vite + React 19 + react-router-dom
v7 + three.js 0.184). Work from there:

```bash
cd frontend
npm run dev      # http://localhost:5173
npm test         # vitest — the suite is ~400 tests and CI gates on it
npm run lint     # eslint
npm run build    # static bundle in frontend/dist
```

- `src/components/SolarSystem3D.jsx` — the main scene (~3k lines): planets,
  moons, belts, orbit rings, the focus camera, the gravity overlays.
- `src/pages/` — four routes: `CategoryBrowser` (catalog + scene + object
  detail, mounted on `path="*"`), `SatelliteView` (`/satellites`),
  `ComparePage` (`/compare`), `TonightPage` (`/tonight`).
- `src/data/` — `solarSystemBodies.js` is what the **scene** draws;
  `objectCatalog.js` is the **catalog's** 70 objects and their stats. Two
  different lists for two different jobs.
- `src/utils/` — the maths and the render-loop singletons (see below).
- `src/i18n/` — the translation layer (see below).

`App.jsx` routes the catalog and every focused body (`/object/<id>`) through a
single catch-all `path="*"`, so `AppShell` + `CategoryBrowser` + `SolarSystem3D`
are never remounted as you navigate between them — that is what preserves the
Three.js camera state and lets the exit animation play. Keep it that way.

## Working in this repo — the release ritual

**Every change ships as a release.** For any commit that changes behaviour:

1. Bump `version` in `frontend/package.json` (`MAJOR.MINOR.PATCH` — see the
   top of [CHANGELOG.md](CHANGELOG.md) for what each level means; most work is
   a PATCH).
2. Add a `## X.Y.Z` entry at the top of `CHANGELOG.md` — prose, a **bold
   lead-in**, then a `---` separator. Written for someone who wants the full
   picture.
3. If a visitor would notice the change, add a plain-language line to the
   current minor's entry in `frontend/src/data/whatsNew.js` (this is the
   in-app "Version history" panel behind the header version number). English
   strings, not i18n keys.
4. Commit titled `X.Y.Z (short description)`, message body explaining the
   *why*, ending with the `Co-Authored-By:` trailer `git log` already uses on
   every commit.
5. `git push origin main` — commits go straight to `main`, which deploys.

When bumping `package.json`, change only the version line — don't let a
formatter reflow the file (it uses 4-space indent).

## Hard rules and landmines

**The render loop is not React.** The scene is built once inside a `useEffect`
with an empty dependency list, and that effect must never re-run. State the
loop reads every frame lives in **module singletons** with a subscribe/notify
API, read imperatively:

| Module | What it holds |
| --- | --- |
| `utils/simTime.js` | the simulated clock + rate; `simNow()` / `isLive()` |
| `utils/scaleMode.js` | compressed layout ⇄ true distances, and the transition |
| `utils/vizMode.js` | the gravity overlay: off / warped grid / field lines |
| `utils/driftControl.js` | idle camera drift rates (yaw/pitch/roll), persisted |
| `utils/assetLoading.js` | what's loading, for the loading screen |

UI components mirror these into local state via their `subscribeX` function.
Anything that has to move every frame — camera, labels, the clock — belongs
**outside** React the same way. Object labels are plain DOM nodes moved with a
composited `transform`; React only hears when the *set* of labels changes.

**i18n parity is enforced by tests.** Every `t()` key must exist in all three
locale files — `src/i18n/locales/{en,vi,ar}.js` — and catalog/object text in
`src/i18n/catalog/{ar,vi}.js`. English (`en`) is the bundled fallback and the
source of truth for what keys exist; `vi` and `ar` are code-split chunks. Tests
auto-generate per non-English locale and fail on any missing or stray key. The
README's **Internationalisation** section has the detail and, if adding a
language, the checklist.

- **RTL:** the `flip-rtl` class mirrors an icon in the Arabic layout, but it is
  overridden by any inline `transform` — fold the flip into the transform
  string or wrap the icon.

**Do not switch `eclipticQuaternion()` in `utils/orbits.js`** off its
two-Mars-sample derivation. `HelioVector` returns J2000 *equatorial*
coordinates; the belt plane is derived from two Mars positions 90 days apart so
the belts share a plane with the orbit rings under the scene's actual camera
framing. An analytic-obliquity "fix" has been tried and reverted. `orbits.test.js`
and `probeTracks.test.js` pin the ~23.4° tilt.

**Performance is budgeted.** `utils/quality.js` picks a tier from the device
and everything expensive (texture set, canvas pixel count, shadow maps, belt
density) reads from it. CI enforces size ceilings on `public/textures`,
`public/models` and `dist`. Put any new texture, light or per-frame cost behind
a tier setting. New textures also go in the `textures` init list in
`SolarSystem3D.jsx` so `renderer.initTexture` pays the GPU-upload cost up front
instead of hitching mid-scene.

**Two coordinate frames that look identical until they don't.** `HelioVector`
is J2000 equatorial; JPL Horizons hands you J2000 ecliptic unless you ask for
`REF_PLANE='FRAME'`. Mixing them tilts one against the other by 23.4° with
nothing obviously wrong on screen. The README's "Watch out for" section has the
full list of this kind of trap — read it before touching orbital maths.

## Verifying scene changes

The test suite covers the maths, not the rendered frame — jsdom has no WebGL,
so nothing mounts `SolarSystem3D`. For a visual change, build and drive the app
in headless Chrome: `npm run build`, `npm run preview`, then a CDP script that
navigates, focuses a body (`/object/<id>`), manipulates time or the toggles,
and screenshots. Plain headless Chrome falls back to the error boundary (no
WebGL); `--headless=new` with no `--use-gl` flags uses the real GPU.

## Deployment

Static build served by Render from `frontend/dist`, with Cloudflare (DNS + CDN)
in front of `p4rsec.com`. Client-side routing needs unknown paths rewritten to
`/index.html` (`render.yaml`, and a dashboard rule if the service wasn't made
from the blueprint). The repo-root `.gitignore` has a broad `*.txt` rule from
unrelated boilerplate — a `.txt` added under `frontend/public/` is silently
ignored unless allow-listed. Cloudflare caches at the edge for 5 minutes, so a
freshly deployed file can lag; verify with a cache-buster query.
