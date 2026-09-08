import { describe, it, expect, beforeEach } from 'vitest';
import { syncDocumentHead } from './documentHead';

describe('syncDocumentHead', () => {
    beforeEach(() => {
        document.head.querySelector('link[rel="canonical"]')?.remove();
        document.title = '';
    });

    it('sets the document title', () => {
        syncDocumentHead({ title: 'Jupiter — P4RSEC', canonicalPath: '/object/jupiter' });
        expect(document.title).toBe('Jupiter — P4RSEC');
    });

    it('creates a single canonical link and keeps updating the same one', () => {
        syncDocumentHead({ title: 'a', canonicalPath: '/' });
        syncDocumentHead({ title: 'b', canonicalPath: '/?tab=moons' });
        const links = document.head.querySelectorAll('link[rel="canonical"]');
        expect(links).toHaveLength(1);
        expect(links[0].href).toBe(window.location.origin + '/?tab=moons');
    });

    it('canonicalises to the current pathname when no path is given', () => {
        syncDocumentHead({ title: 'x' });
        expect(document.head.querySelector('link[rel="canonical"]').href)
            .toBe(window.location.origin + window.location.pathname);
    });
});
