// components/ArmyCard.jsx - UPDATED FILE

import React, { useState, useRef, useEffect } from "react";
import { HSG_UNITS } from "../config/buildingRules";
import { DEITIES } from "../config/religionRules";

export default function ArmyCard({
  army,
  isOwner,
  characters = [],
  allArmies = [],
  patronDeity, // ADD THIS
  onChangeUnit,
  onChangeLevy,
  onChangeField,
  onDelete,
  onUpdateCommanders,
}) {
  const {
    id,
    name,
    location,
    huscarls = 0,
    dismountedKnights = 0,
    mountedKnights = 0,
    lightHorse = 0,
    levyInfantry = 0,
    levyArchers = 0,
    commanders = [],
  } = army;

  const [showCommanderSelect, setShowCommanderSelect] = useState(false);
  const [selectedCommanders, setSelectedCommanders] = useState(commanders || []);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCommanderSelect(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset selected commanders when army commanders change
  useEffect(() => {
    setSelectedCommanders(commanders || []);
  }, [commanders]);

  const hsgTotals = huscarls + dismountedKnights + mountedKnights + lightHorse;

  function toggleCommander(charId) {
    let newCommanders = [...selectedCommanders];
    if (newCommanders.includes(charId)) {
      newCommanders = newCommanders.filter((c) => c !== charId);
    } else {
      if (newCommanders.length >= 3) {
        alert("Maximum 3 commanders per army");
        return;
      }
      newCommanders.push(charId);
    }
    setSelectedCommanders(newCommanders);
  }

  function saveCommanders() {
    onUpdateCommanders(id, selectedCommanders);
    setShowCommanderSelect(false);
  }

  function cancelCommanderSelection() {
    setSelectedCommanders(commanders || []);
    setShowCommanderSelect(false);
  }

  // Get commander objects
  const commanderObjects = commanders
    .map((cmdId) => characters.find((c) => c.id === cmdId))
    .filter(Boolean);

  // Get available characters (not already commanding OTHER armies)
  const commandersInOtherArmies = allArmies
    .filter(a => a.id !== id && !a.deleted)
    .flatMap(a => a.commanders || []);
  
  const availableCharacters = characters.filter(
    char => !commandersInOtherArmies.includes(char.id)
  );

  // Get deity bonuses
  const deity = patronDeity ? DEITIES[patronDeity] : null;
  const leadershipBonus = deity?.bonuses.characterLeadership || 0;
  const prowessBonus = deity?.bonuses.characterProwess || 0;

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ flex: 1, marginRight: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={name || ""}
              disabled={!isOwner}
              onChange={(e) => onChangeField(id, "name", e.target.value)}
              placeholder="Army name"
              style={{
                flex: 1,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid #5e4934",
                background: "#241b15",
                color: "#f4efe4",
                fontFamily: "Georgia, serif",
              }}
            />
          </div>
          <input
            type="text"
            value={location || ""}
            disabled={!isOwner}
            onChange={(e) => onChangeField(id, "location", e.target.value)}
            placeholder="Location (optional)"
            style={{
              marginTop: 4,
              width: "100%",
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid #4c3b2a",
              background: "#1b130d",
              color: "#e7dfd2",
              fontSize: 13,
              fontFamily: "Georgia, serif",
            }}
          />

          {/* Commanders Display - Now under army name */}
          {commanderObjects.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: "8px 10px",
                background: "#1a1410",
                borderRadius: 6,
                border: "1px solid #3a2f24",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: "bold",
                  color: "#d1b26b",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Commanders
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                {commanderObjects.map((cmd) => (
                  <div
                    key={cmd.id}
                    style={{
                      padding: "4px 8px",
                      background: "#241b15",
                      borderRadius: 4,
                      border: "1px solid #4c3b2a",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ fontWeight: "bold", marginBottom: 2 }}>
                      {cmd.firstName || "Unnamed"} {cmd.lastName || ""}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        fontSize: 11,
                        color: "#c7bca5",
                      }}
                    >
                      <span>
                        <span style={{ color: "#d1b26b" }}>Lead:</span>{" "}
                        {cmd.leadership || 1}
                        {leadershipBonus > 0 && (
                          <span style={{ color: "#b5e8a1", fontWeight: "bold" }}>
                            {" "}(+{leadershipBonus})
                          </span>
                        )}
                      </span>
                      <span>
                        <span style={{ color: "#c77d7d" }}>Prow:</span>{" "}
                        {cmd.prowess || 1}
                        {prowessBonus > 0 && (
                          <span style={{ color: "#b5e8a1", fontWeight: "bold" }}>
                            {" "}(+{prowessBonus})
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            <strong>Total HSG units:</strong> {hsgTotals}
          </div>
          {isOwner && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ position: "relative" }} ref={dropdownRef}>
                <button
                  className="small"
                  onClick={() => setShowCommanderSelect(!showCommanderSelect)}
                  style={{ width: "100%" }}
                >
                  Commanders ({commanderObjects.length}/3)
                </button>

                {showCommanderSelect && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: 4,
                      background: "#241b15",
                      border: "1px solid #4c3b2a",
                      borderRadius: 8,
                      padding: 12,
                      zIndex: 10,
                      minWidth: 250,
                      maxHeight: 300,
                      overflowY: "auto",
                      boxShadow: "0 8px 24px rgba(0, 0, 0, 0.7)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: "bold",
                        marginBottom: 8,
                        color: "#d1b26b",
                      }}
                    >
                      Select Commanders (Max 3)
                    </div>
                    {availableCharacters.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#a89a7a", margin: 0 }}>
                        No characters available
                      </p>
                    ) : (
                      <>
                        <div style={{ marginBottom: 8 }}>
                          {availableCharacters.map((char) => {
                            const isSelected = selectedCommanders.includes(char.id);
                            return (
                              <label
                                key={char.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  padding: "6px 8px",
                                  marginBottom: 4,
                                  borderRadius: 4,
                                  cursor: "pointer",
                                  background: isSelected
                                    ? "#2a3f2a"
                                    : "transparent",
                                  border: `1px solid ${
                                    isSelected ? "#4a6642" : "transparent"
                                  }`,
                                  transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.background = "#1f1813";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.background =
                                      "transparent";
                                  }
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCommander(char.id)}
                                  style={{ margin: 0 }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: "bold" }}>
                                    {char.firstName || "Unnamed"}{" "}
                                    {char.lastName || ""}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#a89a7a",
                                      display: "flex",
                                      gap: 12,
                                    }}
                                  >
                                    <span>
                                      Lead: {char.leadership || 1}
                                      {leadershipBonus > 0 && (
                                        <span style={{ color: "#b5e8a1" }}>
                                          {" "}(+{leadershipBonus})
                                        </span>
                                      )}
                                    </span>
                                    <span>
                                      Prow: {char.prowess || 1}
                                      {prowessBonus > 0 && (
                                        <span style={{ color: "#b5e8a1" }}>
                                          {" "}(+{prowessBonus})
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            paddingTop: 8,
                            borderTop: "1px solid #3a2f24",
                          }}
                        >
                          <button
                            className="small"
                            onClick={saveCommanders}
                            style={{
                              flex: 1,
                              margin: 0,
                              padding: "4px 8px",
                              background: "#4a6642",
                              borderColor: "#5a7a52",
                            }}
                          >
                            Save
                          </button>
                          <button
                            className="small"
                            onClick={cancelCommanderSelection}
                            style={{ flex: 1, margin: 0, padding: "4px 8px" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
              <button className="danger small" onClick={() => onDelete(id)}>
                Disband Army
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 style={{ fontSize: 14, marginTop: 4, marginBottom: 6 }}>
        Household Guard
      </h3>
      <div className="army-grid">
        {HSG_UNITS.map((u) => {
          const count = army[u.key] || 0;
          return (
            <div key={u.key} className="army-item">
              <div className="army-item-header">
                <span>{u.label}</span>
                <span>{u.upkeep}g/unit</span>
              </div>
              <div className="army-controls">
                <button
                  disabled={!isOwner}
                  onClick={() => onChangeUnit(id, u.key, -1)}
                >
                  -
                </button>
                <div className="army-count">{count}</div>
                <button
                  disabled={!isOwner}
                  onClick={() => onChangeUnit(id, u.key, 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <h3 style={{ fontSize: 14, marginTop: 10, marginBottom: 6 }}>
        Levies in this Army
      </h3>
      <div className="army-grid">
        <div className="army-item">
          <div className="army-item-header">
            <span>Levy Infantry (units of 10)</span>
            <span>1g raise, 0.25g/turn</span>
          </div>
          <div className="army-controls">
            <button
              disabled={!isOwner}
              onClick={() => onChangeLevy(id, "levyInfantry", -1)}
            >
              -
            </button>
            <div className="army-count">{levyInfantry}</div>
            <button
              disabled={!isOwner}
              onClick={() => onChangeLevy(id, "levyInfantry", 1)}
            >
              +
            </button>
          </div>
        </div>

        <div className="army-item">
          <div className="army-item-header">
            <span>Levy Archers (units of 10)</span>
            <span>1g raise, 0.25g/turn</span>
          </div>
          <div className="army-controls">
            <button
              disabled={!isOwner}
              onClick={() => onChangeLevy(id, "levyArchers", -1)}
            >
              -
            </button>
            <div className="army-count">{levyArchers}</div>
            <button
              disabled={!isOwner}
              onClick={() => onChangeLevy(id, "levyArchers", 1)}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}