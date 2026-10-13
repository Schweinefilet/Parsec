/**
 * The centred card a full-bleed page puts up when it needs something before it
 * can go on, or has to stop and explain — the night sky's location ask, the AR
 * permission ask, Gargantua's desktop warning and lost-GPU notice. One shape:
 * icon, title, body, then whatever notes and actions the caller passes as
 * children (`.dialog-note`, `.dialog-error`, `.dialog-actions` in index.css).
 *
 * `scrim` dims the scene behind it, for when there is a live one worth keeping
 * in view; `passive` lets pointer events through, for a notice that asks
 * nothing of you.
 */
const SceneDialog = ({ icon: Icon, title, body, scrim, passive, maxWidth, zIndex, children }) => (
    <div
        className="scene-dialog"
        data-scrim={scrim || undefined}
        style={{ pointerEvents: passive ? 'none' : undefined, zIndex }}
    >
        <div className="glass dialog-card" role="dialog" aria-label={title} style={{ maxWidth }}>
            {Icon && <Icon className="dialog-icon" aria-hidden="true" />}
            <p className="dialog-title">{title}</p>
            {body && <p className="dialog-body">{body}</p>}
            {children}
        </div>
    </div>
);

export default SceneDialog;
