# Future plan

Scenes to build alongside `/gargantua`. Most of them reuse what that page
already has: the geodesic integrator (`utils/kerr.js`, mirrored in
`utils/gargantuaShaders.js`), the disk shader, the blackbody lookup
(`utils/blackbody.js`) and the quality tiers (`utils/gargantuaCamera.js`).
A few need new techniques, and those are marked.

Effort is a rough guess: **S** is a few sessions, **M** is a proper feature,
**L** is research before code.

## Same integrator, new spacetime

- [x] ~~**Wormhole** (M). Swap the Kerr metric for a traversable wormhole
  (Ellis / Morris–Thorne, the *Interstellar* one is in the same James et al.
  paper). The camera sees a lensed sphere with another galaxy inside it. Rays
  that pass through the throat sample a second sky texture instead of
  escaping to the first one.~~
  Done in 5.15.0: `/exotic/wormhole` (`utils/wormhole.js`).
- [x] ~~**Neutron star with lensing** (M). Light bends enough that more than
  half the surface is visible at once. Schwarzschild exterior is enough for a
  first pass; the rays hit a solid surface at R ≈ 2.5–3 M instead of a
  horizon. Add hotspots and it becomes a **pulsar** with sweeping beams.~~
  Done in 5.15.0: `/exotic/neutron-star` (`utils/neutronStar.js`).
- [x] ~~**Binary black hole merger** (L). Two lensing shadows distorting each
  other. There's no closed-form metric, so this needs an approximation
  (superposed Kerr–Schild holes, or precomputed/tabulated geodesics). Hard,
  but nobody else's portfolio has one.~~
  Done in 5.15.0: `/exotic/binary` (`utils/binaryHole.js`), superposed
  Schwarzschild pulls.

## Gargantua add-ons and disk-fed systems

- [ ] **Quasar with relativistic jets** (M). Bolt jets onto the Gargantua disk
  along the spin axis: volumetric emission, beamed with the existing Doppler
  factor so the approaching jet outshines the receding one. *Interstellar*
  left them out on purpose, so ours becomes the "real" version. Probably a
  new `?shot=` and a toggle in the settings drawer.
- [x] ~~**Roche lobe overflow binary** (M). A star's gas pulled in a stream onto
  a white dwarf or black hole, feeding a disk. Reuses the disk shader; the new
  parts are the donor star's teardrop shape and the stream. Looks great
  animated.~~
  Done in 5.15.0: `/exotic/roche` (`utils/roche.js`).
- [ ] **Tidal disruption event** (M). A star gets spaghettified and smeared
  into a stream that wraps the black hole. Same physics playground as
  Gargantua, better story: scripted like "Fall in", with the stream
  integrated as particles on geodesics.

## New technique: volumetric raymarching

- [x] ~~**Planetary nebula** (M, new skill). Cat's Eye or Ring Nebula.
  Volumetric raymarching with emission-line colours (H-α red, [O III] teal,
  [N II]) instead of blackbody. Totally different skill from lensing.~~
  Done in 5.17.2: the Ring, `/exotic/ring` (`utils/planetaryNebula.js`).
- [x] ~~**WR 104** (S). A Wolf–Rayet binary throwing out a rotating pinwheel
  spiral of dust. An Archimedean spiral advected outward, seen nearly
  face-on. Simple maths, hypnotic result.~~
  Done in 5.17.1: `/exotic/wr104` (`utils/pinwheel.js`).
- [x] ~~**Protoplanetary disk like HL Tau** (S). Concentric rings with gaps
  carved by forming planets. Cheap and pretty; a good first one to build.~~
  Done in 5.17.0: `/exotic/hl-tau` (`utils/protoplanetaryDisk.js`).

## Things to sort out before the first one

- Where they live: one route each (`/wormhole`, …) lazily loaded like
  `/gargantua`, or a single "exotic objects" page with a picker.
  Settled in 5.15.0: one page, `/exotic/:id`, with a picker and one lazy chunk.
- Whether `kerr.js` grows a pluggable metric (`rayDerivative(metric, …)`) so
  the wormhole and neutron star share the RK4 stepper and its tests, with the
  shader side kept line-for-line in step.
  Settled in 5.15.0: no. The neutron star runs on `kerr.js` at a = 0; the
  wormhole and the binary needed different state, so each has its own module.
- All of these are GPU-heavy: same phone warning, same `QUALITY` tiers, same
  drop-a-level-on-context-loss behaviour as Gargantua.
- Each one needs its own tests pinning the physics against closed-form
  answers, the way `kerr.test.js` does (e.g. the wormhole's throat radius,
  the neutron star's visible-surface fraction).
