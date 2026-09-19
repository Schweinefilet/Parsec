import { useEffect, useState } from 'react';
import { getTrackerPhase } from '../utils/trackerEntry';

/**
 * TEMPORARY. A readout of every number the tracker's arrival depends on,
 * printed over the page so it can be photographed.
 *
 * There is a layout fault on the tracker that only appears on a real phone,
 * on the arrival from the solar system, and it has survived being reasoned at
 * from screenshots. Headless Chrome at the same viewport lands the card
 * correctly every time, so the difference is in numbers this side cannot see:
 * what the viewport reports, what the lifted card's box actually is, what the
 * slot holding its place measures, and what the globe ends up drawing into.
 *
 * Switched on by loading any page with `?debug=1`, which is remembered for the
 * tab so it survives the navigate the hand-off makes. Delete this file, its
 * import, and the flag once the fault is found.
 */
const TrackerDebug = ({ slotRef, cardRef }) => {
    const [lines, setLines] = useState([]);

    useEffect(() => {
        const box = (el) => {
            if (!el) return 'none';
            const b = el.getBoundingClientRect();
            return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`;
        };
        const read = () => {
            const card = cardRef.current;
            // Every canvas, not the first: a globe effect that set up twice
            // would leave a dead one stacked above the live one, which is one
            // of the few things that can push a correctly sized globe down the
            // card with a band of nothing over it.
            const canvases = card ? [...card.querySelectorAll('canvas')] : [];
            const mount = canvases[0]?.parentElement;
            setLines([
                `phase ${getTrackerPhase()}  scrollY ${Math.round(window.scrollY)}`,
                `win ${window.innerWidth}x${window.innerHeight} dpr ${window.devicePixelRatio}`,
                `doc ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
                `slot ${box(slotRef.current)}`,
                `card ${box(card)} ${card ? getComputedStyle(card).position : ''}`,
                `mount ${mount ? `${mount.clientWidth}x${mount.clientHeight} sh ${mount.scrollHeight}` : 'none'}`,
                `cvs x${canvases.length} ${box(canvases[0])} buf ${canvases[0] ? `${canvases[0].width}x${canvases[0].height}` : '-'}`,
                ...canvases.slice(1).map((c, i) => `cvs${i + 2} ${box(c)} buf ${c.width}x${c.height}`),
                `clip ${card ? getComputedStyle(card).clipPath.slice(0, 44) : ''}`,
            ]);
        };
        read();
        const iv = setInterval(read, 400);
        return () => clearInterval(iv);
    }, [slotRef, cardRef]);

    return (
        <div
            aria-hidden="true"
            style={{
                position: 'fixed', top: 58, insetInlineStart: 6, zIndex: 9999,
                pointerEvents: 'none', padding: '6px 8px', borderRadius: 6,
                background: 'rgba(0,0,0,0.82)', border: '1px solid rgba(0,255,140,0.45)',
                color: '#5fff9f', font: '600 10px/1.45 ui-monospace, Menlo, Consolas, monospace',
                whiteSpace: 'pre', direction: 'ltr', textAlign: 'left',
            }}
        >
            {lines.join('\n')}
        </div>
    );
};

export default TrackerDebug;
