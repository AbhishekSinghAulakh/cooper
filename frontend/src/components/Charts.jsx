// File: frontend/src/components/Charts.jsx
import React from "react";
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, Legend
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AF19FF", "#FF4F81"];

export default function Charts({ positions }) {
  const pnlData = positions.map(p => ({
    ticker: p.ticker,
    gain: parseFloat(p.gain),
    tvm: parseFloat(p.tvm),
    age: p.age
  }));

  const costData = positions.map(p => ({
    name: p.ticker,
    value: p.contract_value
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
      <div className="border p-4 rounded shadow bg-white">
        <h2 className="text-lg font-semibold mb-2">PnL by Ticker</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={pnlData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ticker" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="gain" fill="#4A90E2" name="Gain" />
            <Bar dataKey="tvm" fill="#50E3C2" name="tvM" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="border p-4 rounded shadow bg-white">
        <h2 className="text-lg font-semibold mb-2">Cost Distribution</h2>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              dataKey="value"
              data={costData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {costData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}