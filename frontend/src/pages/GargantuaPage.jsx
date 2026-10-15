import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Cpu, Waves, Clapperboard, MoveVertical } from 'lucide-react';
import Gargantua3D from '../components/Gargantua3D';
import SceneBack from '../components/SceneBack';
import SceneDialog from '../components/SceneDialog';
import {
    ExoticFrame, PhoneGate, ExoticTitle, ExoticSettings, ShotPicker, QualityPicker, Slider, ExoticFoot,
} from '../components/ExoticChrome';
import { MAX_SPIN } from '../utils/kerr';
import {
    SHOTS, SHOT_ORDER, QUALITY_ORDER, DEFAULT_QUALITY, lowerQuality, hourElsewhere,
    GRAV_RADIUS_KM, AU_KM,
} from '../utils/gargantuaCamera';
import { useI18n } from '../i18n';

// /exotic/gargantua — the black hole from Interstellar, the first of the
// exotic objects (ExoticPage hands this id to this page, which keeps its own
// controls and readouts under the shared picker). Lazy with the rest of
// /exotic (App.jsx); /gargantua redirects here.
//
// It is the one page on the site built to be expensive: a desktop GPU is the
// audience, the default quality is already heavy, and the top setting is
// there to make a strong card sweat. A phone gets told so before anything
// starts, and may carry on anyway.

const SHOT_KEYS = {
    film: 'gargantua.shotFilm', physical: 'gargantua.shotPhysical',
    above: 'gargantua.shotAbove', dive: 'gargantua.shotDive', quasar: 'gargantua.shotQuasar',
};

const GargantuaPage = () => {
    const { t, num } = useI18n();
    const navigate = useNavigate();

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
        // ?jets=1 turns them on with any shot.
        jets: !!SHOTS[initial.id].jets || params.get('jets') === '1',
        cinematic: true,
    }));
    const [shot, setShot] = useState({ id: initial.id, nonce: 0 });
    const [hud, setHud] = useState(null);
    const [failure, setFailure] = useState(null);
    // Bumped to remount the renderer after its context was lost.
    const [generation, setGeneration] = useState(0);

    const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
    const pickShot = (id) => {
        const s = SHOTS[id];
        set({ spin: s.spin, doppler: !!s.doppler, temp: s.temp, jets: !!s.jets });
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

    const f1 = { maximumFractionDigits: 1 };
    const readouts = hud ? [
        [t('gargantua.distance'), t('gargantua.distanceValue', {
            r: num(hud.dist, f1), au: num((hud.dist * GRAV_RADIUS_KM) / AU_KM, f1),
        })],
        [t('gargantua.hourHere'), t('gargantua.hourThere', { amount: hourText })],
        [t('gargantua.spin'), t('gargantua.spinValue', {
            a: num(hud.spin, { minimumFractionDigits: 3, maximumFractionDigits: 3 }),
            isco: num(hud.isco, { maximumFractionDigits: 2 }),
        })],
        // The ratio is what beaming does, so it is only quoted with it on.
        ...(hud.jets ? [[t('gargantua.jetsReadout'), t(settings.doppler ? 'gargantua.jetsValue' : 'gargantua.jetsValueFlat', {
            ratio: num(hud.jetRatio, { maximumSignificantDigits: 2 }),
            v: num(hud.jetSpeed, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
        })]] : []),
        [
            <Cpu key="cpu" style={{ width: 11, height: 11, display: 'inline' }} aria-hidden="true" />,
            t('gargantua.perf', { fps: num(Math.round(hud.fps)), mp: num(hud.pixels / 1e6, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }),
        ],
    ] : null;

    return (
        <PhoneGate body={t('gargantua.desktopBody')}>
            <ExoticFrame>
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
                <SceneBack onClick={() => navigate('/')} />

                {/* The film's own title treatment — thin, wide-tracked capitals —
                    kept on purpose: it is the one page that is a homage. Its
                    size and the tagline under it are the site's. */}
                <ExoticTitle
                    current="gargantua"
                    title={t('gargantua.title')}
                    tagline={t('gargantua.tagline')}
                    tracking="0.32em"
                />

                <ExoticFoot readouts={readouts} credit={t('gargantua.credit')} />

                <ExoticSettings label={t('gargantua.settings')} closeLabel={t('gargantua.settingsClose')}>
                    <ShotPicker
                        heading={t('gargantua.shots')}
                        order={SHOT_ORDER}
                        label={(id) => t(SHOT_KEYS[id])}
                        isOn={(id) => shot.id === id && (id !== 'dive' || !!hud?.diving)}
                        onPick={pickShot}
                    />

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
                        aria-pressed={settings.jets}
                        onClick={() => set({ jets: !settings.jets })}
                    >
                        <MoveVertical aria-hidden="true" />
                        {t('gargantua.jets')}
                    </button>
                    <p className="drawer-note" style={{ marginBottom: 'var(--s-2)' }}>{t('gargantua.jetsNote')}</p>
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
            </ExoticFrame>
        </PhoneGate>
    );
};

export default GargantuaPage;
