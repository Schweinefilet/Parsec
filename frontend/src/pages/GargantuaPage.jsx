import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, SlidersHorizontal, X, Monitor, Cpu } from 'lucide-react';
import Gargantua3D from '../components/Gargantua3D';
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

const chip = (active) => ({
    padding: '8px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'start',
    fontSize: 12, fontWeight: 600, lineHeight: 1.25,
    background: active ? 'rgba(255,190,110,0.16)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${active ? 'rgba(255,190,110,0.4)' : 'rgba(255,255,255,0.12)'}`,
    color: active ? '#ffcf8a' : 'rgba(255,255,255,0.85)',
});
const label = {
    margin: '0 0 7px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
};

function Toggle({ on, onChange, children, note }) {
    return (
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', padding: '5px 0' }}>
            <input
                type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)}
                style={{ marginTop: 3, accentColor: '#ffb86b' }}
            />
            <span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>{children}</span>
                {note && (
                    <span style={{ display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                        {note}
                    </span>
                )}
            </span>
        </label>
    );
}

function Slider({ name, value, display, min, max, step, onChange }) {
    return (
        <div style={{ padding: '6px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
                <span>{name}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: '#ffcf8a' }}>{display}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label={name}
                style={{ width: '100%', accentColor: '#ffb86b' }}
            />
        </div>
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
    const [panelOpen, setPanelOpen] = useState(!isMobile);
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

    const backButton = (
        <button
            onClick={() => navigate('/')}
            className="page-back absolute focus-ring"
            style={{ top: 68, insetInlineStart: 'var(--scene-inset)', zIndex: 20 }}
        >
            <ChevronLeft className="flip-rtl" style={{ width: 15, height: 15 }} aria-hidden="true" />
            <span>{t('nav.back')}</span>
        </button>
    );

    const card = (icon, title, body, actions) => (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 30, display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
            <div className="glass" style={{ padding: 28, textAlign: 'center', maxWidth: 420 }}>
                {icon}
                <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>{title}</p>
                <p style={{ margin: '8px auto 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{body}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
                    {actions}
                </div>
            </div>
        </div>
    );
    const actionBtn = { ...chip(true), padding: '10px 16px', fontWeight: 700 };

    if (gated) {
        return (
            <div style={FULL_BLEED}>
                {backButton}
                {card(
                    <Monitor style={{ width: 26, height: 26, color: '#ffcf8a', margin: '0 auto 10px' }} aria-hidden="true" />,
                    t('gargantua.desktopTitle'),
                    t('gargantua.desktopBody'),
                    <>
                        <button className="focus-ring" style={actionBtn} onClick={() => setAcceptedPhone(true)}>
                            {t('gargantua.runAnyway')}
                        </button>
                        <button className="focus-ring" style={chip(false)} onClick={() => navigate('/')}>
                            {t('nav.back')}
                        </button>
                    </>,
                )}
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
                position: 'absolute', top: 104, insetInlineStart: 'var(--scene-inset)', zIndex: 10,
                pointerEvents: 'none', maxWidth: 'min(420px, 70vw)',
            }}>
                <h1 style={{
                    margin: 0, fontSize: isMobile ? 26 : 34, fontWeight: 300, letterSpacing: '0.32em',
                    textTransform: 'uppercase', color: '#fff', textShadow: '0 2px 16px rgba(0,0,0,0.8)',
                }}>
                    {t('gargantua.title')}
                </h1>
                <p style={{
                    margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.62)',
                    textShadow: '0 1px 8px rgba(0,0,0,0.9)',
                }}>
                    {t('gargantua.tagline')}
                </p>
            </div>

            {hud && (
                <dl
                    style={{
                        position: 'absolute', bottom: 34, insetInlineStart: 'var(--scene-inset)', zIndex: 10,
                        margin: 0, display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 14, rowGap: 4,
                        fontSize: 12, color: 'rgba(255,255,255,0.82)', pointerEvents: 'none',
                        textShadow: '0 1px 6px rgba(0,0,0,0.9)', fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    <dt style={{ color: 'rgba(255,255,255,0.5)' }}>{t('gargantua.distance')}</dt>
                    <dd style={{ margin: 0 }}>
                        {t('gargantua.distanceValue', {
                            r: num(hud.dist, { maximumFractionDigits: 1 }),
                            au: num(auDist, { maximumFractionDigits: 1 }),
                        })}
                    </dd>
                    <dt style={{ color: 'rgba(255,255,255,0.5)' }}>{t('gargantua.hourHere')}</dt>
                    <dd style={{ margin: 0 }}>{t('gargantua.hourThere', { amount: hourText })}</dd>
                    <dt style={{ color: 'rgba(255,255,255,0.5)' }}>{t('gargantua.spin')}</dt>
                    <dd style={{ margin: 0 }}>
                        {t('gargantua.spinValue', {
                            a: num(hud.spin, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
                            isco: num(hud.isco, { maximumFractionDigits: 2 }),
                        })}
                    </dd>
                    <dt style={{ color: 'rgba(255,255,255,0.5)' }}><Cpu style={{ width: 12, height: 12, display: 'inline' }} aria-hidden="true" /></dt>
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
                    className="glass animate-fade-in"
                    aria-label={t('gargantua.settings')}
                    style={{
                        position: 'absolute', top: 112, insetInlineEnd: 'var(--scene-inset)', zIndex: 20,
                        width: 'min(300px, calc(100vw - 32px))', maxHeight: 'calc(var(--app-vh, 100vh) - 160px)',
                        overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14,
                    }}
                >
                    <section>
                        <p style={label}>{t('gargantua.shots')}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {SHOT_ORDER.map((id) => (
                                <button
                                    key={id}
                                    className="focus-ring"
                                    style={chip(shot.id === id && (id !== 'dive' || hud?.diving))}
                                    onClick={() => pickShot(id)}
                                >
                                    {t(SHOT_KEYS[id])}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section>
                        <Toggle
                            on={settings.doppler}
                            onChange={(v) => set({ doppler: v })}
                            note={t('gargantua.dopplerNote')}
                        >
                            {t('gargantua.doppler')}
                        </Toggle>
                        <Toggle on={settings.cinematic} onChange={(v) => set({ cinematic: v })}>
                            {t('gargantua.cinematic')}
                        </Toggle>
                    </section>

                    <section>
                        <Slider
                            name={t('gargantua.spin')}
                            value={settings.spin} min={0} max={MAX_SPIN} step={0.001}
                            display={num(settings.spin, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            onChange={(v) => set({ spin: v })}
                        />
                        <Slider
                            name={t('gargantua.temp')}
                            value={settings.temp} min={2000} max={20000} step={100}
                            display={t('gargantua.kelvin', { k: num(settings.temp) })}
                            onChange={(v) => set({ temp: v })}
                        />
                    </section>

                    <section>
                        <p style={label}>{t('gargantua.quality')}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {QUALITY_ORDER.map((q) => (
                                <button
                                    key={q}
                                    className="focus-ring"
                                    aria-pressed={settings.quality === q}
                                    style={chip(settings.quality === q)}
                                    onClick={() => set({ quality: q })}
                                >
                                    {t(QUALITY_KEYS[q])}
                                </button>
                            ))}
                        </div>
                        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                            {t('gargantua.qualityNote')}
                        </p>
                    </section>

                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{t('gargantua.hint')}</p>
                </aside>
            )}

            {failure && card(
                <Cpu style={{ width: 26, height: 26, color: '#ffcf8a', margin: '0 auto 10px' }} aria-hidden="true" />,
                t(failure === 'nowebgl' ? 'gargantua.noWebglTitle' : 'gargantua.lostTitle'),
                t(failure === 'nowebgl' ? 'gargantua.noWebglBody' : 'gargantua.lostBody'),
                failure === 'nowebgl'
                    ? <button className="focus-ring" style={actionBtn} onClick={() => navigate('/')}>{t('nav.back')}</button>
                    : <button className="focus-ring" style={actionBtn} onClick={retryLower}>{t('gargantua.retryLower')}</button>,
            )}

            <p style={{
                position: 'absolute', bottom: 10, insetInline: 0, zIndex: 5, margin: 0, padding: '0 16px',
                textAlign: 'center', fontSize: 10.5, color: 'rgba(255,255,255,0.38)', pointerEvents: 'none',
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
            }}>
                {t('gargantua.credit')}
            </p>
        </div>
    );
};

export default GargantuaPage;
