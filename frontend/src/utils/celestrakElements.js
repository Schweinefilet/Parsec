// Orbital elements, fetched in a way CelesTrak is willing to serve.
//
// The first version asked for one object at a time and asked again on every
// page load. CelesTrak blocked us for it, and their message is worth quoting
// because it is also the specification:
//
//   "We have detected excessive downloads for files in the /NORAD/elements
//    directory ... orbital data files are only checked for updates every 2
//    hours and most orbital data only updates 2-3 times a day (or less).
//    Please check your scripts to ensure they are operating properly."
//
// So: one request for a whole group rather than one per satellite, which is
// the access pattern they publish these files for, and a cache in localStorage
// so a reload costs nothing. A element set a few hours old is not a compromise
// — it is the freshest thing that exists.
//
// When the network fails, or we are blocked, whatever is cached is served
// however old it is. A stale element set is a worse answer than a fresh one
// and a far better answer than an empty page, and the tracker already shows
// the age of what it is using.

const CACHE_KEY = 'parsec.elements.v1';
// Their files update 2-3 times a day and are only *checked* every 2 hours;
// six is comfortably inside that and means at most four fetches a day from
// someone who leaves the page open.
const FRESH_MS = 6 * 60 * 60 * 1000;
const GROUP_URL = 'https://celestrak.org/NORAD/elements/gp.php?FORMAT=TLE&GROUP=';
const OBJECT_URL = 'https://celestrak.org/NORAD/elements/gp.php?FORMAT=TLE&CATNR=';

/** NORAD catalog number out of line 1, columns 3-7. */
export function noradOf(line1) {
    const n = parseInt(String(line1).slice(2, 7), 10);
    return Number.isFinite(n) ? n : null;
}

/**
 * Parse a TLE file — one satellite or a whole group — into sets by catalog
 * number. Name lines are optional and blank lines are ignored, which covers
 * both the group files and a single-object reply.
 */
export function parseElementFile(text) {
    const out = new Map();
    const lines = String(text).split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim());
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith('1 ') || !lines[i + 1]?.startsWith('2 ')) continue;
        const norad = noradOf(lines[i]);
        if (norad == null) continue;
        // The line above a "1 " line is the object's name, when there is one
        const prev = lines[i - 1];
        const name = prev && !prev.startsWith('1 ') && !prev.startsWith('2 ') ? prev.trim() : null;
        out.set(norad, { norad, name, line1: lines[i], line2: lines[i + 1] });
        i++;
    }
    return out;
}

function readCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return { at: 0, sets: {} };
        const v = JSON.parse(raw);
        return { at: Number(v?.at) || 0, sets: v?.sets && typeof v.sets === 'object' ? v.sets : {} };
    } catch {
        return { at: 0, sets: {} };
    }
}

function writeCache(sets, at) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at, sets }));
    } catch { /* private window, or storage full: not a reason to fail */ }
}

/**
 * Element sets for the given catalog numbers.
 *
 * @param {Array<{norad:number, group?:string}>} wanted
 * @returns {Promise<{sets: Map<number, object>, fetchedAt: number, stale: boolean, error: string|null}>}
 */
export async function loadElements(wanted, { signal, now = Date.now(), fetchImpl = fetch } = {}) {
    const cache = readCache();
    const cached = new Map(Object.entries(cache.sets).map(([k, v]) => [Number(k), v]));
    const haveAll = wanted.every(w => cached.has(w.norad));

    if (haveAll && now - cache.at < FRESH_MS) {
        return { sets: cached, fetchedAt: cache.at, stale: false, error: null };
    }

    const merged = new Map(cached);
    let error = null;

    const get = async (url) => {
        const res = await fetchImpl(url, { signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseElementFile(await res.text());
    };

    // One request per group, not one per satellite — the whole reason we were
    // blocked. Groups are deduplicated, so three satellites in one group cost
    // a single fetch.
    const groups = [...new Set(wanted.map(w => w.group).filter(Boolean))];
    const groupFailed = new Set();
    for (const group of groups) {
        try {
            for (const [norad, set] of await get(GROUP_URL + group)) merged.set(norad, set);
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            groupFailed.add(group);
            error = err.message;
        }
    }

    // Anything a *successful* group reply did not carry, asked for directly:
    // the safety net for a satellite that moves between groups. Deliberately
    // not attempted when the group request itself failed — being blocked and
    // responding by making three more requests is how you stay blocked, and it
    // is the opposite of what CelesTrak asked for.
    for (const w of wanted) {
        if (merged.has(w.norad) || groupFailed.has(w.group)) continue;
        try {
            for (const [norad, set] of await get(OBJECT_URL + w.norad)) merged.set(norad, set);
        } catch (err) {
            if (err.name === 'AbortError') throw err;
            error = err.message;
        }
    }

    const gotSomethingNew = merged.size > cached.size
        || wanted.some(w => merged.get(w.norad) !== cached.get(w.norad));

    if (!error && gotSomethingNew) {
        writeCache(Object.fromEntries(merged), now);
        return { sets: merged, fetchedAt: now, stale: false, error: null };
    }

    // Blocked, offline, or otherwise unhappy: fall back to whatever is cached,
    // however old. The tracker shows the age of what it is using.
    return {
        sets: merged,
        fetchedAt: error ? cache.at : now,
        stale: !!error && merged.size > 0,
        error,
    };
}

/** Test seam. */
export function __clearElementCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* nothing to clear */ }
}
