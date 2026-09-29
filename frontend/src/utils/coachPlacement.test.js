import { describe, it, expect } from 'vitest';
import { freeRun, coachMaxWidth, placeCoach, GUTTER, GAP } from './coachPlacement';

const PHONE = { width: 390, height: 844 };
const rect = (left, top, right, bottom) => ({ left, top, right, bottom });

// The controls as they sit on a 390px phone, from the real layout.
const BURGER = rect(290, 10, 326, 46);
const TIME_PILL = rect(12, 718, 378, 764);
const EXPLORE = rect(12, 683, 210, 714);
const SETTINGS_TAB = rect(12, 641, 46, 675);

describe('placeCoach: above and below', () => {
    it('keeps a tip for a control at the screen edge on the screen, aimed at the control', () => {
        // This is the burger tip. It used to be laid out at left:308px and
        // sized to the 82px to its right.
        const size = { w: 190, h: 36 };
        const p = placeCoach({ target: BURGER, size, viewport: PHONE, side: 'below' });
        expect(p.side).toBe('below');
        expect(p.left + size.w).toBe(PHONE.width - GUTTER);
        expect(p.top).toBe(BURGER.bottom + GAP);
        // The nub still lands on the burger's centre even though the tip slid left.
        expect(p.left + p.nub).toBe(308);
    });

    it('never crosses a gutter, wherever the target is', () => {
        const size = { w: 200, h: 40 };
        for (let x = 0; x <= PHONE.width; x += 5) {
            const target = rect(x - 18, 300, x + 18, 336);
            for (const side of ['above', 'below']) {
                const p = placeCoach({ target, size, viewport: PHONE, side });
                expect(p.left).toBeGreaterThanOrEqual(GUTTER);
                expect(p.left + size.w).toBeLessThanOrEqual(PHONE.width - GUTTER);
                expect(p.nub).toBeGreaterThanOrEqual(16);
                expect(p.nub).toBeLessThanOrEqual(size.w - 16);
            }
        }
    });

    it('flips to the other side when there is no room on the asked-for one', () => {
        const size = { w: 150, h: 40 };
        const nearTop = rect(150, 6, 190, 40);
        expect(placeCoach({ target: nearTop, size, viewport: PHONE, side: 'above' }).side).toBe('below');
        const nearBottom = rect(150, 800, 190, 836);
        expect(placeCoach({ target: nearBottom, size, viewport: PHONE, side: 'below' }).side).toBe('above');
    });

    it('stays where it was asked when neither side has room', () => {
        const short = { width: 390, height: 60 };
        const p = placeCoach({ target: rect(150, 10, 190, 50), size: { w: 150, h: 40 }, viewport: short, side: 'below' });
        expect(p.side).toBe('below');
    });
});

describe('avoiding a neighbour', () => {
    // The speed tip: it points at the time pill, and the Explore pill sits
    // directly above that pill's left half. It used to print over it.
    const overlaps = (a, b) => a.left < b.right && a.right > b.left;

    it('slides to the clear side of the pill', () => {
        const size = { w: 150, h: 44 };
        const p = placeCoach({ target: TIME_PILL, size, viewport: PHONE, side: 'above', avoid: [EXPLORE] });
        expect(overlaps({ left: p.left, right: p.left + size.w }, EXPLORE)).toBe(false);
        expect(p.left).toBeGreaterThanOrEqual(EXPLORE.right);
        expect(p.left + size.w).toBeLessThanOrEqual(PHONE.width - GUTTER);
    });

    it('mirrors in a right-to-left layout, where the pill is on the right', () => {
        const explore = rect(180, 683, 378, 714);
        const size = { w: 150, h: 44 };
        const p = placeCoach({ target: TIME_PILL, size, viewport: PHONE, side: 'above', avoid: [explore] });
        expect(p.left + size.w).toBeLessThanOrEqual(explore.left);
        expect(p.left).toBeGreaterThanOrEqual(GUTTER);
    });

    it('narrows the tip to the room that is left', () => {
        expect(freeRun({ target: TIME_PILL, viewport: PHONE, avoid: [EXPLORE] })).toEqual([218, 378]);
        expect(coachMaxWidth({ target: TIME_PILL, viewport: PHONE, side: 'above', avoid: [EXPLORE] })).toBe(160);
        // A 360px phone has less of it.
        const small = { width: 360, height: 740 };
        const pill = rect(12, 614, 348, 660);
        const explore = rect(12, 579, 210, 610);
        expect(coachMaxWidth({ target: pill, viewport: small, side: 'above', avoid: [explore] })).toBe(130);
    });

    it('takes the run nearest the target when an obstruction splits the screen', () => {
        const middle = rect(150, 600, 240, 640);
        const left = rect(20, 700, 60, 740);
        const right = rect(330, 700, 370, 740);
        expect(freeRun({ target: left, viewport: PHONE, avoid: [middle] })[1]).toBe(142);
        expect(freeRun({ target: right, viewport: PHONE, avoid: [middle] })[0]).toBe(248);
    });

    it('ignores an obstruction that covers everything rather than returning nothing', () => {
        const wall = rect(0, 0, 390, 100);
        expect(freeRun({ target: BURGER, viewport: PHONE, avoid: [wall] })).toEqual([12, 378]);
    });
});

