import { useEffect, useRef } from 'react';

// Sparse drifting starfield painted behind everything. Density scales with
// viewport area so phones don't get a dense mesh in a narrow column, and the
// whole layer freezes for anyone who asks for reduced motion.
const StarfieldBg = ({ canvasId = 'starfield-bg' }) => {
    const idRef = useRef(canvasId);

    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.id = idRef.current;
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0';
        document.body.appendChild(canvas);

        const ctx = canvas.getContext('2d', { alpha: true });
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

        let stars = [];
        let dpr = 1;
        let w = 0;
        let h = 0;

        const build = () => {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = window.innerWidth;
            h = window.innerHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // ~1 star per 9000 px² of viewport, clamped so neither phones nor
            // ultrawides get an unreasonable count.
            const count = Math.round(Math.min(260, Math.max(70, (w * h) / 9000)));
            stars = Array.from({ length: count }, () => {
                // Cube the roll so most stars stay faint and only a few are bright
                const mag = Math.pow(Math.random(), 3);
                return {
                    x: Math.random() * w,
                    y: Math.random() * h,
                    r: 0.4 + mag * 1.3,
                    base: 0.10 + mag * 0.55,
                    // Slow horizontal drift, faster for "nearer" (brighter) stars
                    vx: (0.004 + mag * 0.012) * (Math.random() < 0.5 ? -1 : 1),
                    twinklePhase: Math.random() * Math.PI * 2,
                    twinkleRate: 0.0004 + Math.random() * 0.0011,
                    // A few stars get a cool or warm tint instead of pure white
                    tint: Math.random() < 0.18
                        ? (Math.random() < 0.5 ? '188,206,255' : '255,226,190')
                        : '255,255,255',
                };
            });
        };

        const draw = (t) => {
            ctx.clearRect(0, 0, w, h);
            for (const s of stars) {
                if (!reduceMotion) {
                    s.x += s.vx;
                    if (s.x < -2) s.x = w + 2;
                    else if (s.x > w + 2) s.x = -2;
                }
                const twinkle = reduceMotion
                    ? 1
                    : 0.75 + 0.25 * Math.sin(s.twinklePhase + t * s.twinkleRate);
                ctx.beginPath();
                ctx.fillStyle = `rgba(${s.tint},${(s.base * twinkle).toFixed(3)})`;
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fill();
            }
        };

        let raf;
        const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };

        build();
        if (reduceMotion) draw(0);
        else raf = requestAnimationFrame(loop);

        let resizeTimer;
        const onResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => { build(); if (reduceMotion) draw(0); }, 150);
        };
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(resizeTimer);
            window.removeEventListener('resize', onResize);
            canvas.remove();
        };
    }, []);

    return null;
};

export default StarfieldBg;
