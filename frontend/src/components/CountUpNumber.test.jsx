import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nProvider';
import { CountUpNumber } from './SlidingNumber';

afterEach(cleanup);

const mount = (value) => render(
    <I18nProvider locale="en"><CountUpNumber value={value} /></I18nProvider>,
);

// The animated tree is aria-hidden; the visually hidden copy carries the text.
const animated = (c) => c.querySelector('[aria-hidden="true"]');

describe('CountUpNumber exponents', () => {
    it('winds a power-of-ten exponent up inside a real <sup>', () => {
        const { container } = mount('5.97 × 10²⁴ kg');
        const sup = animated(container).querySelector('sup');
        expect(sup).not.toBeNull();
        // Two columns, one per exponent digit, each a rolling stack of ten.
        expect(sup.children).toHaveLength(2);
        expect(container.textContent).toContain('5.97 × 10²⁴ kg');
    });

    it('isolates the exponent left-to-right, or Arabic reads 10²⁷ as 10⁷²', () => {
        // Each column is a neutral inline-block, so in an Arabic paragraph the
        // two of them order right-to-left and the exponent comes out reversed —
        // the same trap the mantissa's runs are isolated against.
        const { container } = mount('5.97 × 10²⁴ kg');
        const sup = animated(container).querySelector('sup');
        expect(sup.style.direction).toBe('ltr');
        expect(sup.style.unicodeBidi).toBe('isolate');
    });

    it('gives the sup back a line-height, or the exponent is invisible', () => {
        // Tailwind's preflight sets `line-height: 0` on sub/sup. A column is an
        // inline-block sized by its own line box, so under that rule every
        // column in here measures zero high and the clip hides the exponent
        // completely — which is exactly what shipped in 5.10.12. jsdom does no
        // layout and cannot catch that collapse, so this guards the override.
        const { container } = mount('5.97 × 10²⁴ kg');
        const sup = animated(container).querySelector('sup');
        expect(sup.style.lineHeight).toBe('normal');
    });

    it('leaves a unit’s power alone', () => {
        const { container } = mount('1,361 W/m²');
        expect(animated(container).querySelector('sup')).toBeNull();
        expect(container.textContent).toContain('W/m²');
    });
});
