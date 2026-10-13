import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, Monitor, Cpu, Waves, Clapperboard } from 'lucide-react';
import Gargantua3D from '../components/Gargantua3D';
import SceneBack from '../components/SceneBack';
import SceneDialog from '../components/SceneDialog';
import { useIsMobile, useIsTouch } from '../hooks/useMediaQuery';
import { MAX_SPIN } from '../utils/kerr';
import {
    SHOTS, SHOT_ORDER, QUALITY_ORDER, DEFAULT_QUALITY, lowerQuality, hourElsewhere,
    GRAV_RADIUS_KM, AU_KM,
} from '../utils/gargantuaCamera';
import { useI18n } from '../i18n';

// /gargantua — the black hole from Interstellar, as its own page and its own
// lazy chunk (App.jsx). Nothing of it loads until someone navigates here.
//
// It is the one page on the site built to be expensive: a desktop GPU is the
// audience, the default quality is already heavy, and the top setting is
// there to make a strong card sweat. A phone gets told so before anything
// starts, and may carry on anyway.

const FULL_BLEED = {
    position: 'relative', height: 'var(--app-vh, 100vh)', overflow: 'hidden', background: '#000',
    width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)',
};

const SHOT_KEYS = {
    film: 'gargantua.shotFilm', physical: 'gargantua.shotPhysical',
    above: 'gargantua.shotAbove', dive: 'gargantua.shotDive',
};
const QUALITY_KEYS = {
    balanced: 'gargantua.qualityBalanced', high: 'gargantua.qualityHigh',
    ultra: 'gargantua.qualityUltra', absurd: 'gargantua.qualityAbsurd',
};

// A slider in the settings drawer: the caption and its live value on one
// line, the shared .plain-slider track under it.
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

