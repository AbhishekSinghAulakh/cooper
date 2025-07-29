import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Treemap
} from 'recharts';
import '../App.css';

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A0', '#19FF57',
  '#A020F0', '#FF6347', '#4682B4', '#DA70D6', '#8A2BE2', '#D2B48C', '#F08080'
];

const CustomTreemapContent = (props) => {
  const { depth, x, y, width, height, name, value, color } = props;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: color,
          stroke: '#fff',
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {/* Show name if space permits */}
      {width > 50 && height > 20 ? (
        <text
          x={x + width / 2}
          y={y + height / 2 - 5}
          textAnchor="middle"
          fill="#fff"
          fontSize={14}
          fontWeight="bold"
        >
          {name}
        </text>
      ) : null}
      {/* Show value if space permits */}
      {width > 50 && height > 40 ? (
        <text
          x={x + width / 2}
          y={y + height / 2 + 15}
          textAnchor="middle"
          fill="#fff"
          fontSize={12}
        >
          {`₹${value.toLocaleString('en-IN')}`}
        </text>
      ) : null}
    </g>
  );
};

const CustomTreemapTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc', color: '#333' }}>
        <p><strong>{data.name}</strong></p>
        <p>Market Value: ₹{data.size.toLocaleString('en-IN')}</p>
      </div>
    );
  }
  return null;
};


