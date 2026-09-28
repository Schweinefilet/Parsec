import { Link } from 'react-router-dom';
import { Satellite, Star } from 'lucide-react';
import { getObjectById } from '../data/objectCatalog';
import { useModeEntry } from '../hooks/useModeEntry';
import { useI18n } from '../i18n';

// The bodies offered as a first stop, and the colour of the dot beside each.
// The Sun because its own view is the most striking thing in the scene,
// Earth because it is the one everybody looks for, Saturn because its rings
// are what "a planet" looks like to most people. Three, so the row fits on a
// phone beside its lead-in.
const FIRST_STOPS = [
    { id: 'sun',    dot: '#ffb347' },
    { id: 'earth',  dot: '#5b9bea' },
    { id: 'saturn', dot: '#dcc38e' },
];

/**
 * Start-here shortcuts under the home view's greeting, for someone who has
 * just landed and does not yet know what the page does or where to begin.
 *
 * Two rows. "Fly to" a few bodies: one tap and they are somewhere, and it
 * teaches, by doing it, that the things in the scene are there to be flown
 * to. Then the two other modes, the live satellite tracker and the night
 * sky, which otherwise sit behind unlabelled icons on desktop and inside the
 * menu on a phone. They carry the header's own icons, so the header reads
 * afterwards. They go the same cinematic way in as the header links
 * (hooks/useModeEntry.js).
 *
 * Deliberately outside the greeting's fade: a first drag hides the greeting,
 * but dragging the camera round is not the same as knowing where to go, so
 * these stay until the visitor has actually been somewhere (CategoryBrowser
 * owns that, and remembers it across visits).
 */
const StartHere = ({ hidden = false, compact = false }) => {
    const { t, object: localize } = useI18n();
    const { onTrackerClick, onSkyClick } = useModeEntry();

    return (
        <nav
            aria-label={t('scene.startLabel')}
            className="start-here transition-opacity duration-700"
            data-compact={compact || undefined}
            style={{ opacity: hidden ? 0 : 1 }}
            inert={hidden || undefined}
        >
            <div className="start-here-row">
                <span className="start-here-lead">{t('scene.startFlyTo')}</span>
                {FIRST_STOPS.map(({ id, dot }) => {
                    const name = localize(getObjectById(id)).name;
                    return (
                        <Link
                            key={id}
                            to={`/object/${id}`}
                            className="start-chip focus-ring"
                            aria-label={t('scene.flyTo', { name })}
                        >
                            <span className="start-chip-dot" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} aria-hidden="true" />
                            {name}
                        </Link>
                    );
                })}
            </div>
            <div className="start-here-row">
                <Link to="/satellites" onClick={onTrackerClick} className="start-chip focus-ring">
                    <Satellite className="start-chip-icon" aria-hidden="true" />
                    {t('scene.startTracker')}
                </Link>
                <Link to="/sky" onClick={onSkyClick} className="start-chip focus-ring">
                    <Star className="start-chip-icon" aria-hidden="true" />
                    {t('scene.startSky')}
                </Link>
            </div>
        </nav>
    );
};

export default StartHere;
