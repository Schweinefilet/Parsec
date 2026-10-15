import { useState, useCallback } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    Cpu, Clapperboard, Zap, Grid3x3, Pause, Disc, Orbit, MoveVertical, Sparkles, RotateCcw,
} from 'lucide-react';
import Exotic3D from '../components/Exotic3D';
import SceneBack from '../components/SceneBack';
import SceneDialog from '../components/SceneDialog';
import {
    ExoticFrame, PhoneGate, ExoticTitle, ExoticSettings, ShotPicker, QualityPicker, Slider, ExoticFoot,
} from '../components/ExoticChrome';
import GargantuaPage from './GargantuaPage';
import { DEFAULT_QUALITY, lowerQuality } from '../utils/gargantuaCamera';
import { EXOTIC, resolveExotic } from '../utils/exoticScenes';
import { DEFAULT_RADIUS, MIN_RADIUS, MAX_RADIUS, KM_PER_M } from '../utils/neutronStar';
import { PLANETS } from '../utils/protoplanetaryDisk';
import { tidalRadius } from '../utils/tidalDisruption';
import { useI18n } from '../i18n';

// /exotic/:id: Gargantua and the objects that grew out of it. Gargantua is
// its own page (GargantuaPage, shown here under the same picker); the rest
// — a wormhole and two black holes merging, with a neutron star and a Roche
// binary stashed for now (exoticScenes.js) — are each ray traced per pixel
// by their own shader (Exotic3D) on their own physics module with its own
// tests. One lazy chunk for all of them (App.jsx); switching object
// remounts the renderer, not the page.
//
// Like Gargantua it is built to be expensive, warns a phone first, and
// drops a quality level when the GPU gives up.

/** URL id → the key group its strings live under. */
const KEY = {
    wormhole: 'wormhole', 'neutron-star': 'neutronStar', binary: 'binary', roche: 'roche',
    'hl-tau': 'hlTau', wr104: 'wr104', ring: 'ring', tde: 'tde',
};

const SHOT_KEY = {
    approach: 'shotApproach', through: 'shotThrough', far: 'shotFar',
    earth: 'shotEarth', south: 'shotSouth', close: 'shotClose',
    edge: 'shotEdge', above: 'shotAbove',
    wide: 'shotWide', eclipse: 'shotEclipse', disk: 'shotDisk',
    alma: 'shotAlma', tilted: 'shotTilted', side: 'shotSide', inside: 'shotInside', follow: 'shotFollow',
};

const DEFAULTS = {
    wormhole: {},
    'neutron-star': { radius: DEFAULT_RADIUS, pulsar: true, grid: false },
    binary: { hold: false, disk: true },
    roche: { q: 0.4, donorTemp: 4800 },
    'hl-tau': { view: 'mm', planets: true, jet: true },
    wr104: { eta: 0.01 },
    ring: { palette: 'eye', knots: true },
    tde: { beta: 1.5, replay: 0 },
};

/** A row of mutually exclusive choices in the drawer, two up. */
function Choice({ heading, options, value, label, onChange }) {
    return (
        <>
            <p className="label drawer-subtitle">{heading}</p>
            <div className="opt-grid">
                {options.map((o) => (
                    <button key={o} className="opt-row focus-ring" aria-pressed={value === o} onClick={() => onChange(o)}>
                        {label(o)}
                    </button>
                ))}
            </div>
        </>
    );
}

function Toggle({ on, icon, label, onClick }) {
    return (
        <button className="opt-row focus-ring" aria-pressed={on} onClick={onClick}>
            {icon}
            {label}
        </button>
    );
}

