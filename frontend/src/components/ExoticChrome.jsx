import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor } from 'lucide-react';
import EdgeTab from './EdgeTab';
import CoachMark from './CoachMark';
import SceneBack from './SceneBack';
import SceneDialog from './SceneDialog';
import ExoticPicker from './ExoticPicker';
import { useIsMobile, useIsShortViewport, useIsTouch, useReducedMotion } from '../hooks/useMediaQuery';
import { QUALITY_ORDER } from '../utils/gargantuaCamera';
import { useI18n } from '../i18n';

// The chrome every /exotic object shares — Gargantua's page (GargantuaPage)
// and the rest (ExoticPage) — so the two can't drift apart: the picker with the
// title under it, the settings drawer, the readouts and credit along
// the bottom, and the phone warning.

// Full bleed out of AppShell's centred <main>; see NightSkyPage for why both
// margins.
const FULL_BLEED = {
    position: 'relative', height: 'var(--app-vh, 100vh)', overflow: 'hidden', background: '#000',
    width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)',
};

// Behind the chrome at the top and the bottom: enough to lift small grey
// labels off a bright frame, too little to notice over black.
const SCRIM = { position: 'absolute', insetInline: 0, zIndex: 9, pointerEvents: 'none' };
const SCRIM_DOWN = 'linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.28) 55%, transparent)';
const SCRIM_UP = 'linear-gradient(to top, rgba(0,0,0,0.55), rgba(0,0,0,0.3) 55%, transparent)';

/** The page's black, edge to edge. */
export function ExoticFrame({ children }) {
    return <div className="exotic-frame" style={FULL_BLEED}>{children}</div>;
}

const QUALITY_KEYS = {
    balanced: 'gargantua.qualityBalanced', high: 'gargantua.qualityHigh',
    ultra: 'gargantua.qualityUltra', absurd: 'gargantua.qualityAbsurd',
};

// "Run it anyway" holds for the visit, not for one object: the warning is
// about the phone, and it was asking again at every pick in the picker.
let phoneAccepted = false;

/** The phone warning, shown instead of the page (its children) until accepted. */
export function PhoneGate({ body, children }) {
    const { t } = useI18n();
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const isTouch = useIsTouch();
    const [accepted, setAccepted] = useState(phoneAccepted);
    // The flag as well as the state: Gargantua's page and the others each
    // hold their own gate, and either may be the one accepted.
    if (!(isMobile || isTouch) || accepted || phoneAccepted) return children;
    const accept = () => { phoneAccepted = true; setAccepted(true); };
    return (
        <ExoticFrame>
            <SceneBack onClick={() => navigate('/')} />
            <SceneDialog icon={Monitor} title={t('gargantua.desktopTitle')} body={body}>
                <div className="dialog-actions">
                    <button className="action-btn focus-ring" onClick={accept}>
                        {t('gargantua.runAnyway')}
                    </button>
                    <button className="action-btn focus-ring" data-variant="quiet" onClick={() => navigate('/')}>
                        {t('nav.back')}
                    </button>
                </div>
            </SceneDialog>
        </ExoticFrame>
    );
}

/**
 * The picker, then the object's name and its line — under the way out. The
 * picker comes first so it never moves: under a title and tagline that wrap
 * differently for every object (and every language), the pill just clicked
 * jumped out from under the pointer.
 */
export function ExoticTitle({ current, title, tagline, tracking = '0.18em' }) {
    const isMobile = useIsMobile();
    // A phone on its side, or a short window: the readouts climbing from the
    // bottom met the tagline coming down. The name alone, a size smaller.
    const short = useIsShortViewport();
    const text = isMobile ? undefined : 'min(560px, 72vw)';
    return (
        <>
            {/* A soft dark behind the way out, the picker and the title, so they
                read over a bright picture (the binary's disk fills the frame). */}
            <div aria-hidden="true" style={{ ...SCRIM, top: 0, height: short ? 220 : 360, background: SCRIM_DOWN }} />
            <div style={{
                // Under the back link — which drops to 84px on a phone held
            // upright (.scene-back; not on its side, .exotic-frame).
                position: 'absolute', top: isMobile && !short ? 126 : 108, insetInlineStart: 'var(--scene-inset)', zIndex: 10,
                insetInlineEnd: 'var(--scene-inset)',
                // Not a drag target: the scene runs on underneath it. The picker
                // takes its own pointer events back.
                pointerEvents: 'none',
            }}>
                <ExoticPicker current={current} />
                <h1 style={{
                    margin: `var(${short ? '--s-3' : '--s-5'}) 0 0`, maxWidth: text, width: 'fit-content',
                    // Short: one tight line, clear of the drawer's tab below it.
                    ...(short && { lineHeight: 1.2 }),
                    fontSize: isMobile || short ? 'var(--fs-xl)' : 'var(--fs-2xl)', fontWeight: 300,
                    letterSpacing: tracking, textTransform: 'uppercase', color: 'var(--text-primary)',
                    textShadow: '0 2px 16px rgba(0,0,0,0.8)', textWrap: 'balance',
                }}>
                    {title}
                </h1>
                {!short && <p style={{
                    margin: 'var(--s-2) 0 0', maxWidth: text, fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)',
                    textShadow: '0 1px 8px rgba(0,0,0,0.9)', textWrap: 'pretty',
                }}>
                    {tagline}
                </p>}
            </div>
        </>
    );
}