describe('placeCoach: left and right', () => {
    it('sits beside the target, centred on it, and aims the nub at it', () => {
        const size = { w: 150, h: 40 };
        const p = placeCoach({ target: SETTINGS_TAB, size, viewport: PHONE, side: 'right' });
        expect(p.left).toBe(SETTINGS_TAB.right + GAP);
        expect(p.top + p.nub).toBe((SETTINGS_TAB.top + SETTINGS_TAB.bottom) / 2);
    });

    it('sits on the left of a target in a right-to-left layout', () => {
        const target = rect(344, 641, 378, 675);
        const size = { w: 150, h: 40 };
        const p = placeCoach({ target, size, viewport: PHONE, side: 'left' });
        expect(p.left + size.w).toBe(target.left - GAP);
    });

    it('slides up off a neighbour below it, and keeps the nub on the target', () => {
        // Two lines tall and centred on the settings tab, the tip's lower edge
        // landed on the Explore pill directly beneath the tab.
        const size = { w: 150, h: 56 };
        const plain = placeCoach({ target: SETTINGS_TAB, size, viewport: PHONE, side: 'right' });
        expect(plain.top + size.h).toBeGreaterThan(EXPLORE.top);
        const p = placeCoach({ target: SETTINGS_TAB, size, viewport: PHONE, side: 'right', avoid: [EXPLORE] });
        expect(p.top + size.h).toBeLessThanOrEqual(EXPLORE.top);
        expect(p.top + p.nub).toBe((SETTINGS_TAB.top + SETTINGS_TAB.bottom) / 2);
    });

    it('leaves a neighbour it does not come near alone', () => {
        // 28px tall, centred on the tab, ends at 672: clear of the pill's
        // 683 with the margin to spare.
        const size = { w: 150, h: 28 };
        const plain = placeCoach({ target: SETTINGS_TAB, size, viewport: PHONE, side: 'right' });
        const p = placeCoach({ target: SETTINGS_TAB, size, viewport: PHONE, side: 'right', avoid: [EXPLORE] });
        expect(p.top).toBe(plain.top);
    });

    it('stays inside the gutters vertically', () => {
        const size = { w: 150, h: 60 };
        const high = placeCoach({ target: rect(12, 0, 46, 30), size, viewport: PHONE, side: 'right' });
        expect(high.top).toBe(GUTTER);
        const low = placeCoach({ target: rect(12, 814, 46, 844), size, viewport: PHONE, side: 'right' });
        expect(low.top + size.h).toBe(PHONE.height - GUTTER);
    });

    it('caps the width at the room between the target and the far edge', () => {
        expect(coachMaxWidth({ target: SETTINGS_TAB, viewport: PHONE, side: 'right', cap: 400 })).toBe(322);
        expect(coachMaxWidth({ target: SETTINGS_TAB, viewport: PHONE, side: 'right', cap: 190 })).toBe(190);
        expect(coachMaxWidth({ target: rect(344, 641, 378, 675), viewport: PHONE, side: 'left', cap: 400 })).toBe(322);
    });
});
