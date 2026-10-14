import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SlidersHorizontal, X, Monitor, Cpu, Clapperboard, Zap, Grid3x3, Pause, Disc } from 'lucide-react';
import Exotic3D from '../components/Exotic3D';
import SceneBack from '../components/SceneBack';
import SceneDialog from '../components/SceneDialog';
import ExoticPicker from '../components/ExoticPicker';
import GargantuaPage from './GargantuaPage';
import { useIsMobile, useIsTouch } from '../hooks/useMediaQuery';
import { QUALITY_ORDER, DEFAULT_QUALITY, lowerQuality } from '../utils/gargantuaCamera';
import { EXOTIC, resolveExotic } from '../utils/exoticScenes';
import { DEFAULT_RADIUS, MIN_RADIUS, MAX_RADIUS, KM_PER_M } from '../utils/neutronStar';
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

const FULL_BLEED = {
    position: 'relative', height: 'var(--app-vh, 100vh)', overflow: 'hidden', background: '#000',
    width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)',
};

/** URL id → the key group its strings live under. */
const KEY = { wormhole: 'wormhole', 'neutron-star': 'neutronStar', binary: 'binary', roche: 'roche' };

const SHOT_KEY = {
    approach: 'shotApproach', through: 'shotThrough', far: 'shotFar',
    earth: 'shotEarth', south: 'shotSouth', close: 'shotClose',
    edge: 'shotEdge', above: 'shotAbove',
    wide: 'shotWide', eclipse: 'shotEclipse', disk: 'shotDisk',
};

const QUALITY_KEYS = {
    balanced: 'gargantua.qualityBalanced', high: 'gargantua.qualityHigh',
    ultra: 'gargantua.qualityUltra', absurd: 'gargantua.qualityAbsurd',
};

const DEFAULTS = {
    wormhole: {},
    'neutron-star': { radius: DEFAULT_RADIUS, pulsar: true, grid: false },
    binary: { hold: false, disk: true },
    roche: { q: 0.4, donorTemp: 4800 },
};

