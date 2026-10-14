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
};

// The row of objects under an /exotic page's title. Shared by ExoticPage and
// GargantuaPage, which is one of the objects but keeps its own page.
//
// On a phone it is one row that scrolls sideways rather than wrapping: two
// rows of pills pushed the picture down under them.
export default function ExoticPicker({ current }) {
    const { t } = useI18n();
    const isMobile = useIsMobile();
    return (
        <nav
            aria-label={t('exotic.objects')}
            className={isMobile ? 'no-scrollbar' : undefined}
            style={{
                display: 'flex', flexWrap: isMobile ? 'nowrap' : 'wrap', gap: 'var(--s-1)',
                marginTop: 'var(--s-3)', pointerEvents: 'auto',
                ...(isMobile && { overflowX: 'auto', overscrollBehaviorX: 'contain' }),
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
