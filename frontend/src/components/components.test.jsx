import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ObjectCard from './ObjectCard';
import ObjectStatsPanel from './ObjectStatsPanel';
import ObjectSearch from './ObjectSearch';
import ErrorBoundary from './ErrorBoundary';
import DistanceChart from './DistanceChart';
import { OBJECTS, getObjectById } from '../data/objectCatalog';

afterEach(cleanup);

const withRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ObjectCard', () => {
    it('shows the name, type and key stat', () => {
        withRouter(<ObjectCard object={getObjectById('saturn')} />);
        expect(screen.getByText('Saturn')).toBeInTheDocument();
        expect(screen.getByText('Gas Giant')).toBeInTheDocument();
        expect(screen.getByText('29.46 years')).toBeInTheDocument();
    });

    it('renders generated art instead of an image when none is curated', () => {
        // Tiangong has no usable NASA image, so it must fall back rather than
        // render a broken <img>
        const { container } = withRouter(<ObjectCard object={getObjectById('tiangong')} />);
        expect(container.querySelector('img')).toBeNull();
        expect(screen.getByText('Tiangong Space Station')).toBeInTheDocument();
    });

    it('falls back to generated art if the image fails to load', () => {
        const { container } = withRouter(<ObjectCard object={getObjectById('saturn')} />);
        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        fireEvent.error(img);
        expect(container.querySelector('img')).toBeNull();
    });

    it('exposes an accessible name', () => {
        withRouter(<ObjectCard object={getObjectById('mars')} />);
        expect(screen.getByRole('button', { name: /Mars/ })).toBeInTheDocument();
    });

    it('renders every catalog object without throwing', () => {
        for (const object of OBJECTS) {
            const { unmount } = withRouter(<ObjectCard object={object} />);
            unmount();
        }
    });
});

describe('ObjectStatsPanel', () => {
    it('shows the first section by default and switches tabs', () => {
        render(<ObjectStatsPanel object={getObjectById('earth')} />);
        expect(screen.getByRole('tab', { name: 'Physical' })).toHaveAttribute('aria-selected', 'true');
        fireEvent.click(screen.getByRole('tab', { name: 'Orbital' }));
        expect(screen.getByRole('tab', { name: 'Orbital' })).toHaveAttribute('aria-selected', 'true');
    });

    it('renders unicode superscripts as real sup elements', () => {
        const { container } = render(<ObjectStatsPanel object={getObjectById('earth')} />);
        const sup = container.querySelector('sup');
        expect(sup).not.toBeNull();
        expect(sup.textContent).toMatch(/^\d+$/);
    });

    it('handles an object with no stats', () => {
        render(<ObjectStatsPanel object={{ id: 'x', name: 'X' }} />);
        expect(screen.getByText('No stats available.')).toBeInTheDocument();
    });

    it('renders every catalog object without throwing', () => {
        for (const object of OBJECTS) {
            const { unmount } = render(<ObjectStatsPanel object={object} />);
            unmount();
        }
    });
});

describe('ObjectSearch', () => {
    it('offers popular objects before anything is typed', () => {
        withRouter(<ObjectSearch />);
        fireEvent.focus(screen.getByRole('combobox'));
        expect(screen.getByText('Popular')).toBeInTheDocument();
    });

    it('ranks an exact prefix above a longer name', () => {
        withRouter(<ObjectSearch />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tita' } });
        const options = screen.getAllByRole('option');
        expect(options[0].textContent).toContain('Titan');
        expect(options[1].textContent).toContain('Titania');
    });

    it('finds an object by an alias rather than its catalog name', () => {
        withRouter(<ObjectSearch />);
        // Luna is listed as "Luna"; most people type "moon"
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'moon' } });
        expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
    });

    it('says so when nothing matches', () => {
        withRouter(<ObjectSearch />);
        fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzzzzz' } });
        expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
    });

    it('moves the active option with the arrow keys', () => {
        withRouter(<ObjectSearch />);
        const input = screen.getByRole('combobox');
        fireEvent.change(input, { target: { value: 'ti' } });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    });
});

describe('ErrorBoundary', () => {
    const Boom = () => { throw new Error('boom'); };

    it('catches a render error and offers a way out', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        render(<ErrorBoundary><Boom /></ErrorBoundary>);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reload/ })).toBeInTheDocument();
        spy.mockRestore();
    });

    it('renders children when nothing throws', () => {
        render(<ErrorBoundary><p>fine</p></ErrorBoundary>);
        expect(screen.getByText('fine')).toBeInTheDocument();
    });
});

describe('DistanceChart', () => {
    const series = Array.from({ length: 40 }, (_, i) => ({
        time: 1700000000 + i * 86400, value: 1 + Math.sin(i / 5) * 0.2,
    }));

    it('draws a labelled chart', () => {
        render(<DistanceChart data={series} color="rgb(255,255,255)" />);
        expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('degrades gracefully with too few points', () => {
        render(<DistanceChart data={[{ time: 1, value: 1 }]} />);
        expect(screen.getByText(/Not enough data/)).toBeInTheDocument();
    });

    it('survives a completely flat series without dividing by zero', () => {
        const flat = Array.from({ length: 10 }, (_, i) => ({ time: 1700000000 + i * 86400, value: 5 }));
        const { container } = render(<DistanceChart data={flat} />);
        expect(container.querySelector('path')?.getAttribute('d') ?? '').not.toContain('NaN');
    });
});
