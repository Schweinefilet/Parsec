import { Camera } from 'lucide-react';
import { useI18n } from '../i18n';
import SceneDialog from './SceneDialog';

/**
 * The explainer card shown the moment someone taps the AR toggle in
 * NightSkyPage.jsx, before either permission (camera, device orientation)
 * is actually requested — mirrors that page's own "no location yet" card
 * (the same SceneDialog), but as a scrimmed overlay on top
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
        <SceneDialog
            icon={Camera}
            title={t('nightSky.arAskTitle')}
            body={t('nightSky.arAskBody')}
            scrim zIndex={25}
        >
            <p className="dialog-note">{t('nightSky.arExperimental')}</p>
            {error && <p className="dialog-error">{error}</p>}
            <div className="dialog-actions">
                <button onClick={onCancel} disabled={asking} className="action-btn focus-ring" data-variant="quiet">
                    {t('nightSky.arCancel')}
                </button>
                <button onClick={onEnable} disabled={asking} className="action-btn focus-ring">
                    <Camera aria-hidden="true" />
                    {t(asking ? 'nightSky.arAsking' : 'nightSky.arEnable')}
                </button>
            </div>
        </SceneDialog>
    );
};

export default ArPermissionCard;
