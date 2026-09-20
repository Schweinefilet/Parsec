import { useEffect, useMemo, useRef } from 'react';
import { animate, motion as Motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { useI18n } from '../i18n';

/**
 * Two readouts whose digits roll rather than snap — after motion-primitives'
 * SlidingNumber, which is the ancestor of both.
 *
 * They share every pixel of their machinery (the column, the clipping, the
 * locale's glyphs, the accessible copy) and differ only in what drives the
 * roll, which is why they live together:
 *
 *   <SlidingNumber>  each digit springs to its new value by the shortest route.
 *                    The timeline pill, where the clock ticks forward a second
 *                    at a time and nothing is "counting up" to anything.
 *
 *   <CountUpNumber>  every number in the string winds up from zero to its true
 *                    value in one sweep. A focused body's figures, which arrive
 *                    all at once and want announcing.
 *
 * Neither takes a number. Nothing here is a bare number: the pill shows
 * "19 Sept 2026" and "22:31:07", and a focused body's figures read "1,361 W/m²"
 * or "5.97 × 10²⁴ kg". Both take the **already-formatted string** and animate
 * only the digits in it — separators, month names and units are ordinary text
 * that simply swaps. A superscript exponent is left alone for free: "10²⁴"'s
 * ²⁴ is a distinct run of Unicode code points, not digits, so it is never
 * matched and the exponent holds still while the mantissa winds up.
 *
 * Keeping the formatting upstream is also what keeps it correct: the caller has
 * already been through `Intl`, so neither of these has to know what a date or a
 * grouped thousand looks like in Arabic.
 *
 * Which glyphs count as digits comes from `Intl.NumberFormat` for the active
 * locale, not from an ASCII test. Arabic renders ٠-٩ (see i18n/digits.js), and
 * matching on `[0-9]` would have quietly left the Arabic pill unanimated while
 * looking perfectly fine in English.
 *
 * Accessibility: a rolling column holds all ten glyphs at once, so a screen
 * reader walking the DOM would announce "0123456789" per digit. The animated
 * part is `aria-hidden` and the real string is carried by a visually hidden
 * copy, which is also what keeps the value findable by text in tests.
 *
 * Reduced motion gets the plain string from both — index.css zeroes CSS
 * durations, but these are JS and never see them.
 */

// Just overdamped (ζ ≈ 1.07), so a digit glides into place and never wobbles.
// A clock that bounced on every tick would be unreadable.
const SPRING = { stiffness: 300, damping: 22, mass: 0.35 };

// One long sweep, decelerating hard into the final value — slow enough that the
// higher columns are legible on the way rather than a blur.
const COUNT_UP = { duration: 1.6, ease: [0.16, 1, 0.3, 1] };

const SR_ONLY = {
    position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
    overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

// The column is a normal inline-block with visible overflow, so its baseline is
// the ghost digit's own — an inline-block that clips would instead baseline on
// its bottom margin edge, which would drop the pill's date a few pixels off the
// clock beside it (they share an `align-items: baseline` row).
const COLUMN = { position: 'relative', display: 'inline-block' };
const CLIP = { position: 'absolute', inset: 0, overflowX: 'visible', overflowY: 'clip' };
// No flex centring: laid out as ordinary text in a box the same height as the
// ghost, each glyph lands on exactly the ghost's baseline.
const GLYPH = { position: 'absolute', left: 0, right: 0, top: 0, textAlign: 'center' };

/**
 * A number is written left to right in every language, Arabic included. As a
 * plain text node the bidi algorithm knows that and handles it; once each digit
 * became its own inline-block, each one turned into a neutral object taking the
 * paragraph's direction, and the Arabic pill rendered ١٩ سبتمبر ٢٠٢٦ as
 * "٩١ سبتمبر ٦٢٠٢" — every run backwards. An LTR isolate per run restores what
 * a real number does: digits left to right inside, one neutral unit outside, so
 * the surrounding Arabic still orders the date the way an Arabic reader expects.
 */
const RUN = { direction: 'ltr', unicodeBidi: 'isolate' };

// Strong right-to-left letters, deliberately skipping the Arabic-Indic digit
// blocks (U+0660–0669, U+06F0–06F9) — those are numerals, not letters.
const RTL_LETTER = /[\u0591-\u05F4\u0620-\u064A\u066E-\u06D3\u06FA-\u06FF\u0750-\u077F\uFB1D-\uFDFC\uFE70-\uFEFC]/;

/** One item in a rolling stack, parked `offset` rows from the visible slot. */
const Slot = ({ pos, index, item, count }) => {
    const y = useTransform(pos, (latest) => {
        const place = ((latest % count) + count) % count;
        let offset = (count + index - place) % count;
        // Take the short way round, so 9 → 0 does not scroll back through the
        // whole stack, and December → January rolls forward by one rather than
        // back through the year. The jump this introduces is always half a
        // stack out, well outside the clip box, so it is never on screen. It is
        // also what lets a count-up's ever-climbing position wrap cleanly:
        // nothing has to reset when the ones column passes nine.
        if (offset > count / 2) offset -= count;
        // Percentages, not measured pixels: one row is by definition the
        // element's own height, so nothing here needs a ResizeObserver.
        return `${offset * 100}%`;
    });
    return <Motion.span style={{ ...GLYPH, y }}>{item}</Motion.span>;
};

/**
 * The rolling column itself. `pos` is a motion value in items — 3 shows the
 * fourth, 3.5 sits halfway to the fifth — so a spring on an integer and a
 * count-up's continuously climbing position drive exactly the same DOM.
 *
 * `ghost` is the item left in flow to size the column. For digits any of them
 * will do, since they are tabular; for month names they are not the same width,
 * so the caller passes the one currently showing and the column is exactly as
 * wide as the word in it.
 */
const Column = ({ pos, items, ghost }) => (
    <span style={COLUMN}>
        {/* In flow, and invisible: it is what gives the column its width, its
            height and its baseline. */}
        <span style={{ visibility: 'hidden' }}>{ghost ?? items[0]}</span>
        <span style={CLIP}>
            {items.map((it, i) => (
                <Slot key={i} pos={pos} index={i} item={it} count={items.length} />
            ))}
        </span>
    </span>
);

/** <SlidingNumber>'s digit: springs to its new value, independent of its peers. */
const SpringDigit = ({ value, glyphs }) => {
    const mv = useMotionValue(value);
    const pos = useSpring(mv, SPRING);
    useEffect(() => { mv.set(value); }, [mv, value]);
    return <Column pos={pos} items={glyphs} />;
};

/**
 * The month name, rolling the same way a digit does.
 *
 * Only for locales whose month names are words. Vietnamese's are "Tháng 9",
 * "Tháng 10" — the part that changes is already a digit and already rolls, and
 * treating the whole thing as one word would take that away and swing the
 * column's width around besides.
 */
const SpringWord = ({ index, words }) => {
    const mv = useMotionValue(index);
    const pos = useSpring(mv, SPRING);
    useEffect(() => { mv.set(index); }, [mv, index]);
    return <Column pos={pos} items={words} ghost={words[index]} />;
};

/**
 * <CountUpNumber>'s digit: a window onto one decimal place of a number that is
 * winding up. Dividing the run's single climbing value by this column's place
 * is what makes the ones column spin fast and the thousands column crawl — an
 * odometer, rather than ten digits that happen to finish together.
 *
 * The division cannot drive the column directly, though. A geared odometer
 * reads 898 with its hundreds wheel 98% of the way from 8 to 9, which on a
 * screen is simply an unreadable number: the first cut of this rendered
 * Jupiter's mass as "1.9₀8 × 10²⁷ kg", every column above the ones parked
 * between two digits. So each of those columns chases `floor(v / place)` — a
 * whole digit, always — and a spring supplies the roll between one and the
 * next. It still spins while the sweep is on, because the target is changing
 * many times a second, and it lands dead on a digit because the target is one.
 *
 * The ones column needs none of that: `v` is already whole when it comes to
 * rest, so it rides the sweep directly and stays perfectly smooth.
 */
const ROLL = { stiffness: 400, damping: 34, mass: 0.6 };

const CountUpColumn = ({ run, place, glyphs }) => {
    const stepped = useTransform(run, (v) => Math.floor(v / place));
    const rolled = useSpring(stepped, ROLL);
    return <Column pos={place === 1 ? run : rolled} items={glyphs} />;
};

/** One maximal run of digits, winding from zero to its true value. */
const CountUpRun = ({ value, places, glyphs, delay }) => {
    const run = useMotionValue(0);
    // The delay only belongs to the first wind-up. Arriving from the catalog,
    // the panel this sits in is still fading in (a 700ms transition delay of
    // its own) and a count-up that started immediately would be over before it
    // was visible. Landing on another body from an already-open panel, though,
    // there is nothing to wait for — and holding at zero for 700ms first would
    // read as a glitch.
    const first = useRef(true);
    useEffect(() => {
        const wait = first.current ? delay : 0;
        first.current = false;
        run.set(0);
        const controls = animate(run, value, { ...COUNT_UP, delay: wait / 1000 });
        return () => controls.stop();
    }, [run, value, delay]);

    return places.map((place, i) => (
        <CountUpColumn key={i} run={run} place={place} glyphs={glyphs} />
    ));
};

/**
 * The locale's twelve month names as `date()` formats them, or null when they
 * are not plain words.
 *
 * `month: 'short'` mirrors the default options in I18nProvider's `date()`,
 * which is what the pill calls — so these are the exact strings that turn up in
 * the text it is handed, and matching them needs no parsing or guesswork.
 *
 * A locale whose months carry digits (Vietnamese: "Tháng 9") is opted out: the
 * digit is the part that changes and it already rolls on its own.
 */
function useMonths() {
    const { intl } = useI18n();
    return useMemo(() => {
        const f = new Intl.DateTimeFormat(intl, { month: 'short', timeZone: 'UTC' });
        // Mid-month in UTC, so no time zone can slide the date into a
        // neighbouring month and mislabel the list.
        const months = Array.from({ length: 12 }, (_, m) =>
            f.format(new Date(Date.UTC(2021, m, 15))));
        if (months.some(m => /\p{Nd}/u.test(m))) return null;
        // Longest first: "Jan" must not win against a longer name it prefixes.
        const byLength = months.map((name, index) => ({ name, index }))
            .sort((a, b) => b.name.length - a.name.length);
        return { months, byLength };
    }, [intl]);
}

/** The locale's own ten digits, in order, and where each one sits. */
function useGlyphs() {
    const { intl } = useI18n();
    return useMemo(() => {
        // Derived rather than looked up, so a locale added later with a third
        // numbering system needs nothing here.
        const nf = new Intl.NumberFormat(intl, { useGrouping: false });
        const glyphs = Array.from({ length: 10 }, (_, i) => nf.format(i));
        return { glyphs, places: new Map(glyphs.map((g, i) => [g, i])) };
    }, [intl]);
}

/**
 * Split a formatted string into digit runs and the text between them. Runs of
 * non-digits collapse into one node each, so "19 Sept 2026" is six columns and
 * two text nodes rather than twelve separate spans.
 */
function tokenize(text, places, months) {
    const out = [];
    let run = [];
    let gap = '';
    const flush = () => {
        if (!run.length) return;
        out.push({ digits: run });
        run = [];
    };
    const flushGap = () => {
        if (gap) out.push(...splitMonth(gap, months));
        gap = '';
    };
    for (const ch of text) {
        const place = places.get(ch);
        if (place === undefined) { flush(); gap += ch; continue; }
        flushGap();
        run.push(place);
    }
    flush();
    flushGap();
    return group(out);
}

/**
 * Pull a month name out of a run of text, so it can roll like a digit.
 *
 * The date arrives already formatted, so the month is just some letters in the
 * middle of it. Rather than parse the date, this looks for the exact strings
 * `Intl` would have produced for this locale — which is why useMonths() builds
 * them with the same options the formatter used.
 */
function splitMonth(text, months) {
    if (!months) return [{ text }];
    for (const { name, index } of months.byLength) {
        const at = text.indexOf(name);
        if (at === -1) continue;
        const before = text.slice(0, at);
        const after = text.slice(at + name.length);
        return [
            ...(before ? [{ text: before }] : []),
            { month: index },
            ...(after ? splitMonth(after, months) : []),
        ];
    }
    return [{ text }];
}

// Characters that live *inside* a number rather than between two of them: the
// decimal mark, the thousands mark (Arabic has its own of each) and the colons
// of a clock face. A plain space is deliberately absent — "−180 to 430" is two
// numbers, not one.
const SEPARATOR = /^[.,:/\u066B\u066C\u00A0\u202F\u2009-]+$/;

/**
 * Fold each number's own separators back into it, so "1.898", "71,492" and
 * "22:31:07" are each a single run.
 *
 * This matters only in Arabic, and it matters a lot: a run is rendered as one
 * left-to-right isolate, and anything left outside it is a neutral that the
 * paragraph orders right-to-left. With the decimal point outside, "١.٨٩٨"
 * came out as "٨٩٨.١" — the halves swapped around the point.
 */
function group(tokens) {
    const out = [];
    let i = 0;
    while (i < tokens.length) {
        // Anything that is not a digit run — plain text, a month — passes
        // straight through; only numbers absorb their own separators.
        if (tokens[i].digits === undefined) { out.push(tokens[i]); i++; continue; }
        const parts = [tokens[i]];
        i++;
        while (i + 1 < tokens.length
            && tokens[i].text !== undefined && SEPARATOR.test(tokens[i].text)
            && tokens[i + 1].digits !== undefined) {
            parts.push(tokens[i], tokens[i + 1]);
            i += 2;
        }
        out.push({ parts });
    }
    return out;
}

/**
 * A readout with no letters in it — a clock, a figure and its unit — is one
 * number as far as a reader is concerned, and its parts must not reorder either:
 * "٢٢:٣١:٠٧" laid out right to left would read as 07:31:22. Those get an LTR
 * isolate around the whole thing. A string that *does* carry letters (a date
 * with a month name) keeps the paragraph's own direction, so only the digit runs
 * inside it are pinned left-to-right.
 */
const Shell = ({ className, style, text, children }) => {
    const pure = !RTL_LETTER.test(text);
    return (
        <span className={className} style={{ whiteSpace: 'nowrap', ...style }}>
            <span style={SR_ONLY}>{text}</span>
            <span aria-hidden="true" style={pure ? RUN : undefined}>{children}</span>
        </span>
    );
};

/** Each digit springs to its new value by the shortest route. */
const SlidingNumber = ({ value, className, style }) => {
    const { glyphs, places } = useGlyphs();
    const months = useMonths();
    const reduced = useReducedMotion();
    const text = value == null ? '' : String(value);
    const tokens = useMemo(() => tokenize(text, places, months), [text, places, months]);

    if (!text) return null;
    if (reduced) return <span className={className} style={style}>{text}</span>;

    return (
        <Shell className={className} style={style} text={text}>
            {tokens.map((tok, i) => {
                if (tok.text !== undefined) return <span key={`s${i}`}>{tok.text}</span>;
                if (tok.month !== undefined) {
                    return <SpringWord key={`m${i}`} index={tok.month} words={months.months} />;
                }
                return (
                    <span key={`n${i}`} style={RUN}>
                        {tok.parts.map((part, j) => (
                            part.text !== undefined
                                ? <span key={j}>{part.text}</span>
                                : part.digits.map((d, k) => (
                                    <SpringDigit key={`${j}-${k}`} value={d} glyphs={glyphs} />
                                ))
                        ))}
                    </span>
                );
            })}
        </Shell>
    );
};

/**
 * Every number in the string winds up from zero to its true value at once.
 *
 * Each run counts independently, so "−180 to 430 °C" winds both figures and
 * "1,361" winds the 1 and the 361 either side of the separator — they share a
 * duration, so the whole line lands together regardless.
 */
export const CountUpNumber = ({ value, className, style, delay = 0 }) => {
    const { glyphs, places } = useGlyphs();
    const reduced = useReducedMotion();
    const text = value == null ? '' : String(value);
    const tokens = useMemo(() => tokenize(text, places), [text, places]);

    if (!text) return null;
    if (reduced) return <span className={className} style={style}>{text}</span>;

    return (
        <Shell className={className} style={style} text={text}>
            {tokens.map((tok, i) => {
                if (tok.text !== undefined) return <span key={`s${i}`}>{tok.text}</span>;
                // The whole number shares one isolate; each digit run inside it
                // still winds up on its own, so "1,361" counts the 1 and the 361
                // together and lands as one figure.
                const shape = tok.parts.map(p => (p.digits ? p.digits.length : p.text)).join('|');
                return (
                    <span key={`n${i}-${shape}`} style={RUN}>
                        {tok.parts.map((part, j) => {
                            if (part.text !== undefined) return <span key={j}>{part.text}</span>;
                            const n = part.digits.length;
                            const target = part.digits.reduce((acc, d) => acc * 10 + d, 0);
                            const columns = part.digits.map((_, k) => 10 ** (n - 1 - k));
                            return (
                                <CountUpRun
                                    key={j}
                                    value={target}
                                    places={columns}
                                    glyphs={glyphs}
                                    delay={delay}
                                />
                            );
                        })}
                    </span>
                );
            })}
        </Shell>
    );
};

export default SlidingNumber;
