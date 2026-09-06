import { useState } from 'react';
import { objectImage } from '../data/objectImages';
import { FallbackArt } from './ObjectCard';

/**
 * The visual subject for objects the 3D scene cannot show.
 *
 * Andromeda, the exoplanets and most spacecraft have no position to fly to, so
 * those pages used to be a faded starfield with panels floating over nothing.
 * This puts the curated photograph where the planet would have been — or the
 * generated cover art, for the dozen objects NASA has no usable image of.
 */
const ObjectHero = ({ object, compact = false }) => {
    const src = objectImage(object.id);
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const showPhoto = !!src && !failed;

    return (
        <div
            className="animate-fade-in"
            style={{
                position: 'relative',
                width: compact ? 'min(78vw, 420px)' : 'min(46vw, 620px)',
                aspectRatio: '4 / 3',
                maxHeight: compact ? '26vh' : '52vh',
                borderRadius: 'var(--radius-card)',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: '0 24px 70px rgba(0,0,0,0.65)',
                background: '#05070a',
            }}
        >
            {showPhoto ? (
                <>
                    <img
                        src={src}
                        alt={`${object.name} — ${object.type}`}
                        onLoad={() => setLoaded(true)}
                        onError={() => setFailed(true)}
                        style={{
                            width: '100%', height: '100%',
                            objectFit: 'cover', objectPosition: 'center',
                            opacity: loaded ? 1 : 0,
                            transition: 'opacity 0.6s ease',
                            display: 'block',
                        }}
                    />
                    <span
                        style={{
                            position: 'absolute', right: 10, bottom: 8,
                            fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.45)',
                            textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                            pointerEvents: 'none',
                        }}
                    >
                        NASA
                    </span>
                </>
            ) : (
                <FallbackArt object={object} />
            )}
        </div>
    );
};

export default ObjectHero;