function Slider({ name, value, display, min, max, step, onChange }) {
    return (
        <label style={{ display: 'block' }}>
            <span className="drawer-field drawer-field-row">
                <span>{name}</span>
                <span className="drawer-field-value">{display}</span>
            </span>
            <input
                type="range" className="plain-slider" dir="ltr"
                min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label={name}
            />
        </label>
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
    const isMobile = useIsMobile();
    const def = EXOTIC[id];
    const k = (key) => `exotic.${KEY[id]}.${key}`;

    const [settings, setSettings] = useState(() => ({
        quality: DEFAULT_QUALITY, cinematic: true, ...DEFAULTS[id],
    }));
    const [shot, setShot] = useState({ id: def.shotOrder[0], nonce: 0 });
    const [panelOpen, setPanelOpen] = useState(false);
    const [hud, setHud] = useState(null);
    const [failure, setFailure] = useState(null);
    const [generation, setGeneration] = useState(0);

    const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
    const pickShot = (sid) => setShot((cur) => ({ id: sid, nonce: cur.nonce + 1 }));
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
        } else if (id === 'roche' && hud.q != null) {
            readouts.push([t(k('lobe')), t(k('lobeValue'), { r: num(hud.lobe, f2) })]);
            readouts.push([t(k('diskSize')), t(k('lobeValue'), { r: num(hud.disk, f2) })]);
        }
        readouts.push([
            <Cpu key="cpu" style={{ width: 11, height: 11, display: 'inline' }} aria-hidden="true" />,
            t('gargantua.perf', { fps: num(Math.round(hud.fps)), mp: num(hud.pixels / 1e6, f1) }),
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

            <div style={{
                position: 'absolute', top: isMobile ? 124 : 104, insetInlineStart: 'var(--scene-inset)', zIndex: 10,
                maxWidth: 'min(440px, 72vw)',
            }}>
                <h1 style={{
                    margin: 0, fontSize: isMobile ? 'var(--fs-xl)' : 'var(--fs-2xl)', fontWeight: 300,
                    letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-primary)',
                    textShadow: '0 2px 16px rgba(0,0,0,0.8)',
                }}>
                    {t(k('title'))}
                </h1>
                <p style={{
                    margin: 'var(--s-2) 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
                    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
                }}>
                    {t(k('tagline'))}
                </p>
                <ExoticPicker current={id} />
            </div>

            {readouts.length > 0 && (
                <dl
                    style={{
                        position: 'absolute', bottom: 34, insetInlineStart: 'var(--scene-inset)', zIndex: 10,
                        margin: 0, display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 'var(--s-4)',
                        rowGap: 'var(--s-1)', alignItems: 'baseline',
                        fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.88)',
                        pointerEvents: 'none', textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {readouts.map(([label, value], i) => (
                        <div key={i} style={{ display: 'contents' }}>
                            <dt className="label">{label}</dt>
                            <dd style={{ margin: 0 }}>{value}</dd>
                        </div>
                    ))}
                </dl>
            )}

            <button
                onClick={() => setPanelOpen((v) => !v)}
                className="chrome-btn focus-ring"
                aria-expanded={panelOpen}
                aria-label={t(panelOpen ? 'exotic.settingsClose' : 'exotic.settings')}
                title={t(panelOpen ? 'exotic.settingsClose' : 'exotic.settings')}
                style={{ position: 'absolute', top: 68, insetInlineEnd: 'var(--scene-inset)', zIndex: 21 }}
            >
                {panelOpen
                    ? <X className="h-4 w-4" aria-hidden="true" />
                    : <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
            </button>

            {panelOpen && (
                <aside
                    className="drawer animate-fade-in"
                    aria-label={t('exotic.settings')}
                    style={{
                        position: 'absolute', top: 112, insetInlineEnd: 'var(--scene-inset)', zIndex: 20,
                        width: 'min(280px, calc(100vw - 32px))', maxHeight: 'calc(var(--app-vh, 100vh) - 160px)',
                    }}
                >
                    <p className="label drawer-title">{t('gargantua.shots')}</p>
                    <div className="opt-grid">
                        {def.shotOrder.map((sid) => (
                            <button
                                key={sid}
                                className="opt-row focus-ring"
                                data-on={shot.id === sid && (sid !== 'through' || !!hud?.traversing)}
                                onClick={() => pickShot(sid)}
                            >
                                {t(k(SHOT_KEY[sid]))}
                            </button>
                        ))}
                    </div>

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

                    <p className="label drawer-subtitle">{t('gargantua.quality')}</p>
                    <div className="opt-grid">
                        {QUALITY_ORDER.map((q) => (
                            <button
                                key={q}
                                className="opt-row focus-ring"
                                aria-pressed={settings.quality === q}
                                onClick={() => set({ quality: q })}
                            >
                                {t(QUALITY_KEYS[q])}
                            </button>
                        ))}
                    </div>
                    <p className="drawer-note">{t('gargantua.qualityNote')}</p>
                    <p className="drawer-note" style={{ marginTop: 'var(--s-3)' }}>{t('gargantua.hint')}</p>
                </aside>
            )}

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

            <p className="scene-credit">{t(k('credit'))}</p>
        </>
    );
}

const ExoticPage = () => {
    const { t } = useI18n();
    const navigate = useNavigate();
    const params = useParams();
    const id = resolveExotic(params.id);
    const isMobile = useIsMobile();
    const isTouch = useIsTouch();
    const [acceptedPhone, setAcceptedPhone] = useState(false);
    const gated = (isMobile || isTouch) && !acceptedPhone;
    const backButton = <SceneBack onClick={() => navigate('/')} />;

    // Gargantua keeps its own page, its own phone warning included.
    if (id === 'gargantua') return <GargantuaPage />;

    if (gated) {
        return (
            <div style={FULL_BLEED}>
                {backButton}
                <SceneDialog icon={Monitor} title={t('gargantua.desktopTitle')} body={t('exotic.desktopBody')}>
                    <div className="dialog-actions">
                        <button className="action-btn focus-ring" onClick={() => setAcceptedPhone(true)}>
                            {t('gargantua.runAnyway')}
                        </button>
                        <button className="action-btn focus-ring" data-variant="quiet" onClick={() => navigate('/')}>
                            {t('nav.back')}
                        </button>
                    </div>
                </SceneDialog>
            </div>
        );
    }

    return (
        <div style={FULL_BLEED}>
            <ExoticView key={id} id={id} />
            {backButton}
        </div>
    );
};

export default ExoticPage;