/**
 * The settings drawer: the same chevron tab against the leading edge that the
 * solar system's view options and the night sky's settings use, so all three
 * scenes keep their settings in the same place. A first-visit tip points at it.
 */
export function ExoticSettings({ label, closeLabel, children }) {
    const { t, rtl } = useI18n();
    const reduced = useReducedMotion();
    const isMobile = useIsMobile();
    const short = useIsShortViewport();
    const [open, setOpen] = useState(false);
    // The tab is centred on the window, unless that puts it beside the title
    // block (the window is short, or the title wraps on a small phone): then
    // it drops to just under it. Only the tab moves; the drawer stays centred.
    const tabFloor = short ? 210 : isMobile ? 350 : 290;
    const tabTop = `max(50%, calc(50% + ${tabFloor}px - var(--app-vh, 100vh) / 2))`;

    // Its own flag: having found the solar system's drawer or the sky's
    // doesn't mean you know this page has one.
    const [coachSeen, setCoachSeen] = useState(() => {
        try { return window.localStorage.getItem('p4rsec.coachExotic') === '1'; } catch { return true; }
    });
    const [coachRect, setCoachRect] = useState(null);
    const endCoach = useCallback((persist) => {
        setCoachSeen(true);
        if (persist) { try { window.localStorage.setItem('p4rsec.coachExotic', '1'); } catch { /* ignore */ } }
    }, []);

    const toggleOpen = () => { if (!open) endCoach(true); setOpen((v) => !v); };

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    useEffect(() => {
        if (coachSeen) return undefined;
        const measure = () => {
            const el = document.querySelector('[data-coach="exotic-tab"]');
            if (el) setCoachRect(el.getBoundingClientRect());
        };
        const arm = setTimeout(measure, 1300);
        // A miss doesn't mark it seen — the next visit gets another chance.
        const miss = setTimeout(() => endCoach(false), 1300 + 8000);
        window.addEventListener('resize', measure);
        return () => { clearTimeout(arm); clearTimeout(miss); window.removeEventListener('resize', measure); };
    }, [coachSeen, endCoach]);

    const slide = reduced ? 'none' : 'transform 320ms var(--ease-glide), inset-inline-start 320ms var(--ease-glide)';
    // .edge-tab carries an opacity hover of its own, and an inline transition
    // replaces the class's outright, so both halves are named here.
    const tabSlide = reduced ? 'none' : `${slide}, opacity var(--t-base) var(--ease-out)`;

    return (
        <>
            <div
                style={{
                    // Above the title and the readouts, which it covers when open.
                    position: 'absolute', insetInlineStart: 0, top: '50%', zIndex: 21,
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                }}
            >
                <div style={{ position: 'relative' }}>
                    <EdgeTab
                        open={open}
                        reduced={reduced}
                        onClick={toggleOpen}
                        aria-expanded={open}
                        aria-label={open ? closeLabel : label}
                        title={open ? closeLabel : label}
                        data-coach="exotic-tab"
                        style={{
                            position: 'absolute', top: tabTop,
                            insetInlineStart: open ? '100%' : 0,
                            transform: 'translateY(-50%)',
                            transition: tabSlide,
                        }}
                    />
                    <div
                        role="group"
                        aria-label={label}
                        aria-hidden={!open || undefined}
                        inert={!open || undefined}
                        className="drawer drawer-edge"
                        style={{
                            width: 264, maxWidth: '82vw',
                            maxHeight: 'calc(var(--app-vh, 100vh) - 96px)',
                            pointerEvents: open ? 'auto' : 'none',
                            transform: open ? 'translateX(0)' : (rtl ? 'translateX(100%)' : 'translateX(-100%)'),
                            transition: slide,
                        }}
                    >
                        <p className="label drawer-title">{label}</p>
                        {children}
                    </div>
                </div>
            </div>
            {!coachSeen && coachRect && !open && (
                <CoachMark
                    text={t('exotic.hintSettings')}
                    target={coachRect}
                    // The tab hugs the leading edge, so the tip opens toward the scene.
                    side={rtl ? 'left' : 'right'}
                    maxWidth={220}
                    onDismiss={() => endCoach(true)}
                />
            )}
        </>
    );
}

