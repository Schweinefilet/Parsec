import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { objectImage } from '../data/objectImages';
import { accentOf } from '../data/categoryStyles';
import { useNearViewport } from '../hooks/useNearViewport';
import { useI18n } from '../i18n';

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

const ObjectCard = ({ object: source }) => {
    const { t, object: localize } = useI18n();
    const object = localize(source);
    const navigate = useNavigate();
    const src = objectImage(object.id);
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);

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
            aria-label={t('catalog.cardAria', { name: object.name, type: object.type })}
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                width: '100%',
                // A 4:3-ish frame rather than a content-driven height, so a row
                // of cards is a row of equal rectangles whatever each object's
                // stats happen to run to. The min keeps a narrow column honest.
                aspectRatio: '4 / 3',
                minHeight: 168,
                textAlign: 'start',
                overflow: 'hidden',
                borderRadius: 'var(--radius-card)',
                border: '1px solid var(--panel-border)',
                boxShadow: 'var(--sh-2), var(--specular)',
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
                    {/* Legibility scrim — darkest where the text sits. Thins on
                        hover (see .object-card-scrim in index.css), so the
                        photograph brightens as the card comes forward. */}
                    <div
                        aria-hidden="true"
                        className="object-card-scrim"
                        style={{
                            position: 'absolute', inset: 0,
                            background:
                                'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0.34) 100%)',
                            transition: 'opacity var(--t-slow) var(--ease-out)',
                        }}
                    />
                </>
            ) : (
                <FallbackArt object={object} />
            )}

            {/* No category badge: every card in this grid is already filtered to
                one category, so the badge only ever repeated the tab you were on. */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 'var(--s-2)', padding: 'var(--s-5) var(--s-5) 0' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h3 style={{
                        color: '#fff', fontSize: 'var(--fs-base)', fontWeight: 700,
                        letterSpacing: 'var(--tr-tight)', margin: 0, lineHeight: 1.2,
                    }}>
                        {object.name}
                    </h3>
                    <p style={{
                        color: 'var(--text-secondary)', fontSize: 'var(--fs-tiny)',
                        margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {object.type}
                    </p>
                </div>
            </div>

            <div style={{ position: 'relative', zIndex: 1, padding: '0 var(--s-5) var(--s-5)', marginTop: 'var(--s-4)' }}>
                <p className="num-run figure" style={{ margin: 0, fontSize: 'var(--fs-lg)' }}>
                    {object.keyStatValue}
                </p>
                <p className="label" style={{ margin: '3px 0 0' }}>
                    {object.keyStatLabel}
                </p>
                {object.secondaryStatValue && (
                    <div style={{
                        display: 'flex', alignItems: 'baseline', gap: 'var(--s-2)',
                        marginTop: 'var(--s-2)', paddingTop: 'var(--s-2)',
                        // A hairline tying the secondary figure to the headline one
                        // above it, so the footer reads as one block of two rows
                        // rather than three free-floating lines of text.
                        borderTop: '1px solid rgba(255,255,255,0.10)',
                    }}>
                        <span className="num-run" style={{
                            color: 'rgba(255,255,255,0.78)', fontSize: 'var(--fs-xs)', fontWeight: 600,
                        }}>
                            {object.secondaryStatValue}
                        </span>
                        <span className="label label-dim" style={{ fontSize: '9px' }}>
                            {object.secondaryStatLabel}
                        </span>
                    </div>
                )}
            </div>
        </button>
    );
};

export default ObjectCard;
