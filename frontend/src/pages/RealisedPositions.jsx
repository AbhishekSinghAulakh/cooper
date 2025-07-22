// File: src/pages/RealisedPositions.jsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import "../App.css";

const RealisedPositions = () => {
  const [realised, setRealised] = useState([]);

  useEffect(() => {
    const fetchRealised = async () => {
      try {
        const res = await axios.get("http://localhost:8000/realised");
        setRealised(res.data);
      } catch (error) {
        console.error("Failed to fetch realised positions", error);
      }
    };

    fetchRealised();
  }, []);

  return (
    <div className="realised-positions-container">
      <h2>Realised Positions</h2>
      <div className="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              {/* Removed Ticker column */}
              <th>Buy Date</th>
              <th>Sell Date</th>
              <th>Buy Price</th>
              <th>Sell Price</th>
              <th>Qty</th>
              <th>PnL (₹)</th>
              <th>P&L (%)</th>
              <th>Note</th>
              <th>Trade Value</th>
              <th>Market Value</th>
              <th>TVM</th>
              <th>Pos Age</th>
            </tr>
          </thead>
          <tbody>
            {realised.map((t, i) => (
              <tr key={i}>
                <td>{t.symbol}</td>
                <td>{t.buy_date || "-"}</td>
                <td>{t.sell_date || "-"}</td>
                <td>{t.buy_price !== null ? `₹${t.buy_price.toFixed(2)}` : "-"}</td>
                <td>{t.sell_price !== null ? `₹${t.sell_price.toFixed(2)}` : "-"}</td>
                <td>{t.qty}</td>
                <td style={{ color: t.total_pnl >= 0 ? "green" : "red" }}>
                  {t.total_pnl !== null ? `₹${t.total_pnl.toFixed(2)}` : "-"}
                </td>
                <td style={{ color: t.pct_pnl >= 0 ? "green" : "red" }}>
                  {t.pct_pnl !== null ? `${t.pct_pnl.toFixed(2)}%` : "-"}
                </td>
                <td>{t.note || "-"}</td>
                <td>{t.tradevalue !== null ? `₹${t.tradevalue.toFixed(2)}` : "-"}</td>
                <td>{t.market_value !== null ? `₹${t.market_value.toFixed(2)}` : "-"}</td>
                <td>{t.tvm !== null ? t.tvm.toFixed(2) : "-"}</td> {/* Display tvm rounded */}
                <td>{t.pos_age || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RealisedPositions;