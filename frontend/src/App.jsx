import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import CategoryBrowser from './pages/CategoryBrowser';
import SatelliteView from './pages/SatelliteView';
import ComparePage from './pages/ComparePage';
import TonightPage from './pages/TonightPage';

// The one lazily-loaded route in the app. /sky carries its own three.js scene
// plus a real data catalog (the star field + constellation lines, ~175 KB
// gzipped) — a cost every other route already avoids paying, and one that
// should only be spent by a visitor who actually navigates here. Every other
// page above is small enough, and used often enough from the header nav, that
// splitting it would just trade a bit of bundle size for a loading flicker on
// first click.
const NightSkyPage = lazy(() => import('./pages/NightSkyPage'));

function App() {
    return (
        <ErrorBoundary>
            <Router>
                <Routes>
                    <Route path="/satellites" element={<AppShell><SatelliteView /></AppShell>} />
                    <Route path="/compare" element={<AppShell><ComparePage /></AppShell>} />
                    <Route path="/tonight" element={<AppShell><TonightPage /></AppShell>} />
                    <Route
                        path="/sky"
                        element={(
                            <AppShell>
                                <Suspense fallback={<NightSkyFallback />}>
                                    <NightSkyPage />
                                </Suspense>
                            </AppShell>
                        )}
                    />
                    {/* Single route so AppShell + CategoryBrowser + SolarSystem3D are never
                        remounted during navigation — preserves Three.js camera state and
                        allows smooth exit animations when returning to the solar system. */}
                    <Route path="*" element={<AppShell><CategoryBrowser /></AppShell>} />
                </Routes>
            </Router>
        </ErrorBoundary>
    );
}

// Deliberately not LoadingScreen — that component is wired to the solar
// system's own assetLoading.js boot sequence (texture progress, the "fly to
// header" animation) and reusing it here would mean either dragging that
// coupling into an unrelated page or stubbing it out. A plain centred spinner
// is honest about what's actually happening: one lazy chunk resolving.
const NightSkyFallback = () => (
    <div style={{
        position: 'relative', minHeight: 'var(--app-vh, 100vh)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
        <div
            aria-hidden="true"
            style={{
                width: 34, height: 34, borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.14)',
                borderTopColor: 'rgba(255,255,255,0.6)',
                animation: 'spin 0.8s linear infinite',
            }}
        />
    </div>
);

export default App;
