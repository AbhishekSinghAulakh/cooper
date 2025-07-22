// File: src/pages/NotesPage.jsx
import React, { useState } from "react";

const NotesPage = () => {
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("portfolio_notes", notes);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLoad = () => {
    const savedNotes = localStorage.getItem("portfolio_notes");
    setNotes(savedNotes || "");
  };

  return (
    <div className="container">
      <h2>Notes & Learnings</h2>
      <textarea
        rows={12}
        placeholder="Write your learnings, reflections, and strategies here..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div style={{ marginTop: "1rem" }}>
        <button onClick={handleSave}>💾 Save Notes</button>
        <button onClick={handleLoad} style={{ marginLeft: "1rem" }}>
          📥 Load Last Saved
        </button>
      </div>
      {saved && <p style={{ color: "green" }}>✅ Notes saved!</p>}
    </div>
  );
};

export default NotesPage;