// Per-category accent colours, shared by catalog cards, chart series and badges.
// Kept in its own module so component files export only components.
export const CATEGORY_ACCENT = {
    stars:               { rgb: '253,184,19',  text: 'rgba(253,184,19,0.95)' },
    planets:             { rgb: '100,160,255', text: 'rgba(140,185,255,0.95)' },
    'dwarf-planets':     { rgb: '210,190,160', text: 'rgba(224,208,184,0.95)' },
    moons:               { rgb: '180,180,220', text: 'rgba(200,200,240,0.95)' },
    exoplanets:          { rgb: '255,180,80',  text: 'rgba(255,198,120,0.95)' },
    'deep-sky':          { rgb: '120,220,180', text: 'rgba(150,232,198,0.95)' },
    neos:                { rgb: '255,120,80',  text: 'rgba(255,150,115,0.95)' },
    asteroid:            { rgb: '180,160,120', text: 'rgba(206,188,150,0.95)' },
    comet:               { rgb: '160,220,255', text: 'rgba(184,232,255,0.95)' },
    'space-stations':    { rgb: '100,200,255', text: 'rgba(140,214,255,0.95)' },
    'space-telescopes':  { rgb: '200,160,255', text: 'rgba(214,182,255,0.95)' },
    'deep-space-probes': { rgb: '255,200,100', text: 'rgba(255,214,140,0.95)' },
    historical:          { rgb: '200,200,180', text: 'rgba(216,216,200,0.95)' },
};

export const accentOf = (category) =>
    CATEGORY_ACCENT[category] ?? { rgb: '255,255,255', text: 'rgba(255,255,255,0.8)' };
