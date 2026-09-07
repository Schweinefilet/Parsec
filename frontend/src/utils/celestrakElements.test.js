import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    parseElementFile, noradOf, loadElements, __clearElementCache,
} from './celestrakElements';

// A real group reply: names, CRLF, three satellites
const STATIONS = [
    'ISS (ZARYA)             ',
    '1 25544U 98067A   26249.72428942  .00004390  00000+0  87774-4 0  9993',
    '2 25544  51.6308 256.5398 0005013 114.0700 246.0800 15.50221514 12345',
    'CSS (TIANHE)            ',
    '1 48274U 21035A   26249.83726132  .00015091  00000+0  18766-3 0  9997',
    '2 48274  41.4675 186.3172 0002379 261.1309  98.9200 15.61000000 54321',
].join('\r\n');

const HUBBLE_ONLY = [
    '1 20580U 90037B   26249.68045545  .00003990  00000+0  11978-3 0  9993',
    '2 20580  28.4722 243.2424 0001542 335.0690  24.9843 15.11418748745383',
].join('\r\n');

const WANTED = [
    { norad: 25544, group: 'stations' },
    { norad: 48274, group: 'stations' },
    { norad: 20580, group: 'science' },
];

const ok = (body) => ({ ok: true, status: 200, text: async () => body });
const fail = (status) => ({ ok: false, status, text: async () => '' });

beforeEach(() => __clearElementCache());

describe('parseElementFile', () => {
    it('reads a whole group into sets by catalog number', () => {
        const sets = parseElementFile(STATIONS);
        expect([...sets.keys()]).toEqual([25544, 48274]);
        expect(sets.get(25544).name).toBe('ISS (ZARYA)');
        expect(sets.get(48274).line2).toMatch(/^2 48274/);
    });

    it('reads a set with no name line above it', () => {
        const sets = parseElementFile(HUBBLE_ONLY);
        expect(sets.get(20580).name).toBeNull();
        expect(sets.get(20580).line1).toMatch(/^1 20580U/);
    });

    it('ignores anything that is not a pair of element lines', () => {
        expect(parseElementFile('No GP data found').size).toBe(0);
        expect(parseElementFile('').size).toBe(0);
        // A truncated download: line 1 with no line 2 is not a set
        expect(parseElementFile(STATIONS.split('\r\n').slice(0, 2).join('\r\n')).size).toBe(0);
    });

    it('pulls the catalog number out of column 3-7', () => {
        expect(noradOf('1 25544U 98067A   26249.72428942')).toBe(25544);
        expect(noradOf('1 00005U 58002B   26249.00000000')).toBe(5);
        expect(noradOf('nonsense')).toBeNull();
    });
});

describe('loadElements', () => {
    it('asks once per group, not once per satellite', async () => {
        // Three satellites, two groups: two requests. Asking per object is
        // what got the site blocked.
        const seen = [];
        const fetchImpl = vi.fn(async (url) => {
            seen.push(url);
            return ok(url.includes('stations') ? STATIONS : HUBBLE_ONLY);
        });
        const r = await loadElements(WANTED, { fetchImpl });
        expect(fetchImpl).toHaveBeenCalledTimes(2);
        expect(seen.every(u => u.includes('GROUP='))).toBe(true);
        expect([...r.sets.keys()].sort()).toEqual([20580, 25544, 48274]);
        expect(r.stale).toBe(false);
    });

    it('serves a reload from cache without touching the network', async () => {
        const fetchImpl = vi.fn(async (url) => ok(url.includes('stations') ? STATIONS : HUBBLE_ONLY));
        await loadElements(WANTED, { fetchImpl, now: 1_000_000 });
        fetchImpl.mockClear();
        const again = await loadElements(WANTED, { fetchImpl, now: 1_000_000 + 60_000 });
        expect(fetchImpl).not.toHaveBeenCalled();
        expect(again.sets.size).toBe(3);
    });

    it('refetches once the cache is older than the data could be', async () => {
        const fetchImpl = vi.fn(async (url) => ok(url.includes('stations') ? STATIONS : HUBBLE_ONLY));
        await loadElements(WANTED, { fetchImpl, now: 0 });
        fetchImpl.mockClear();
        await loadElements(WANTED, { fetchImpl, now: 7 * 60 * 60 * 1000 });
        expect(fetchImpl).toHaveBeenCalled();
    });

    it('keeps working on a 403 by falling back to what it already had', async () => {
        // This is the case that prompted all of it: CelesTrak blocks the IP
        // for two hours. A tracker that goes blank is worse than one showing
        // elements from this morning, and the age is on screen either way.
        const good = vi.fn(async (url) => ok(url.includes('stations') ? STATIONS : HUBBLE_ONLY));
        await loadElements(WANTED, { fetchImpl: good, now: 0 });

        const blocked = vi.fn(async () => fail(403));
        const r = await loadElements(WANTED, { fetchImpl: blocked, now: 7 * 60 * 60 * 1000 });
        expect(r.sets.size).toBe(3);
        expect(r.stale).toBe(true);
        expect(r.error).toBe('HTTP 403');
        expect(r.fetchedAt).toBe(0);      // the age of what it is actually using
    });

    it('does not answer a block by making more requests', async () => {
        // Being blocked and responding with three more requests is how you stay
        // blocked. Only groups that replied get a per-object follow-up.
        const blocked = vi.fn(async () => fail(403));
        await loadElements(WANTED, { fetchImpl: blocked });
        expect(blocked).toHaveBeenCalledTimes(2);        // the two groups, and no more
        expect(blocked.mock.calls.every(c => c[0].includes('GROUP='))).toBe(true);
    });

    it('reports an honest failure when it has nothing at all', async () => {
        const blocked = vi.fn(async () => fail(403));
        const r = await loadElements(WANTED, { fetchImpl: blocked });
        expect(r.sets.size).toBe(0);
        expect(r.error).toBe('HTTP 403');
    });

    it('falls back to a direct request for anything its group did not carry', async () => {
        const seen = [];
        const fetchImpl = vi.fn(async (url) => {
            seen.push(url);
            if (url.includes('GROUP=stations')) return ok(STATIONS);
            if (url.includes('GROUP=science')) return ok('');   // moved out of this group
            return ok(HUBBLE_ONLY);
        });
        const r = await loadElements(WANTED, { fetchImpl });
        expect(r.sets.get(20580)).toBeTruthy();
        expect(seen.some(u => u.includes('CATNR=20580'))).toBe(true);
    });

    it('lets an abort through rather than swallowing it', async () => {
        const abort = vi.fn(async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; });
        await expect(loadElements(WANTED, { fetchImpl: abort })).rejects.toThrow('aborted');
    });
});
