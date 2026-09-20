/**
 * Draws one frame of a decode — the markup half of the effect after Aceternity
 * UI's EncryptedText. The cipher itself is `hooks/useEncryptedText`, which
 * explains why the two are apart.
 *
 * Every character gets its own slot, held open by the settled glyph it is going
 * to become, drawn in flow and invisible. Whatever the text is currently saying
 * there is laid over that slot from its centre. So the element is always
 * exactly as wide as the finished text, every glyph stays on the centre line of
 * the letter it will resolve into, and nothing moves from the first frame to
 * the last.
 *
 * Centring each glyph in its own slot rather than setting the whole ciphertext
 * from the leading edge is what keeps the line centred. Cipher glyphs are not
 * the width of the letters they stand in for — a run of them is a few pixels
 * wider or narrower than the wordmark — so a left-anchored overlay hangs off
 * one side and creeps back into place as the letters land, which reads as the
 * text sliding into position rather than as a decode.
 *
 * It also means the last frame of the decode and the plain text that replaces
 * it occupy identical space — which is what the loading screen's flight to the
 * header depends on, since that flight ends by clearing a transform and
 * expecting to be pixel-identical to the header's own wordmark.
 *
 * There are three states, and the slot is the same in all three:
 *
 *   held      `shown` is null. The slot's candidate glyphs (`cipherFrames`)
 *             are stacked into a reel one glyph tall, and CSS winds it round.
 *             Nothing here runs on the main thread, because this is the state
 *             the wordmark is in while the scene is being built and the main
 *             thread is not running anything.
 *   decoding  `shown` is a string. One glyph per slot, from the cipher.
 *   settled   `shown` is the text. Plain text in normal flow, nothing wrapped,
 *             nothing positioned, out of the way entirely.
 *
 * The held state is a reel rather than a stack of glyphs taking turns at
 * opacity, which is what it was first built as. Six layers per slot agreeing
 * on whose turn it is, by way of six animation delays, is six ways for a slot
 * to end up showing nothing — and on iOS that is exactly what happened: the
 * letters sat on one glyph each and blinked instead of scrambling. A reel
 * cannot do that. Which glyph is showing is decided by what the slot is
 * clipping, not by six animations agreeing, so the worst an engine that
 * refuses to run the animation at all can produce is a letter standing still.
 */

const BOX = { display: 'inline-block', whiteSpace: 'nowrap' };
// The slot: as wide as the settled glyph, and the frame the cipher is drawn in.
const SLOT = { position: 'relative', display: 'inline-block' };
const WIDTH = { visibility: 'hidden' };
const OVER = { position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)' };

// A space collapses to nothing inside an inline-block, which would close the
// slot up and shorten the line. Non-breaking is the same width and stays.
const solid = (ch) => (ch === ' ' ? ' ' : ch);

export default function EncryptedText({ text, shown, frames, className, style }) {
    const held = shown == null;
    // Settled, or held with nothing to hold it with: plain text either way.
    if (shown === text || (held && !frames)) {
        return <span className={className} style={style}>{text}</span>;
    }

    const slots = [];
    for (let i = 0; i < text.length; i++) {
        const ch = solid(text[i]);
        const glyphs = held ? frames[i]?.glyphs : null;
        slots.push(
            <span key={i} style={SLOT}>
                {/* The settled glyph carries the width. */}
                <span style={WIDTH}>{ch}</span>
                {glyphs
                    // Held: the candidates in a column, wound past a window
                    // one glyph tall. The window is the slot, so whichever
                    // glyph the reel has brought round is the one showing.
                    ? (
                        <span className="cipher-reel" aria-hidden="true">
                            <span
                                className="cipher-drum"
                                style={{
                                    '--cycle': `${frames[i].cycle}ms`,
                                    '--phase': `${frames[i].phase}ms`,
                                }}
                            >
                                {glyphs.map((g, k) => <span key={k}>{g}</span>)}
                            </span>
                        </span>
                    )
                    // Decoding, or a character the cipher leaves alone.
                    : <span style={OVER} aria-hidden="true">{held ? ch : solid(shown[i] ?? text[i])}</span>}
            </span>
        );
    }
    return <span className={className} style={{ ...BOX, ...style }}>{slots}</span>;
}
