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
    it('opens on the wormhole, and explains when WebGL 2 is missing', async () => {
        at('/exotic');
        expect(screen.getByRole('heading', { name: 'Wormhole' })).toBeInTheDocument();
        expect(await screen.findByText('WebGL 2 needed')).toBeInTheDocument();
    });

    it('links to all four objects and marks the one on screen', () => {
        at('/exotic/binary');
        const nav = screen.getByRole('navigation', { name: 'Exotic objects' });
        for (const name of ['Wormhole', 'Neutron star', 'Binary black hole', 'Roche lobe overflow']) {
            expect(nav).toHaveTextContent(name);
        }
        expect(screen.getByRole('link', { name: 'Binary black hole' })).toHaveAttribute('aria-current', 'page');
    });

    it('falls back to the wormhole for an unknown object', () => {
        at('/exotic/quasar');
        expect(screen.getByRole('heading', { name: 'Wormhole' })).toBeInTheDocument();
    });

    it('gives each object its own shots and settings', () => {
        const cases = [
            ['/exotic/wormhole', ['Approach', 'Go through', 'From the other side'], []],
            ['/exotic/neutron-star', ['Side on', 'Over a pole', 'Close in'], ['Pulsar beams and hotspots', 'Latitude and longitude']],
            ['/exotic/binary', ['Edge on', 'From above', 'Close in'], ['Hold the orbit', 'Gas disk round the pair']],
            ['/exotic/roche', ['The system', 'In the orbit’s plane', 'The disk'], []],
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

    it('has the Roche sliders', () => {
        at('/exotic/roche');
        fireEvent.click(screen.getByRole('button', { name: 'Scene settings' }));
        expect(screen.getByRole('slider', { name: 'Mass ratio' })).toHaveValue('0.4');
        expect(screen.getByRole('slider', { name: 'Star temperature' })).toBeInTheDocument();
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
