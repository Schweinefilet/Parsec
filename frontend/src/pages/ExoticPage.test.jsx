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
        for (const name of ['Gargantua', 'Wormhole', 'Binary black hole', 'Ring Nebula', 'HL Tau', 'WR 104']) {
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
            ['/exotic/hl-tau', ['As ALMA sees it', 'From above', 'Edge on', 'Close in'], ['Forming planets', 'Jet']],
            ['/exotic/wr104', ['As Keck sees it', 'At a slant', 'Edge on', 'Close in'], []],
            ['/exotic/ring', ['As we see it', 'At a slant', 'From the side', 'Inside'], ['Dense knots']],
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

    it('lets a shot switch how HL Tau is shown', () => {
        at('/exotic/hl-tau');
        fireEvent.click(screen.getByRole('button', { name: 'Scene settings' }));
        expect(screen.getByRole('button', { name: 'Millimetre waves' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Edge on' }));
        expect(screen.getByRole('button', { name: 'Starlight' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'As ALMA sees it' }));
        expect(screen.getByRole('button', { name: 'Millimetre waves' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByText(/Jupiter masses/)).toHaveTextContent('0.5 · 0.31 · 0.05');
    });

    it('closes its settings on Escape, and says which shot is on', () => {
        at('/exotic/wormhole');
        const tab = screen.getByRole('button', { name: 'Scene settings' });
        fireEvent.click(tab);
        expect(tab).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('button', { name: 'Approach' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'From the other side' })).toHaveAttribute('aria-pressed', 'false');
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.getByRole('button', { name: 'Scene settings' })).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByRole('button', { name: 'Approach' })).not.toBeInTheDocument();
    });

    // Last: "Run it anyway" holds for the rest of the visit, by design.
    it('warns a phone once, not again at every object', () => {
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
        fireEvent.click(screen.getByRole('link', { name: 'Gargantua' }));
        expect(screen.getByRole('heading', { name: 'Gargantua' })).toBeInTheDocument();
        expect(screen.queryByText('Built for a computer')).not.toBeInTheDocument();
    });
});
