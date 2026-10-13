import { useState, useEffect } from 'react';
import { Waves, Sparkles, Compass } from 'lucide-react';
import EdgeTab from './EdgeTab';
import {
    getNightSkySettings, setLinesVisible, setTwinkleEnabled, setStarDensity,
    subscribeNightSkySettings,
} from '../utils/nightSkySettings';
import { setLookDirection, DEFAULT_AZIMUTH, DEFAULT_ALTITUDE } from '../utils/skyRotation';
import { resetCalibrationOffset } from '../utils/deviceOrientation';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

/**
 * The left-edge toggle drawer for /sky — the same collapsed-by-default,
 * chevron-tab treatment SolarSystem3D's own ScenePanel.jsx uses, so the two
 * scenes read as one family, but wired to utils/nightSkySettings.js instead
 * of scaleMode/vizMode/driftControl. Three controls: the constellation
 * lines, twinkle, and a "how much light pollution" star-density slider —
 * plus a Look North button, since there's no other way back to a known
 * orientation once you've dragged somewhere unfamiliar.
 */
const NightSkyPanel = ({ onOpen, arMode = false }) => {
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

    const slide = reduced ? 'none' : 'transform 320ms var(--ease-glide), inset-inline-start 320ms var(--ease-glide)';
    // .edge-tab carries an opacity hover of its own, and an inline transition
    // replaces the class's outright, so both halves are named here.
    const tabSlide = reduced ? 'none' : `${slide}, opacity var(--t-base) var(--ease-out)`;
    const hiddenX = rtl ? 'translateX(100%)' : 'translateX(-100%)';


    return (
        <div
            style={{
                position: 'absolute', insetInlineStart: 0, top: '50%', zIndex: 15,
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
            }}
        >
            <div style={{ position: 'relative' }}>
                <EdgeTab
                    open={open}
                    reduced={reduced}
                    onClick={toggleOpen}
                    aria-expanded={open}
                    aria-label={t(open ? 'nightSky.settingsClose' : 'nightSky.settings')}
                    title={t(open ? 'nightSky.settingsClose' : 'nightSky.settings')}
                    data-coach="tab"
                    style={{
                        position: 'absolute', top: '50%',
                        insetInlineStart: open ? '100%' : 0,
                        transform: 'translateY(-50%)',
                        transition: tabSlide,
                    }}
                />

                <div
                    role="group"
                    aria-label={t('nightSky.settings')}
                    aria-hidden={!open || undefined}
                    inert={!open || undefined}
                    className="drawer drawer-edge"
                    style={{
                        width: 246, maxWidth: '82vw',
                        maxHeight: 'calc(var(--app-vh, 100vh) - 96px)',
                        pointerEvents: open ? 'auto' : 'none',
                        transform: open ? 'translateX(0)' : hiddenX,
                        transition: slide,
                    }}
                >
                    <p className="label drawer-title">
                        {t('nightSky.settings')}
                    </p>

                    {/* In AR mode the sensor drives azimuth/altitude every
                        frame, so resetting them directly (the virtual-view
                        behaviour) would be overwritten on the very next
                        reading — a confusing no-op. "Look north" becomes
                        "trust the sensor again": it zeroes the manual
                        calibration-offset drag instead (see
                        NightSky3D.jsx's onPointerMove/onKeyDown, which nudge
                        that offset while AR is active rather than the view). */}
                    <button
                        onClick={() => (arMode
                            ? resetCalibrationOffset()
                            : setLookDirection(DEFAULT_AZIMUTH, DEFAULT_ALTITUDE))}
                        className="opt-row focus-ring"
                    >
                        <Compass aria-hidden="true" />
                        {t(arMode ? 'nightSky.arRecalibrate' : 'nightSky.lookNorth')}
                    </button>

                    <hr className="drawer-rule" />

                    <button
                        onClick={() => setLinesVisible(!settings.linesVisible)}
                        aria-pressed={settings.linesVisible}
                        className="opt-row focus-ring"
                    >
                        <Waves aria-hidden="true" />
                        {t('nightSky.lines')}
                    </button>

                    <button
                        onClick={() => setTwinkleEnabled(!settings.twinkle)}
                        aria-pressed={settings.twinkle}
                        className="opt-row focus-ring"
                    >
                        <Sparkles aria-hidden="true" />
                        {t('nightSky.twinkle')}
                    </button>

                    <label style={{ display: 'block', marginTop: 'var(--s-4)' }}>
                        <span className="drawer-field" style={{ marginBottom: 3 }}>
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
