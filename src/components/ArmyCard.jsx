// components/ArmyCard.jsx - UPDATED WITH LOCATION DROPDOWN

import React, { useState, useRef, useEffect } from "react";
import { HSG_UNITS } from "../config/buildingRules";
import { DEITIES } from "../config/religionRules";
import { getAdjacentRegions, ARMY_MOVE_RANGE, ARMY_MOVE_RANGE_KURIMBOR } from "../config/hexUtils";

// Helper function for modified upkeep
function getModifiedUpkeep(unitType, baseUpkeep, patronDeity) {
  const deity = patronDeity ? DEITIES[patronDeity] : null;
  if (!deity) return baseUpkeep;
  
  switch(unitType) {
    case 'huscarls':
      return deity.bonuses.huscarlUpkeep ?? baseUpkeep;
    case 'dismountedKnights':
      return deity.bonuses.dismountedKnightUpkeep ?? baseUpkeep;
    case 'mountedKnights':
      return deity.bonuses.mountedKnightUpkeep ?? baseUpkeep;
    case 'lightHorse':
      return baseUpkeep; // No deity modifies light horse
    default:
      return baseUpkeep;
  }
}

export default function ArmyCard({
  army,
  isOwner,
  characters = [],
  allArmies = [],
  allRegions = [], // NEW: All regions for location dropdown
  patronDeity,
  courtBonuses,
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
    .flatMap(a => a.commanders || [])
    .filter(Boolean); // Filter out any undefined/null values
  
  const availableCharacters = characters.filter(
    char => char && char.id && !commandersInOtherArmies.includes(char.id)
  );

  // Get deity bonuses
  const deity = patronDeity ? DEITIES[patronDeity] : null;
  const leadershipBonus = deity?.bonuses.characterLeadership || 0;
  const prowessBonus = deity?.bonuses.characterProwess || 0;
  
  // Calculate movement range (Kurimbor deity gives extended range)
  const moveRange = patronDeity === 'kurimbor' ? ARMY_MOVE_RANGE_KURIMBOR : ARMY_MOVE_RANGE;

  // Calculate unit upkeeps with deity bonuses
  const unitData = [
    { 
      key: "huscarls", 
      label: "Huscarls", 
      baseUpkeep: 2,
      count: huscarls
    },
    { 
      key: "dismountedKnights", 
      label: "Dismounted Knights", 
      baseUpkeep: 3,
      count: dismountedKnights
    },
    { 
      key: "mountedKnights", 
      label: "Mounted Knights", 
      baseUpkeep: 4,
      count: mountedKnights
    },
    { 
      key: "lightHorse", 
      label: "Light Horse", 
      baseUpkeep: 2,
      count: lightHorse
    },
  ].map(u => ({
    ...u,
    modifiedUpkeep: getModifiedUpkeep(u.key, u.baseUpkeep, patronDeity),
    hasBonus: getModifiedUpkeep(u.key, u.baseUpkeep, patronDeity) !== u.baseUpkeep
  }));

  // Get valid movement destinations (adjacent regions only, or all if no current location)
  const validMoveDestinations = location
    ? getAdjacentRegions(location, allRegions)
    : allRegions;
  
  // Sort regions for dropdown - by code then by name
  const sortedRegions = [...validMoveDestinations].sort((a, b) => {
    if (a.code && b.code) return a.code.localeCompare(b.code);
    if (a.code) return -1;
    if (b.code) return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  // Get current location display
  const currentRegion = allRegions.find(r => r.code === location || r.id === location);
  const locationDisplay = currentRegion 
    ? `[${currentRegion.code}] ${currentRegion.name}`
    : location || 'No location set';

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
          
          {/* Location Dropdown */}
          <div style={{ marginTop: 4 }}>
            {location && (
              <div style={{ 
                fontSize: 11, 
                color: "#a89a7a", 
                marginBottom: 2,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
                <span>Current: [{location}]</span>
                <span style={{ color: "#7db5d1" }}>
                  • Move to adjacent ({sortedRegions.filter(r => r.code !== location).length} options)
                </span>
              </div>
            )}
            <select
              value={location || ""}
              disabled={!isOwner}
              onChange={(e) => onChangeField(id, "location", e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid #4c3b2a",
                background: "#1b130d",
                color: "#e7dfd2",
                fontSize: 13,
                fontFamily: "Georgia, serif",
                cursor: isOwner ? "pointer" : "not-allowed",
              }}
            >
              {!location && <option value="">-- Select Starting Location --</option>}
              {location && <option value={location}>[{location}] (Current - Stay)</option>}
              {sortedRegions
                .filter(r => r.code !== location)
                .map(region => (
                <option key={region.id} value={region.code || region.id}>
                  [{region.code || '??'}] {region.name || 'Unnamed'} 
                  {region.underSiege ? ' (SIEGE)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Movement bonus indicator */}
          {deity?.bonuses.armyMovement && (
            <div
              style={{
                marginTop: 6,
                padding: "4px 8px",
                background: "#1a2f1a",
                borderRadius: 4,
                border: "1px solid #2a4f2a",
                fontSize: 12,
                color: "#b5e8a1",
              }}
            >
               Movement: 2 regions per turn (Kurimbor's blessing)
            </div>
          )}

          {/* Commanders Display */}
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
                {commanderObjects.map((cmd) => {
                  const wieldsmercy = courtBonuses?.prowessBonus?.[cmd.id] === 6;
                  const mercyBonus = wieldsmercy ? 6 : 0;
                  const totalProwessBonus = prowessBonus + mercyBonus;
                  
                  return (
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
                        {wieldsmercy && (
                          <span style={{ 
                            color: "#FFD700", 
                            fontSize: "11px",
                            marginLeft: "4px",
                            fontStyle: "italic"
                          }}>
                            (Mercy)
                          </span>
                        )}
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
                          {wieldsmercy && (
                            <span style={{ color: "#FFD700", fontWeight: "bold" }}>
                              {" "}(+6)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
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
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>Select Commanders (Max 3)</span>
                      <span style={{ 
                        color: selectedCommanders.length > 0 ? "#b5e8a1" : "#a89a7a",
                        fontWeight: "normal"
                      }}>
                        {selectedCommanders.length} selected
                      </span>
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
                              <div
                                key={char.id}
                                onClick={() => toggleCommander(char.id)}
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
                                  readOnly
                                  style={{ margin: 0, pointerEvents: "none" }}
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
                              </div>
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
                              background: selectedCommanders.length > 0 ? "#4a6642" : "#3a3020",
                              borderColor: selectedCommanders.length > 0 ? "#5a7a52" : "#5e4934",
                            }}
                          >
                            Save ({selectedCommanders.length})
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
        {(deity?.bonuses.huscarlUpkeep || deity?.bonuses.dismountedKnightUpkeep || deity?.bonuses.mountedKnightUpkeep) && (
          <span style={{ fontSize: 11, color: "#b5e8a1", fontWeight: "normal" }}>
            {" "}(deity bonuses active)
          </span>
        )}
      </h3>
      <div className="army-grid">
        {unitData.map((u) => {
          return (
            <div key={u.key} className="army-item">
              <div className="army-item-header">
                <span>{u.label}</span>
                <span>
                  {u.hasBonus ? (
                    <>
                      <span style={{ textDecoration: "line-through", opacity: 0.5 }}>
                        {u.baseUpkeep}
                      </span>{" "}
                      <span style={{ color: "#b5e8a1", fontWeight: "bold" }}>
                        {u.modifiedUpkeep}
                      </span>
                    </>
                  ) : (
                    u.baseUpkeep
                  )}
                  g/unit
                  {u.hasBonus && u.key === 'huscarls' && patronDeity === 'erigan' && (
                    <span style={{ fontSize: 10, color: "#b5e8a1" }}> (Erigan)</span>
                  )}
                  {u.hasBonus && u.key === 'dismountedKnights' && patronDeity === 'durren' && (
                    <span style={{ fontSize: 10, color: "#b5e8a1" }}> (Durren)</span>
                  )}
                  {u.hasBonus && u.key === 'mountedKnights' && patronDeity === 'durren' && (
                    <span style={{ fontSize: 10, color: "#b5e8a1" }}> (Durren)</span>
                  )}
                </span>
              </div>
              <div className="army-controls">
                <button
                  disabled={!isOwner}
                  onClick={() => onChangeUnit(id, u.key, -1)}
                >
                  -
                </button>
                <div className="army-count">{u.count}</div>
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
        {deity?.bonuses.levyInfantryCF && (
          <span style={{ fontSize: 11, color: "#b5e8a1", fontWeight: "normal" }}>
            {" "}(Seyluna: Infantry +1 CF)
          </span>
        )}
      </h3>
      <div className="army-grid">
        <div className="army-item">
          <div className="army-item-header">
            <span>
              Levy Infantry (units of 10)
              {deity?.bonuses.levyInfantryCF && (
                <span style={{ fontSize: 10, color: "#b5e8a1" }}> +1 CF</span>
              )}
            </span>
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