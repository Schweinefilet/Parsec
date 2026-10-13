import { ChevronLeft } from 'lucide-react';
import { useI18n } from '../i18n';

/**
 * The way out of a full-bleed page — .page-back pinned on the spine under the
 * wordmark (.scene-back). The focused-body view, the night sky and Gargantua
 * all use it, in the same place, so leaving any of them is the same gesture.
 *
 * No aria-label: the visible text is the accessible name, and one that didn't
 * contain the other would be the WCAG "label in name" trap. Extra wording can
 * go in `title`.
 */
const SceneBack = ({ onClick, className = '', style, ...rest }) => {
    const { t } = useI18n();
    return (
        <button
            type="button"
            onClick={onClick}
            className={`page-back scene-back focus-ring ${className}`.trim()}
            style={style}
            {...rest}
        >
            <ChevronLeft className="flip-rtl" style={{ width: 15, height: 15 }} aria-hidden="true" />
            <span>{t('nav.back')}</span>
        </button>
    );
};

export default SceneBack;
