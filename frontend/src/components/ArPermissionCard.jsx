import { Camera } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * The explainer card shown the moment someone taps the AR toggle in
 * NightSkyPage.jsx, before either permission (camera, device orientation)
 * is actually requested — mirrors that page's own "no location yet" card
 * (same glass/icon/title/body/error/button shape), but as an overlay on top
 * of the still-visible virtual dome rather than a full-page replacement,
 * since unlike a missing location this is reversible with one tap (Cancel)
 * and there is a scene worth leaving in view behind it.
 *
 * `onEnable` is the actual user-gesture handler: the caller sequences the
 * iOS orientation-permission request before the camera one (see
 * utils/deviceOrientation.js's own requestPermission()) — this component
 * only renders the ask and reports asking/error state back up.
 */
const ArPermissionCard = ({ onEnable, onCancel, asking, error }) => {
    const { t } = useI18n();
    return (
        <div
            style={{
                position: 'absolute', inset: 0, zIndex: 25,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20, background: 'rgba(0,0,0,0.5)',
            }}
        >
            <div className="glass" style={{ padding: 28, textAlign: 'center', maxWidth: 420 }}>
                <Camera style={{ width: 26, height: 26, color: 'var(--accent)', margin: '0 auto 10px' }} />
                <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                    {t('nightSky.arAskTitle')}
                </p>
                <p style={{ margin: '6px auto 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {t('nightSky.arAskBody')}
                </p>
                <p style={{ margin: '10px auto 0', fontSize: '0.78rem', color: '#ffd166', opacity: 0.85 }}>
                    {t('nightSky.arExperimental')}
                </p>
                {error && (
                    <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: '#ff8a80' }}>{error}</p>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
                    <button
                        onClick={onCancel}
                        disabled={asking}
                        className="rounded-xl font-bold focus-ring"
                        style={{
                            padding: '11px 18px', fontSize: '0.85rem',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.16)',
                            color: 'var(--text-secondary)', cursor: asking ? 'default' : 'pointer',
                        }}
                    >
                        {t('nightSky.arCancel')}
                    </button>
                    <button
                        onClick={onEnable}
                        disabled={asking}
                        className="flex items-center gap-2 rounded-xl font-bold focus-ring"
                        style={{
                            padding: '11px 18px', fontSize: '0.85rem',
                            background: 'rgba(255,209,102,0.14)',
                            border: '1px solid rgba(255,209,102,0.28)',
                            color: '#ffd166', cursor: asking ? 'default' : 'pointer',
                            opacity: asking ? 0.6 : 1,
                        }}
                    >
                        <Camera style={{ width: 15, height: 15 }} />
                        {t(asking ? 'nightSky.arAsking' : 'nightSky.arEnable')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ArPermissionCard;
