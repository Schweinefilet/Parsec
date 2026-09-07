// The spacecraft the live tracker follows besides the ISS.
//
// The ISS is not in this list: it has its own feed (wheretheiss.at), which also
// reports whether it is in sunlight and how wide its footprint is, and it is
// what the page is built around. These are propagated locally instead — see
// hooks/useTrackedSatellites.js for why that turned out to be the better source
// even though it is more work.
//
// `catalogId` ties each one to its page in the object catalog, so the legend
// can link through to what it is.
export const TRACKED_SATELLITES = [
    {
        id: 'tiangong',
        norad: 48274,             // CSS (Tianhe core module)
        name: 'Tiangong',
        catalogId: 'tiangong',
        color: '#ff8f6b',
    },
    {
        id: 'hubble',
        norad: 20580,
        name: 'Hubble',
        catalogId: 'hubble',
        color: '#c9a7ff',
    },
];

/** The colour the ISS is drawn in, so the legend can show all three together. */
export const ISS_COLOR = '#7fe3a0';