/** The drawer's shot list: one pressed at a time, two up. */
export function ShotPicker({ heading, order, label, isOn, onPick }) {
    return (
        <>
            <p className="label drawer-subtitle">{heading}</p>
            <div className="opt-grid">
                {order.map((id) => (
                    <button
                        key={id}
                        className="opt-row focus-ring"
                        aria-pressed={isOn(id)}
                        onClick={() => onPick(id)}
                    >
                        {label(id)}
                    </button>
                ))}
            </div>
        </>
    );
}

/** The drawer's closing block: render quality, and how to move the camera. */
export function QualityPicker({ value, onChange }) {
    const { t } = useI18n();
    const isTouch = useIsTouch();
    return (
        <>
            <p className="label drawer-subtitle">{t('gargantua.quality')}</p>
            <div className="opt-grid">
                {QUALITY_ORDER.map((q) => (
                    <button
                        key={q}
                        className="opt-row focus-ring"
                        aria-pressed={value === q}
                        onClick={() => onChange(q)}
                    >
                        {t(QUALITY_KEYS[q])}
                    </button>
                ))}
            </div>
            <p className="drawer-note">{t('gargantua.qualityNote')}</p>
            <p className="drawer-note" style={{ marginTop: 'var(--s-3)' }}>
                {t(isTouch ? 'gargantua.hintTouch' : 'gargantua.hint')}
            </p>
        </>
    );
}

// A slider in the settings drawer: the caption and its live value on one
// line, the shared .plain-slider track under it.
export function Slider({ name, value, display, min, max, step, onChange }) {
    return (
        <label style={{ display: 'block' }}>
            <span className="drawer-field drawer-field-row">
                <span>{name}</span>
                <span className="drawer-field-value">{display}</span>
            </span>
            <input
                type="range" className="plain-slider" dir="ltr"
                min={min} max={max} step={step} value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-label={name}
                aria-valuetext={typeof display === 'string' ? display : undefined}
            />
        </label>
    );
}

/**
 * A number and the word after it never part at a line break: on a phone
 * "1,3 megapixel" broke as "1,3 / megapixel", and "0% swallowed" as
 * "0% / swallowed". Any script's digits, and a percent or degree sign
 * after them.
 */
const keepUnits = (value) => (
    typeof value === 'string' ? value.replace(/(\p{Nd}[%٪°]?) (?=\S)/gu, '$1 ') : value
);

/**
 * The readouts and the credit, stacked from the bottom edge. One column, so a
 * credit that wraps (any phone, a narrow window) pushes the readouts up
 * instead of running underneath them.
 */
export function ExoticFoot({ readouts, credit }) {
    // A short window: on the trailing side, out of the way of the drawer's
    // tab on the leading edge, which sits low enough to meet them.
    const short = useIsShortViewport();
    return (
        <div style={{
            position: 'absolute', bottom: 0, insetInline: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', gap: 'var(--s-3)',
            pointerEvents: 'none',
            // The same soft dark as behind the title, rising behind the
            // readouts and the credit.
            paddingTop: 64, paddingBottom: 10, background: SCRIM_UP,
        }}>
            {readouts?.length > 0 && (
                <dl
                    style={{
                        alignSelf: short ? 'flex-end' : 'flex-start', marginBlock: 0, marginInline: 'var(--scene-inset)',
                        display: 'grid', gridTemplateColumns: 'auto auto', columnGap: 'var(--s-4)',
                        // Short: closer rows, so the disruption's five fit under its title.
                        rowGap: short ? 1 : 'var(--s-1)', alignItems: 'baseline',
                        fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'rgba(255,255,255,0.88)',
                        textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {readouts.map(([label, value], i) => (
                        <div key={i} style={{ display: 'contents' }}>
                            <dt className="label">{label}</dt>
                            <dd style={{ margin: 0 }}>{keepUnits(value)}</dd>
                        </div>
                    ))}
                </dl>
            )}
            <p className="scene-credit" style={{ position: 'static' }}>{credit}</p>
        </div>
    );
}
