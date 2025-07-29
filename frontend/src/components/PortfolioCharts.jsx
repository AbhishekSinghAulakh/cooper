// src/components/PortfolioCharts.jsx

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Treemap
} from 'recharts';

// For the Pie Chart (if used for few categories like Accounts/Sectors)
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#83a6ed'];

const PortfolioCharts = ({ portfolioHistory, baseSnapshot, summaryData, groupedPositions }) => {

  // Data for Portfolio Index Line Chart
  // Ensure the data is sorted by date for the line chart
  const sortedHistory = [...portfolioHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
  const portfolioIndexChartData = sortedHistory.map(d => ({
    date: d.date,
    'Portfolio Index': d.portfolio_index_value
  }));

  // Data for Market Value by Sector Treemap (Example)
  // This requires 'groupedPositions' to have sector info for each position
  // And we need to sum market values by sector.
  const marketValueBySector = {};
  groupedPositions.forEach(pos => {
    const sector = pos.sector || 'Uncategorized';
    marketValueBySector[sector] = (marketValueBySector[sector] || 0) + pos.marketValue;
  });
  const treemapData = Object.keys(marketValueBySector).map(sector => ({
    name: sector,
    size: marketValueBySector[sector] // 'size' is the prop Recharts Treemap uses for value
  }));


  // Example for Market Value by Account Pie Chart (if you prefer for few accounts)
  const marketValueByAccount = {};
  groupedPositions.forEach(pos => {
    const account = pos.account || 'Uncategorized';
    marketValueByAccount[account] = (marketValueByAccount[account] || 0) + pos.marketValue;
  });
  const pieChartDataAccounts = Object.keys(marketValueByAccount).map(account => ({
    name: account,
    value: marketValueByAccount[account]
  }));


  return (
    <div className="charts-container">
      {/* 1. Portfolio Index Time-Series Chart */}
      <h3 className="chart-title">Portfolio Index Performance Over Time</h3>
      {baseSnapshot && (
        <div className="base-info">
          <p>
            <strong>Base Date: {baseSnapshot.date}</strong> (Index Value: 100.00)
          </p>
          <p>
            Composition on Base Date: <br />
            Market Value: ₹{baseSnapshot.market_value.toLocaleString('en-IN')} |
            Cost Value: ₹{baseSnapshot.total_cost_value.toLocaleString('en-IN')} |
            Total P&L: ₹{baseSnapshot.total_pnl.toLocaleString('en-IN')}
          </p>
        </div>
      )}

      {portfolioIndexChartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={portfolioIndexChartData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Portfolio Index" stroke="#8884d8" activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p>No historical index data available yet. Take a snapshot to start charting!</p>
      )}

      {/* 2. Treemap for Market Value by Sector (Good for many items and hierarchy) */}
      <h3 className="chart-title">Market Value by Sector</h3>
      {treemapData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <Treemap
            data={treemapData}
            dataKey="size"
            aspectRatio={4/3}
            stroke="#fff"
            fill="#8884d8"
            content={<CustomTreemapContent />}
          >
            <Tooltip content={<CustomTreemapTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      ) : (
        <p>No position data available for sector breakdown.</p>
      )}

      {/* 3. Optional: Market Value by Account Pie Chart (if few accounts, useful composition) */}
      <h3 className="chart-title">Market Value by Account</h3>
      {pieChartDataAccounts.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieChartDataAccounts}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            >
              {pieChartDataAccounts.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <p>No position data available for account breakdown.</p>
      )}

      {/* Add more charts here as needed, e.g., Top/Bottom P&L performers as bar charts */}

    </div>
  );
};

// Custom Treemap Content for Labels
const CustomTreemapContent = (props) => {
  const { depth, x, y, width, height, name, value } = props;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: depth < 2 ? '#fff' : 'rgba(0,0,0,0)',
          stroke: '#fff',
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {width > 50 && height > 20 ? ( // Only show label if box is large enough
        <text
          x={x + width / 2}
          y={y + height / 2 + 7} // Adjust text position for vertical centering
          textAnchor="middle"
          fill="#000"
          fontSize={14}
          fontWeight="bold"
        >
          {name}
        </text>
      ) : null}
      {width > 50 && height > 20 && depth < 2 ? ( // Show value only for top level or if space
        <text
          x={x + width / 2}
          y={y + height / 2 + 25}
          textAnchor="middle"
          fill="#000"
          fontSize={12}
        >
          {`₹${value.toLocaleString('en-IN')}`}
        </text>
      ) : null}
    </g>
  );
};

// Custom Tooltip for Treemap (Optional, but can show more details)
const CustomTreemapTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc' }}>
        <p><strong>{data.name}</strong></p>
        <p>Market Value: ₹{data.size.toLocaleString('en-IN')}</p>
      </div>
    );
  }
  return null;
};


export default PortfolioCharts;