import { Component, useMemo, useState } from 'react';
import ObjectStatsPanel from './ObjectStatsPanel';
import DistanceChart from './DistanceChart';
import { computeDistanceSeries } from '../utils/astroFormatters';
import { CATEGORY_ACCENT } from '../data/categoryStyles';
import { isSurfacePainted } from '../data/solarSystemBodies';
import { useI18n } from '../i18n';

// Distance chart is stashed for now — flip this back to true to restore it.
// Everything it needs (DistanceChart, the series builder, the range picker)
// is still here and working; only the render is gated.
const SHOW_DISTANCE_CHART = false;

const TIME_RANGES = [
    { key: '3m', label: '3M', days: 90 },
    { key: '6m', label: '6M', days: 180 },
    { key: '1y', label: '1Y', days: 365 },
    { key: '2y', label: '2Y', days: 730 },
];

// Only bodies that orbit the Sun get a distance-from-Earth curve. A moon's
// `orbital.a` is its distance from its *planet* (Europa: 0.0045 AU), so feeding
// it to a heliocentric two-body model produced a flat ~1 AU line — which is why
// this chart was disabled. Luna is handled separately, against Earth.
const HAS_ORBIT_CHART = new Set(['planets', 'dwarf-planets', 'neos']);

class ChartBoundary extends Component {
    constructor(props) { super(props); this.state = { failed: false }; }
    static getDerivedStateFromError() { return { failed: true }; }
    render() {
        if (this.state.failed) {
            // A class component cannot call a hook, so the one string it needs
            // arrives as a prop from the caller that can.
            return (
                <div className="flex items-center justify-center p-6 text-center"
                    style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                    {this.props.message}
                </div>
            );
        }
        return this.props.children;
    }
}

/**
 * Description, stats and orbital chart for one object. Rendered inside the
 * desktop overlay panel and inside the mobile bottom sheet, so both surfaces
 * stay in sync by construction.
 */
const ObjectDetailBody = ({ object: source, showDescription = true }) => {
    const { t, object: localize } = useI18n();
    const object = localize(source);
    const [range, setRange] = useState('1y');

    const chart = useMemo(() => {
        if (!SHOW_DISTANCE_CHART) return null;
        if (!object?.orbital) return null;
        if (!HAS_ORBIT_CHART.has(object.category) && object.id !== 'luna') return null;
        const days = (TIME_RANGES.find(r => r.key === range) ?? TIME_RANGES[2]).days;
        const nowSec = Math.floor(Date.now() / 1000);

        // Earth and Luna are special: distance to the Sun / to Earth respectively,
        // driven by their own eccentricity rather than the two-body approximation.
        if (object.id === 'earth' || object.id === 'luna') {
            const isEarth = object.id === 'earth';
            const period = isEarth ? 365.25 : 27.32;
            const step = isEarth ? 5 : 1;
            const points = [];
            for (let d = -days; d <= 0; d += step) {
                const M = ((2 * Math.PI * d) / period) + (object.orbital.phase ?? 0);
                points.push({
                    time: nowSec + d * 86400,
                    value: isEarth ? 1.0 + 0.0167 * Math.cos(M)
                                   : 0.00257 * (1 + 0.0549 * Math.cos(M)),
                });
            }
            return {
                points,
                title: t(isEarth ? 'stats.distanceFromSun' : 'stats.distanceFromEarth'),
                subtitle: t('stats.chartUnits', { e: isEarth ? '0.0167' : '0.0549' }),
            };
        }

        return {
            points: computeDistanceSeries(
                object.orbital.a, object.orbital.period, days, object.orbital.phase ?? 0,
            ).filter(p => p.time <= nowSec),
            title: t('stats.distanceFromEarth'),
            subtitle: object.orbital.e != null
                ? t('stats.chartUnits', { e: object.orbital.e.toFixed(3) })
                : t('stats.chartUnitsCircular'),
        };
    }, [object, range, t]);

    if (!object) return null;
    const accent = CATEGORY_ACCENT[object.category]?.rgb ?? '255,255,255';

    return (
        <div className="flex flex-col gap-4">
            {showDescription && (
                <div className="glass p-5">
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.65, fontSize: '0.9rem', margin: 0 }}>
                        {object.description}
                    </p>
                </div>
            )}

            <ObjectStatsPanel object={object} />

            {/* No global map exists for most of these bodies, so their surface
                is generated. Say so rather than letting it pass as imagery. */}
            {isSurfacePainted(object.id) && (
                <p style={{
                    margin: 0, padding: '0 4px',
                    fontSize: '0.66rem', lineHeight: 1.5,
                    color: 'var(--text-tertiary)',
                }}>
                    {t('stats.painted', { name: object.shortName ?? object.name })}
                </p>
            )}

            {SHOW_DISTANCE_CHART && chart && chart.points.length > 1 && (
                <div className="glass p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                            <h3 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
                                {chart.title}
                            </h3>
                            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem', margin: '2px 0 0' }}>
                                {chart.subtitle}
                            </p>
                        </div>
                        <div className="glass-pill" role="group" aria-label={t('stats.chartRange')}>
                            {TIME_RANGES.map(r => (
                                <button
                                    key={r.key}
                                    onClick={() => setRange(r.key)}
                                    aria-pressed={range === r.key}
                                    style={{
                                        padding: '3px 9px',
                                        borderRadius: 10,
                                        fontSize: '0.66rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        background: range === r.key ? 'rgba(255,255,255,0.16)' : 'transparent',
                                        color: range === r.key ? '#fff' : 'var(--text-tertiary)',
                                    }}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <ChartBoundary message={t('stats.chartFailed')}>
                        <DistanceChart
                            data={chart.points}
                            color={`rgb(${accent})`}
                            ariaLabel={t('stats.chartAria', {
                                title: chart.title, name: object.name, range,
                            })}
                        />
                    </ChartBoundary>
                </div>
            )}
        </div>
    );
};

export default ObjectDetailBody;
