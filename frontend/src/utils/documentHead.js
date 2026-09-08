// Per-route <title> and <link rel="canonical">.
//
// There is no server render, so index.html ships one static title and no
// canonical at all — every route looked identical to a crawler or a link
// unfurler, and a preview domain or a localhost mirror would compete with the
// real page for the same content. This keeps both in step with the route.
//
// The caller composes the title string (it has the translator); this only
// writes it and maintains the canonical link.

/**
 * @param {object} head
 * @param {string} head.title          the full document title to set
 * @param {string} [head.canonicalPath]  path (+ optional search) the page
 *                                       canonicalises to, e.g. "/",
 *                                       "/object/jupiter", "/?tab=moons".
 *                                       Defaults to the current pathname.
 */
export function syncDocumentHead({ title, canonicalPath } = {}) {
    if (typeof document === 'undefined') return;

    if (title) document.title = title;

    const path = canonicalPath ?? window.location.pathname;
    // origin + path: correct on the deployed origin, harmless on localhost or a
    // preview domain (neither of which is crawled).
    const href = window.location.origin + path;

    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
    }
    link.href = href;
}