const Analysis = () => {
  const [openPositions, setOpenPositions] = useState([]);
  const [closedPositions, setClosedPositions] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const openRes = await axios.get("http://localhost:8000/positions");
        const processedOpenPositions = openRes.data.map(pos => ({
          ...pos,
          marketValue: parseFloat(pos.marketValue) || 0
        }));
        setOpenPositions(processedOpenPositions);

        const closedRes = await axios.get("http://localhost:8000/realised");
        setClosedPositions(closedRes.data);
      } catch (err) {
        console.error("Error fetching data for analysis:", err);
      }
    };
    fetchData();
  }, []);

  // --- Data preparation for Open Positions ---

  // PnL by Symbol (Open Positions) - Bar chart
  const openPnlData = openPositions.map(pos => ({
    symbol: pos.symbol,
    pnl: pos.pnl
  }));

  // Sector Exposure (Open Positions - Market Value) - Pie chart (This was the one removed)
  // No longer needed:
  // const openSectorExposure = openPositions.reduce((acc, pos) => {
  //   acc[pos.sector || 'Uncategorized'] = (acc[pos.sector || 'Uncategorized'] || 0) + pos.marketValue;
  //   return acc;
  // }, {});
  // const openSectorData = Object.keys(openSectorExposure).map(sector => ({
  //   name: sector,
  //   value: parseFloat(openSectorExposure[sector].toFixed(2))
  // }));

  // Age of Positions (Open Positions - Categorized by days) - Bar chart
  const openPosAgeData = openPositions.reduce((acc, pos) => {
    const ageInDays = parseFloat(pos.pos_age);

    let category = "Unknown/Invalid Age";
    if (!isNaN(ageInDays) && ageInDays >= 0) {
      if (ageInDays <= 90) {
        category = "<= 90 Days";
      } else if (ageInDays <= 180) {
        category = "91-180 Days";
      } else if (ageInDays <= 365) {
        category = "181-365 Days";
      } else {
        category = "> 365 Days";
      }
    }
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const openPosAgeChartData = Object.keys(openPosAgeData).map(age => ({
    name: age,
    value: openPosAgeData[age]
  })).sort((a, b) => {
    const order = {
      "<= 90 Days": 1,
      "91-180 Days": 2,
      "181-365 Days": 3,
      "> 365 Days": 4,
      "Unknown/Invalid Age": 99
    };
    return (order[a.name] || 99) - (order[b.name] || 99);
  });


  // TVM Grade (Open Positions) - Pie chart
  const openTvmGrades = openPositions.reduce((acc, pos) => {
    let grade = "N/A";
    if (pos.tvm !== null && pos.tvm !== undefined) {
      const tvmValue = parseFloat(pos.tvm);
      if (!isNaN(tvmValue)) {
        if (tvmValue >= 10) grade = "Excellent";
        else if (tvmValue >= 5) grade = "Good";
        else if (tvmValue >= 1) grade = "Fair";
        else grade = "Poor";
      }
    }
    acc[grade] = (acc[grade] || 0) + 1;
    return acc;
  }, {});

  const openTvmChartData = Object.keys(openTvmGrades).map(grade => ({
    name: grade,
    value: openTvmGrades[grade]
  }));

  // --- DATA PREP FOR NEW CHARTS IN ANALYSIS.JSX (from previous PortfolioCharts.jsx) ---

  // UPDATED: Data for Market Value by Sector Treemap - now includes color assignment
  const marketValueBySectorForTreemap = openPositions.reduce((acc, pos) => {
    const sector = pos.sector || 'Uncategorized';
    acc[sector] = (acc[sector] || 0) + pos.marketValue;
    return acc;
  }, {});

  const treemapData = Object.keys(marketValueBySectorForTreemap).map((sector, index) => ({
    name: sector,
    size: marketValueBySectorForTreemap[sector],
    color: COLORS[index % COLORS.length] // Assign a color from the COLORS array
  }));

  // Data for Market Value by Account Pie Chart
  const marketValueByAccount = openPositions.reduce((acc, pos) => {
    const account = pos.account || 'Uncategorized';
    acc[account] = (acc[account] || 0) + pos.marketValue;
    return acc;
  }, {});
  const pieChartDataAccounts = Object.keys(marketValueByAccount).map(account => ({
    name: account,
    value: marketValueByAccount[account]
  }));

  // --- END NEW DATA PREP ---


  // --- Data preparation for Closed Positions ---

  // PnL Distribution (Closed Positions) - Bar Chart
  const closedPnlData = closedPositions.map(pos => ({
    symbol: pos.symbol,
    pnl: pos.total_pnl
  }));

  // Sector Performance (Closed Positions - Total PnL by sector) - Pie chart
  const closedSectorPerformance = closedPositions.reduce((acc, pos) => {
    acc[pos.sector || 'Uncategorized'] = (acc[pos.sector || 'Uncategorized'] || 0) + pos.total_pnl;
    return acc;
  }, {});
  const closedSectorPerformanceData = Object.keys(closedSectorPerformance).map(sector => ({
    name: sector,
    value: parseFloat(closedSectorPerformance[sector].toFixed(2))
  }));

  return (
    <div className="analysis-container">
      <h2>Portfolio Analysis</h2>

      <div className="chart-section">
        <h3>Open Positions Analysis</h3>

        {/* UPDATED: Treemap for Market Value by Sector */}
        <div className="chart-wrapper">
          <h4>Market Value by Sector (Composition)</h4>
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
        </div>

        {/* NEW: Market Value by Account Pie Chart */}
        <div className="chart-wrapper">
          <h4>Market Value by Account (Composition)</h4>
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
        </div>

        {/* Existing Open Positions Charts (excluding the removed one) */}
        <div className="chart-wrapper">
          <h4>P&L by Symbol</h4>
          {openPnlData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={openPnlData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="symbol" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="pnl" fill="#8884d8" name="P&L (₹)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p>No data available for P&L by Symbol.</p>
          )}
        </div>

        {/* REMOVED: Sector Exposure (Market Value) - Original Pie */}
        {/*
        <div className="chart-wrapper">
          <h4>Sector Exposure (Market Value) - Original Pie</h4>
          {openSectorData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={openSectorData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {openSectorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p>No data available for Sector Exposure.</p>
          )}
        </div>
        */}

        <div className="chart-wrapper">
          <h4>Age of Open Positions</h4>
          {openPosAgeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={openPosAgeChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#82ca9d" name="Number of Positions" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p>No data available for Age of Open Positions.</p>
          )}
        </div>

        <div className="chart-wrapper">
          <h4>TVM Grade Distribution (Open Positions)</h4>
          {openTvmChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={openTvmChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {openTvmChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p>No data available for TVM Grade Distribution.</p>
          )}
        </div>
      </div>

      <hr />

      <div className="chart-section">
        <h3>Closed Positions Analysis</h3>

        <div className="chart-wrapper">
          <h4>P&L Distribution (Closed Positions)</h4>
          {closedPnlData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={closedPnlData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="symbol" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="pnl" fill="#ff7300" name="Realised P&L (₹)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p>No data available for P&L Distribution.</p>
          )}
        </div>

        <div className="chart-wrapper">
          <h4>Sector Performance (Closed Positions - Total P&L)</h4>
          {closedSectorPerformanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={closedSectorPerformanceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {closedSectorPerformanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p>No data available for Sector Performance.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Analysis;