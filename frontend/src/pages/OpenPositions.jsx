// File: src/pages/OpenPositions.jsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import "../App.css";

const OpenPositions = () => {
  const [grouped, setGrouped] = useState([]);
  const [manualPrices, setManualPrices] = useState({});
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedPositionForSell, setSelectedPositionForSell] = useState(null);
  const [sellDate, setSellDate] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [groupingOption, setGroupingOption] = useState("None"); // State for grouping

  const loadPositions = async () => {
    try {
      const res = await axios.get("http://localhost:8000/positions");
      setGrouped(res.data);
      console.log("Open positions data from Excel:", res.data);
    } catch (err) {
      console.error("Error loading open positions from Excel:", err);
    }
  };

  useEffect(() => {
    loadPositions();
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
    if (!selectedPositionForSell || !sellDate || !sellPrice) {
      alert("Please enter sell date and sell price.");
      return;
    }

    try {
      const sellRecord = {
        symbol: selectedPositionForSell.symbol,
        ticker: selectedPositionForSell.ticker,
        buy_date: selectedPositionForSell.original_buy_date,
        buy_price: selectedPositionForSell.avgPrice,
        qty: selectedPositionForSell.totalQty,
        sell_date: sellDate,
        sell_price: parseFloat(sellPrice),
        sector: selectedPositionForSell.sector,
        note: `Sold aggregated position from Excel: ${selectedPositionForSell.symbol}`,
        tradevalue: selectedPositionForSell.excel_tradevalue,
        market_value: selectedPositionForSell.excel_market_value,
        total_pnl: selectedPositionForSell.excel_total_pnl,
        pct_pnl: selectedPositionForSell.excel_pct_pnl,
        tvm: selectedPositionForSell.excel_tvm, // tvm is now a number from backend
        pos_age: selectedPositionForSell.excel_pos_age
      };

      await axios.post("http://localhost:8000/sell_trade", sellRecord);

      alert(`Position for ${selectedPositionForSell.symbol} sold successfully and recorded in history!`);
      setShowSellModal(false);
      setSelectedPositionForSell(null);
      setSellDate("");
      setSellPrice("");

      alert("IMPORTANT: Please manually remove the sold position(s) from your Excel file (positions_data.xlsx) and then click 'Refresh Data from Excel' to update this page.");
      loadPositions(); // Reload positions after successful sell
    } catch (error) {
      console.error("Error selling position:", error);
      alert("Failed to record sell transaction. Please try again.");
    }
  };

  // Grouping logic for the frontend
  const getGroupedData = () => {
    if (groupingOption === "None") {
      return { "All Positions": grouped };
    }

    const groupedData = {};
    grouped.forEach(item => {
      const key = item[groupingOption] || "Uncategorized";
      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(item);
    });
    return groupedData;
  };

  const renderTable = (data) => (
    <table>
      <thead>
        <tr>
          <th>Actions</th> {/* Moved to very left */}
          <th>Symbol</th>
          {/* Removed Ticker column */}
          <th>Avg Buy</th>
          <th>Qty</th>
          <th>Cost Value</th>
          <th>Current Price</th>
          <th>Market Value</th>
          <th>P&L (₹)</th>
          <th>P&L (%)</th>
          <th>Sector</th>
          <th>Daily Change</th>
          <th>Daily P&L</th>
          <th>Trade Value</th>
          <th>Total P&L</th>
          {/* Removed Weight(TV) and Weight(MV) */}
          <th>Pos Age</th>
          <th>Account</th>
          <th>TVM</th>
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
                  step="0.01" // Added step for better input experience
                  value={manualPrices[entry.symbol] ?? updated.currentPrice}
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
              <td>{updated.sector}</td>
              <td style={{ color: updated.daily_change >= 0 ? "green" : "red" }}>
                  {updated.daily_change.toFixed(2)}%
              </td>
              <td style={{ color: updated.daily_pnl >= 0 ? "green" : "red" }}>
                  ₹{updated.daily_pnl.toFixed(2)}
              </td>
              <td>₹{updated.tradevalue.toFixed(2)}</td>
              <td style={{ color: updated.total_pnl >= 0 ? "green" : "red" }}>
                  ₹{updated.total_pnl.toFixed(2)}
              </td>
              <td>{updated.pos_age}</td>
              <td>{updated.account}</td>
              <td>{updated.tvm.toFixed(2)}</td> {/* Display tvm rounded */}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const groupedDisplayData = getGroupedData();

  return (
    <div className="open-positions-container">
      <h2>Open Positions</h2>
      <button onClick={() => {
        axios.post("http://localhost:8000/reload-excel-data")
          .then(() => loadPositions())
          .catch(err => console.error("Error reloading Excel data:", err));
      }}>
        Refresh Data from Excel
      </button>

      <div style={{ margin: '15px 0' }}>
        <label htmlFor="grouping-select">Group by: </label>
        <select
          id="grouping-select"
          value={groupingOption}
          onChange={(e) => setGroupingOption(e.target.value)}
        >
          <option value="None">None</option>
          <option value="sector">Sector</option>
          <option value="account">Account</option>
          {/* Add other categorical options here if needed */}
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