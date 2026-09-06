import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { objectImage } from '../data/objectImages';
import { accentOf } from '../data/categoryStyles';
import { useNearViewport } from '../hooks/useNearViewport';

/**
 * Generated cover art for the objects NASA has no usable photograph of —
 * a lit limb in the category's accent over a dark field. Deterministic per
 * object so a card always looks the same, and clearly a designed graphic
 * rather than a failed image.
 */
export const FallbackArt = ({ object }) => {
    const { rgb } = accentOf(object.category);
    // Stable pseudo-random offsets from the id so each card differs slightly
    const seed = [...object.id].reduce((a, c) => a + c.charCodeAt(0), 0);
    const cx = 62 + (seed % 18);
    const cy = 34 + (seed % 11);

    return (
        <div
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                background: `
                    radial-gradient(120% 120% at ${cx}% ${cy}%, rgba(${rgb},0.30) 0%, rgba(${rgb},0.10) 34%, rgba(0,0,0,0) 68%),
                    radial-gradient(80% 100% at 8% 96%, rgba(${rgb},0.10) 0%, rgba(0,0,0,0) 60%),
                    linear-gradient(160deg, #0b0d12 0%, #05070a 100%)
                `,
            }}
        >
            {/* Terminator arc — reads as a body edge catching light */}
            <svg
                viewBox="0 0 200 130" preserveAspectRatio="none"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}
            >
                <defs>
                    <linearGradient id={`fa-${object.id}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%"   stopColor={`rgba(${rgb},0.75)`} />
                        <stop offset="100%" stopColor={`rgba(${rgb},0)`} />
                    </linearGradient>
                </defs>
                <circle
                    cx={cx * 2} cy={cy * 1.3} r="52"
                    fill="none" stroke={`url(#fa-${object.id})`} strokeWidth="1.2"
                />
                <circle
                    cx={cx * 2} cy={cy * 1.3} r="78"
                    fill="none" stroke={`rgba(${rgb},0.14)`} strokeWidth="0.8"
                />
            </svg>
        </div>
    );
};

const ObjectCard = ({ object }) => {
    const navigate = useNavigate();
    const src = objectImage(object.id);
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const accent = accentOf(object.category);

    // The catalog sits a whole screen below the 3D scene, and these are big
    // photographs — 1280px square in places, which is 6 MB of pixels once
    // decoded. `loading="lazy"` was letting them through anyway, so seven of
    // them were being fetched and decoded during the scene's first seconds,
    // for cards nobody had scrolled to yet. Now the <img> does not exist until
    // the card is nearly on screen.
    const cardRef = useRef(null);
    const near = useNearViewport(cardRef, '400px');
    const showPhoto = !!src && !failed;

    return (
        <button
            ref={cardRef}
            type="button"
            onClick={() => navigate(`/object/${object.id}`)}
            className="object-card group"
            aria-label={`${object.name} — ${object.type}`}
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '100%',
                minHeight: 148,
                textAlign: 'left',
                overflow: 'hidden',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--glass-border)',
                boxShadow: 'var(--glass-shadow), var(--glass-specular)',
                background: '#05070a',
                cursor: 'pointer',
                padding: 0,
            }}
        >
            {showPhoto ? (
                <>
                    {near && <img
                        src={src}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        onLoad={() => setLoaded(true)}
                        onError={() => setFailed(true)}
                        className="object-card-img"
                        style={{
                            position: 'absolute', inset: 0,
                            width: '100%', height: '100%',
                            objectFit: 'cover', objectPosition: 'center',
                            opacity: loaded ? 1 : 0,
                            transition: 'opacity 0.5s ease, transform 0.6s cubic-bezier(0.22,0.61,0.36,1)',
                        }}
                    />}
                    {/* Legibility scrim — darkest where the text sits */}
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute', inset: 0,
                            background:
                                'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0.34) 100%)',
                        }}
                    />
                </>
            ) : (
                <FallbackArt object={object} />
            )}

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '16px 16px 0' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
                        {object.name}
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.72rem', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {object.type}
                    </p>
                </div>
                <span
                    style={{
                        flexShrink: 0,
                        fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.06em',
                        padding: '3px 7px', borderRadius: 8,
                        background: `rgba(${accent.rgb},0.16)`,
                        border: `1px solid rgba(${accent.rgb},0.28)`,
                        color: accent.text,
                        textTransform: 'uppercase',
                    }}
                >
                    {object.category.replace(/-/g, ' ')}
                </span>
            </div>

            <div style={{ position: 'relative', zIndex: 1, padding: '0 16px 16px', marginTop: 12 }}>
                <p style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                    {object.keyStatValue}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.48)', fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '1px 0 0' }}>
                    {object.keyStatLabel}
                </p>
                {object.secondaryStatValue && (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 7 }}>
                        <span style={{ color: 'rgba(255,255,255,0.70)', fontSize: '0.74rem', fontWeight: 500 }}>
                            {object.secondaryStatValue}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.42)', fontSize: '0.58rem', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                            {object.secondaryStatLabel}
                        </span>
                    </div>
                )}
            </div>
        </button>
    );
};

export default ObjectCard;
