import '@testing-library/jest-dom/vitest';

// jsdom has no canvas or WebGL. Components under test never render the 3D
// scene, but shared modules (procedural textures) do touch a 2D context, so
// hand them a stub that records nothing and throws nowhere.
const ctx2d = new Proxy({}, {
    get: (_t, prop) => {
        if (prop === 'canvas') return { width: 0, height: 0 };
        if (prop === 'createRadialGradient' || prop === 'createLinearGradient') {
            return () => ({ addColorStop() {} });
        }
        return () => {};
    },
});
HTMLCanvasElement.prototype.getContext = function getContext(kind) {
    return kind === '2d' ? ctx2d : null;
};
HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';

if (!window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false, media: query, onchange: null,
        addEventListener() {}, removeEventListener() {},
        addListener() {}, removeListener() {}, dispatchEvent: () => false,
    });
}

global.ResizeObserver ??= class {
    observe() {} unobserve() {} disconnect() {}
};
