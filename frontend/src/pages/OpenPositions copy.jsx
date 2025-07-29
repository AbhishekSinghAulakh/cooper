// File: src/pages/OpenPositions.jsx

import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import "../App.css";
// import PortfolioCharts from "../components/PortfolioCharts.jsx"; // ⚡️ REMOVE OR COMMENT OUT THIS LINE ⚡️

// ⚡️ NEW: Recharts imports for the LineChart ⚡️
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const OpenPositions = () => {
  const [grouped, setGrouped] = useState([]);
  const [manualPrices, setManualPrices] = useState({});
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedPositionForSell, setSelectedPositionForSell] = useState(null);
  const [sellDate, setSellDate] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [groupingOption, setGroupingOption] = useState("None");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [symbolSearchTerm, setSymbolSearchTerm] = useState("");
  const [accountSearchTerm, setAccountSearchTerm] = useState("");
  const [pnlFilter, setPnlFilter] = useState("All");

  const [businessDate, setBusinessDate] = useState('');
  const [portfolioIndex, setPortfolioIndex] = useState(0);
  const [netCashFlow, setNetCashFlow] = useState(0.0);
  const [livePortfolioIndex, setLivePortfolioIndex] = useState(0.0);

  // --- ⚡️ KEEP STATE FOR PORTFOLIO HISTORY & BASE SNAPSHOT ⚡️ ---
  const [portfolioHistory, setPortfolioHistory] = useState([]);
  const [baseSnapshot, setBaseSnapshot] = useState(null);


  const loadPositions = async () => {
    try {
      const res = await axios.get("http://localhost:8000/positions");
      setGrouped(res.data);
      console.log("Open positions data from Excel:", res.data);
    } catch (err) {
      console.error("Error loading open positions from Excel:", err);
    }
  };

  const loadLivePortfolioIndex = async (currentNetCashFlow) => {
    try {
      const res = await axios.get(`http://localhost:8000/calculate-live-index?net_cash_flow_today=${currentNetCashFlow}`);
      console.log("Live Index Response:", res.data);
      setLivePortfolioIndex(res.data.live_portfolio_index_value);
    } catch (err) {
      console.error("Error calculating live index:", err);
      setLivePortfolioIndex(0.0);
    }
  };


  const loadPortfolioHistory = async () => {
      try {
          const res = await axios.get("http://localhost:8000/portfolio-history");
          const historyData = res.data;
          setPortfolioHistory(historyData); // Set the full history for charting

          if (historyData.length > 0) {
              const sortedHistory = [...historyData].sort((a, b) => new Date(a.date) - new Date(b.date));
              setBaseSnapshot(sortedHistory[0]); // Set the first snapshot as base

              const latestSnapshot = historyData[historyData.length - 1];
              setPortfolioIndex(latestSnapshot.portfolio_index_value);
              setBusinessDate(latestSnapshot.date);
              setNetCashFlow(latestSnapshot.net_cash_flow_today || 0.0);
              await loadLivePortfolioIndex(latestSnapshot.net_cash_flow_today || 0.0);
          } else {
              setPortfolioIndex(0);
              setBusinessDate(new Date().toISOString().slice(0, 10));
              setNetCashFlow(0.0);
              setBaseSnapshot(null);
              await loadLivePortfolioIndex(0.0);
          }
      } catch (err) {
          console.error("Error loading portfolio history:", err);
          setBusinessDate(new Date().toISOString().slice(0, 10));
          setPortfolioIndex(0.0);
          setNetCashFlow(0.0);
          setLivePortfolioIndex(0.0);
          setPortfolioHistory([]);
          setBaseSnapshot(null);
      }
  };

  useEffect(() => {
    loadPositions();
    loadPortfolioHistory();
  }, []);

  const handlePriceChange = (symbol, value) => {
    setManualPrices((prev) => ({ ...prev, [symbol]: Number(value) }));
  };

  const recalculate = (entry) => {
    const price = manualPrices[entry.symbol] ?? entry.currentPrice;
    const marketValue = +(price * entry.totalQty).toFixed(2);
    const pnl = +(marketValue - entry.costValue).toFixed(2);
    const pct_pnl = +((pnl / entry.costValue) * 100).toFixed(2);
    return { ...entry, currentPrice: price, marketValue, pnl, pct_pnl };
  };

  const handleSellClick = (position) => {
    setSelectedPositionForSell(position);
    setSellDate(new Date().toISOString().slice(0, 10));
    setSellPrice(position.currentPrice || "");
    setShowSellModal(true);
  };

  const handleSellSubmit = async () => {
    // ... (existing sell logic)
    setShowSellModal(false);
    loadPositions();
    loadPortfolioHistory();
  };

  const handleTakeSnapshot = async () => {
      try {
          const res = await axios.post("http://localhost:8000/snapshot", {
              net_cash_flow_today: parseFloat(netCashFlow) || 0.0
          });
          console.log(res.data.message);
          alert(res.data.message);
          setNetCashFlow(0.0);
          await loadPortfolioHistory();
      } catch (err) {
          console.error("Error taking snapshot:", err);
          alert("Error taking snapshot. Check console for details.");
      }
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedAndFilteredData = useMemo(() => {
    let sortableItems = [...grouped];

    sortableItems = sortableItems.filter(item => {
      const matchesSymbol = symbolSearchTerm === "" ||
                            item.symbol.toLowerCase().includes(symbolSearchTerm.toLowerCase());
      const matchesAccount = accountSearchTerm === "" ||
                             (item.account && item.account.toLowerCase().includes(accountSearchTerm.toLowerCase()));
      let matchesPnl = true;
      if (pnlFilter === "Positive") {
        matchesPnl = item.total_pnl > 0;
      } else if (pnlFilter === "Negative") {
        matchesPnl = item.total_pnl < 0;
      }
      return matchesSymbol && matchesAccount && matchesPnl;
    });

    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
        }
        else if (typeof aValue === 'string' && typeof bValue === 'string') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
            if (aValue < bValue) {
                return sortConfig.direction === 'ascending' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'ascending' ? 1 : -1;
            }
        }
        return 0;
      });
    }
    return sortableItems;
  }, [grouped, sortConfig, symbolSearchTerm, accountSearchTerm, pnlFilter]);

  const getGroupedData = () => {
    if (groupingOption === "None") {
      return { "All Positions": sortedAndFilteredData };
    }

    const groupedData = {};
    sortedAndFilteredData.forEach(item => {
      const key = item[groupingOption] || "Uncategorized";
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(item);
    });
    return groupedData;
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? ' ⬆️' : ' ⬇️';
    }
    return '';
  };

  const summaryData = useMemo(() => {
    let totalCost = 0;
    let totalMarketValue = 0;
    let totalTodayPnl = 0;
    let totalOverallPnl = 0;
    const pnlByAccount = {};
    const dailyPnlByAccount = {};

    const dataForSummary = grouped.map(recalculate);

    dataForSummary.forEach(pos => {
      totalCost += pos.costValue;
      totalMarketValue += pos.marketValue;
      totalTodayPnl += pos.daily_pnl;
      totalOverallPnl += pos.pnl;

      const accountName = pos.account || "Uncategorized";

      if (!pnlByAccount[accountName]) {
        pnlByAccount[accountName] = 0;
      }
      pnlByAccount[accountName] += pos.pnl;

      if (!dailyPnlByAccount[accountName]) {
        dailyPnlByAccount[accountName] = 0;
      }
      dailyPnlByAccount[accountName] += pos.daily_pnl;
    });

    return {
      totalCost,
      totalMarketValue,
      totalTodayPnl,
      totalOverallPnl,
      pnlByAccount,
      dailyPnlByAccount
    };
  }, [grouped, manualPrices]);

  const formatNumber = (num) => {
    if (isNaN(num)) {
      return 'N/A';
    }
    return parseFloat(num.toFixed(2)).toLocaleString('en-IN');
  };

  const formatIndex = (num) => {
    if (isNaN(num)) {
        return 'N/A';
    }
    return num.toFixed(2);
  }

  const handleNetCashFlowChange = (e) => {
    const value = parseFloat(e.target.value);
    setNetCashFlow(isNaN(value) ? 0.0 : value);
    loadLivePortfolioIndex(isNaN(value) ? 0.0 : value);
  };

