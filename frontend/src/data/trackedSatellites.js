// Everything the live tracker follows.
//
// One list, one shape, no special cases: the ISS is an entry here like any
// other, and adding a fourth spacecraft is adding a line. It used to be the
// exception — its own feed, its own hook, its own half of the page — which is
// why the tracker only ever really worked for the ISS.
//
// `catalogId` ties each one to its page in the object catalog, so the tracker
// can link through to what the thing actually is.
export const SATELLITES = [
    {
        id: 'iss',
        norad: 25544,
        name: 'International Space Station',
        shortName: 'ISS',
        catalogId: 'iss',
        color: '#7fe3a0',
    },
    {
        id: 'tiangong',
        norad: 48274,               // CSS (Tianhe core module)
        name: 'Tiangong Space Station',
        shortName: 'Tiangong',
        catalogId: 'tiangong',
        color: '#ff8f6b',
    },
    {
        id: 'hubble',
        norad: 20580,
        name: 'Hubble Space Telescope',
        shortName: 'Hubble',
        catalogId: 'hubble',
        color: '#c9a7ff',
    },
];

export const DEFAULT_SATELLITE = 'iss';

export const satelliteById = (id) => SATELLITES.find(s => s.id === id);
