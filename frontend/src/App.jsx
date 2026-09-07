import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import CategoryBrowser from './pages/CategoryBrowser';
import SatelliteView from './pages/SatelliteView';
import ComparePage from './pages/ComparePage';

function App() {
    return (
        <ErrorBoundary>
            <Router>
                <Routes>
                    <Route path="/satellites" element={<AppShell><SatelliteView /></AppShell>} />
                    <Route path="/compare" element={<AppShell><ComparePage /></AppShell>} />
                    {/* Single route so AppShell + CategoryBrowser + SolarSystem3D are never
                        remounted during navigation — preserves Three.js camera state and
                        allows smooth exit animations when returning to the solar system. */}
                    <Route path="*" element={<AppShell><CategoryBrowser /></AppShell>} />
                </Routes>
            </Router>
        </ErrorBoundary>
    );
}

export default App;
