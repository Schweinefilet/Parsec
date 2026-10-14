import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExoticPage from './ExoticPage';

// jsdom has no WebGL, so each renderer fails to start: the page has to say
// so, and everything around the picture still has to work.

const at = (url = '/exotic/wormhole') => render(
    <MemoryRouter initialEntries={[url]}>
        <Routes>
            <Route path="/exotic" element={<ExoticPage />} />
            <Route path="/exotic/:id" element={<ExoticPage />} />
        </Routes>
    </MemoryRouter>,
);

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('ExoticPage', () => {
    it('opens on Gargantua, and explains when WebGL 2 is missing', async () => {
        at('/exotic');
        expect(screen.getByRole('heading', { name: 'Gargantua' })).toBeInTheDocument();
        expect(await screen.findByText('WebGL 2 needed')).toBeInTheDocument();
    });

    it('links to the objects on offer, not the stashed ones, and marks the one on screen', () => {
        at('/exotic/binary');
        const nav = screen.getByRole('navigation', { name: 'Exotic objects' });
        for (const name of ['Gargantua', 'Wormhole', 'Binary black hole']) {
            expect(nav).toHaveTextContent(name);
        }
        for (const name of ['Neutron star', 'Roche lobe overflow']) {
            expect(nav).not.toHaveTextContent(name);
        }
        expect(screen.getByRole('link', { name: 'Binary black hole' })).toHaveAttribute('aria-current', 'page');
    });

    it('shows the same picker on Gargantua', () => {
        at('/exotic/gargantua');
        expect(screen.getByRole('link', { name: 'Gargantua' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Wormhole' })).toHaveAttribute('href', '/exotic/wormhole');
    });

    it('falls back to Gargantua for an unknown or stashed object', () => {
        for (const url of ['/exotic/quasar', '/exotic/roche', '/exotic/neutron-star']) {
            at(url);
            expect(screen.getByRole('heading', { name: 'Gargantua' })).toBeInTheDocument();
            cleanup();
        }
    });

    it('gives each object its own shots and settings', () => {
        const cases = [
            ['/exotic/wormhole', ['Approach', 'Go through', 'From the other side'], []],
            ['/exotic/binary', ['Edge on', 'From above', 'Close in'], ['Hold the orbit', 'Gas disk round the pair']],
        ];
        for (const [url, shots, toggles] of cases) {
            at(url);
            fireEvent.click(screen.getByRole('button', { name: 'Scene settings' }));
            for (const name of shots) expect(screen.getByRole('button', { name })).toBeInTheDocument();
            for (const name of toggles) expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed');
            expect(screen.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'true');
            cleanup();
        }
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
