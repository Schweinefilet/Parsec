import { useState, useEffect } from 'react';
import { ChevronDown, Waves, Sparkles, Compass } from 'lucide-react';
import {
    getNightSkySettings, setLinesVisible, setTwinkleEnabled, setStarDensity,
    subscribeNightSkySettings,
} from '../utils/nightSkySettings';
import { setLookDirection, DEFAULT_AZIMUTH, DEFAULT_ALTITUDE } from '../utils/skyRotation';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

const rowBtn = (active) => ({
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '9px 11px', borderRadius: 10,
    background: active ? 'rgba(255,209,102,0.16)' : 'rgba(255,255,255,0.06)',
    border: `1px solid ${active ? 'rgba(255,209,102,0.34)' : 'rgba(255,255,255,0.13)'}`,
    color: active ? '#ffd166' : 'rgba(255,255,255,0.84)',
    fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    lineHeight: 1.25, textAlign: 'start', cursor: 'pointer',
});

/**
 * The left-edge toggle drawer for /sky — the same collapsed-by-default,
 * chevron-tab treatment SolarSystem3D's own ScenePanel.jsx uses, so the two
 * scenes read as one family, but wired to utils/nightSkySettings.js instead
 * of scaleMode/vizMode/driftControl. Three controls: the constellation
 * lines, twinkle, and a "how much light pollution" star-density slider —
 * plus a Look North button, since there's no other way back to a known
 * orientation once you've dragged somewhere unfamiliar.
 */
const NightSkyPanel = ({ onOpen }) => {
    const { t, rtl } = useI18n();
    const reduced = useReducedMotion();
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState(getNightSkySettings);
    const toggleOpen = () => { if (!open) onOpen?.(); setOpen(v => !v); };

    useEffect(() => subscribeNightSkySettings(() => setSettings({ ...getNightSkySettings() })), []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const slide = reduced ? 'none' : 'transform 320ms cubic-bezier(0.32,0.72,0,1), inset-inline-start 320ms cubic-bezier(0.32,0.72,0,1)';
    const hiddenX = rtl ? 'translateX(100%)' : 'translateX(-100%)';

    // Same handle mark as ScenePanel — two overlapped ChevronDown, widened
    // and rotated so the pair reads » / « and points into the scene when
    // closed, back at the edge when open.
    const chevDeg = (open === rtl) ? -90 : 90;
    const chevLeft  = rtl ? 0.80 : 0.40;
    const chevRight = rtl ? 0.40 : 0.80;

    return (
        <div
            style={{
                position: 'absolute', insetInlineStart: 0, top: '50%', zIndex: 15,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
            }}
        >
            <div style={{ position: 'relative' }}>
                <button
                    onClick={toggleOpen}
                    aria-expanded={open}
                    aria-label={t(open ? 'nightSky.settingsClose' : 'nightSky.settings')}
                    title={t(open ? 'nightSky.settingsClose' : 'nightSky.settings')}
                    data-coach="tab"
                    className="focus-ring"
                    style={{
                        position: 'absolute', top: '50%',
                        insetInlineStart: open ? '100%' : 10,
                        transform: 'translateY(-50%)',
                        transition: slide,
                        pointerEvents: 'auto',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '12px 6px',
                        background: 'none', border: 'none', cursor: 'pointer',
                    }}
                >
                    <span
                        style={{
                            display: 'block', pointerEvents: 'none',
                            '--bob-x': rtl ? '-4px' : '4px',
                            animation: (open || reduced) ? 'none' : 'edgeTabBob 1.8s ease-in-out infinite',
                        }}
                    >
                        <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center', direction: 'ltr' }}>
                            <span style={{ width: 14, height: 34, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ChevronDown style={{
                                    width: 40, height: 40, flexShrink: 0,
                                    color: `rgba(255,255,255,${chevLeft})`,
                                    transform: `rotate(${chevDeg}deg) scaleX(1.5)`,
                                    transition: 'transform 0.35s ease',
                                }} />
                            </span>
                            <span style={{ width: 14, height: 34, flexShrink: 0, marginInlineStart: -3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ChevronDown style={{
                                    width: 40, height: 40, flexShrink: 0,
                                    color: `rgba(255,255,255,${chevRight})`,
                                    transform: `rotate(${chevDeg}deg) scaleX(1.5)`,
                                    transition: 'transform 0.35s ease',
                                }} />
                            </span>
                        </span>
                    </span>
                </button>

                <div
                    role="group"
                    aria-label={t('nightSky.settings')}
                    aria-hidden={!open || undefined}
                    inert={!open || undefined}
                    style={{
                        width: 232, maxWidth: '82vw',
                        maxHeight: 'calc(var(--app-vh, 100vh) - 96px)',
                        overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain',
                        padding: '14px 16px',
                        background: 'rgba(8,10,15,0.95)',
                        border: '1px solid rgba(255,255,255,0.14)',
                        backdropFilter: 'blur(16px) saturate(140%)',
                        WebkitBackdropFilter: 'blur(16px) saturate(140%)',
                        boxShadow: '0 12px 34px rgba(0,0,0,0.5)',
                        borderStartStartRadius: 0, borderEndStartRadius: 0,
                        borderStartEndRadius: 16, borderEndEndRadius: 16,
                        pointerEvents: open ? 'auto' : 'none',
                        transform: open ? 'translateX(0)' : hiddenX,
                        transition: slide,
                    }}
                >
                    <p style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
                        textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)',
                        margin: '0 0 10px',
                    }}>
                        {t('nightSky.settings')}
                    </p>

                    <button
                        onClick={() => setLookDirection(DEFAULT_AZIMUTH, DEFAULT_ALTITUDE)}
                        className="focus-ring"
                        style={rowBtn(false)}
                    >
                        <Compass style={{ width: 13, height: 13 }} aria-hidden="true" />
                        {t('nightSky.lookNorth')}
                    </button>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '12px 0' }} />

                    <button
                        onClick={() => setLinesVisible(!settings.linesVisible)}
                        aria-pressed={settings.linesVisible}
                        className="focus-ring"
                        style={{ ...rowBtn(settings.linesVisible), marginBottom: 8 }}
                    >
                        <Waves style={{ width: 13, height: 13 }} aria-hidden="true" />
                        {t('nightSky.lines')}
                    </button>

                    <button
                        onClick={() => setTwinkleEnabled(!settings.twinkle)}
                        aria-pressed={settings.twinkle}
                        className="focus-ring"
                        style={rowBtn(settings.twinkle)}
                    >
                        <Sparkles style={{ width: 13, height: 13 }} aria-hidden="true" />
                        {t('nightSky.twinkle')}
                    </button>

                    <label style={{ display: 'block', margin: '14px 0 2px' }}>
                        <span style={{
                            display: 'block', fontSize: 11, fontWeight: 600,
                            color: 'rgba(255,255,255,0.82)', marginBottom: 3,
                        }}>
                            {t('nightSky.starDensity')}
                        </span>
                        <input
                            type="range"
                            className="plain-slider"
                            dir="ltr"
                            min={0}
                            max={1}
                            step={0.01}
                            value={settings.density}
                            onChange={(e) => setStarDensity(Number(e.target.value))}
                            aria-label={t('nightSky.starDensity')}
                            aria-valuetext={`${Math.round(settings.density * 100)}%`}
                        />
                    </label>
                </div>
            </div>
        </div>
    );
};

export default NightSkyPanel;
