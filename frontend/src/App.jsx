import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import CategoryBrowser from './pages/CategoryBrowser';
import ObjectDetail from './pages/ObjectDetail';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<AppShell><CategoryBrowser /></AppShell>} />
                <Route path="/object/:id" element={<AppShell><CategoryBrowser /></AppShell>} />
            </Routes>
        </Router>
    );
}

export default App;
