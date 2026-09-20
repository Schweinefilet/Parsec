/**
 * Draws one frame of a decode — the markup half of the effect after Aceternity
 * UI's EncryptedText. The cipher itself is `hooks/useEncryptedText`, which
 * explains why the two are apart.
 *
 * The settled string is left in flow, invisible, to hold the box open, and the
 * ciphertext is laid over it from the same leading edge. So the element is
 * always exactly as wide as the finished text: letters that have already
 * decoded cannot shift once they land, and the undecoded tail is the only part
 * that moves. It also means the last frame of the decode and the plain text
 * that replaces it occupy identical space — which is what the loading screen's
 * flight to the header depends on, since that flight ends by clearing a
 * transform and expecting to be pixel-identical to the header's own wordmark.
 */

const BOX = { position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' };
const OVER = { position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap' };

export default function EncryptedText({ text, shown, className, style }) {
    // Once settled, get out of the way entirely: plain text in normal flow,
    // nothing wrapped, nothing positioned.
    if (shown === text) return <span className={className} style={style}>{text}</span>;
    return (
        <span className={className} style={{ ...BOX, ...style }}>
            {/* The real string carries the accessible text and the width. */}
            <span style={{ visibility: 'hidden' }}>{text}</span>
            <span style={OVER} aria-hidden="true">{shown}</span>
        </span>
    );
}
