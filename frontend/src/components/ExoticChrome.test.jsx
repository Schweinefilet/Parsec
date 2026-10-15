import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExoticFoot } from './ExoticChrome';

describe('ExoticFoot', () => {
    it('never breaks a line between a number and its unit, in any script', () => {
        render(<ExoticFoot credit="" readouts={[
            ['a', '72 khung/giây · 1,3 megapixel'],
            ['b', '٧٢ إطار/ث'],
            ['c', '50% bound · 0% swallowed'],
        ]} />);
        expect(screen.getByText(/khung/).textContent).toBe('72 khung/giây · 1,3 megapixel');
        expect(screen.getByText(/إطار/).textContent).toBe('٧٢ إطار/ث');
        expect(screen.getByText(/bound/).textContent).toBe('50% bound · 0% swallowed');
    });
});
