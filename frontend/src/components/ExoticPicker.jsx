import { Link } from 'react-router-dom';
import { EXOTIC_ORDER } from '../utils/exoticScenes';
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
export default function ExoticPicker({ current }) {
    const { t } = useI18n();
    return (
        <nav
            aria-label={t('exotic.objects')}
            style={{
                display: 'flex', flexWrap: 'wrap', gap: 'var(--s-1)', marginTop: 'var(--s-3)',
                pointerEvents: 'auto',
            }}
        >
            {EXOTIC_ORDER.map((id) => (
                <Link
                    key={id}
                    to={`/exotic/${id}`}
                    className="opt-row focus-ring"
                    aria-current={id === current ? 'page' : undefined}
                    data-on={id === current || undefined}
                    style={{ width: 'auto', paddingInline: 'var(--s-3)' }}
                >
                    {t(TITLE_KEY[id])}
                </Link>
            ))}
        </nav>
    );
}
