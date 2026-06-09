import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OBJECTS } from '../data/objectCatalog';

// Quick-access seed for the dropdown's popular items
const POPULAR_IDS = [
    'mercury', 'venus', 'mars', 'jupiter', 'saturn',
    'europa', 'titan', 'proxima-centauri-b', 'andromeda', 'apophis',
];
const POPULAR = POPULAR_IDS
    .map(id => OBJECTS.find(o => o.id === id))
    .filter(Boolean);

const ObjectSearch = () => {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const inputRef   = useRef(null);
    const dropdownRef = useRef(null);
    const navigate   = useNavigate();

    useEffect(() => {
        if (!query.trim()) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }
        const q = query.toLowerCase();
        const filtered = OBJECTS.filter(
            o => o.name.toLowerCase().includes(q) || o.type.toLowerCase().includes(q) || o.category.includes(q)
        ).slice(0, 7);
        setSuggestions(filtered);
        setShowDropdown(true);
        setActiveIndex(-1);
    }, [query]);

    useEffect(() => {
        const handler = e => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const navigateTo = (id) => {
        navigate(`/object/${id}`);
        setQuery('');
        setShowDropdown(false);
    };

    const handleSubmit = e => {
        e.preventDefault();
        if (activeIndex >= 0 && suggestions[activeIndex]) {
            navigateTo(suggestions[activeIndex].id);
        } else if (suggestions.length > 0) {
            navigateTo(suggestions[0].id);
        }
    };

    const handleKeyDown = e => {
        if (!showDropdown || suggestions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(i => Math.max(i - 1, -1));
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const displayList = query.trim() ? suggestions : [];

    return (
        <div className="relative w-full max-w-md" ref={dropdownRef}>
            <form onSubmit={handleSubmit}>
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search planets, moons, dwarf planets..."
                        className="glass-input glass-input-search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => query && setShowDropdown(true)}
                        autoComplete="off"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                        style={{ color: 'var(--text-tertiary)' }} />
                    {query && (
                        <button
                            type="button"
                            onClick={() => { setQuery(''); setSuggestions([]); setShowDropdown(false); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </form>

            {showDropdown && displayList.length > 0 && (
                <div className="absolute z-50 top-full mt-2 w-full overflow-hidden"
                    style={{
                        background: 'rgba(0,0,0,0.95)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '14px',
                        backdropFilter: 'blur(20px)',
                    }}>
                    {displayList.map((obj, i) => (
                        <button
                            key={obj.id}
                            onMouseDown={() => navigateTo(obj.id)}
                            className="w-full flex items-center justify-between px-4 py-2 text-left transition-colors"
                            style={i === activeIndex
                                ? { background: 'rgba(255,255,255,0.08)' }
                                : { background: 'transparent' }
                            }
                        >
                            <div>
                                <span className="font-bold text-sm text-white">{obj.name}</span>
                                <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>
                                    {obj.type}
                                </span>
                            </div>
                            <span
                                className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                                style={{
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: 'var(--text-tertiary)',
                                }}
                            >
                                {obj.category.replace('-', ' ')}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ObjectSearch;
