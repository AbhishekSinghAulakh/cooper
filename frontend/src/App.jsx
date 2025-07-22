// File: src/App.jsx

import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import OpenPositions from "./pages/OpenPositions";
import RealisedPositions from "./pages/RealisedPositions";
import AddTrade from "./pages/AddTrade";
import SimulateTrade from "./pages/SimulateTrade";
import TradesHistory from "./pages/TradesHistory";
import "./App.css";

const App = () => {
  return (
    <div>
      <nav className="navbar">
        <Link to="/">Open Positions</Link>
        <Link to="/realised">Realised</Link>
        <Link to="/add">Add Trade</Link>
        <Link to="/simulate">Simulate</Link>
        <Link to="/trades">Trades History</Link>
      </nav>

      <div className="container">
        <Routes>
          <Route path="/" element={<OpenPositions />} />
          <Route path="/realised" element={<RealisedPositions />} />
          <Route path="/add" element={<AddTrade />} />
          <Route path="/simulate" element={<SimulateTrade />} />
          <Route path="/trades" element={<TradesHistory />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;