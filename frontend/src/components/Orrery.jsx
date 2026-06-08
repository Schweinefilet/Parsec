import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import * as Astronomy from 'astronomy-engine';

const CX = 400;
const CY = 400;

const PLANETS = [
    { id: 'mercury', name: 'Mercury', orbitR: 48,  r: 1.5, color: '#b5b5b5' },
    { id: 'venus',   name: 'Venus',   orbitR: 72,  r: 2.5, color: '#e8cda0' },
    { id: 'earth',   name: 'Earth',   orbitR: 96,  r: 2.5, color: '#4fa3e0' },
    { id: 'mars',    name: 'Mars',    orbitR: 128, r: 2,   color: '#c1440e' },
    { id: 'jupiter', name: 'Jupiter', orbitR: 176, r: 5,   color: '#c88b3a' },
    { id: 'saturn',  name: 'Saturn',  orbitR: 224, r: 4.5, color: '#e4d191' },
    { id: 'uranus',  name: 'Uranus',  orbitR: 268, r: 3.5, color: '#7de8e8' },
    { id: 'neptune', name: 'Neptune', orbitR: 308, r: 3,   color: '#5b7fdb' },
];

function computePositions(date) {
    return PLANETS.map(p => {
        const vec   = Astronomy.HelioVector(p.name, date);
        const angle = Math.atan2(vec.y, vec.x);
        const lon   = ((angle * 180 / Math.PI) + 360) % 360;
        return {
            cx: CX + Math.cos(angle) * p.orbitR,
            cy: CY + Math.sin(angle) * p.orbitR,
            lon,
        };
    });
}

const Orrery = () => {
    const navigate  = useNavigate();
    const dotRefs   = useRef([]);
    const [positions, setPositions] = useState(() => computePositions(new Date()));
    const [tooltip, setTooltip]     = useState(null);
    // burst: { x, y, planetId } — the screen origin of the expanding circle
    const [burst, setBurst]         = useState(null);
    const [burstExpanded, setBurstExpanded] = useState(false);

    // Refresh planet positions every 60 seconds
    useEffect(() => {
        const id = setInterval(() => setPositions(computePositions(new Date())), 60_000);
        return () => clearInterval(id);
    }, []);

    // When a new burst is set: expand the circle, then navigate after 480ms
    useEffect(() => {
        if (!burst) return;

        setBurstExpanded(false);

        // Two rAFs: first paints the small circle, second starts the CSS transition
        let raf2;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setBurstExpanded(true));
        });

        const navId = setTimeout(() => navigate(`/object/${burst.planetId}`), 480);

        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
            clearTimeout(navId);
        };
    }, [burst]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleClick = (p, i) => {
        setTooltip(null);
        const el   = dotRefs.current[i];
        const rect = el?.getBoundingClientRect();
        if (!rect) return;
        setBurst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, planetId: p.id });
    };

    return (
        <div className="glass" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Title + date legend */}
            <div style={{ position: 'absolute', top: 14, left: 18, zIndex: 10, pointerEvents: 'none' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Solar System
                </p>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 3 }}>
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
            </div>
            <svg viewBox="0 0 800 800" width="100%" style={{ display: 'block' }}>
                {/* Sun */}
                <circle cx={CX} cy={CY} r={4} fill="#fff" />

                {/* Orbital rings */}
                {PLANETS.map(p => (
                    <circle
                        key={p.name}
                        cx={CX} cy={CY}
                        r={p.orbitR}
                        fill="none"
                        stroke="rgba(255,255,255,0.08)"
                        strokeWidth="1"
                    />
                ))}

                {/* Planet dots + hit areas */}
                {positions.map((pos, i) => {
                    const p = PLANETS[i];
                    return (
                        <g
                            key={p.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleClick(p, i)}
                            onMouseEnter={e => setTooltip({ name: p.name, lon: pos.lon, x: e.clientX, y: e.clientY })}
                            onMouseMove={e => setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                            onMouseLeave={() => setTooltip(null)}
                        >
                            <circle
                                ref={el => { dotRefs.current[i] = el; }}
                                cx={pos.cx} cy={pos.cy}
                                r={p.r} fill={p.color}
                            />
                            <circle cx={pos.cx} cy={pos.cy} r={12} fill="transparent" />
                        </g>
                    );
                })}
            </svg>

            {/* Hover tooltip */}
            {tooltip && (
                <div style={{
                    position: 'fixed',
                    left: tooltip.x,
                    top: tooltip.y - 10,
                    transform: 'translate(-50%, -100%)',
                    background: 'rgba(8,8,18,0.92)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '6px',
                    padding: '3px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#fff',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    whiteSpace: 'nowrap',
                }}>
                    {tooltip.name} · {tooltip.lon?.toFixed(1)}°
                </div>
            )}

            {/* Expanding circle transition — portalled to body so it escapes overflow:hidden */}
            {burst && createPortal(
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 99999,
                    overflow: 'hidden',
                }}>
                    <div style={{
                        position: 'absolute',
                        left: burst.x,
                        top: burst.y,
                        width:  burstExpanded ? '300vw' : '8px',
                        height: burstExpanded ? '300vw' : '8px',
                        borderRadius: '50%',
                        background: '#fff',
                        transform: 'translate(-50%, -50%)',
                        transition: burstExpanded ? 'width 500ms ease-in, height 500ms ease-in' : 'none',
                    }} />
                </div>,
                document.body
            )}
        </div>
    );
};

export default Orrery;