const GargantuaPage = () => {
    const { t, num } = useI18n();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const isTouch = useIsTouch();
    const [acceptedPhone, setAcceptedPhone] = useState(false);
    const gated = (isMobile || isTouch) && !acceptedPhone;

    // ?shot=physical&quality=ultra opens on that shot at that quality, so a
    // view can be linked to. Anything unknown falls back to the defaults.
    const [params] = useSearchParams();
    const [initial] = useState(() => {
        const id = SHOTS[params.get('shot')] ? params.get('shot') : 'film';
        const q = QUALITY_ORDER.includes(params.get('quality')) ? params.get('quality') : DEFAULT_QUALITY;
        return { id, q };
    });
    const [settings, setSettings] = useState(() => ({
        quality: initial.q,
        spin: SHOTS[initial.id].spin,
        doppler: true,
        temp: SHOTS[initial.id].temp,
        cinematic: true,
    }));
    const [shot, setShot] = useState({ id: initial.id, nonce: 0 });
    const [panelOpen, setPanelOpen] = useState(false);
    const [hud, setHud] = useState(null);
    const [failure, setFailure] = useState(null);
    // Bumped to remount the renderer after its context was lost.
    const [generation, setGeneration] = useState(0);

    const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
    const pickShot = (id) => {
        const s = SHOTS[id];
        set({ spin: s.spin, doppler: !!s.doppler, temp: s.temp });
        setShot((cur) => ({ id, nonce: cur.nonce + 1 }));
    };
    const onShotDone = useCallback(() => setShot((cur) => ({ id: 'film', nonce: cur.nonce })), []);
    const onLost = useCallback((kind) => setFailure(kind), []);
    const retryLower = () => {
        const lower = lowerQuality(settings.quality) ?? settings.quality;
        set({ quality: lower });
        setFailure(null);
        setGeneration((g) => g + 1);
    };

    const hourText = useMemo(() => {
        const h = hud && hourElsewhere(hud.dilation);
        if (!h) return '—';
        return t(`time.${h.unit}`, { count: h.value });
    }, [hud, t]);

    const backButton = <SceneBack onClick={() => navigate('/')} />;


    if (gated) {
        return (
            <div style={FULL_BLEED}>
                {backButton}
                <SceneDialog icon={Monitor} title={t('gargantua.desktopTitle')} body={t('gargantua.desktopBody')}>
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

    const auDist = hud ? (hud.dist * GRAV_RADIUS_KM) / AU_KM : 0;

    return (
        <div style={FULL_BLEED}>
            {!failure && (
                <Gargantua3D
                    key={generation}
                    settings={settings}
                    shot={shot}
                    onHud={setHud}
                    onShotDone={onShotDone}
                    onLost={onLost}
                />
            )}
            {backButton}

            <div style={{
                // Under the back link — which drops to 84px on a phone (.scene-back).
                position: 'absolute', top: isMobile ? 124 : 104, insetInlineStart: 'var(--scene-inset)', zIndex: 10,
                pointerEvents: 'none', maxWidth: 'min(420px, 70vw)',
            }}>
                {/* The film's own title treatment — thin, wide-tracked capitals —
                    kept on purpose: it is the one page that is a homage. Its
                    size and the tagline under it are the site's. */}
                <h1 style={{
                    margin: 0, fontSize: isMobile ? 'var(--fs-xl)' : 'var(--fs-2xl)', fontWeight: 300,
                    letterSpacing: '0.32em', textTransform: 'uppercase', color: 'var(--text-primary)',
                    textShadow: '0 2px 16px rgba(0,0,0,0.8)',
                }}>
                    {t('gargantua.title')}
                </h1>
                <p style={{
                    margin: 'var(--s-2) 0 0', fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
                    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
                }}>
                    {t('gargantua.tagline')}
                </p>
            </div>

            {hud && (
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
                    <dt className="label">{t('gargantua.distance')}</dt>
                    <dd style={{ margin: 0 }}>
                        {t('gargantua.distanceValue', {
                            r: num(hud.dist, { maximumFractionDigits: 1 }),
                            au: num(auDist, { maximumFractionDigits: 1 }),
                        })}
                    </dd>
                    <dt className="label">{t('gargantua.hourHere')}</dt>
                    <dd style={{ margin: 0 }}>{t('gargantua.hourThere', { amount: hourText })}</dd>
                    <dt className="label">{t('gargantua.spin')}</dt>
                    <dd style={{ margin: 0 }}>
                        {t('gargantua.spinValue', {
                            a: num(hud.spin, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
                            isco: num(hud.isco, { maximumFractionDigits: 2 }),
                        })}
                    </dd>
                    <dt className="label"><Cpu style={{ width: 11, height: 11, display: 'inline' }} aria-hidden="true" /></dt>
                    <dd style={{ margin: 0 }}>
                        {t('gargantua.perf', {
                            fps: num(Math.round(hud.fps)),
                            mp: num(hud.pixels / 1e6, { maximumFractionDigits: 1 }),
                        })}
                    </dd>
                </dl>
            )}

            <button
                onClick={() => setPanelOpen((v) => !v)}
                className="chrome-btn focus-ring"
                aria-expanded={panelOpen}
                aria-label={t(panelOpen ? 'gargantua.settingsClose' : 'gargantua.settings')}
                title={t(panelOpen ? 'gargantua.settingsClose' : 'gargantua.settings')}
                style={{ position: 'absolute', top: 68, insetInlineEnd: 'var(--scene-inset)', zIndex: 21 }}
            >
                {panelOpen
                    ? <X className="h-4 w-4" aria-hidden="true" />
                    : <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
            </button>

            {panelOpen && (
                <aside
                    className="drawer animate-fade-in"
                    aria-label={t('gargantua.settings')}
                    style={{
                        position: 'absolute', top: 112, insetInlineEnd: 'var(--scene-inset)', zIndex: 20,
                        width: 'min(280px, calc(100vw - 32px))', maxHeight: 'calc(var(--app-vh, 100vh) - 160px)',
                    }}
                >
                    <p className="label drawer-title">{t('gargantua.shots')}</p>
                    <div className="opt-grid">
                        {SHOT_ORDER.map((id) => (
                            <button
                                key={id}
                                className="opt-row focus-ring"
                                data-on={shot.id === id && (id !== 'dive' || !!hud?.diving)}
                                onClick={() => pickShot(id)}
                            >
                                {t(SHOT_KEYS[id])}
                            </button>
                        ))}
                    </div>

                    <hr className="drawer-rule" />

                    <button
                        className="opt-row focus-ring"
                        aria-pressed={settings.doppler}
                        onClick={() => set({ doppler: !settings.doppler })}
                    >
                        <Waves aria-hidden="true" />
                        {t('gargantua.doppler')}
                    </button>
                    <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>{t('gargantua.dopplerNote')}</p>
                    <button
                        className="opt-row focus-ring"
                        aria-pressed={settings.cinematic}
                        onClick={() => set({ cinematic: !settings.cinematic })}
                    >
                        <Clapperboard aria-hidden="true" />
                        {t('gargantua.cinematic')}
                    </button>

                    <hr className="drawer-rule" />

                    <div className="drawer-section">
                        <Slider
                            name={t('gargantua.spin')}
                            value={settings.spin} min={0} max={MAX_SPIN} step={0.001}
                            display={num(settings.spin, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            onChange={(v) => set({ spin: v })}
                        />
                    </div>
                    <div className="drawer-section">
                        <Slider
                            name={t('gargantua.temp')}
                            value={settings.temp} min={2000} max={20000} step={100}
                            display={t('gargantua.kelvin', { k: num(settings.temp) })}
                            onChange={(v) => set({ temp: v })}
                        />
                    </div>

                    <hr className="drawer-rule" />

                    <p className="label drawer-subtitle">
                        {t('gargantua.quality')}
                    </p>
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

            <p className="scene-credit">{t('gargantua.credit')}</p>
        </div>
    );
};

export default GargantuaPage;
