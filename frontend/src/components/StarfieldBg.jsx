import { useEffect } from 'react';

const StarfieldBg = ({ canvasId = 'starfield-bg' }) => {
    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.id = canvasId;
        canvas.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'width:100%',
            'height:100%',
            'pointer-events:none',
            'z-index:0',
            'opacity:0.135',
        ].join(';');
        document.body.appendChild(canvas);

        let lib = null;
        let cancelled = false;

        import('particlesjs').then((mod) => {
            if (cancelled) return;
            lib = mod.default ?? mod;
            try {
                lib.init({
                    selector: `#${canvasId}`,
                    maxParticles: 90,
                    color: '#ffffff',
                    connectParticles: true,
                    speed: 0.18,
                    minDistance: 160,
                    sizeVariations: 3,
                });
            } catch (err) {
                console.warn('StarfieldBg:', err);
            }
        });

        return () => {
            cancelled = true;
            try { lib?.destroy?.(); } catch {
                // ignore destruction errors
            }
            canvas.remove();
        };
    }, [canvasId]);

    return null;
};

export default StarfieldBg;
