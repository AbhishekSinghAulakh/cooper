// File: src/App.jsx

import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import OpenPositions from "./pages/OpenPositions";
import RealisedPositions from "./pages/RealisedPositions";
import SimulateTrade from "./pages/SimulateTrade";
import TradesHistory from "./pages/TradesHistory";
import Analysis from "./pages/Analysis"; // Import the new Analysis component
import Dividends from './pages/Dividends'; 
import "./App.css";

const App = () => {
  return (
    <div>
      <nav className="navbar">
        <Link to="/">Open Positions</Link>
        <Link to="/realised">Realised</Link>

        <Link to="/simulate">Simulate</Link>
        <Link to="/trades">Trades History</Link>
        <Link to="/analysis">Graphical Analysis</Link> {/* New Nav Link */}
        <Link to="/dividends" className="nav-link">Dividends</Link> {/* ⚡️ NEW: Dividends Link ⚡️ */}
      </nav>

      <div className="container">
        <Routes>
          <Route path="/" element={<OpenPositions />} />
          <Route path="/realised" element={<RealisedPositions />} />

          <Route path="/simulate" element={<SimulateTrade />} />
          <Route path="/trades" element={<TradesHistory />} />
          <Route path="/analysis" element={<Analysis />} /> 
          <Route path="/dividends" element={<Dividends />} />
        </Routes>
      </div>
    </div>
  );
};


export default App;