import { useMemo, useRef, useState, useCallback } from 'react';

// Distance-over-time chart drawn as inline SVG. Replaces a financial charting
// library that was ported in from another project — a single smoothed series
// needs an axis, a fill and a readout, not a candlestick engine.

const PAD = { top: 14, right: 12, bottom: 22, left: 46 };
const VB_W = 600;
const VB_H = 200;

// Catmull-Rom → cubic Bézier, so the line curves through every sample.
function smoothPath(pts) {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] ?? pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] ?? p2;
        const c1x = p1.x + (p2.x - p0.x) / 6;
        const c1y = p1.y + (p2.y - p0.y) / 6;
        const c2x = p2.x - (p3.x - p1.x) / 6;
        const c2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    return d;
}

const fmtDate = (unixSec) =>
    new Date(unixSec * 1000).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

const DistanceChart = ({ data, color = '#ffffff', unit = 'AU', ariaLabel }) => {
    const svgRef = useRef(null);
    const [hover, setHover] = useState(null);
    const gradId = useRef(`dcg-${Math.random().toString(36).slice(2, 9)}`).current;

    const model = useMemo(() => {
        if (!Array.isArray(data) || data.length < 2) return null;
        const values = data.map(d => d.value);
        const times = data.map(d => d.time);
        let min = Math.min(...values);
        let max = Math.max(...values);
        // Pad the range so the curve never rides the frame; guard flat series
        const span = max - min || Math.max(Math.abs(max) * 0.1, 0.001);
        min -= span * 0.15;
        max += span * 0.15;
        const t0 = times[0];
        const t1 = times[times.length - 1];
        const iw = VB_W - PAD.left - PAD.right;
        const ih = VB_H - PAD.top - PAD.bottom;
        const xOf = (t) => PAD.left + ((t - t0) / (t1 - t0 || 1)) * iw;
        const yOf = (v) => PAD.top + (1 - (v - min) / (max - min)) * ih;
        const pts = data.map(d => ({ x: xOf(d.time), y: yOf(d.value), ...d }));
        return { pts, min, max, t0, t1, xOf, yOf, iw, ih,
            lo: Math.min(...values), hi: Math.max(...values) };
    }, [data]);

    const onMove = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg || !model) return;
        const rect = svg.getBoundingClientRect();
        const clientX = e.touches?.[0]?.clientX ?? e.clientX;
        const vbX = ((clientX - rect.left) / rect.width) * VB_W;
        // Nearest sample to the pointer
        let best = model.pts[0];
        let bestD = Infinity;
        for (const p of model.pts) {
            const d = Math.abs(p.x - vbX);
            if (d < bestD) { bestD = d; best = p; }
        }
        setHover(best);
    }, [model]);

    if (!model) {
        return (
            <div className="flex items-center justify-center"
                style={{ height: 200, color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                Not enough data to chart.
            </div>
        );
    }

    const { pts, min, max, lo, hi } = model;
    const line = smoothPath(pts);
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(2)} ${VB_H - PAD.bottom} L ${pts[0].x.toFixed(2)} ${VB_H - PAD.bottom} Z`;
    const ticks = [max, (max + min) / 2, min];

    return (
        <div style={{ position: 'relative' }}>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                preserveAspectRatio="none"
                style={{ width: '100%', height: 200, display: 'block', touchAction: 'pan-y' }}
                role="img"
                aria-label={ariaLabel ?? `Distance over time, ranging from ${lo.toFixed(2)} to ${hi.toFixed(2)} ${unit}`}
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
                onTouchStart={onMove}
                onTouchMove={onMove}
                onTouchEnd={() => setHover(null)}
            >
                <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={color} stopOpacity="0.30" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Horizontal guides + value labels */}
                {ticks.map((v, i) => {
                    const y = model.yOf(v);
                    return (
                        <g key={i}>
                            <line
                                x1={PAD.left} y1={y} x2={VB_W - PAD.right} y2={y}
                                stroke="rgba(255,255,255,0.08)" strokeWidth="1"
                                vectorEffect="non-scaling-stroke"
                            />
                            <text
                                x={PAD.left - 8} y={y + 3} textAnchor="end"
                                fill="rgba(255,255,255,0.40)" fontSize="9" fontWeight="600"
                            >
                                {v.toFixed(v < 10 ? 2 : 0)}
                            </text>
                        </g>
                    );
                })}

                <path d={area} fill={`url(#${gradId})`} />
                <path
                    d={line} fill="none" stroke={color} strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                />

                {/* Time axis: first, middle, last */}
                {[pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].map((p, i) => (
                    <text
                        key={i}
                        x={p.x} y={VB_H - 7}
                        textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
                        fill="rgba(255,255,255,0.35)" fontSize="9" fontWeight="600"
                    >
                        {fmtDate(p.time)}
                    </text>
                ))}

                {hover && (
                    <g>
                        <line
                            x1={hover.x} y1={PAD.top} x2={hover.x} y2={VB_H - PAD.bottom}
                            stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeDasharray="3 3"
                            vectorEffect="non-scaling-stroke"
                        />
                        <circle cx={hover.x} cy={hover.y} r="4" fill={color}
                            stroke="#000" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                    </g>
                )}
            </svg>

            {/* Readout — HTML rather than SVG text so it doesn't stretch with preserveAspectRatio */}
            <div
                aria-live="polite"
                style={{
                    position: 'absolute', top: 0, right: 0,
                    padding: '2px 8px', borderRadius: 8,
                    background: 'rgba(0,0,0,0.55)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    opacity: hover ? 1 : 0,
                    transition: 'opacity 0.15s ease',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                }}
            >
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
                    {hover ? hover.value.toFixed(3) : '—'}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginLeft: 4 }}>
                    {unit}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, marginLeft: 8 }}>
                    {hover ? new Date(hover.time * 1000).toLocaleDateString(undefined,
                        { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                </span>
            </div>
        </div>
    );
};

export default DistanceChart;
