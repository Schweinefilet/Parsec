import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import CategoryBrowser from './pages/CategoryBrowser';
import ObjectDetail from './pages/ObjectDetail';

function App() {
    return (
        <Router>
            <Routes>
                {/* Single route so AppShell + CategoryBrowser + SolarSystem3D are never
                    remounted during navigation — preserves Three.js camera state and
                    allows smooth exit animations when returning to the solar system. */}
                <Route path="*" element={<AppShell><CategoryBrowser /></AppShell>} />
            </Routes>
        </Router>
    );
}

export default App;
