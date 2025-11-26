// components/CharacterForm.jsx - Shared character creation form

import { useState } from "react";

/**
 * CharacterForm - Reusable form for creating characters
 * 
 * @param {Object} props
 * @param {Function} props.onSubmit - Called with character data { firstName, lastName, ...stats }
 * @param {Function} props.onCancel - Called when cancel is clicked
 * @param {boolean} props.randomStats - If true, generate random stats (for player characters)
 * @param {boolean} props.showStats - If true, show stat inputs (for GM/neutral characters)
 * @param {string} props.title - Form title
 * @param {string} props.description - Optional description text
 */
export default function CharacterForm({
  onSubmit,
  onCancel,
  randomStats = true,
  showStats = false,
  title = "New Character",
  description,
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [stats, setStats] = useState({
    leadership: 5,
    prowess: 5,
    stewardship: 5,
    intrigue: 5,
  });
  const [customDescription, setCustomDescription] = useState("");

  function generateRandomStats() {
    return {
      leadership: Math.floor(Math.random() * 10) + 1,
      prowess: Math.floor(Math.random() * 10) + 1,
      stewardship: Math.floor(Math.random() * 10) + 1,
      intrigue: Math.floor(Math.random() * 10) + 1,
    };
  }

  function handleSubmit(e) {
    e?.preventDefault?.();
    
    const characterData = {
      firstName: firstName.trim() || "Unnamed",
      lastName: lastName.trim() || "",
      ...(randomStats ? generateRandomStats() : stats),
    };
    
    if (customDescription.trim()) {
      characterData.description = customDescription.trim();
    }
    
    onSubmit(characterData);
    
    // Reset form
    setFirstName("");
    setLastName("");
    setStats({ leadership: 5, prowess: 5, stewardship: 5, intrigue: 5 });
    setCustomDescription("");
  }

  function handleCancel() {
    setFirstName("");
    setLastName("");
    setStats({ leadership: 5, prowess: 5, stewardship: 5, intrigue: 5 });
    setCustomDescription("");
    onCancel();
  }

  return (
    <div className="card" style={{ marginBottom: 16, padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {description && (
        <p style={{ fontSize: 12, color: "#c7bca5", marginTop: 0, marginBottom: 12 }}>
          {description}
        </p>
      )}
      {randomStats && (
        <p style={{ fontSize: 12, color: "#c7bca5", marginTop: 0, marginBottom: 12 }}>
          Stats will be randomly generated (1-10 each).
        </p>
      )}
      
      {/* Name inputs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: showStats ? 12 : 0 }}>
        <div>
          <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>
            First Name
          </label>
          <input
            type="text"
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #5e4934",
              background: "#1d1610",
              color: "#f3eadc",
              fontFamily: "Georgia, serif",
              fontSize: 16,
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>
            Last Name
          </label>
          <input
            type="text"
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #5e4934",
              background: "#1d1610",
              color: "#f3eadc",
              fontFamily: "Georgia, serif",
              fontSize: 16,
            }}
          />
        </div>
      </div>

      {/* Stats inputs (for GM/neutral characters) */}
      {showStats && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            marginTop: "12px",
          }}
        >
          {["leadership", "prowess", "stewardship", "intrigue"].map((stat) => (
            <div key={stat}>
              <label
                style={{
                  fontSize: "11px",
                  textTransform: "capitalize",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                {stat}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={stats[stat]}
                onChange={(e) =>
                  setStats((prev) => ({ ...prev, [stat]: Number(e.target.value) }))
                }
                style={{ width: "100%" }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
        <button type="button" onClick={handleSubmit} className="green">
          Create Character
        </button>
        <button type="button" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}