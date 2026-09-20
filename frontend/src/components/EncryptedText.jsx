/**
 * Draws one frame of a decode — the markup half of the effect after Aceternity
 * UI's EncryptedText. The cipher itself is `hooks/useEncryptedText`, which
 * explains why the two are apart.
 *
 * Every character gets its own slot, held open by the settled glyph it is going
 * to become, drawn in flow and invisible. Whatever the cipher is currently
 * saying there is laid over that slot from its centre. So the element is always
 * exactly as wide as the finished text, every glyph stays on the centre line of
 * the letter it will resolve into, and nothing moves for the whole decode.
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
 */

const BOX = { display: 'inline-block', whiteSpace: 'nowrap' };
// The slot: as wide as the settled glyph, and the frame the cipher is drawn in.
const SLOT = { position: 'relative', display: 'inline-block' };
const WIDTH = { visibility: 'hidden' };
const OVER = { position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)' };

// A space collapses to nothing inside an inline-block, which would close the
// slot up and shorten the line. Non-breaking is the same width and stays.
const solid = (ch) => (ch === ' ' ? ' ' : ch);

export default function EncryptedText({ text, shown, className, style }) {
    // Once settled, get out of the way entirely: plain text in normal flow,
    // nothing wrapped, nothing positioned.
    if (shown === text) return <span className={className} style={style}>{text}</span>;

    const slots = [];
    for (let i = 0; i < text.length; i++) {
        slots.push(
            <span key={i} style={SLOT}>
                {/* The settled glyph carries the width. */}
                <span style={WIDTH}>{solid(text[i])}</span>
                <span style={OVER} aria-hidden="true">{solid(shown[i] ?? text[i])}</span>
            </span>
        );
    }
    return <span className={className} style={{ ...BOX, ...style }}>{slots}</span>;
}
