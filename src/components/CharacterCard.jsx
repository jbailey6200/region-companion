// components/CharacterCard.jsx - UPDATED FILE

import { useState } from "react";
import { DEITIES } from "../config/religionRules";

export default function CharacterCard({
  character,
  isOwner,
  isGM,
  patronDeity,
  onUpdateField,
  onDelete,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(character.firstName || "");
  const [lastName, setLastName] = useState(character.lastName || "");

  function handleSaveName() {
    onUpdateField(character.id, "firstName", firstName);
    onUpdateField(character.id, "lastName", lastName);
    setIsEditing(false);
  }

  function handleCancelEdit() {
    setFirstName(character.firstName || "");
    setLastName(character.lastName || "");
    setIsEditing(false);
  }

  // Get deity bonuses
  const deity = patronDeity ? DEITIES[patronDeity] : null;

  const stats = [
    { 
      key: "leadership", 
      label: "Leadership", 
      color: "#d1b26b",
      bonus: deity?.bonuses.characterLeadership || 0
    },
    { 
      key: "prowess", 
      label: "Prowess", 
      color: "#c77d7d",
      bonus: deity?.bonuses.characterProwess || 0
    },
    { 
      key: "stewardship", 
      label: "Stewardship", 
      color: "#7db5d1",
      bonus: 0 // No deities currently give stewardship bonus
    },
    { 
      key: "intrigue", 
      label: "Intrigue", 
      color: "#9d7dd1",
      bonus: deity?.bonuses.characterIntrigue || 0
    },
  ];

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div>
        {/* Name Section */}
        <div style={{ marginBottom: 12 }}>
          {isEditing ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #5e4934",
                  background: "#1d1610",
                  color: "#f4efe4",
                  fontFamily: "Georgia, serif",
                  fontSize: 16,
                }}
              />
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #5e4934",
                  background: "#1d1610",
                  color: "#f4efe4",
                  fontFamily: "Georgia, serif",
                  fontSize: 16,
                }}
              />
              <button
                onClick={handleSaveName}
                className="small"
                style={{ margin: 0, padding: "6px 12px" }}
              >
                ✓
              </button>
              <button
                onClick={handleCancelEdit}
                className="small"
                style={{ margin: 0, padding: "6px 12px" }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: 20 }}>
                  {firstName || "Unnamed"} {lastName || "Character"}
                </h3>
                {isOwner && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="small"
                    style={{ margin: 0, padding: "4px 8px" }}
                  >
                    Edit
                  </button>
                )}
              </div>
              
              {(isOwner || isGM) && (
                <button
                  onClick={() => onDelete(character.id)}
                  className="small"
                  style={{
                    margin: 0,
                    padding: "6px 10px",
                    background: "#8b3a3a",
                    border: "1px solid #6d2828",
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
            marginBottom: 12,
          }}
        >
          {stats.map(({ key, label, color, bonus }) => (
            <div
              key={key}
              style={{
                padding: "8px 12px",
                background: "#1a1410",
                borderRadius: 8,
                border: `1px solid ${color}44`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#a89a7a",
                  marginBottom: 4,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {label}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: "bold",
                    color: color,
                  }}
                >
                  {character[key] || 1}
                </span>
                {bonus > 0 && (
                  <span style={{ color: "#b5e8a1", fontSize: 14, fontWeight: "bold" }}>
                    (+{bonus})
                  </span>
                )}
                {isGM && (
                  <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
                    <button
                      onClick={() => {
                        const current = character[key] || 1;
                        if (current > 1)
                          onUpdateField(character.id, key, current - 1);
                      }}
                      className="small"
                      style={{
                        margin: 0,
                        padding: "2px 6px",
                        fontSize: 10,
                        minHeight: 20,
                      }}
                    >
                      -
                    </button>
                    <button
                      onClick={() => {
                        const current = character[key] || 1;
                        if (current < 10)
                          onUpdateField(character.id, key, current + 1);
                      }}
                      className="small"
                      style={{
                        margin: 0,
                        padding: "2px 6px",
                        fontSize: 10,
                        minHeight: 20,
                      }}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Court Position */}
        <div
          style={{
            padding: "6px 10px",
            background: "#1a1410",
            borderRadius: 6,
            border: "1px solid #3a2f24",
            fontSize: 13,
          }}
        >
          <span style={{ color: "#a89a7a" }}>Court Position: </span>
          <span style={{ color: "#c7bca5" }}>
            {character.courtPosition || "None"}
          </span>
        </div>

        {/* Show deity influence if there's a bonus */}
        {deity && (stats.some(s => s.bonus > 0)) && (
          <p style={{ fontSize: 11, color: "#a89a7a", marginTop: 8, fontStyle: "italic" }}>
            Blessed by {deity.name}
          </p>
        )}
      </div>
    </div>
  );
}