const renderTable = (data) => (
    <table>
      <thead>
        <tr>
          <th>Actions</th>
          <th onClick={() => requestSort('symbol')} style={{ cursor: 'pointer' }}>
            Symbol{getSortIndicator('symbol')}
          </th>
          <th onClick={() => requestSort('avgPrice')} style={{ cursor: 'pointer' }}>
            Avg Buy{getSortIndicator('avgPrice')}
          </th>
          <th onClick={() => requestSort('totalQty')} style={{ cursor: 'pointer' }}>
            Qty{getSortIndicator('totalQty')}
          </th>
          <th onClick={() => requestSort('costValue')} style={{ cursor: 'pointer' }}>
            Cost Value{getSortIndicator('costValue')}
          </th>
          <th onClick={() => requestSort('currentPrice')} style={{ cursor: 'pointer' }}>
            Current Price{getSortIndicator('currentPrice')}
          </th>
          <th onClick={() => requestSort('marketValue')} style={{ cursor: 'pointer' }}>
            Market Value{getSortIndicator('marketValue')}
          </th>
          <th onClick={() => requestSort('pnl')} style={{ cursor: 'pointer' }}>
            P&L (₹){getSortIndicator('pnl')}
          </th>
          <th onClick={() => requestSort('pct_pnl')} style={{ cursor: 'pointer' }}>
            P&L (%){getSortIndicator('pct_pnl')}
          </th>
          <th onClick={() => requestSort('sector')} style={{ cursor: 'pointer' }}>
            Sector{getSortIndicator('sector')}
          </th>
          <th onClick={() => requestSort('daily_change')} style={{ cursor: 'pointer' }}>
            Daily Change (₹){getSortIndicator('daily_change')}
          </th>
          <th onClick={() => requestSort('daily_pnl')} style={{ cursor: 'pointer' }}>
            Daily P&L (₹){getSortIndicator('daily_pnl')}
          </th>
          <th onClick={() => requestSort('tradevalue')} style={{ cursor: 'pointer' }}>
            Trade Value{getSortIndicator('tradevalue')}
          </th>
          <th onClick={() => requestSort('total_pnl')} style={{ cursor: 'pointer' }}>
            Total P&L (₹){getSortIndicator('total_pnl')}
          </th>
          <th onClick={() => requestSort('pos_age')} style={{ cursor: 'pointer' }}>
            Pos Age (Days){getSortIndicator('pos_age')}
          </th>
          <th onClick={() => requestSort('account')} style={{ cursor: 'pointer' }}>
            Account{getSortIndicator('account')}
          </th>
          <th onClick={() => requestSort('tvm')} style={{ cursor: 'pointer' }}>
            TVM{getSortIndicator('tvm')}
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((entry) => {
          const updated = recalculate(entry);
          return (
            <tr key={entry.symbol}>
              <td>
                <button onClick={() => handleSellClick(entry)}>Sell</button>
              </td>
              <td>{updated.symbol}</td>
              <td>₹{updated.avgPrice.toFixed(2)}</td>
              <td>{updated.totalQty}</td>
              <td>₹{updated.costValue.toFixed(2)}</td>
              <td>
                ₹
                <input
                  style={{ width: "80px" }}
                  type="number"
                  step="0.01"
                  value={manualPrices[entry.symbol] ?? entry.currentPrice}
                  onChange={(e) =>
                    handlePriceChange(entry.symbol, e.target.value)
                  }
                />
              </td>
              <td>₹{updated.marketValue.toFixed(2)}</td>
              <td style={{ color: updated.pnl >= 0 ? "green" : "red" }}>
                ₹{updated.pnl.toFixed(2)}
              </td>
              <td style={{ color: updated.pct_pnl >= 0 ? "green" : "red" }}>
                {updated.pct_pnl.toFixed(2)}%
              </td>
              <td>{entry.sector}</td>
              <td style={{ color: entry.daily_change >= 0 ? "green" : "red" }}>
                  ₹{entry.daily_change.toFixed(2)}
              </td>
              <td style={{ color: entry.daily_pnl >= 0 ? "green" : "red" }}>
                  ₹{entry.daily_pnl.toFixed(2)}
              </td>
              <td>₹{entry.tradevalue.toFixed(2)}</td>
              <td style={{ color: entry.total_pnl >= 0 ? "green" : "red" }}>
                  ₹{entry.total_pnl.toFixed(2)}
              </td>
              <td>{entry.pos_age}</td>
              <td>{entry.account}</td>
              <td>{entry.tvm.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const groupedDisplayData = getGroupedData();

  // ⚡️ NEW: Data preparation for Portfolio Index Line Chart ⚡️
  // Ensure the data is sorted by date for the line chart
  const sortedHistoryForChart = [...portfolioHistory].sort((a, b) => new Date(a.date) - new Date(b.date));
  const portfolioIndexChartData = sortedHistoryForChart.map(d => ({
    date: d.date,
    'Portfolio Index': d.portfolio_index_value
  }));


  return (
    <div className="open-positions-container">
      <h2>Open Positions</h2>
      <button onClick={() => {
        axios.post("http://localhost:8000/reload-excel-data")
          .then(() => {
            loadPositions();
            loadLivePortfolioIndex(netCashFlow);
          })
          .catch(err => console.error("Error reloading Excel data:", err));
      }}>
        Refresh Data from Excel
      </button>

      <div className="portfolio-info-bar">
          <p>Business Date: <strong>{businessDate}</strong></p>
          <p>Portfolio Index Value (Last Snapshot): <strong>{formatIndex(portfolioIndex)}</strong></p>
          <p>Portfolio Index (Live Estimate): <strong>{formatIndex(livePortfolioIndex)}</strong></p>
          <div className="snapshot-controls">
              <label htmlFor="net-cash-flow">Net Cash Flow Today (₹):</label>
              <input
                  id="net-cash-flow"
                  type="number"
                  step="0.01"
                  value={netCashFlow}
                  onChange={handleNetCashFlowChange}
                  placeholder="0.00"
                  style={{ width: '120px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <button onClick={handleTakeSnapshot}>Take Daily Snapshot</button>
          </div>
      </div>

      <div className="summary-section">
        <h3>Portfolio Summary</h3>
        <div className="summary-cards">
          <div className="summary-card">
            <h4>Total Cost Value</h4>
            <p>₹{formatNumber(summaryData.totalCost)}</p>
          </div>
          <div className="summary-card">
            <h4>Current Market Value</h4>
            <p>₹{formatNumber(summaryData.totalMarketValue)}</p>
          </div>
          <div className="summary-card">
            <h4>Today's P&L</h4>
            <p style={{ color: summaryData.totalTodayPnl >= 0 ? "green" : "red" }}>
              ₹{formatNumber(summaryData.totalTodayPnl)}
            </p>
          </div>
          <div className="summary-card">
            <h4>Overall P&L</h4>
            <p style={{ color: summaryData.totalOverallPnl >= 0 ? "green" : "red" }}>
              ₹{formatNumber(summaryData.totalOverallPnl)}
            </p>
          </div>
        </div>

        <h4 style={{ marginTop: '20px' }}>Total P&L by Account</h4>
        <div className="account-pnl-cards">
          {Object.entries(summaryData.pnlByAccount).map(([account, pnl]) => (
            <div key={`total-${account}`} className="account-pnl-card">
              <h5>{account}</h5>
              <p style={{ color: pnl >= 0 ? "green" : "red" }}>
                ₹{formatNumber(pnl)}
              </p>
            </div>
          ))}
        </div>

        <h4 style={{ marginTop: '20px' }}>Daily P&L by Account</h4>
        <div className="account-pnl-cards">
          {Object.entries(summaryData.dailyPnlByAccount).map(([account, pnl]) => (
            <div key={`daily-${account}`} className="account-pnl-card">
              <h5>{account}</h5>
              <p style={{ color: pnl >= 0 ? "green" : "red" }}>
                ₹{formatNumber(pnl)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* --- ⚡️ MOVED: Portfolio Index Time-Series Chart ⚡️ --- */}
      <div className="chart-section"> {/* Using chart-section class for consistent styling */}
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
      </div>
      {/* --- ⚡️ END MOVED: Portfolio Index Time-Series Chart ⚡️ --- */}


      <div className="filter-controls">
        <label>
          Search Symbol:
          <input
            type="text"
            value={symbolSearchTerm}
            onChange={(e) => setSymbolSearchTerm(e.target.value)}
            placeholder="SBIN"
          />
        </label>
        <label>
          Search Account:
          <input
            type="text"
            value={accountSearchTerm}
            onChange={(e) => setAccountSearchTerm(e.target.value)}
            placeholder="Zerodha"
          />
        </label>
        <label>
          P&L Filter:
          <select value={pnlFilter} onChange={(e) => setPnlFilter(e.target.value)}>
            <option value="All">All</option>
            <option value="Positive">Positive P&L</option>
            <option value="Negative">Negative P&L</option>
          </select>
        </label>
      </div>

      <div style={{ margin: '15px 0' }}>
        <label htmlFor="grouping-select">Group by: </label>
        <select
          id="grouping-select"
          value={groupingOption}
          onChange={(e) => {
            setGroupingOption(e.target.value);
            setSortConfig({ key: null, direction: 'ascending' });
          }}
        >
          <option value="None">None</option>
          <option value="sector">Sector</option>
          <option value="account">Account</option>
        </select>
      </div>

      <div className="table-responsive">
        {Object.keys(groupedDisplayData).map(groupName => (
          <div key={groupName}>
            {groupingOption !== "None" && <h3>{groupName}</h3>}
            {renderTable(groupedDisplayData[groupName])}
          </div>
        ))}
      </div>


      {showSellModal && selectedPositionForSell && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Sell Position: {selectedPositionForSell.symbol}</h3>
            <p>Quantity to Sell: {selectedPositionForSell.totalQty}</p>
            <p>Average Buy Price: ₹{selectedPositionForSell.avgPrice.toFixed(2)}</p>
            <label>
              Sell Date:
              <input
                type="date"
                value={sellDate}
                onChange={(e) => setSellDate(e.target.value)}
              />
            </label>
            <label>
              Sell Price:
              <input
                type="number"
                step="0.01"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </label>
            <div className="modal-actions">
              <button onClick={handleSellSubmit}>Confirm Sell</button>
              <button onClick={() => setShowSellModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenPositions;