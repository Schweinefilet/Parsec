import { useLocation, useNavigate } from 'react-router-dom';
import { armSkyEntry } from '../utils/skyEntry';
import { armTrackerEntry } from '../utils/trackerEntry';
import { useObserverLocation } from './useObserverLocation';

/**
 * Click handlers for the two other modes — the satellite tracker and the
 * night sky — that play their cinematic way in rather than cutting to the
 * page. Shared by every link into them (the header dock, the phone menu, the
 * home view's start-here shortcuts), so they all arrive the same way.
 *
 * Each is meant for the onClick of a <Link> to the mode's own route: when it
 * steps aside (already there, a modified click, nowhere to dive to), the
 * link's ordinary navigation carries on.
 *
 * Tracker: arms the cinematic and goes to Earth instead, which is on the
 * catch-all route — so the scene is not torn down, and the ordinary focus
 * fly-in becomes the transition itself rather than the first half of it: it
 * is told to land on the pose the tracker's globe opens at.
 *
 * Sky: the dive-to-Earth transition (utils/skyEntry.js) needs a real spot to
 * dive to and a mounted solar-system scene to dive through. Without a
 * remembered location there is nothing to zoom in on, so the link just
 * navigates — /sky's own ask-card handles the prompt from there.
 *
 * A modified click (new tab, middle-click) is left alone for both: the
 * cinematic only makes sense replacing the tab you're already in.
 */
export function useModeEntry() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { location: skyLocation } = useObserverLocation();

    const plainClick = (e) =>
        e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

    const onTrackerClick = (e) => {
        if (pathname === '/satellites' || !plainClick(e)) return;
        e.preventDefault();
        armTrackerEntry();
        navigate('/object/earth');
    };

    const onSkyClick = (e) => {
        if (pathname === '/sky' || !skyLocation || !plainClick(e)) return;
        e.preventDefault();
        armSkyEntry(skyLocation);
        navigate('/object/earth');
    };

    return { onTrackerClick, onSkyClick };
}
