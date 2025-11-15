// RegionCard.jsx - Replace the entire file

import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { canAddBuilding, getTerrainInfo, TERRAIN_TYPES } from "../config/terrainRules";

const SETTLEMENTS = ["Village", "Town", "City"];

export default function RegionCard({ region, eco, role, myFactionId }) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(region.notes || "");
  const [regionName, setRegionName] = useState(region.name || "");
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    setNotes(region.notes || "");
  }, [region.notes]);

  useEffect(() => {
    setRegionName(region.name || "");
  }, [region.name]);

  const upgrades = region.upgrades || [];

  const isGM = role === "gm";
  const isOwner = (role === "faction" && myFactionId === region.owner) || isGM;

  // Terrain info
  const terrain = region.terrain || TERRAIN_TYPES.PLAINS;
  const terrainInfo = getTerrainInfo(terrain);

  // Count helpers
  const count = (name) => upgrades.filter((u) => u === name).length;
  const countGroup = (names) => upgrades.filter((u) => names.includes(u)).length;

  function getSettlement() {
    if (upgrades.includes("City")) return "City";
    if (upgrades.includes("Town")) return "Town";
    if (upgrades.includes("Village")) return "Village";
    return "None";
  }

  async function updateRegionFields(fields) {
    await updateDoc(doc(db, "regions", region.id), fields);
  }

  async function updateUpgrades(newUps) {
    await updateRegionFields({ upgrades: newUps, disabledUpgrades: [] });
  }

  // Settlement controls
  async function setSettlement(type) {
    if (!isOwner) return;

    const current = getSettlement();
    let newUps = upgrades.filter((u) => !SETTLEMENTS.includes(u));

    if (type === "None") {
      await updateUpgrades(newUps);
      return;
    }

    const check = canAddBuilding(terrain, type, upgrades);
    if (!check.allowed) {
      window.alert(check.reason);
      return;
    }

    if (type === "Village") {
      if (current !== "None") {
        window.alert("Only one settlement per region.");
        return;
      }
    }

    if (type === "Town") {
      if (current === "City") {
        window.alert("Already a City.");
        return;
      }
      if (!eco || eco.farmEquivalent < 4 || eco.mineEquivalent < 1) {
        window.alert("Requires 4 Farms (eq) and 1 Mine to become a Town.");
        return;
      }
    }

    if (type === "City") {
      if (!eco || eco.farmEquivalent < 6 || eco.mineEquivalent < 2) {
        window.alert("Requires 6 Farms (eq) and 2 Mine equivalents to become a City.");
        return;
      }
    }

    newUps.push(type);
    await updateUpgrades(newUps);
  }

  // Farm management
  async function addFarm() {
    if (!isOwner) return;
    const check = canAddBuilding(terrain, "Farm", upgrades);
    if (!check.allowed) {
      window.alert(check.reason);
      return;
    }
    const farmGroup = countGroup(["Farm", "Farm2"]);
    if (farmGroup >= terrainInfo.maxFarms) {
      window.alert(`Max ${terrainInfo.maxFarms} farms in ${terrainInfo.name}.`);
      return;
    }
    await updateUpgrades([...upgrades, "Farm"]);
  }

  async function upgradeFarm() {
    if (!isOwner) return;
    const farmIdx = upgrades.indexOf("Farm");
    if (farmIdx === -1) {
      window.alert("No Farm to upgrade.");
      return;
    }
    const newUps = [...upgrades];
    newUps[farmIdx] = "Farm2";
    await updateUpgrades(newUps);
  }

  async function removeFarm() {
    if (!isOwner) return;
    let newUps = [...upgrades];
    const farm2Idx = newUps.indexOf("Farm2");
    if (farm2Idx !== -1) {
      newUps.splice(farm2Idx, 1);
    } else {
      const farmIdx = newUps.indexOf("Farm");
      if (farmIdx !== -1) {
        newUps.splice(farmIdx, 1);
      }
    }
    await updateUpgrades(newUps);
  }

  // Mine management
  async function addMine() {
    if (!isOwner) return;
    const check = canAddBuilding(terrain, "Mine", upgrades);
    if (!check.allowed) {
      window.alert(check.reason);
      return;
    }
    const mineGroup = countGroup(["Mine", "Mine2"]);
    if (mineGroup >= terrainInfo.maxMines) {
      window.alert(`Max ${terrainInfo.maxMines} mines in ${terrainInfo.name}.`);
      return;
    }
    await updateUpgrades([...upgrades, "Mine"]);
  }

  async function upgradeMine() {
    if (!isOwner) return;
    const mineIdx = upgrades.indexOf("Mine");
    if (mineIdx === -1) {
      window.alert("No Mine to upgrade.");
      return;
    }
    const newUps = [...upgrades];
    newUps[mineIdx] = "Mine2";
    await updateUpgrades(newUps);
  }

  async function removeMine() {
    if (!isOwner) return;
    let newUps = [...upgrades];
    const mine2Idx = newUps.indexOf("Mine2");
    if (mine2Idx !== -1) {
      newUps.splice(mine2Idx, 1);
    } else {
      const mineIdx = newUps.indexOf("Mine");
      if (mineIdx !== -1) {
        newUps.splice(mineIdx, 1);
      }
    }
    await updateUpgrades(newUps);
  }

  // Fortifications
  const hasKeep = upgrades.includes("Keep");
  const hasCastle = upgrades.includes("Castle");

  async function toggleKeep() {
    if (!isOwner) return;
    let newUps = [...upgrades];
    if (hasKeep) {
      newUps = newUps.filter((u) => u !== "Keep" && u !== "Castle");
    } else {
      const check = canAddBuilding(terrain, "Keep", upgrades);
      if (!check.allowed) {
        window.alert(check.reason);
        return;
      }
      newUps.push("Keep");
    }
    await updateUpgrades(newUps);
  }

  async function upgradeToCastle() {
    if (!isOwner) return;
    if (!hasKeep) {
      window.alert("Need Keep first.");
      return;
    }
    const check = canAddBuilding(terrain, "Castle", upgrades);
    if (!check.allowed) {
      window.alert(check.reason);
      return;
    }
    await updateUpgrades([...upgrades, "Castle"]);
  }

  async function removeCastle() {
    if (!isOwner) return;
    const newUps = upgrades.filter((u) => u !== "Castle");
    await updateUpgrades(newUps);
  }

  async function saveNotes() {
    if (!isOwner) return;
    await updateRegionFields({ notes });
  }

  async function saveRegionName() {
    await updateRegionFields({ name: regionName });
    setIsEditingName(false);
  }

  function cancelEditName() {
    setRegionName(region.name || "");
    setIsEditingName(false);
  }

  async function deleteRegion() {
    if (!isGM) return;
    if (!window.confirm("Delete this region permanently?")) return;
    await deleteDoc(doc(db, "regions", region.id));
  }

  async function changeOwner(newOwner) {
    if (!isGM) return;
    await updateRegionFields({ owner: Number(newOwner) });
  }

  const settlement = getSettlement();
  const farmCount = count("Farm");
  const farm2Count = count("Farm2");
  const mineCount = count("Mine");
  const mine2Count = count("Mine2");

  // Summary for collapsed view
  const summaryParts = [];
  if (farmCount) summaryParts.push(`${farmCount} Farm`);
  if (farm2Count) summaryParts.push(`${farm2Count} Farm2`);
  if (mineCount) summaryParts.push(`${mineCount} Mine`);
  if (mine2Count) summaryParts.push(`${mine2Count} Mine2`);
  if (hasKeep) summaryParts.push("Keep");
  if (hasCastle) summaryParts.push("Castle");
  const summaryText = summaryParts.length ? summaryParts.join(" • ") : "No buildings";

  // Settlement prerequisites
  const canUpgradeToTown = eco && eco.farmEquivalent >= 4 && eco.mineEquivalent >= 1;
  const canUpgradeToCity = eco && eco.farmEquivalent >= 6 && eco.mineEquivalent >= 2;

  return (
    <div className="card" style={{ marginBottom: "12px" }}>
      {/* Header - always visible */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ flex: "1 1 auto", minWidth: "200px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "15px",
                fontWeight: 700,
                backgroundColor: "#30425d",
                border: "1.5px solid #4a5d7a",
                color: "#f8f4e6",
              }}
            >
              {region.code || region.name}
            </span>
            
            {isEditingName ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  autoFocus
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid #5e4934",
                    background: "#1d1610",
                    color: "#f4efe4",
                    fontFamily: "Georgia, serif",
                    fontSize: "16px",
                    minWidth: "150px",
                  }}
                />
                <button
                  onClick={saveRegionName}
                  className="small"
                  style={{
                    margin: 0,
                    padding: "4px 10px",
                    minHeight: "28px",
                    background: "#4a6642",
                    borderColor: "#5a7a52",
                  }}
                >
                  ✓
                </button>
                <button
                  onClick={cancelEditName}
                  className="small"
                  style={{
                    margin: 0,
                    padding: "4px 10px",
                    minHeight: "28px",
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ margin: 0, display: "inline" }}>
                  {regionName || "(unnamed)"}
                </h2>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingName(true);
                  }}
                  className="small"
                  style={{
                    margin: 0,
                    padding: "4px 8px",
                    minHeight: "28px",
                    background: "transparent",
                    border: "1px solid #5e4934",
                  }}
                  title="Edit region name"
                >
                  ✏️
                </button>
              </>
            )}
            
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 10px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                backgroundColor: terrainInfo.color + "33",
                border: `1.5px solid ${terrainInfo.color}`,
                color: "#f8f4e6",
              }}
            >
              <span style={{ fontSize: "16px" }}>{terrainInfo.icon}</span>
              <span>{terrainInfo.name}</span>
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "14px" }}>
            <strong>Owner:</strong> Faction {region.owner} • <strong>Settlement:</strong> {settlement}
          </p>
          {!expanded && (
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#aaa" }}>
              {summaryText}
            </p>
          )}
        </div>
        
        {/* Settlement buttons + Expand/Collapse */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {isOwner && ["None", "Village", "Town", "City"].map((s) => {
            const isCurrent = settlement === s;
            const isDisabled = (s === "Town" && !canUpgradeToTown) || (s === "City" && !canUpgradeToCity);
            
            return (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); setSettlement(s); }}
                disabled={isDisabled}
                className="small"
                style={{
                  background: isCurrent ? "#30425d" : undefined,
                  borderColor: isCurrent ? "#4a5d7a" : undefined,
                  opacity: isDisabled ? 0.5 : 1,
                  margin: "0 2px",
                  padding: "4px 8px",
                  minHeight: "28px",
                }}
              >
                {s}
              </button>
            );
          })}
          <button
            type="button"
            className="small"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              margin: "0 0 0 4px",
              minHeight: "28px",
            }}
          >
            {expanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{ marginTop: "16px" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* GM Controls */}
          {isGM && (
            <div className="card" style={{ marginBottom: "12px", padding: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <strong>GM Controls</strong>
                <button
                  onClick={deleteRegion}
                  className="small"
                  style={{ background: "#990000", borderColor: "#660000", margin: "0", padding: "4px 10px", minHeight: "28px" }}
                >
                  Delete Region
                </button>
              </div>
              <label style={{ fontSize: "13px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span>Transfer to faction:</span>
                <select
                  value={region.owner}
                  onChange={(e) => changeOwner(e.target.value)}
                  style={{
                    padding: "6px",
                    borderRadius: "6px",
                    border: "1px solid #555",
                    background: "#222",
                    color: "white",
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
                    <option key={f} value={f}>
                      Faction {f}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Resources, Fortifications, Notes in 3 columns (stacks on mobile) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
            {/* Resources */}
            <div>
              <h3 style={{ fontSize: "16px", marginTop: 0, marginBottom: "8px" }}>
                Resources (max in {terrainInfo.name})
              </h3>
              
              {/* Terrain info */}
              {(terrainInfo.bonuses?.length > 0 || terrainInfo.penalties?.length > 0) && (
                <div style={{ 
                  fontSize: "12px", 
                  marginBottom: "10px", 
                  padding: "6px 8px", 
                  background: "#1a1410",
                  borderRadius: "6px",
                  border: "1px solid #3a2f24"
                }}>
                  {terrainInfo.bonuses?.length > 0 && (
                    <div style={{ color: "#b5e8a1", marginBottom: terrainInfo.penalties?.length > 0 ? "4px" : "0" }}>
                      + {terrainInfo.bonuses.join(", ")}
                    </div>
                  )}
                  {terrainInfo.penalties?.length > 0 && (
                    <div style={{ color: "#f97373" }}>
                      − {terrainInfo.penalties.join(", ")}
                    </div>
                  )}
                </div>
              )}
              
              {/* Farms */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "14px", marginBottom: "4px" }}>
                  Farms: <strong>{farmCount + farm2Count} / {terrainInfo.maxFarms}</strong>
                  {farm2Count > 0 && ` (${farm2Count} upgraded)`}
                </div>
                {isOwner && (
                  <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                    <button className="small" onClick={addFarm} style={{ margin: "2px 0", padding: "3px 8px", minHeight: "26px" }}>+ Farm</button>
                    {farmCount > 0 && <button className="small" onClick={upgradeFarm} style={{ margin: "2px 0", padding: "3px 8px", minHeight: "26px" }}>Upgrade</button>}
                    {(farmCount > 0 || farm2Count > 0) && <button className="small" onClick={removeFarm} style={{ margin: "2px 0", padding: "3px 8px", minHeight: "26px" }}>Remove</button>}
                  </div>
                )}
              </div>

              {/* Mines */}
              <div>
                <div style={{ fontSize: "14px", marginBottom: "4px" }}>
                  Mines: <strong>{mineCount + mine2Count} / {terrainInfo.maxMines}</strong>
                  {mine2Count > 0 && ` (${mine2Count} upgraded)`}
                </div>
                {isOwner && (
                  <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                    <button className="small" onClick={addMine} style={{ margin: "2px 0", padding: "3px 8px", minHeight: "26px" }}>+ Mine</button>
                    {mineCount > 0 && <button className="small" onClick={upgradeMine} style={{ margin: "2px 0", padding: "3px 8px", minHeight: "26px" }}>Upgrade</button>}
                    {(mineCount > 0 || mine2Count > 0) && <button className="small" onClick={removeMine} style={{ margin: "2px 0", padding: "3px 8px", minHeight: "26px" }}>Remove</button>}
                  </div>
                )}
              </div>
            </div>

            {/* Fortifications */}
            <div>
              <h3 style={{ fontSize: "16px", marginTop: 0, marginBottom: "8px" }}>Fortifications</h3>
              <div style={{ fontSize: "14px", marginBottom: "4px" }}>
                Keep: <strong>{hasKeep ? "Yes" : "No"}</strong>
              </div>
              <div style={{ fontSize: "14px", marginBottom: "4px" }}>
                Castle: <strong>{hasCastle ? "Yes" : "No"}</strong>
              </div>
              {isOwner && (
                <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginTop: "6px" }}>
                  {!hasKeep && <button className="small" onClick={toggleKeep} style={{ margin: "2px 0", padding: "3px 8px", minHeight: "26px" }}>Add Keep</button>}
                  {hasKeep && !hasCastle && (
                    <>
                      <button className="small" onClick={upgradeToCastle} style={{ margin: "2px 0", padding: "3px 8px", minHeight: "26px" }}>→ Castle</button>
                      <button className="small" onClick={toggleKeep} style={{ margin: "2px 0", padding: "3px 8px", minHeight: "26px" }}>Remove Keep</button>
                    </>
                  )}
                  {hasCastle && <button className="small" onClick={removeCastle} style={{ margin: "2px 0", padding: "3px 8px", minHeight: "26px" }}>Remove Castle</button>}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <h3 style={{ fontSize: "16px", marginTop: 0, marginBottom: "8px" }}>Notes</h3>
              {isOwner ? (
                <>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{
                      width: "100%",
                      height: "80px",
                      background: "#222",
                      color: "white",
                      padding: "8px",
                      borderRadius: "6px",
                      border: "1px solid #444",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                  <button onClick={saveNotes} className="small" style={{ marginTop: "4px", margin: "4px 0 0 0", padding: "3px 8px", minHeight: "26px" }}>
                    Save Notes
                  </button>
                </>
              ) : (
                <p style={{ fontSize: "13px", margin: 0 }}>{notes || "No notes."}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}