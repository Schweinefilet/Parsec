import React, {
    useEffect, useRef, useState, useCallback, useMemo,
    forwardRef, useImperativeHandle,
} from 'react';
import { createChart, CrosshairMode, AreaSeries, LineSeries } from 'lightweight-charts';
import { X } from 'lucide-react';

// ChartContainer trimmed for Parsec:
//   - Removed trade markers (createSeriesMarkers, buildSeriesMarkers, tradeMarkers props)
//   - Removed drawing overlay (DrawingOverlay, drawings, onAddDrawing, activeTool props)
//   - Removed position entry line (position prop)
//   - Kept: multi-pane layout, crosshair sync, time-axis sync, overlay legend chips,
//           drag-resize handles, ResizeObserver, prepareData

const CHART_OPTIONS = {
    layout: {
        background: { color: '#000000' },
        textColor: '#d1d4dc',
        fontSize: 11,
        attributionLogo: false,
    },
    grid: {
        vertLines: { color: 'rgba(255,255,255,0.07)' },
        horzLines: { color: 'rgba(255,255,255,0.07)' },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.10)',
        borderVisible: true,
        minimumWidth: 58,
    },
    timeScale: {
        borderColor: 'rgba(255,255,255,0.10)',
        borderVisible: true,
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
    },
};

const prepareData = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const formatted = rows.map(d => {
        if (!d) return null;
        const t = d.time || d.Date;
        if (!t) return null;

        let timeValue = t;
        if (typeof t === 'string' && (t.includes(':') || t.includes('T') || t.includes(' '))) {
            const date = new Date(t);
            if (!isNaN(date.getTime())) timeValue = Math.floor(date.getTime() / 1000);
        }

        return {
            time: timeValue,
            value: Number(d.value ?? d.close ?? d.Close ?? 0),
        };
    }).filter(d => d !== null && d.time !== undefined);

    formatted.sort((a, b) => {
        const ta = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time * 1000;
        const tb = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time * 1000;
        return ta - tb;
    });

    const unique = [];
    const seen = new Set();
    for (const row of formatted) {
        if (!seen.has(row.time)) { unique.push(row); seen.add(row.time); }
    }
    return unique;
};

const solidColor = (hex) => {
    if (!hex) return '#ffffff';
    return hex.length > 7 ? hex.slice(0, 7) : hex;
};

function formatCrosshairTime(time) {
    if (time === undefined || time === null) return '';
    const date = new Date(typeof time === 'string' ? time : time * 1000);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return timeStr;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
}