// One object's view. Keyed by id in the page, so switching object starts
// its settings, shot and renderer afresh.
function ExoticView({ id }) {
    const { t, num } = useI18n();
    const navigate = useNavigate();
    const def = EXOTIC[id];
    const k = (key) => `exotic.${KEY[id]}.${key}`;

    const [settings, setSettings] = useState(() => ({
        quality: DEFAULT_QUALITY, cinematic: true, ...DEFAULTS[id],
    }));
    const [shot, setShot] = useState({ id: def.shotOrder[0], nonce: 0 });
    const [hud, setHud] = useState(null);
    const [failure, setFailure] = useState(null);
    const [generation, setGeneration] = useState(0);

    const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
    const pickShot = (sid) => {
        // A shot can also set how the object is shown (HL Tau's "As ALMA
        // sees it" switches to the millimetre view).
        if (def.shots[sid].set) set(def.shots[sid].set);
        setShot((cur) => ({ id: sid, nonce: cur.nonce + 1 }));
    };
    // The wormhole's "Go through" ends on the far side looking back.
    const onShotDone = useCallback(() => setShot((cur) => ({ id: 'far', nonce: cur.nonce })), []);
    const onLost = useCallback((kind) => setFailure(kind), []);
    const retryLower = () => {
        set({ quality: lowerQuality(settings.quality) ?? settings.quality });
        setFailure(null);
        setGeneration((g) => g + 1);
    };

    const f1 = { maximumFractionDigits: 1 };
    const f2 = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    const readouts = [];
    if (hud) {
        if (id === 'wormhole') {
            readouts.push([t(k('distance')), t(k('distanceValue'), { d: num(Math.abs(hud.l), f1) })]);
            readouts.push([t(k('where')), t(k(hud.l >= 0 ? 'ours' : 'theirs'))]);
        } else if (id === 'neutron-star') {
            readouts.push([t(k('radius')), t(k('radiusValue'), { r: num(hud.radius, f1), km: num(hud.km, f1) })]);
            readouts.push([t(k('visible')), t(k('visibleValue'), { pct: num(Math.round(hud.visible * 100)) })]);
            readouts.push([t(k('redshift')), t(k('redshiftValue'), { g: num(hud.redshift, f2) })]);
        } else if (id === 'binary') {
            readouts.push([t(k('separation')), hud.merged
                ? t(k('merged'))
                : t(k('separationValue'), { a: num(hud.separation, f1) })]);
            readouts.push([t(k('wave')), hud.gw ? t(k('waveValue'), { f: num(hud.gw, f1) }) : '—']);
            readouts.push([t(k('toMerge')), hud.merged ? '—' : t(k('toMergeValue'), { t: num(hud.toMerge, f2) })]);
        } else if (id === 'hl-tau') {
            readouts.push([t(k('distance')), t(k('distanceValue'), { au: num(Math.round(hud.au)) })]);
            readouts.push([t(k('elapsed')), t(k('elapsedValue'), { y: num(Math.round(hud.years)) })]);
        } else if (id === 'tde' && hud.phase) {
            const pct = (x) => num(Math.round(x * 100));
            readouts.push([t(k('phase')), t(k(`phase_${hud.phase}`))]);
            readouts.push([t(k('clock')), hud.phase === 'approach' ? '—' : t(k('clockValue'), { m: num(hud.minutes, f1) })]);
            readouts.push([t(k('debris')), t(k('debrisValue'), {
                bound: pct(hud.bound), leaving: pct(hud.leaving), swallowed: pct(hud.swallowed),
            })]);
            readouts.push([t(k('speed')), t(k('speedValue'), { x: num(Math.max(1, Math.round(hud.speed))) })]);
        } else if (id === 'ring') {
            readouts.push([t(k('star')), t('gargantua.kelvin', { k: num(hud.temp) })]);
            readouts.push([t(k('age')), t(k('ageValue'), { y: num(hud.age) })]);
            readouts.push([t(k('distance')), t(k('distanceValue'), { ly: num(hud.kau * 1000 / 63241, f1) })]);
        } else if (id === 'wr104') {
            readouts.push([t(k('spacing')), t(k('spacingValue'), { au: num(Math.round(hud.spacing)) })]);
            readouts.push([t(k('cone')), t(k('coneValue'), { deg: num(Math.round(hud.cone)) })]);
            readouts.push([t(k('day')), t(k('dayValue'), { d: num(Math.floor(hud.day)), p: num(hud.period, f1) })]);
        } else if (id === 'roche' && hud.q != null) {
            readouts.push([t(k('lobe')), t(k('lobeValue'), { r: num(hud.lobe, f2) })]);
            readouts.push([t(k('diskSize')), t(k('lobeValue'), { r: num(hud.disk, f2) })]);
        }
        readouts.push([
            <Cpu key="cpu" style={{ width: 11, height: 11, display: 'inline' }} aria-hidden="true" />,
            t('gargantua.perf', { fps: num(Math.round(hud.fps)), mp: num(hud.pixels / 1e6, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }),
        ]);
    }

    return (
        <>
            {!failure && (
                <Exotic3D
                    key={generation}
                    id={id}
                    settings={settings}
                    shot={shot}
                    onHud={setHud}
                    onShotDone={onShotDone}
                    onLost={onLost}
                />
            )}

            <ExoticTitle current={id} title={t(k('title'))} tagline={t(k('tagline'))} />

            <ExoticFoot readouts={readouts} credit={t(k('credit'))} />

            <ExoticSettings label={t('exotic.settings')} closeLabel={t('exotic.settingsClose')}>
                <ShotPicker
                    heading={t('gargantua.shots')}
                    order={def.shotOrder}
                    label={(sid) => t(k(SHOT_KEY[sid]))}
                    isOn={(sid) => shot.id === sid && (sid !== 'through' || !!hud?.traversing)}
                    onPick={pickShot}
                />

                <hr className="drawer-rule" />

                {id === 'neutron-star' && (
                    <>
                        <div className="drawer-section">
                            <Slider
                                name={t(k('radius'))}
                                value={settings.radius} min={MIN_RADIUS} max={MAX_RADIUS} step={0.1}
                                display={t(k('radiusValue'), {
                                    r: num(settings.radius, f1), km: num(settings.radius * KM_PER_M, f1),
                                })}
                                onChange={(v) => set({ radius: v })}
                            />
                        </div>
                        <Toggle on={settings.pulsar} icon={<Zap aria-hidden="true" />} label={t(k('pulsar'))} onClick={() => set({ pulsar: !settings.pulsar })} />
                        <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>{t(k('pulsarNote'))}</p>
                        <Toggle on={settings.grid} icon={<Grid3x3 aria-hidden="true" />} label={t(k('grid'))} onClick={() => set({ grid: !settings.grid })} />
                        <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>{t(k('gridNote'))}</p>
                    </>
                )}
                {id === 'binary' && (
                    <>
                        <Toggle on={settings.hold} icon={<Pause aria-hidden="true" />} label={t(k('hold'))} onClick={() => set({ hold: !settings.hold })} />
                        <Toggle on={settings.disk} icon={<Disc aria-hidden="true" />} label={t(k('disk'))} onClick={() => set({ disk: !settings.disk })} />
                        <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>{t(k('massNote'))}</p>
                    </>
                )}
                {id === 'hl-tau' && (
                    <>
                        <Choice
                            heading={t(k('view'))}
                            options={['mm', 'visible']}
                            value={settings.view}
                            label={(o) => t(k(o === 'mm' ? 'viewMm' : 'viewVisible'))}
                            onChange={(v) => set({ view: v })}
                        />
                        <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>
                            {t(k(settings.view === 'mm' ? 'viewMmNote' : 'viewVisibleNote'))}
                        </p>
                        <Toggle on={settings.planets} icon={<Orbit aria-hidden="true" />} label={t(k('planets'))} onClick={() => set({ planets: !settings.planets })} />
                        <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>
                            {t(k('planetsNote'), {
                                masses: PLANETS.map((p) => num(p.jupiters, { maximumFractionDigits: 2 })).join(' · '),
                            })}
                        </p>
                        <Toggle on={settings.jet} icon={<MoveVertical aria-hidden="true" />} label={t(k('jet'))} onClick={() => set({ jet: !settings.jet })} />
                    </>
                )}
                {id === 'tde' && (
                    <>
                        <div className="drawer-section">
                            <Slider
                                name={t(k('beta'))}
                                value={settings.beta} min={1} max={3.4} step={0.05}
                                display={t(k('betaValue'), {
                                    b: num(settings.beta, f2),
                                    rp: num(Math.max(tidalRadius() / settings.beta, 4.05), f1),
                                })}
                                onChange={(v) => set({ beta: v })}
                            />
                        </div>
                        <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>{t(k('betaNote'))}</p>
                        <button className="opt-row focus-ring" onClick={() => set({ replay: settings.replay + 1 })}>
                            <RotateCcw aria-hidden="true" />
                            {t(k('replay'))}
                        </button>
                    </>
                )}
                {id === 'ring' && (
                    <>
                        <Choice
                            heading={t(k('palette'))}
                            options={['eye', 'hubble']}
                            value={settings.palette}
                            label={(o) => t(k(o === 'eye' ? 'paletteEye' : 'paletteHubble'))}
                            onChange={(v) => set({ palette: v })}
                        />
                        <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>
                            {t(k(settings.palette === 'eye' ? 'paletteEyeNote' : 'paletteHubbleNote'))}
                        </p>
                        <Toggle on={settings.knots} icon={<Sparkles aria-hidden="true" />} label={t(k('knots'))} onClick={() => set({ knots: !settings.knots })} />
                        <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>{t(k('knotsNote'))}</p>
                    </>
                )}
                {id === 'wr104' && (
                    <>
                        <div className="drawer-section">
                            <Slider
                                name={t(k('eta'))}
                                value={settings.eta} min={0.005} max={0.2} step={0.005}
                                display={num(settings.eta, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                                onChange={(v) => set({ eta: v })}
                            />
                        </div>
                        <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>{t(k('etaNote'))}</p>
                    </>
                )}
                {id === 'roche' && (
                    <>
                        <div className="drawer-section">
                            <Slider
                                name={t(k('q'))}
                                value={settings.q} min={0.1} max={1} step={0.01}
                                display={t(k('qValue'), { q: num(settings.q, f2) })}
                                onChange={(v) => set({ q: v })}
                            />
                        </div>
                        <div className="drawer-section">
                            <Slider
                                name={t(k('temp'))}
                                value={settings.donorTemp} min={3500} max={12000} step={100}
                                display={t('gargantua.kelvin', { k: num(settings.donorTemp) })}
                                onChange={(v) => set({ donorTemp: v })}
                            />
                        </div>
                    </>
                )}
                <Toggle
                    on={settings.cinematic} icon={<Clapperboard aria-hidden="true" />} label={t('gargantua.cinematic')}
                    onClick={() => set({ cinematic: !settings.cinematic })}
                />

                <hr className="drawer-rule" />

                <QualityPicker value={settings.quality} onChange={(q) => set({ quality: q })} />
            </ExoticSettings>

            {failure && (
                <SceneDialog
                    icon={Cpu}
                    title={t(failure === 'nowebgl' ? 'gargantua.noWebglTitle' : 'gargantua.lostTitle')}
                    body={t(failure === 'nowebgl' ? 'gargantua.noWebglBody' : 'gargantua.lostBody')}
                >
                    <div className="dialog-actions">
                        {failure === 'nowebgl'
                            ? <button className="action-btn focus-ring" onClick={() => navigate('/')}>{t('nav.back')}</button>
                            : <button className="action-btn focus-ring" onClick={retryLower}>{t('gargantua.retryLower')}</button>}
                    </div>
                </SceneDialog>
            )}
        </>
    );
}

const ExoticPage = () => {
    const { t } = useI18n();
    const navigate = useNavigate();
    const params = useParams();
    const { search } = useLocation();
    const id = resolveExotic(params.id);

    // An unknown or stashed object shows the default under its own address,
    // so the address says what is on screen (and a link copied from it does).
    if (params.id && params.id !== id) return <Navigate to={`/exotic/${id}${search}`} replace />;

    // Gargantua keeps its own page, its own phone warning included (the
    // two share one "run it anyway", so it is asked once a visit).
    if (id === 'gargantua') return <GargantuaPage />;

    return (
        <PhoneGate body={t('exotic.desktopBody')}>
            <ExoticFrame>
                {/* First, so it is first to a keyboard too, as on Gargantua. */}
                <SceneBack onClick={() => navigate('/')} />
                <ExoticView key={id} id={id} />
            </ExoticFrame>
        </PhoneGate>
    );
};

export default ExoticPage;
