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
  const disabledUpgrades = region.disabledUpgrades || [];

  const isGM = role === "gm";
  const isOwner = role === "faction" && myFactionId === region.owner;

  // ----- terrain info -----
  const terrain = region.terrain || TERRAIN_TYPES.PLAINS;
  const terrainInfo = getTerrainInfo(terrain);

  // ----- generic helpers -----
  const count = (name) => upgrades.filter((u) => u === name).length;
  const disabledCount = (name) =>
    disabledUpgrades.filter((u) => u === name).length;
  const activeCount = (name) => Math.max(0, count(name) - disabledCount(name));
  const countGroup = (names) =>
    upgrades.filter((u) => names.includes(u)).length;

  function getSettlement() {
    if (upgrades.includes("City")) return "City";
    if (upgrades.includes("Town")) return "Town";
    if (upgrades.includes("Village")) return "Village";
    return "None";
  }

  async function updateRegionFields(fields) {
    await updateDoc(doc(db, "regions", region.id), fields);
  }

  async function updateUpgrades(newUps, newDisabled) {
    await updateRegionFields({
      upgrades: newUps,
      disabledUpgrades: newDisabled ?? disabledUpgrades,
    });
  }

  function normalizeDisabledFor(names, newUps, disabled) {
    let result = [...disabled];
    names.forEach((name) => {
      const total = newUps.filter((u) => u === name).length;
      let dCount = result.filter((u) => u === name).length;
      while (dCount > total) {
        const idx = result.indexOf(name);
        if (idx === -1) break;
        result.splice(idx, 1);
        dCount--;
      }
    });
    return result;
  }

  // ----- settlement controls -----
  async function setSettlement(type) {
    if (!isOwner) return;

    const current = getSettlement();
    let newUps = upgrades.filter((u) => !SETTLEMENTS.includes(u));

    if (type === "None") {
      await updateUpgrades(newUps);
      return;
    }

    // Check terrain restrictions for settlements
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
      if (!eco) {
        window.alert("Economy not loaded yet.");
        return;
      }
      if (eco.farmEquivalent < 4 || eco.mineEquivalent < 1) {
        window.alert(
          "Requires 4 Farms (eq) and 1 Mine to become a Town (any regions)."
        );
        return;
      }
    }

    if (type === "City") {
      if (!eco) {
        window.alert("Economy not loaded yet.");
        return;
      }
      if (eco.farmEquivalent < 6 || eco.mineEquivalent < 2) {
        window.alert(
          "Requires 6 Farms (eq) and 1 Mine2 (2 mine equivalents) to become a City (any regions)."
        );
        return;
      }
    }

    newUps.push(type);
    await updateUpgrades(newUps);
  }

  // ----- farms -----
  async function addFarm() {
    if (!isOwner) return;
    
    // Check terrain restrictions
    const check = canAddBuilding(terrain, "Farm", upgrades);
    if (!check.allowed) {
      window.alert(check.reason);
      return;
    }
    
    const farmGroup = countGroup(["Farm", "Farm2"]);
    if (farmGroup >= 3) {
      window.alert("Max 3 farms (including Farm2) per region.");
      return;
    }
    const newUps = [...upgrades, "Farm"];
    const newDisabled = normalizeDisabledFor(
      ["Farm", "Farm2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function removeFarm() {
    if (!isOwner) return;
    const idx = upgrades.indexOf("Farm");
    if (idx === -1) return;
    const newUps = [...upgrades];
    newUps.splice(idx, 1);
    const newDisabled = normalizeDisabledFor(
      ["Farm", "Farm2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function addFarm2() {
    if (!isOwner) return;
    
    // Check terrain restrictions
    const check = canAddBuilding(terrain, "Farm2", upgrades);
    if (!check.allowed) {
      window.alert(check.reason);
      return;
    }
    
    const farmGroup = countGroup(["Farm", "Farm2"]);
    let newUps = [...upgrades];

    const farmIdx = newUps.indexOf("Farm");
    if (farmIdx !== -1) {
      newUps[farmIdx] = "Farm2";
    } else {
      if (farmGroup >= 3) {
        window.alert("Max 3 farms (including Farm2) per region.");
        return;
      }
      newUps.push("Farm2");
    }

    const newDisabled = normalizeDisabledFor(
      ["Farm", "Farm2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function removeFarm2() {
    if (!isOwner) return;
    const idx = upgrades.indexOf("Farm2");
    if (idx === -1) return;
    const newUps = [...upgrades];
    newUps.splice(idx, 1);
    const newDisabled = normalizeDisabledFor(
      ["Farm", "Farm2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  // ----- mines -----
  async function addMine() {
    if (!isOwner) return;
    
    // Check terrain restrictions
    const check = canAddBuilding(terrain, "Mine", upgrades);
    if (!check.allowed) {
      window.alert(check.reason);
      return;
    }
    
    const mineGroup = countGroup(["Mine", "Mine2"]);
    if (mineGroup >= 3) {
      window.alert("Max 3 mines (including Mine2) per region.");
      return;
    }
    const newUps = [...upgrades, "Mine"];
    const newDisabled = normalizeDisabledFor(
      ["Mine", "Mine2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function removeMine() {
    if (!isOwner) return;
    const idx = upgrades.indexOf("Mine");
    if (idx === -1) return;
    const newUps = [...upgrades];
    newUps.splice(idx, 1);
    const newDisabled = normalizeDisabledFor(
      ["Mine", "Mine2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function addMine2() {
    if (!isOwner) return;
    
    // Check terrain restrictions
    const check = canAddBuilding(terrain, "Mine2", upgrades);
    if (!check.allowed) {
      window.alert(check.reason);
      return;
    }
    
    const mineGroup = countGroup(["Mine", "Mine2"]);
    let newUps = [...upgrades];

    const mineIdx = newUps.indexOf("Mine");
    if (mineIdx !== -1) {
      newUps[mineIdx] = "Mine2";
    } else {
      if (mineGroup >= 3) {
        window.alert("Max 3 mines (including Mine2) per region.");
        return;
      }
      newUps.push("Mine2");
    }

    const newDisabled = normalizeDisabledFor(
      ["Mine", "Mine2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function removeMine2() {
    if (!isOwner) return;
    const idx = upgrades.indexOf("Mine2");
    if (idx === -1) return;
    const newUps = [...upgrades];
    newUps.splice(idx, 1);
    const newDisabled = normalizeDisabledFor(
      ["Mine", "Mine2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  // ----- forts -----
  const hasKeep = upgrades.includes("Keep");
  const hasCastle = upgrades.includes("Castle");

  async function toggleKeep() {
    if (!isOwner) return;
    
    // Check terrain restrictions
    if (!hasKeep) {
      const check = canAddBuilding(terrain, "Keep", upgrades);
      if (!check.allowed) {
        window.alert(check.reason);
        return;
      }
    }
    
    let newUps = [...upgrades];
    let newDisabled = [...disabledUpgrades];

    if (hasKeep) {
      newUps = newUps.filter((u) => u !== "Keep" && u !== "Castle");
      newDisabled = normalizeDisabledFor(
        ["Keep", "Castle"],
        newUps,
        newDisabled
      );
    } else {
      newUps.push("Keep");
    }
    await updateUpgrades(newUps, newDisabled);
  }

  async function toggleCastle() {
    if (!isOwner) return;
    let newUps = [...upgrades];
    let newDisabled = [...disabledUpgrades];

    if (!hasKeep) {
      window.alert("You must have a Keep to upgrade to Castle.");
      return;
    }

    // Check terrain restrictions
    if (!hasCastle) {
      const check = canAddBuilding(terrain, "Castle", upgrades);
      if (!check.allowed) {
        window.alert(check.reason);
        return;
      }
    }

    if (hasCastle) {
      newUps = newUps.filter((u) => u !== "Castle");
      newDisabled = normalizeDisabledFor(["Castle"], newUps, newDisabled);
    } else {
      newUps.push("Castle");
    }
    await updateUpgrades(newUps, newDisabled);
  }

  async function disableOne(name) {
    if (!isOwner) return;
    if (activeCount(name) <= 0) return;
    const newDisabled = [...disabledUpgrades, name];
    await updateRegionFields({ disabledUpgrades: newDisabled });
  }

  async function enableOne(name) {
    if (!isOwner) return;
    const idx = disabledUpgrades.indexOf(name);
    if (idx === -1) return;
    const newDisabled = [...disabledUpgrades];
    newDisabled.splice(idx, 1);
    await updateRegionFields({ disabledUpgrades: newDisabled });
  }

  async function saveNotes() {
    if (!isOwner) return;
    await updateRegionFields({ notes });
  }

  async function saveRegionName() {
    if (!isGM) return;
    await updateRegionFields({ name: regionName });
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

  // counts
  const farmCount = count("Farm");
  const farm2Count = count("Farm2");
  const mineCount = count("Mine");
  const mine2Count = count("Mine2");

  const farmActive = activeCount("Farm");
  const farm2Active = activeCount("Farm2");
  const farmDisabled = disabledCount("Farm");
  const farm2Disabled = disabledCount("Farm2");

  const mineActive = activeCount("Mine");
  const mine2Active = activeCount("Mine2");
  const mineDisabled = disabledCount("Mine");
  const mine2Disabled = disabledCount("Mine2");

  const keepActive = activeCount("Keep");
  const keepDisabled = disabledCount("Keep");
  const castleActive = activeCount("Castle");
  const castleDisabled = disabledCount("Castle");

  // short line under name
  const summaryBuildings = [
    farmActive || farm2Active
      ? `Farms: ${farmActive} / Farm2: ${farm2Active}`
      : null,
    mineActive || mine2Active
      ? `Mines: ${mineActive} / Mine2: ${mine2Active}`
      : null,
    keepActive ? `Keep` : null,
    castleActive ? `Castle` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="card" style={{ marginBottom: "12px" }}>
      {/* header */}
      <div
        className="region-header-row"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          gap: "10px",
          flexWrap: "wrap",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <div style={{ flex: "1 1 auto", minWidth: "200px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
            {/* Region Code Badge */}
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
            
            {/* Editable Region Name */}
            {isGM ? (
              isEditingName ? (
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={regionName}
                    onChange={(e) => setRegionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveRegionName();
                      if (e.key === 'Escape') {
                        setRegionName(region.name || "");
                        setIsEditingName(false);
                      }
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid #555",
                      background: "#1d1610",
                      color: "#f8f4e6",
                      fontSize: "15px",
                      fontWeight: 600,
                      minWidth: "150px",
                    }}
                    autoFocus
                  />
                  <button
                    onClick={saveRegionName}
                    className="small"
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                      background: "#0066cc",
                      borderColor: "#004d99",
                    }}
                  >
                    Save
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRegionName(region.name || "");
                      setIsEditingName(false);
                    }}
                    className="small"
                    style={{
                      padding: "4px 8px",
                      fontSize: "12px",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <h2 
                  style={{ 
                    margin: 0, 
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingName(true);
                  }}
                  title="Click to edit name"
                >
                  {regionName || "(unnamed)"}
                  <span style={{ fontSize: "14px", color: "#888" }}>✎</span>
                </h2>
              )
            ) : (
              <h2 style={{ margin: 0 }}>
                {regionName || "(unnamed)"}
              </h2>
            )}
            
            {/* Terrain Badge */}
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
              title={terrainInfo.description}
            >
              <span style={{ fontSize: "16px" }}>{terrainInfo.icon}</span>
              <span>{terrainInfo.name}</span>
            </span>
          </div>
          <p style={{ margin: 0 }}>
            <strong>Owner:</strong> Faction {region.owner} •{" "}
            <strong>Settlement:</strong> {settlement}
          </p>
          {summaryBuildings && (
            <p style={{ margin: 0, fontSize: "13px", color: "#aaa" }}>
              {summaryBuildings}
            </p>
          )}
        </div>
        <button
          type="button"
          className="small"
          style={{
            padding: "6px 12px",
            borderRadius: "999px",
            border: "1px solid #555",
            background: "#111",
            color: "white",
            fontSize: "13px",
            flexShrink: 0,
          }}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {!expanded && (
        <p style={{ marginTop: "6px", fontSize: "12px", color: "#777" }}>
          Click to quickly edit settlement, buildings, forts, and notes.
        </p>
      )}

      {/* compact expanded grid */}
      {expanded && (
        <div
          style={{
            marginTop: "10px",
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.4fr)",
            gap: "12px",
          }}
          className="region-expanded-grid"
          onClick={(e) => e.stopPropagation()}
        >
          {/* LEFT COLUMN: terrain info + settlement + forts + notes (+ GM controls) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* Terrain Info Section */}
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: `2px solid ${terrainInfo.color}`,
                background: terrainInfo.color + "11",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                <span style={{ fontSize: "20px" }}>{terrainInfo.icon}</span>
                <strong style={{ fontSize: "15px" }}>{terrainInfo.name}</strong>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#ccc", fontStyle: "italic" }}>
                {terrainInfo.description}
              </p>
              
              {/* Building Limits */}
              <div style={{ fontSize: "12px", color: "#ddd" }}>
                <div style={{ marginBottom: "4px" }}>
                  <strong>Building Limits:</strong>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "2px 8px", paddingLeft: "8px" }}>
                  <span>Farms:</span>
                  <span>{terrainInfo.maxFarms}</span>
                  <span>Mines:</span>
                  <span>{terrainInfo.maxMines}</span>
                  <span>Settlements:</span>
                  <span>{terrainInfo.allowedSettlements ? terrainInfo.allowedSettlements.join(", ") : "Any"}</span>
                  <span>Keep:</span>
                  <span>{terrainInfo.canHaveKeep ? "✓" : "✗"}</span>
                  <span>Castle:</span>
                  <span>{terrainInfo.canHaveCastle ? "✓" : "✗"}</span>
                </div>
              </div>

              {/* Bonuses */}
              {terrainInfo.bonuses && terrainInfo.bonuses.length > 0 && (
                <div style={{ marginTop: "8px", fontSize: "12px" }}>
                  <strong style={{ color: "#6ba368" }}>Bonuses:</strong>
                  <ul style={{ margin: "2px 0 0", paddingLeft: "18px", color: "#ccc" }}>
                    {terrainInfo.bonuses.map((bonus, i) => (
                      <li key={i}>{bonus}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Penalties */}
              {terrainInfo.penalties && terrainInfo.penalties.length > 0 && (
                <div style={{ marginTop: "6px", fontSize: "12px" }}>
                  <strong style={{ color: "#f97373" }}>Penalties:</strong>
                  <ul style={{ margin: "2px 0 0", paddingLeft: "18px", color: "#ccc" }}>
                    {terrainInfo.penalties.map((penalty, i) => (
                      <li key={i}>{penalty}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {isGM && (
              <div
                style={{
                  padding: "8px 10px",
                  borderRadius: "10px",
                  border: "1px dashed #444",
                  background: "#141414",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <strong>GM Controls</strong>
                  </div>
                  <button
                    onClick={deleteRegion}
                    className="small"
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      background: "#990000",
                      border: "1px solid #660000",
                      color: "white",
                      fontSize: "12px",
                      minHeight: "32px",
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div style={{ marginTop: "6px" }}>
                  <label style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span>Transfer to faction:</span>
                    <select
                      value={region.owner}
                      onChange={(e) => changeOwner(e.target.value)}
                      style={{
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #555",
                        background: "#222",
                        color: "white",
                        fontSize: "13px",
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
              </div>
            )}

            {/* Settlement */}
            <div
              style={{
                padding: "8px 10px",
                borderRadius: "10px",
                border: "1px solid #333",
                background: "#141414",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                  flexWrap: "wrap",
                  gap: "6px",
                }}
              >
                <strong>Settlement</strong>
                <span style={{ fontSize: "12px", color: "#aaa", whiteSpace: "nowrap" }}>
                  Current: <strong>{settlement}</strong>
                </span>
              </div>
              {isOwner ? (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  <button className="small" onClick={() => setSettlement("None")}>None</button>
                  <button className="small" onClick={() => setSettlement("Village")}>
                    Village
                  </button>
                  <button className="small" onClick={() => setSettlement("Town")}>Town</button>
                  <button className="small" onClick={() => setSettlement("City")}>City</button>
                </div>
              ) : (
                <p style={{ color: "#aaa", fontSize: "12px", marginTop: "4px" }}>
                  Only the owning faction can change its settlement.
                </p>
              )}
            </div>

            {/* Fortifications */}
            <div
              style={{
                padding: "8px 10px",
                borderRadius: "10px",
                border: "1px solid #333",
                background: "#141414",
              }}
            >
              <strong>Fortifications</strong>
              <p style={{ margin: "4px 0 2px", fontSize: "13px" }}>
                Keep:{" "}
                <strong>
                  {keepActive} active / {keepDisabled} disabled
                </strong>
              </p>
              <p style={{ margin: "0 0 6px", fontSize: "13px" }}>
                Castle:{" "}
                <strong>
                  {castleActive} active / {castleDisabled} disabled
                </strong>
              </p>
              {isOwner ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      marginBottom: "4px",
                    }}
                  >
                    <button className="small" onClick={toggleKeep}>
                      {hasKeep ? "Remove Keep" : "Add Keep"}
                    </button>
                    <button className="small" onClick={toggleCastle}>
                      {hasCastle ? "Remove Castle" : "Upgrade → Castle"}
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    <button className="small" onClick={() => disableOne("Keep")}>
                      Disable Keep
                    </button>
                    <button className="small" onClick={() => enableOne("Keep")}>
                      Enable Keep
                    </button>
                    <button className="small" onClick={() => disableOne("Castle")}>
                      Disable Castle
                    </button>
                    <button className="small" onClick={() => enableOne("Castle")}>
                      Enable Castle
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ color: "#aaa", fontSize: "12px" }}>
                  Only the owning faction can change forts.
                </p>
              )}
            </div>

            {/* Notes */}
            <div
              style={{
                padding: "8px 10px",
                borderRadius: "10px",
                border: "1px solid #333",
                background: "#141414",
              }}
            >
              <strong>Notes</strong>
              {isOwner ? (
                <>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: "4px",
                      height: "70px",
                      background: "#222",
                      color: "white",
                      padding: "6px",
                      borderRadius: "6px",
                      border: "1px solid #444",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                  <button
                    onClick={saveNotes}
                    className="small"
                    style={{
                      marginTop: "6px",
                      padding: "6px 12px",
                      background: "#0066cc",
                      borderColor: "#004d99",
                    }}
                  >
                    Save
                  </button>
                </>
              ) : (
                <p style={{ marginTop: "4px", fontSize: "13px" }}>
                  {notes || "No notes."}
                </p>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: farms + mines */}
          <div
            style={{
              padding: "8px 10px",
              borderRadius: "10px",
              border: "1px solid #333",
              background: "#141414",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <strong>Resource Buildings</strong>

            {/* Farms */}
            <div>
              <h4
                style={{
                  margin: "4px 0",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Farms (max {terrainInfo.maxFarms} in {terrainInfo.name})
              </h4>
              <p style={{ margin: "0 0 2px", fontSize: "13px" }}>
                Farm:{" "}
                <strong>
                  {farmActive} active / {farmDisabled} disabled ({farmCount} total)
                </strong>
              </p>
              <p style={{ margin: "0 0 4px", fontSize: "13px" }}>
                Farm2:{" "}
                <strong>
                  {farm2Active} active / {farm2Disabled} disabled ({farm2Count} total)
                </strong>
              </p>
              {isOwner ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      marginBottom: "4px",
                    }}
                  >
                    <button className="small" onClick={addFarm}>+ Farm</button>
                    <button className="small" onClick={removeFarm}>- Farm</button>
                    <button className="small" onClick={addFarm2}>+ Farm2 (upgrade)</button>
                    <button className="small" onClick={removeFarm2}>- Farm2</button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    <button className="small" onClick={() => disableOne("Farm")}>
                      Disable Farm
                    </button>
                    <button className="small" onClick={() => enableOne("Farm")}>
                      Enable Farm
                    </button>
                    <button className="small" onClick={() => disableOne("Farm2")}>
                      Disable Farm2
                    </button>
                    <button className="small" onClick={() => enableOne("Farm2")}>
                      Enable Farm2
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ color: "#aaa", fontSize: "12px" }}>
                  Only the owning faction can modify farms.
                </p>
              )}
            </div>

            {/* Mines */}
            <div>
              <h4
                style={{
                  margin: "8px 0 4px",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
              >
                Mines (max {terrainInfo.maxMines} in {terrainInfo.name})
              </h4>
              <p style={{ margin: "0 0 2px", fontSize: "13px" }}>
                Mine:{" "}
                <strong>
                  {mineActive} active / {mineDisabled} disabled ({mineCount} total)
                </strong>
              </p>
              <p style={{ margin: "0 0 4px", fontSize: "13px" }}>
                Mine2:{" "}
                <strong>
                  {mine2Active} active / {mine2Disabled} disabled ({mine2Count} total)
                </strong>
              </p>
              {isOwner ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      marginBottom: "4px",
                    }}
                  >
                    <button className="small" onClick={addMine}>+ Mine</button>
                    <button className="small" onClick={removeMine}>- Mine</button>
                    <button className="small" onClick={addMine2}>+ Mine2 (upgrade)</button>
                    <button className="small" onClick={removeMine2}>- Mine2</button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    <button className="small" onClick={() => disableOne("Mine")}>
                      Disable Mine
                    </button>
                    <button className="small" onClick={() => enableOne("Mine")}>
                      Enable Mine
                    </button>
                    <button className="small" onClick={() => disableOne("Mine2")}>
                      Disable Mine2
                    </button>
                    <button className="small" onClick={() => enableOne("Mine2")}>
                      Enable Mine2
                    </button>
                  </div>
                </>
              ) : (
                <p style={{ color: "#aaa", fontSize: "12px" }}>
                  Only the owning faction can modify mines.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}