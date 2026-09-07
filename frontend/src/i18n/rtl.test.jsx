import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from './I18nProvider';
import { loadLocale } from './load';
import ObjectCard from '../components/ObjectCard';
import ObjectStatsPanel from '../components/ObjectStatsPanel';
import ObjectSearch from '../components/ObjectSearch';
import LanguagePicker from '../components/LanguagePicker';
import ComparePage from '../pages/ComparePage';
import { getObjectById } from '../data/objectCatalog';

// The data tests next door prove the Arabic exists. These prove it reaches the
// screen — that the provider hands it down, that the document flips to
// right-to-left, and that the pieces which have to keep working in English
// (identifiers, catalogue numbers, search by the name people actually type)
// still do.

afterEach(cleanup);

beforeAll(async () => {
    await loadLocale('ar');
});

/** Mount in one language, and wait for the provider to have that language. */
const mount = async (ui, locale = 'ar') => {
    const result = render(
        <I18nProvider locale={locale}>
            <MemoryRouter>{ui}</MemoryRouter>
        </I18nProvider>,
    );
    // The provider draws nothing until the chunk has landed, so every one of
    // these waits on the same thing a reader does.
    await waitFor(() => expect(result.container).not.toBeEmptyDOMElement());
    return result;
};

describe('the document in Arabic', () => {
    it('sets lang and dir on the root, which is what drives the whole layout', async () => {
        await mount(<ObjectCard object={getObjectById('mars')} />);
        await waitFor(() => {
            expect(document.documentElement.getAttribute('lang')).toBe('ar');
            expect(document.documentElement.getAttribute('dir')).toBe('rtl');
        });
    });

    it('puts it back for a left-to-right language', async () => {
        await mount(<ObjectCard object={getObjectById('mars')} />, 'en');
        await waitFor(() => {
            expect(document.documentElement.getAttribute('lang')).toBe('en');
            expect(document.documentElement.getAttribute('dir')).toBe('ltr');
        });
    });

    it('renames the tab', async () => {
        await mount(<ObjectCard object={getObjectById('mars')} />);
        await waitFor(() => expect(document.title).toMatch(/[؀-ۿ]/));
    });
});

describe('a catalog card', () => {
    it('shows the Arabic name, type and value', async () => {
        await mount(<ObjectCard object={getObjectById('saturn')} />);
        expect(screen.getByText('زُحل')).toBeInTheDocument();
        expect(screen.getByText('عملاق غازي')).toBeInTheDocument();
        // "29.46 years" — the number survives, the noun agrees with it.
        expect(screen.getByText('29.46 سنة')).toBeInTheDocument();
    });

    it('is still the English card in English', async () => {
        await mount(<ObjectCard object={getObjectById('saturn')} />, 'en');
        expect(screen.getByText('Saturn')).toBeInTheDocument();
        expect(screen.getByText('Gas Giant')).toBeInTheDocument();
    });

    it('names itself in Arabic for a screen reader too', async () => {
        await mount(<ObjectCard object={getObjectById('mars')} />);
        expect(screen.getByRole('button', { name: /المرّيخ/ })).toBeInTheDocument();
    });
});

describe('the stats panel', () => {
    it('translates the tabs, the labels and the values', async () => {
        await mount(<ObjectStatsPanel object={getObjectById('mercury')} />);
        expect(screen.getByRole('tab', { name: 'الخصائص الفيزيائية' })).toBeInTheDocument();
        expect(screen.getByText('الكتلة')).toBeInTheDocument();
        expect(screen.getByText('نصف القطر الاستوائي')).toBeInTheDocument();
    });

    it('keeps the figures, the units of measure and the superscripts', async () => {
        const { container } = await mount(<ObjectStatsPanel object={getObjectById('mercury')} />);
        // 3.301 × 10²³ kg, with the exponent as a real <sup> and kg in Arabic.
        const sup = container.querySelector('sup');
        expect(sup).not.toBeNull();
        expect(sup.textContent).toBe('23');
        expect(container.textContent).toContain('3.301');
        expect(container.textContent).toContain('كغ');
    });

    it('switches tab on the English section name, which never changes', async () => {
        // The tab state, the compare page's row matching and the tests all key
        // on the English section; only the label is translated.
        await mount(<ObjectStatsPanel object={getObjectById('mercury')} />);
        fireEvent.click(screen.getByRole('tab', { name: 'الخصائص المدارية' }));
        expect(screen.getByText('الانحراف المداري')).toBeInTheDocument();
    });
});

describe('search', () => {
    it('finds a body by its Arabic name', async () => {
        await mount(<ObjectSearch />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'المشتري' } });
        expect(screen.getByRole('option', { name: /المشتري/ })).toBeInTheDocument();
    });

    it('still finds it by its English one', async () => {
        // Someone reading the Arabic interface knows the planet as Jupiter as
        // often as المشتري, and a search that answered "nothing found" to that
        // would be a worse search than the one it replaced.
        await mount(<ObjectSearch />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'jupiter' } });
        const options = screen.getAllByRole('option');
        expect(within(options[0]).getByText('المشتري')).toBeInTheDocument();
    });

    it('says so in Arabic when nothing matches', async () => {
        await mount(<ObjectSearch />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzzz' } });
        expect(screen.getByText(/لا شيء يطابق/)).toBeInTheDocument();
    });

    it('finds a catalogue designation typed exactly as it is written', async () => {
        // TRAPPIST-1e is an identifier, not a word, and is deliberately left
        // in Latin — this is the test that says so on purpose.
        await mount(<ObjectSearch />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'trappist' } });
        expect(screen.getByRole('option', { name: /TRAPPIST-1e/ })).toBeInTheDocument();
    });
});

describe('the compare page', () => {
    it('reads as one Arabic sentence rather than glued fragments', async () => {
        await mount(<ComparePage />);
        // Jupiter beside Earth, the default pair. Word order is the locale's,
        // which is why the whole sentence is one key.
        expect(screen.getByText(/المشتري أعرض من الأرض/)).toBeInTheDocument();
    });

    it('translates the shared stat rows on both sides', async () => {
        const { container } = await mount(<ComparePage />);
        expect(container.textContent).toContain('الخصائص الفيزيائية');
        expect(container.textContent).toContain('الكتلة');
    });
});

describe('the language picker', () => {
    it('names every language in its own script', async () => {
        await mount(<LanguagePicker />, 'en');
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByRole('option', { name: /English/ })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /العربية/ })).toBeInTheDocument();
    });

    it('marks the language you are in as selected', async () => {
        await mount(<LanguagePicker />, 'en');
        fireEvent.click(screen.getByRole('button'));
        const english = screen.getByRole('option', { name: /English/ });
        expect(english).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('option', { name: /العربية/ }))
            .toHaveAttribute('aria-selected', 'false');
    });

    it('gives each row the direction its own language reads in', async () => {
        await mount(<LanguagePicker />, 'en');
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByRole('option', { name: /العربية/ })).toHaveAttribute('dir', 'rtl');
        expect(screen.getByRole('option', { name: /English/ })).toHaveAttribute('dir', 'ltr');
    });
});
