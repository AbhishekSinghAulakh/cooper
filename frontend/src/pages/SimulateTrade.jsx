// File: src/pages/Simulate.jsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../App.css";

const Simulate = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const simData = location.state?.simulation;
  const tradeData = location.state?.input;

  // Fallback if data is missing
  if (!simData || !tradeData) {
    return (
      <div className="container">
        <h3>⚠️ Simulation data is missing.</h3>
        <p>This page was likely accessed incorrectly.</p>
        <button className="btn" onClick={() => navigate("/add")}>
          Go Back to Add Trade
        </button>
      </div>
    );
  }

  const handleCommit = async () => {
    try {
      const response = await fetch("http://localhost:8000/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeData),
      });

      if (!response.ok) throw new Error("Failed to commit trade");
      navigate("/");
    } catch (error) {
      console.error("Commit failed:", error);
    }
  };

  return (
    <div className="container">
      <h2>Simulated Trade Result for {tradeData.symbol}</h2>
      <div className="card simulation-card">
        <p><strong>Symbol:</strong> {tradeData.symbol}</p>
        <p><strong>Ticker:</strong> {tradeData.ticker}</p>
        <p><strong>Buy Price:</strong> ₹{tradeData.buy_price}</p>
        <p><strong>Quantity:</strong> {tradeData.qty}</p>
        <p><strong>Avg Cost (simulated):</strong> ₹{simData.simulated_avg_price}</p>
        <p><strong>Total Qty (simulated):</strong> {simData.simulated_qty}</p>
        {tradeData.note && (
          <p><strong>Note:</strong> {tradeData.note}</p>
        )}
        {tradeData.strategy && (
          <p><strong>Strategy:</strong> {tradeData.strategy}</p>
        )}
      </div>
      <div className="btn-group">
        <button className="btn" onClick={() => navigate("/add")}>Go Back</button>
        <button className="btn primary" onClick={handleCommit}>Commit Trade</button>
      </div>
    </div>
  );
};

export default Simulate;
