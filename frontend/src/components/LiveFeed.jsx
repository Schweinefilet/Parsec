import { useState } from 'react';
import { Play, ArrowUpRight, VideoOff } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * The live video from a tracked satellite, where there is one.
 *
 * Click to load, rather than loading with the page. An embedded player pulls
 * close to a megabyte of third-party script and starts a connection to Google
 * before anyone has asked to watch anything — on a page whose job is a dot on a
 * globe, that is a cost paid by every visitor for a feature most of them did
 * not come for. Nothing is requested from YouTube until the button is pressed.
 *
 * nocookie is the same reasoning: youtube-nocookie.com holds off on the
 * tracking cookies until playback actually starts.
 */
const LiveFeed = ({ satellite }) => {
    const { t, bodyName } = useI18n();
    const [playing, setPlaying] = useState(false);
    const live = satellite?.live;

    // No feed is the normal case, and worth saying rather than leaving blank:
    // people reasonably wonder whether they are missing a button.
    if (!live) {
        return (
            <div className="glass" style={{ marginTop: 16, padding: '14px 20px' }}>
                <p className="flex items-center gap-2" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                    <VideoOff style={{ width: 14, height: 14, flexShrink: 0 }} aria-hidden="true" />
                    {t('feed.none', {
                        name: bodyName(satellite?.shortName ?? satellite?.name ?? ''),
                    })}
                    {t(satellite?.id === 'hubble' || satellite?.id === 'chandra'
                        ? 'feed.noneTelescope' : 'feed.noneOther')}
                </p>
            </div>
        );
    }

    const src = `https://www.youtube-nocookie.com/embed/${live.id}`
        + '?autoplay=1&rel=0&modestbranding=1';

    return (
        <div className="glass" style={{ marginTop: 16, padding: 20 }}>
            <div className="flex flex-wrap items-baseline justify-between gap-3" style={{ marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                        {t('feed.title')}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                        {live.titleKey ? t(live.titleKey) : live.title}
                    </p>
                </div>
                <a
                    href={`https://www.youtube.com/watch?v=${live.id}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 focus-ring rounded-lg"
                    style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', padding: '2px 4px' }}
                >
                    {t('feed.onYouTube', { source: live.source })}
                    <ArrowUpRight style={{ width: 12, height: 12 }} aria-hidden="true" />
                </a>
            </div>

            <div style={{
                position: 'relative', width: '100%', aspectRatio: '16 / 9',
                borderRadius: 14, overflow: 'hidden', background: '#000',
                border: '1px solid rgba(255,255,255,0.10)',
            }}>
                {playing ? (
                    <iframe
                        src={src}
                        title={live.title}
                        allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                    />
                ) : (
                    <button
                        onClick={() => setPlaying(true)}
                        className="flex flex-col items-center justify-center focus-ring"
                        style={{
                            position: 'absolute', inset: 0, width: '100%', height: '100%',
                            background: 'radial-gradient(circle at 50% 45%, rgba(40,52,74,0.55), rgba(0,0,0,0.9) 70%)',
                            border: 'none', cursor: 'pointer', gap: 12,
                        }}
                    >
                        <span
                            className="flex items-center justify-center"
                            style={{
                                width: 56, height: 56, borderRadius: 999,
                                background: 'rgba(255,255,255,0.10)',
                                border: '1px solid rgba(255,255,255,0.30)',
                                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                            }}
                        >
                            <Play style={{ width: 22, height: 22, color: '#fff', marginLeft: 3 }} aria-hidden="true" />
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
                            {t('feed.play')}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', maxWidth: 300, textAlign: 'center' }}>
                            {t('feed.lazy')}
                        </span>
                    </button>
                )}
            </div>

            <p style={{ margin: '10px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
                {live.captionKey ? t(live.captionKey) : null}
            </p>
        </div>
    );
};

export default LiveFeed;
