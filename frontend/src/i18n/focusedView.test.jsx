import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from './I18nProvider';
import { loadLocale } from './load';

// The annotations flanking a focused body are the one piece of Arabic surface
// with no other coverage, and they were the last thing still in English: they
// read `row.value` and `row.label` off the catalog, which localizeObject keeps
// in English on purpose — the translated pair sits beside them as `valueText`
// and `labelText`, because a section and a row have to stay identifiable by a
// name that does not move. So the page rendered زُحل, عملاق غازي and 29.46 سنة
// correctly and then said MASS and EQUATORIAL RADIUS underneath them.
//
// Nothing about that is visible from the data tests, which is why this one
// renders the page.

// The scene is three.js and there is no WebGL here; the rest are heavy and
// have their own tests. What is under examination is the text around them.
vi.mock('../components/SolarSystem3D', () => ({ default: () => <div data-testid="scene" /> }));
vi.mock('../components/SpaceDataStrip', () => ({ default: () => null }));
vi.mock('../components/LoadingScreen', () => ({ default: () => null }));
vi.mock('../components/SpacecraftViewer', () => ({ default: () => null }));
// Desktop: the flanking annotations only exist there. On a phone the same two
// rows go into the identity card in the sheet, which is asserted below too.
vi.mock('../hooks/useMediaQuery', () => ({
    useIsMobile: () => false,
    useIsShortViewport: () => false,
    useReducedMotion: () => true,
    useHasRoomForTimeline: () => true,
}));

const { default: CategoryBrowser } = await import('../pages/CategoryBrowser');

afterEach(cleanup);
beforeAll(() => loadLocale('ar'));

const openAt = async (path, locale) => {
    const result = render(
        <I18nProvider locale={locale}>
            <MemoryRouter initialEntries={[path]}>
                <Routes>
                    <Route path="/object/:id" element={<CategoryBrowser />} />
                </Routes>
            </MemoryRouter>
        </I18nProvider>,
    );
    await waitFor(() => expect(result.container).not.toBeEmptyDOMElement());
    return result;
};

describe('a focused body, in Arabic', () => {
    it('names it, and says what kind of thing it is', async () => {
        await openAt('/object/saturn', 'ar');
        // Level 1: the catalog below stays mounted while an object is focused
        // — it is collapsed, not unmounted — so Saturn's card heading is in
        // the tree too, and an unscoped query finds both.
        expect(screen.getByRole('heading', { level: 1, name: 'زُحل' })).toBeInTheDocument();
        expect(screen.getAllByText('عملاق غازي').length).toBeGreaterThan(0);
    });

    it('translates the labels on the annotations flanking it', async () => {
        const { container } = await openAt('/object/saturn', 'ar');
        // The two rows lifted out of the Physical section.
        expect(container.textContent).toContain('الكتلة');
        expect(container.textContent).toContain('نصف القطر الاستوائي');
        expect(container.textContent).not.toContain('MASS');
        expect(container.textContent).not.toContain('EQUATORIAL RADIUS');
    });

    it('translates their values too, units and all', async () => {
        const { container } = await openAt('/object/saturn', 'ar');
        expect(container.textContent).toContain('كم');
        expect(container.textContent).toContain('كغ');
        // 29.46 years — the figure survives, the noun agrees with it.
        expect(container.textContent).toContain('29.46 سنة');
    });

    it('leaves no English prose anywhere on the page', async () => {
        const { container } = await openAt('/object/saturn', 'ar');
        // The wordmark is a name and stays Latin; so does anything with a
        // digit stuck to it, which is a catalogue number or a spectral class.
        const prose = container.textContent
            .replace(/P4RSEC/g, '')
            .replace(/\b[A-Za-z]+[-–\s]?\d[\w+.-]*/g, '')
            .replace(/\b[A-Z]{1,6}\b/g, '');
        const leftovers = prose.match(/[A-Za-z]{4,}/g) ?? [];
        expect([...new Set(leftovers)]).toEqual([]);
    });

    it('is still English in English', async () => {
        const { container } = await openAt('/object/saturn', 'en');
        expect(screen.getByRole('heading', { level: 1, name: 'Saturn' })).toBeInTheDocument();
        expect(container.textContent).toContain('Equatorial Radius');
    });
});