// ── ChartPane ─────────────────────────────────────────────────────────────────
const ChartPane = forwardRef(({
    id,
    data = [],
    type,
    title,
    color = '#ffffff',
    height,
    isLast,
    syncTimeAxis,
    syncCrosshair,
    showTimeLabel,
    overlays = [],
    onCrosshairMove,
    onClose,
    onRemoveOverlay,
}, ref) => {
    const containerRef = useRef(null);
    const chartRef     = useRef(null);
    const mainSeriesRef = useRef(null);
    const seriesRefs   = useRef({});
    const [isReady, setIsReady] = useState(false);
    const [timeLabel, setTimeLabel] = useState(null);

    useImperativeHandle(ref, () => ({
        getChart:  () => chartRef.current,
        getSeries: () => mainSeriesRef.current,
    }));

    useEffect(() => {
        if (!containerRef.current) return;

        const chart = createChart(containerRef.current, {
            ...CHART_OPTIONS,
            height,
            timeScale: { ...CHART_OPTIONS.timeScale, visible: isLast },
        });
        chartRef.current = chart;

        let series;
        if (type === 'area') {
            series = chart.addSeries(AreaSeries, {
                lineColor: solidColor(color),
                topColor: `${solidColor(color)}28`,
                bottomColor: `${solidColor(color)}00`,
                lineWidth: 2,
                priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
            });
        } else {
            series = chart.addSeries(LineSeries, { color: solidColor(color), lineWidth: 2 });
        }
        mainSeriesRef.current = series;
        setIsReady(true);

        chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            if (syncTimeAxis) syncTimeAxis(range, id);
        });

        chart.subscribeCrosshairMove(param => {
            if (showTimeLabel) {
                if (param?.point && param?.time !== undefined) {
                    setTimeLabel({ x: param.point.x, text: formatCrosshairTime(param.time) });
                } else {
                    setTimeLabel(null);
                }
            }
            if (syncCrosshair) syncCrosshair(param, id);
            if (onCrosshairMove) {
                if (!param?.point || !param?.seriesData) { onCrosshairMove(null); return; }
                const bar = param.seriesData.get(mainSeriesRef.current);
                onCrosshairMove(bar || null);
            }
        });

        return () => {
            setIsReady(false);
            setTimeLabel(null);
            seriesRefs.current = {};
            chart.remove();
        };
    }, [id, type, isLast, color]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isReady || !mainSeriesRef.current || !data) return;
        const safeData = prepareData(data);
        if (safeData.length > 0) {
            mainSeriesRef.current.setData(safeData.map(({ time, value }) => ({ time, value })));
            chartRef.current.timeScale().fitContent();
        }

        const currentIds = new Set(overlays.map(o => o.id));
        Object.keys(seriesRefs.current).forEach(sid => {
            if (!currentIds.has(sid)) {
                try { chartRef.current.removeSeries(seriesRefs.current[sid]); } catch {} // eslint-disable-line no-empty
                delete seriesRefs.current[sid];
            }
        });

        overlays.forEach(ov => {
            if (!seriesRefs.current[ov.id]) {
                seriesRefs.current[ov.id] = chartRef.current.addSeries(LineSeries, {
                    color: solidColor(ov.color) || '#ffffff',
                    lineWidth: 1.5,
                    priceLineVisible: false,
                    lastValueVisible: true,
                });
            }
            seriesRefs.current[ov.id].setData(prepareData(ov.data));
        });
    }, [data, overlays, isReady, type]);

    useEffect(() => {
        if (chartRef.current && height && containerRef.current) {
            chartRef.current.resize(containerRef.current.clientWidth, height);
        }
    }, [height]);

    const overlayChips = useMemo(() => {
        const seen = new Set();
        return overlays.filter(ov => {
            if (!ov.label) return false;
            const key = ov.sourceId ?? ov.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [overlays]);

    return (
        <div className="relative w-full border-b border-white/20 flex-shrink-0" style={{ height }}>
            <div className="absolute top-1.5 left-2 z-10 flex items-center gap-2 flex-wrap">
                {title && (
                    <span className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 pointer-events-none"
                        style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {type === 'line' && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        )}
                        {title}
                    </span>
                )}
                {overlayChips.map(ov => (
                    <span key={ov.sourceId ?? ov.id} className="flex items-center gap-0.5 text-[10px] font-bold">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: solidColor(ov.color) }} />
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>{ov.label}</span>
                        {onRemoveOverlay && (
                            <button
                                onClick={() => onRemoveOverlay(ov.sourceId ?? ov.id)}
                                className="ml-0.5 hover:text-rose-400 transition-colors leading-none"
                                style={{ color: 'rgba(255,255,255,0.3)' }}
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </span>
                ))}
                {onClose && (
                    <button onClick={onClose} className="hover:text-white transition-colors leading-none"
                        style={{ color: 'rgba(255,255,255,0.35)' }}>
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>

            <div ref={containerRef} className="w-full h-full" />

            {/* Y-axis unit label — AU is the unit for all Parsec orbital distance charts */}
            {type === 'area' && (
                <div style={{
                    position: 'absolute', top: 6, right: 4, zIndex: 10,
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
                    color: 'rgba(255,255,255,0.22)', pointerEvents: 'none',
                }}>AU</div>
            )}

            {showTimeLabel && timeLabel && (
                <div style={{
                    position: 'absolute', bottom: 0, left: timeLabel.x,
                    transform: 'translateX(-50%)',
                    background: '#1e222d', color: '#d1d4dc',
                    fontSize: '10px', fontFamily: 'monospace',
                    padding: '1px 5px', lineHeight: '16px',
                    border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: '2px', pointerEvents: 'none', zIndex: 20,
                    whiteSpace: 'nowrap',
                }}>
                    {timeLabel.text}
                </div>
            )}
        </div>
    );
});

ChartPane.displayName = 'ChartPane';

// ── OrbitalChart (was ChartContainer) ────────────────────────────────────────
const OrbitalChart = ({
    data,
    chartType = 'area',
    panes = [],
    overlays = [],
    onCrosshairMove,
    onRemovePane,
    onRemoveOverlay,
    color = '#ffffff',
}) => {
    const paneRefs            = useRef({});
    const isSyncing           = useRef(false);
    const isSyncingCrosshair  = useRef(false);
    const outerRef            = useRef(null);
    const [paneHeights, setPaneHeights]       = useState({});
    const [containerHeight, setContainerHeight] = useState(400);

    useEffect(() => {
        if (!outerRef.current) return;
        const ro = new ResizeObserver(entries => {
            if (entries[0]) setContainerHeight(entries[0].contentRect.height);
        });
        ro.observe(outerRef.current);
        return () => ro.disconnect();
    }, []);

    const getPaneHeight = (id) => paneHeights[id] ?? 150;
    const totalOscHeight   = panes.reduce((sum, p) => sum + getPaneHeight(p.id), 0);
    const dragHandleTotal  = panes.length * 4;
    const mainHeight       = Math.max(200, containerHeight - totalOscHeight - dragHandleTotal);

    const handleDragStart = useCallback((e, paneId) => {
        e.preventDefault();
        const startY = e.clientY;
        const startH = paneHeights[paneId] ?? 150;
        const onMove = ev =>
            setPaneHeights(prev => ({ ...prev, [paneId]: Math.max(80, startH + ev.clientY - startY) }));
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [paneHeights]);

    const syncTimeAxis = useCallback((range, sourceId) => {
        if (isSyncing.current || !range) return;
        isSyncing.current = true;
        Object.keys(paneRefs.current).forEach(id => {
            if (id !== sourceId && paneRefs.current[id]) {
                paneRefs.current[id].getChart()?.timeScale().setVisibleLogicalRange(range);
            }
        });
        isSyncing.current = false;
    }, []);

    const syncCrosshair = useCallback((param, sourceId) => {
        if (isSyncingCrosshair.current) return;
        isSyncingCrosshair.current = true;
        const hasValidTime = param?.time !== undefined && param?.time !== null;
        Object.keys(paneRefs.current).forEach(id => {
            if (id === sourceId) return;
            const pane = paneRefs.current[id];
            if (!pane) return;
            const chart  = pane.getChart();
            const series = pane.getSeries();
            if (!chart || !series) return;
            if (!hasValidTime || !param?.point) { chart.clearCrosshairPosition(); return; }
            try {
                chart.setCrosshairPosition(0, param.time, series);
            } catch {
                chart.clearCrosshairPosition();
            }
        });
        isSyncingCrosshair.current = false;
    }, []);

    if (!data || data.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center"
                style={{ minHeight: 300, color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                No data available
            </div>
        );
    }

    return (
        <div ref={outerRef} className="flex flex-col w-full h-full overflow-hidden" style={{ background: '#000' }}>
            <ChartPane
                ref={el => paneRefs.current['main'] = el}
                id="main"
                data={data}
                type={chartType}
                color={color}
                height={mainHeight}
                isLast={panes.length === 0}
                syncTimeAxis={syncTimeAxis}
                syncCrosshair={syncCrosshair}
                showTimeLabel={panes.length > 0}
                overlays={overlays}
                onCrosshairMove={onCrosshairMove}
                onRemoveOverlay={onRemoveOverlay}
            />
            {panes.map((pane, index) => (
                <React.Fragment key={pane.id}>
                    <div
                        className="w-full h-1 hover:bg-white/30 cursor-ns-resize flex-shrink-0 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.15)' }}
                        onMouseDown={e => handleDragStart(e, pane.id)}
                        title="Drag to resize"
                    />
                    <ChartPane
                        ref={el => paneRefs.current[pane.id] = el}
                        id={pane.id}
                        title={pane.title}
                        data={pane.data}
                        type="line"
                        color={pane.color ?? '#ffffff'}
                        height={getPaneHeight(pane.id)}
                        isLast={index === panes.length - 1}
                        syncTimeAxis={syncTimeAxis}
                        syncCrosshair={syncCrosshair}
                        showTimeLabel={index !== panes.length - 1}
                        overlays={pane.overlays ?? []}
                        onClose={onRemovePane ? () => onRemovePane(pane.id) : undefined}
                    />
                </React.Fragment>
            ))}
        </div>
    );
};

export default OrbitalChart;
