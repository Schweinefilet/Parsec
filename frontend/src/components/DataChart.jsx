import React from 'react';
import OrbitalChart from './OrbitalChart';

// Semantic wrapper over OrbitalChart for displaying a single astronomy data series.
// Accepts {time (unix seconds), value} data points and renders as an area chart.
const DataChart = ({ data, color = '#ffffff', onCrosshairMove }) => {
    if (!data || data.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center"
                style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                No data available for this object type
            </div>
        );
    }

    return (
        <OrbitalChart
            data={data}
            chartType="area"
            panes={[]}
            overlays={[]}
            color={color}
            onCrosshairMove={onCrosshairMove}
        />
    );
};

export default DataChart;
