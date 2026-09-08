import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OBJECTS } from '../data/objectCatalog';
import { useI18n } from '../i18n';

// Shown before the user types anything — a way in for people who don't yet
// know what to look for. (The previous build computed this list but never
// rendered it, so an empty search box showed nothing at all.)
const POPULAR_IDS = ['mars', 'jupiter', 'saturn', 'europa', 'titan', 'pluto', 'andromeda', 'jwst'];
const POPULAR = POPULAR_IDS.map(id => OBJECTS.find(o => o.id === id)).filter(Boolean);

// Alternate names people are likely to type
const ALIASES = {
    luna: 'moon earth\'s moon',
    'pillars-of-creation': 'eagle nebula m16',
    andromeda: 'm31',
    'whirlpool-galaxy': 'm51',
    'crab-nebula': 'm1',
    'orion-nebula': 'm42',
    jwst: 'webb james webb',
    iss: 'international space station',
    halley: 'comet 1p',
    luna_: '',
};

/**
 * How well one object matches what was typed.
 *
 * Two names are tried, not one: the name in the reader's language and the
 * English name the object also has. Someone reading the Arabic interface still
 * knows the planet as "Jupiter" as often as "المشتري" — the English names are
 * what the literature, the search engines and half of school science use — and
 * a search that only matched the translated name would answer "nothing found"
 * to a perfectly good query. `local` wins ties, because it is what the results
 * list is about to show them.
 */
function score(obj, q, local) {
    const names = [local.toLowerCase(), obj.name.toLowerCase()];
    const type = local === obj.name ? obj.type.toLowerCase() : '';
    const alias = (ALIASES[obj.id] ?? '').toLowerCase();
    if (names.includes(q)) return 100;
    if (names.some(n => n.startsWith(q))) return 80;
    if (alias.split(' ').some(a => a && a.startsWith(q))) return 70;
    if (names.some(n => n.includes(q))) return 55;
    if (alias.includes(q)) return 45;
    if (type.includes(q)) return 30;
    if (obj.category.includes(q)) return 20;
    return 0;
}

const ObjectSearch = ({ onClose, autoFocus }) => {
    const { t, intl, object: localize, categoryBadge } = useI18n();
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef = useRef(null);
    const wrapRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (!autoFocus) return;
        const t = setTimeout(() => inputRef.current?.focus(), 60);
        return () => clearTimeout(t);
    }, [autoFocus]);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return POPULAR.map(localize);
        return OBJECTS
            .map(o => ({ o: localize(o), src: o }))
            .map(x => ({ ...x, s: score(x.src, q, x.o.name) }))
            .filter(x => x.s > 0)
            // Ordered with the reader's own collation: Arabic does not sort
            // the way a byte comparison does, and neither does English once
            // there are diacritics in a name.
            .sort((a, b) => b.s - a.s || a.o.name.localeCompare(b.o.name, intl))
            .slice(0, 8)
            .map(x => x.o);
    }, [query, localize, intl]);

    useEffect(() => { setActiveIndex(-1); setOpen(true); }, [query]);

    useEffect(() => {
        const handler = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const go = (id) => {
        navigate(`/object/${id}`);
        setQuery('');
        setOpen(false);
        onClose?.();
    };

    const onKeyDown = (e) => {
        if (e.key === 'Escape') { setOpen(false); onClose?.(); return; }
        if (!results.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActiveIndex(i => (i + 1) % results.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => (i - 1 + results.length) % results.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            go(results[activeIndex >= 0 ? activeIndex : 0].id);
        }
    };

    const showList = open && results.length > 0;
    const noMatches = open && query.trim() && results.length === 0;

    return (
        <div className="relative w-full" ref={wrapRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={showList}
                    aria-controls="object-search-list"
                    aria-autocomplete="list"
                    aria-label={t('search.label')}
                    placeholder={t('search.placeholder')}
                    className="glass-input glass-input-search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={onKeyDown}
                    onFocus={() => setOpen(true)}
                    autoComplete="off"
                    spellCheck="false"
                />
                <Search
                    className="absolute top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                    style={{ insetInlineStart: 12, color: 'var(--text-tertiary)' }}
                    aria-hidden="true"
                />
                {query && (
                    <button
                        type="button"
                        onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                        aria-label={t('search.clear')}
                        className="absolute top-1/2 -translate-y-1/2"
                        style={{ insetInlineEnd: 12, color: 'var(--text-tertiary)', cursor: 'pointer' }}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {(showList || noMatches) && (
                <div
                    id="object-search-list"
                    role="listbox"
                    className="absolute z-50 top-full mt-2 w-full overflow-hidden"
                    style={{
                        background: 'rgba(8,10,14,0.97)',
                        border: '1px solid rgba(255,255,255,0.16)',
                        borderRadius: 14,
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        boxShadow: '0 18px 50px rgba(0,0,0,0.6)',
                    }}
                >
                    {!query.trim() && showList && (
                        <p style={{
                            margin: 0, padding: '8px 14px 4px',
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
                            textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)',
                        }}>
                            {t('search.popular')}
                        </p>
                    )}

                    {noMatches ? (
                        <p style={{ margin: 0, padding: '14px', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                            {t('search.noMatches', { query: query.trim() })}
                        </p>
                    ) : results.map((obj, i) => (
                        <button
                            key={obj.id}
                            role="option"
                            aria-selected={i === activeIndex}
                            onMouseDown={(e) => { e.preventDefault(); go(obj.id); }}
                            onMouseEnter={() => setActiveIndex(i)}
                            className="w-full flex items-center justify-between gap-2 px-4 py-2"
                            style={{
                                textAlign: 'start',
                                background: i === activeIndex ? 'rgba(255,255,255,0.09)' : 'transparent',
                                cursor: 'pointer',
                            }}
                        >
                            {/* One line, truncated — a long name like "James Webb
                                Space Telescope" was wrapping around the badge into
                                a four-line block on a phone. */}
                            <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span className="font-bold text-sm text-white">{obj.name}</span>
                                <span className="text-xs" style={{ marginInlineStart: 8, color: 'var(--text-tertiary)' }}>
                                    {obj.type}
                                </span>
                            </span>
                            {i === activeIndex ? (
                                <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }} />
                            ) : (
                                <span
                                    className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded flex-shrink-0"
                                    style={{ border: '1px solid rgba(255,255,255,0.18)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}
                                >
                                    {categoryBadge(obj.category)}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ObjectSearch;
