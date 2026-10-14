import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GargantuaPage from './GargantuaPage';

// jsdom has no WebGL, so the renderer can't start here — which is exactly the
// path worth testing: the page has to say so rather than leave a black screen.

const at = (url = '/gargantua') => render(
    <MemoryRouter initialEntries={[url]}><GargantuaPage /></MemoryRouter>,
);

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('GargantuaPage', () => {
    it('explains when WebGL 2 is missing instead of drawing nothing', async () => {
        at();
        expect(screen.getByRole('heading', { name: 'Gargantua' })).toBeInTheDocument();
        expect(await screen.findByText('WebGL 2 needed')).toBeInTheDocument();
    });

    it('starts with its settings collapsed, and opens them with every shot and quality level', () => {
        at('/gargantua?shot=physical&quality=ultra');
        expect(screen.queryByRole('button', { name: 'Fall in' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Black hole settings' }));
        for (const name of ['As in the film', 'As physics has it', 'From above', 'A quasar', 'Fall in']) {
            expect(screen.getByRole('button', { name })).toBeInTheDocument();
        }
        expect(screen.getByRole('button', { name: 'Ultra' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: /Doppler/ })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Relativistic jets' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('switches the jets on with the quasar shot, and off again with the film’s', () => {
        at('/gargantua?shot=quasar');
        fireEvent.click(screen.getByRole('button', { name: 'Black hole settings' }));
        const jets = screen.getByRole('button', { name: 'Relativistic jets' });
        expect(jets).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'As in the film' }));
        expect(jets).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(jets);
        expect(jets).toHaveAttribute('aria-pressed', 'true');
    });

    it('warns a phone first, and lets it carry on', () => {
        vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
            matches: query.includes('max-width') || query.includes('coarse'),
            media: query, onchange: null,
            addEventListener() {}, removeEventListener() {},
            addListener() {}, removeListener() {}, dispatchEvent: () => false,
        }));
        at();
        expect(screen.getByText('Built for a computer')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Run it anyway' }));
        expect(screen.queryByText('Built for a computer')).not.toBeInTheDocument();
    });
});
