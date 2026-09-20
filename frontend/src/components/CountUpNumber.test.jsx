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

    it('leaves a unit’s power alone', () => {
        const { container } = mount('1,361 W/m²');
        expect(animated(container).querySelector('sup')).toBeNull();
        expect(container.textContent).toContain('W/m²');
    });
});
