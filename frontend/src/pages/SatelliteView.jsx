import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Satellite } from 'lucide-react';
import StarfieldBg from '../components/StarfieldBg';

const ISS_NORAD = '25544';

const SatelliteView = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const highlight = searchParams.get('highlight');

    // Future: use highlight param to auto-center on a specific satellite
    const isHighlightingISS = highlight === ISS_NORAD;

    return (
        <div className="min-h-screen text-white flex flex-col items-center justify-center px-6 text-center">
            <StarfieldBg canvasId="starfield-satellites" />
            <div className="relative z-10 flex flex-col items-center gap-6 max-w-lg">
                <div
                    className="flex items-center justify-center rounded-2xl"
                    style={{ width: '72px', height: '72px', background: 'rgba(100,200,255,0.12)', border: '1px solid rgba(100,200,255,0.25)' }}
                >
                    <Satellite style={{ width: '36px', height: '36px', color: '#64c8ff' }} />
                </div>
                <h1 className="font-extrabold text-white" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', letterSpacing: '-0.03em' }}>
                    Live Satellite Tracker
                </h1>
                {isHighlightingISS && (
                    <div
                        className="text-sm font-bold px-4 py-2 rounded-xl"
                        style={{ background: 'rgba(100,220,100,0.15)', color: '#80e080', border: '1px solid rgba(100,220,100,0.25)' }}
                    >
                        ISS (NORAD {ISS_NORAD}) — tracking coming soon
                    </div>
                )}
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                    Real-time satellite tracking is coming soon. This will display live orbital positions
                    for the ISS, Tiangong, and thousands of other satellites using TLE data.
                </p>
                <button
                    onClick={() => navigate(-1)}
                    className="px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.14)' }}
                >
                    ← Go Back
                </button>
            </div>
        </div>
    );
};

export default SatelliteView;
