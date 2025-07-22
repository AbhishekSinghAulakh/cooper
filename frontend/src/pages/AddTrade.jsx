// File: src/pages/AddTrade.jsx
/* import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css"; */

/* const AddTrade = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    symbol: "",
    ticker: "",
    buy_price: "",
    qty: "",
    buy_date: "",
    sell_date: "",
    sell_price: "",
    sector: "",
    type: "",
    note: "",
    strategy: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }; */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

const AddTrade = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    symbol: "",
    ticker: "",
    buy_price: "",
    qty: "",
    buy_date: "",
    sell_date: "",
    sell_price: "",
    sector: "",
    type: "",
    note: "",
    strategy: "",
  });

  const [errors, setErrors] = useState({});

  const validateSymbol = (value) => {
    if (!value) return "Symbol is required";
    if (!/^[a-zA-Z0-9]+$/.test(value)) return "Alphanumeric only, no spaces";
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let processedValue = value;

    if (name === "symbol") {
      processedValue = value.trim().toUpperCase();
      const error = validateSymbol(processedValue);
      setErrors((prev) => ({ ...prev, symbol: error }));
    }

    setFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));
  };



  const handleAdd = async () => {
    try {
      const cleaned = cleanFields(formData);

      const response = await fetch("http://localhost:8000/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });

      if (!response.ok) throw new Error("Failed to add trade");

      alert("Trade added successfully");
      navigate("/");
    } catch (error) {
      console.error("Add Trade Error:", error);
      alert("Error adding trade");
    }
  };

  const handleSimulate = async () => {
    try {
      const cleaned = cleanFields(formData);

      const response = await fetch("http://localhost:8000/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }

      const result = await response.json();
      navigate("/simulate", {
        state: {
          input: cleaned,
          simulation: result,
        },
      });
    } catch (error) {
      console.error("Simulation Error:", error);
      alert("Error simulating trade: " + error.message);
    }
  };

  const cleanFields = (data) => {
    const cleaned = { ...data };

    ["buy_price", "sell_price", "qty"].forEach((field) => {
      cleaned[field] = cleaned[field] === "" ? null : Number(cleaned[field]);
    });

    ["buy_date", "sell_date"].forEach((field) => {
      cleaned[field] = cleaned[field]
        ? new Date(cleaned[field]).toISOString().split("T")[0]
        : null;
    });

    ["symbol", "sector", "type", "note", "strategy"].forEach((field) => {
      cleaned[field] = cleaned[field] === "" ? null : cleaned[field];
    });

    return cleaned;
  };

  return (
    <div className="container">
      <h2>Add Trade</h2>
      <div className="form-grid">
        <div className="form-group">
        <div className="form-group">
        <label>Symbol <span className="required">*</span></label>
          <input name="symbol" value={formData.symbol} onChange={handleChange} required />
          {errors.symbol && <span className="error">{errors.symbol}</span>}
        </div>
          <label>
            Ticker <span className="required">*</span>
          </label>
          <input name="ticker" value={formData.ticker} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>
            Buy Price <span className="required">*</span>
          </label>
          <input type="number" name="buy_price" value={formData.buy_price} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>
            Quantity <span className="required">*</span>
          </label>
          <input type="number" name="qty" value={formData.qty} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Buy Date</label>
          <input type="date" name="buy_date" value={formData.buy_date} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Sell Date</label>
          <input type="date" name="sell_date" value={formData.sell_date} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Sell Price</label>
          <input type="number" name="sell_price" value={formData.sell_price} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Sector</label>
          <input name="sector" value={formData.sector} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Type</label>
          <input name="type" value={formData.type} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Note</label>
          <textarea name="note" value={formData.note} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Strategy</label>
          <textarea name="strategy" value={formData.strategy} onChange={handleChange} />
        </div>
      </div>

      <div className="button-group">
        <button onClick={handleSimulate} className="btn simulate">Simulate</button>
        <button onClick={handleAdd} className="btn submit">Add Trade</button>
      </div>
    </div>
  );
};

export default AddTrade;
