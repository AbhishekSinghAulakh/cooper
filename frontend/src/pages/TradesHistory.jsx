// File: src/pages/TradesHistory.jsx

import React, { useEffect, useState } from "react";
import axios from "axios";
import "../App.css";

const TradesHistory = () => {
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const res = await axios.get("http://localhost:8000/all_trades");
        setTrades(res.data);
      } catch (error) {
        console.error("Failed to fetch trade history", error);
      }
    };

    fetchTrades();
  }, []);

  return (
    <div>
      <h2>Trades History (All Entries)</h2>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Ticker</th>
            <th>Buy Date</th>
            <th>Sell Date</th>
            <th>Buy Price</th>
            <th>Sell Price</th>
            <th>Qty</th>
            <th>Type</th>
            <th>Note</th>
            <th>Strategy</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => (
            <tr key={i}>
              <td>{t.symbol}</td>
              <td>{t.ticker}</td>
              <td>{t.buy_date || "-"}</td>
              <td>{t.sell_date || "-"}</td>
              <td>{t.buy_price ? `₹${t.buy_price}` : "-"}</td>
              <td>{t.sell_price ? `₹${t.sell_price}` : "-"}</td>
              <td>{t.qty}</td>
              <td>{t.type || "-"}</td>
              <td>{t.note || "-"}</td>
              <td>{t.strategy || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TradesHistory;
