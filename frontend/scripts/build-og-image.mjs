// Regenerates public/og-image.png — the share card link unfurlers show for
// p4rsec.com.  Run with:  node scripts/build-og-image.mjs
//
// The card itself is scripts/og-card.html; this serves frontend/ over HTTP (the
// page reads the scene's textures into a canvas, which file:// would taint) and
// has headless Chrome screenshot it at 1200x630. Needs Google Chrome installed
// (set CHROME to its binary if it is not in the default macOS location) and a
// network connection for the Google Fonts the card uses.
//
// After regenerating, bump the ?v= on og:image and twitter:image in index.html.
// Unfurlers cache the image by URL, often for days.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'public/og-image.png');
const CHROME = process.env.CHROME
    || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TYPES = { '.html': 'text/html', '.jpg': 'image/jpeg', '.png': 'image/png' };

const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    try {
        const body = await readFile(join(ROOT, path));
        res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream' });
        res.end(body);
    } catch {
        res.writeHead(404).end();
    }
});

server.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    execFile(CHROME, [
        '--headless=new',
        '--hide-scrollbars',
        '--window-size=1200,630',
        // The Earth is ray-cast in JS; give it virtual time to finish.
        '--virtual-time-budget=30000',
        `--screenshot=${OUT}`,
        `http://127.0.0.1:${port}/scripts/og-card.html`,
    ], (err) => {
        server.close();
        if (err) {
            console.error(err.message);
            process.exit(1);
        }
        console.log(`wrote ${OUT}`);
    });
});
