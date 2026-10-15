import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { EXOTIC_ORDER } from '../utils/exoticScenes';
import { useIsMobile } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

/** Picker id → the title key it shows. Gargantua keeps its own page's strings. */
const TITLE_KEY = {
    gargantua: 'gargantua.title',
    wormhole: 'exotic.wormhole.title',
    'neutron-star': 'exotic.neutronStar.title',
    binary: 'exotic.binary.title',
    roche: 'exotic.roche.title',
    'hl-tau': 'exotic.hlTau.title',
    wr104: 'exotic.wr104.title',
    ring: 'exotic.ring.title',
    tde: 'exotic.tde.title',
};

// The row of objects over an /exotic page's title. Shared by ExoticPage and
// GargantuaPage, which is one of the objects but keeps its own page.
//
// On a phone it is one row that scrolls sideways rather than wrapping: two
// rows of pills pushed the picture down under them. The row runs on to the
// screen's edges and fades there, so a pill cut in half reads as "more this
// way" rather than as clipped, and it opens scrolled to the object on screen.
export default function ExoticPicker({ current }) {
    const { t, rtl } = useI18n();
    const isMobile = useIsMobile();
    const navRef = useRef(null);
    // Scrolled all the way along: nothing more to hint at, so no fade over
    // the last pill.
    const [ends, setEnds] = useState({ start: true, end: false });
    const measure = useCallback(() => {
        const nav = navRef.current;
        if (!nav) return;
        const along = Math.abs(nav.scrollLeft);
        const start = along < 2;
        const end = along + nav.clientWidth >= nav.scrollWidth - 2;
        setEnds((e) => (e.start === start && e.end === end ? e : { start, end }));
    }, []);

    useEffect(() => {
        const nav = navRef.current;
        const el = nav?.querySelector('[aria-current]');
        if (!isMobile || !nav) return;
        if (el) {
            // By hand rather than scrollIntoView, which would also scroll the
            // page's own overflow-hidden frame.
            const n = nav.getBoundingClientRect();
            const e = el.getBoundingClientRect();
            const pad = 48;
            if (e.right > n.right - pad) nav.scrollLeft += e.right - n.right + pad;
            else if (e.left < n.left + pad) nav.scrollLeft -= n.left + pad - e.left;
        }
        measure();
    }, [current, isMobile, measure]);

    // Faded at whichever end has more to scroll to.
    const fade = `linear-gradient(to ${rtl ? 'left' : 'right'}, `
        + `${ends.start ? '#000' : 'transparent'}, #000 32px, #000 calc(100% - 48px), `
        + `${ends.end ? '#000' : 'transparent'})`;
    return (
        <nav
            ref={navRef}
            aria-label={t('exotic.objects')}
            className={isMobile ? 'no-scrollbar' : undefined}
            onScroll={isMobile ? measure : undefined}
            style={{
                display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', gap: 'var(--s-1)',
                pointerEvents: 'auto',
                ...(isMobile && {
                    overflowX: 'auto', overscrollBehaviorX: 'contain',
                    // Out to both edges of the screen, so pills scroll away
                    // under them rather than being cut at the gutter, with
                    // room for the focus ring, which a scroller would clip.
                    marginInline: 'calc(-1 * var(--scene-inset))',
                    paddingInline: 'var(--scene-inset)',
                    paddingBlock: 3, marginBlock: -3,
                    ...(!(ends.start && ends.end) && { maskImage: fade, WebkitMaskImage: fade }),
                }),
            }}
        >
            {EXOTIC_ORDER.map((id) => (
                <Link
                    key={id}
                    to={`/exotic/${id}`}
                    className="opt-row focus-ring"
                    aria-current={id === current ? 'page' : undefined}
                    data-on={id === current || undefined}
                    // marginTop: .opt-row + .opt-row stacks drawer rows; in a
                    // row it dropped every pill after the first by 8px.
                    style={{
                        width: 'auto', flexShrink: 0, marginTop: 0, whiteSpace: 'nowrap',
                        paddingInline: 'var(--s-3)',
                    }}
                >
                    {t(TITLE_KEY[id])}
                </Link>
            ))}
        </nav>
    );
}
