// File: src/pages/Dividends.jsx

import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell
} from 'recharts';
import '../App.css'; // For general styling

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A0', '#19FF57',
  '#A020F0', '#FF6347', '#4682B4', '#DA70D6', '#8A2BE2', '#D2B48C', '#F08080'
];

const Dividends = () => {
  const [rawDividends, setRawDividends] = useState([]);
  const [chartData, setChartData] = useState([]); // For Total Amount by Ticker
  const [yearlyChartData, setYearlyChartData] = useState([]); // For Dividends by Year
  const [totalDividendEarned, setTotalDividendEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ⚡️ NEW: State for filters ⚡️
  const [groupBy, setGroupBy] = useState('none'); // 'none', 'ticker', 'sector', 'year'
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDividendsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get("http://localhost:8000/dividends");
      setRawDividends(response.data.raw_data);
      setChartData(response.data.chart_data);
      setYearlyChartData(response.data.dividends_by_year);
      setTotalDividendEarned(response.data.total_dividend_earned);
    } catch (err) {
      console.error("Error fetching dividends data:", err);
      setError("Failed to load dividends data. Please check the backend server and Excel file.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDividendsData();
  }, []);

  const handleRefreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      await axios.post("http://localhost:8000/reload-dividends-data");
      await fetchDividendsData(); // Re-fetch all data after reload
      alert("Dividend data refreshed successfully!");
    } catch (err) {
      console.error("Error reloading dividends data:", err);
      setError("Failed to reload dividends data. Check backend logs.");
      alert("Error reloading dividend data.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (isNaN(value)) return 'N/A';
    return `₹${parseFloat(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ⚡️ NEW: Memoized filtered and grouped data for the table ⚡️
  const filteredAndGroupedDividends = useMemo(() => {
    let currentData = rawDividends;

    // Apply search filter
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      currentData = currentData.filter(record =>
        record.ticker && record.ticker.toLowerCase().includes(lowerCaseSearchTerm)
      );
    }

    // Apply group by logic
    if (groupBy !== 'none' && currentData.length > 0) {
      const grouped = {};
      currentData.forEach(record => {
        let key;
        let displayKey;

        switch (groupBy) {
          case 'ticker':
            key = record.ticker || 'N/A Ticker';
            displayKey = key;
            break;
          case 'sector':
            key = record.sector || 'N/A Sector';
            displayKey = key;
            break;
          case 'year':
            key = record.date_of_disbur ? new Date(record.date_of_disbur).getFullYear() : 'N/A Year';
            displayKey = key;
            break;
          default:
            key = 'none'; // Should not happen with current logic
            displayKey = 'none';
        }

        if (!grouped[key]) {
          grouped[key] = {
            [groupBy]: displayKey,
            total_amount: 0,
            count: 0,
            // To show a representative date if grouped by ticker/sector
            first_record_date: record.date_of_disbur,
            // Add other fields you might want to display for grouped rows
          };
        }
        grouped[key].total_amount += record.amount || 0;
        grouped[key].count += 1;
      });

      // Convert grouped object back to array
      const groupedArray = Object.values(grouped);

      // Sort grouped array
      if (groupBy === 'year') {
        groupedArray.sort((a, b) => a.year - b.year);
      } else {
        groupedArray.sort((a, b) => String(a[groupBy]).localeCompare(String(b[groupBy])));
      }
      return groupedArray;

    } else {
      // If no grouping, just sort the filtered raw data by date
      return [...currentData].sort((a, b) => {
        const dateA = a.date_of_disbur ? new Date(a.date_of_disbur) : new Date(0);
        const dateB = b.date_of_disbur ? new Date(b.date_of_disbur) : new Date(0);
        return dateB - dateA; // Descending order
      });
    }
  }, [rawDividends, groupBy, searchTerm]);


  if (loading) {
    return <div className="loading-message">Loading dividends data...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="dividends-container">
      <h2>Dividend Income</h2>

      <div className="total-dividend-banner">
        Total Dividend Earned: <strong>{formatCurrency(totalDividendEarned)}</strong>
      </div>

      <button onClick={handleRefreshData} className="refresh-button">
        Refresh Dividend Data from Excel
      </button>

      {/* Chart Section: Total Dividend Amount by Ticker */}
      <div className="chart-section">
        <h3>Total Dividend Amount by Ticker (Excluding HISTDIVIDENDS)</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ticker" />
              <YAxis tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="total_amount" name="Total Dividend (₹)">
                {
                  chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))
                }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>No dividend data available to chart by ticker (after excluding HISTDIVIDENDS).</p>
        )}
      </div>

      {/* Chart Section: Dividends by Year */}
      <div className="chart-section">
        <h3>Dividend Income by Year</h3>
        {yearlyChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={yearlyChartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="total_amount" name="Total Dividend (₹)" fill="#82ca9d">
                {
                  yearlyChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))
                }
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p>No dividend data available to chart by year.</p>
        )}
      </div>

      {/* ⚡️ NEW: Filter Controls ⚡️ */}
      <div className="filter-controls">
        <label>
          Group By:
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
            <option value="none">None</option>
            <option value="ticker">Ticker</option>
            <option value="sector">Sector</option>
            <option value="year">Year</option>
          </select>
        </label>
        <label>
          Search Ticker:
          <input
            type="text"
            placeholder="Search by Ticker"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </label>
      </div>

      {/* Raw Data Table Section */}
      <div className="table-responsive">
        <h3>All Dividend Records</h3>
        {filteredAndGroupedDividends.length > 0 ? (
          <table>
            <thead>
              <tr>
                {groupBy === 'none' && <th>Ticker</th>}
                {groupBy === 'none' && <th>Record Date</th>}
                {groupBy === 'none' && <th>Rs per Share</th>}
                {groupBy === 'none' && <th>Qty</th>}
                {groupBy === 'none' && <th>Sector</th>}
                {groupBy !== 'none' && <th>{groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}</th>}
                <th>Total Amount</th>
                {groupBy !== 'none' && <th>Number of Records</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAndGroupedDividends.map((record, index) => (
                <tr key={index}>
                  {groupBy === 'none' && <td>{record.ticker}</td>}
                  {groupBy === 'none' && <td>{record.date_of_disbur}</td>}
                  {groupBy === 'none' && <td>{formatCurrency(record.rs_per_share)}</td>}
                  {groupBy === 'none' && <td>{record.qty}</td>}
                  {groupBy === 'none' && <td>{record.sector}</td>}
                  {groupBy !== 'none' && <td>{record[groupBy]}</td>}
                  <td>{formatCurrency(record.total_amount || record.amount)}</td> {/* Use total_amount for grouped, amount for raw */}
                  {groupBy !== 'none' && <td>{record.count}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No dividend records found based on current filters.</p>
        )}
      </div>
    </div>
  );
};

export default Dividends;
