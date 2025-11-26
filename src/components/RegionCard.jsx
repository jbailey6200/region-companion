// components/RegionCard.jsx - FULL FILE WITH SIEGE FUNCTIONALITY

import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { doc, updateDoc, deleteDoc, collection, onSnapshot } from "firebase/firestore";
import { canAddBuilding, getTerrainInfo, TERRAIN_TYPES } from "../config/terrainRules";
import { BUILDING_RULES } from "../config/buildingRules";
import { DEITIES } from "../config/religionRules";

const SETTLEMENTS = ["Village", "Town", "City"];

export default function RegionCard({ region, eco, role, myFactionId, patronDeity, capital, onSetCapital }) {
  const [expanded, setExpanded] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [notes, setNotes] = useState(region.notes || "");
  const [regionName, setRegionName] = useState(region.name || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [factionNames, setFactionNames] = useState({});

  useEffect(() => {
    setNotes(region.notes || "");
  }, [region.notes]);

  useEffect(() => {
    setRegionName(region.name || "");
  }, [region.name]);

  // Load faction names
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "factions"), (snap) => {
      const names = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        const factionId = doc.id;
        names[factionId] = data.name || `Faction ${factionId}`;
      });
      setFactionNames(names);
    });

    return () => unsub();
  }, []);

  const upgrades = region.upgrades || [];

  const isGM = role === "gm";
  const isOwner = (role === "faction" && myFactionId === region.owner) || isGM;

  const terrain = region.terrain || TERRAIN_TYPES.PLAINS;
  const terrainInfo = getTerrainInfo(terrain);

  // Get deity for cost modifications
  const deity = patronDeity ? DEITIES[patronDeity] : null;

  const count = (name) => upgrades.filter((u) => u === name).length;
  const countGroup = (names) => upgrades.filter((u) => names.includes(u)).length;

  function getFactionName(factionId) {
    return factionNames[String(factionId)] || `Faction ${factionId}`;
  }

  function getSettlement() {
    if (upgrades.includes("City")) return "City";
    if (upgrades.includes("Town")) return "Town";
    if (upgrades.includes("Village")) return "Village";
    return "None";
  }

  // Helper function to get modified building cost
  function getModifiedBuildingCost(buildingType, baseCost) {
    if (!deity) return baseCost;
    
    // Umara: Fortifications cost half
    if ((buildingType === 'Keep' || buildingType === 'Castle') && deity.bonuses.fortificationCost) {
      return Math.round(baseCost * deity.bonuses.fortificationCost);
    }
    
    return baseCost;
  }

  function getSettlementRequirements(type) {
    const current = getSettlement();
    const villageCount = eco?.villageCount || 0;
    const townCount = eco?.townCount || 0;
    const cityCount = eco?.cityCount || 0;
    const farmEq = eco?.farmEquivalent || 0;
    const mineEq = eco?.mineEquivalent || 0;

    const requirements = {
      allowed: true,
      reasons: [],
      tooltip: "",
    };

    if (type === "None") return requirements;

    const terrainCheck = canAddBuilding(terrain, type, upgrades);
    if (!terrainCheck.allowed) {
      requirements.allowed = false;
      requirements.reasons.push(terrainCheck.reason);
    }

    if (current === type) {
      requirements.reasons.push(`Already ${type}`);
    }

    if (type === "Village") {
      if (current !== "None") {
        requirements.allowed = false;
        requirements.reasons.push("Only one settlement per region");
      }
      
      const neededVillages = current === "Village" ? villageCount : villageCount + 1;
      const requiredFarms = neededVillages * 2;
      
      if (farmEq < requiredFarms) {
        requirements.allowed = false;
        requirements.reasons.push(`Need ${requiredFarms} farms (have ${farmEq})`);
      } else {
        requirements.reasons.push(`Has ${requiredFarms} farms`);
      }
      
      requirements.reasons.push(`Cost: ${BUILDING_RULES.Village.buildCost}g`);
    }

    if (type === "Town") {
      if (current === "City") {
        requirements.allowed = false;
        requirements.reasons.push("Already a City");
      }
      
      const neededTowns = current === "Town" ? townCount : townCount + 1;
      const requiredFarms = neededTowns * 4;
      const requiredMines = neededTowns * 1;
      
      const missingReqs = [];
      if (farmEq < requiredFarms) {
        requirements.allowed = false;
        missingReqs.push(`farms: ${farmEq}/${requiredFarms}`);
      } else {
        requirements.reasons.push(`Has ${requiredFarms} farms`);
      }
      
      if (mineEq < requiredMines) {
        requirements.allowed = false;
        missingReqs.push(`mines: ${mineEq}/${requiredMines}`);
      } else {
        requirements.reasons.push(`Has ${requiredMines} mine${requiredMines > 1 ? 's' : ''}`);
      }
      
      if (missingReqs.length > 0) {
        requirements.reasons.unshift(`Need ${missingReqs.join(', ')}`);
      }
      
      requirements.reasons.push(`Cost: ${BUILDING_RULES.Town.buildCost}g${current === "Village" ? " (upgrade)" : ""}`);
    }

    if (type === "City") {
      const neededCities = current === "City" ? cityCount : cityCount + 1;
      const requiredFarms = neededCities * 6;
      const requiredMines = neededCities * 2;
      
      const missingReqs = [];
      if (farmEq < requiredFarms) {
        requirements.allowed = false;
        missingReqs.push(`farms: ${farmEq}/${requiredFarms}`);
      } else {
        requirements.reasons.push(`Has ${requiredFarms} farms`);
      }
      
      if (mineEq < requiredMines) {
        requirements.allowed = false;
        missingReqs.push(`mines: ${mineEq}/${requiredMines}`);
      } else {
        requirements.reasons.push(`Has ${requiredMines} mines`);
      }
      
      if (missingReqs.length > 0) {
        requirements.reasons.unshift(`Need ${missingReqs.join(', ')}`);
      }
      
      requirements.reasons.push(`Cost: ${BUILDING_RULES.City.buildCost}g (upgrade)`);
    }

    requirements.tooltip = requirements.reasons.join(" Â· ");
    return requirements;
  }

  async function updateRegionFields(fields) {
    await updateDoc(doc(db, "regions", region.id), fields);
  }

  async function updateUpgrades(newUps) {
    await updateRegionFields({ upgrades: newUps, disabledUpgrades: [] });
  }

  async function toggleSiege() {
    if (!isGM) return;
    await updateRegionFields({ underSiege: !region.underSiege });
  }

  async function setSettlement(type) {
    if (!isOwner) return;
    if (region.underSiege && !isGM) return;

    const current = getSettlement();
    let newUps = upgrades.filter((u) => !SETTLEMENTS.includes(u));

    if (type === "None") {
      await updateUpgrades(newUps);
      return;
    }

    const reqs = getSettlementRequirements(type);
    if (!reqs.allowed) {
      window.alert(reqs.reasons.join("\n"));
      return;
    }

    const cost = BUILDING_RULES[type].buildCost;
    if (!window.confirm(`Build ${type} for ${cost} gold?`)) return;

    newUps.push(type);
    await updateUpgrades(newUps);
  }

  async function addFarm() {
    if (!isOwner) return;
    if (region.underSiege && !isGM) return;
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
    
    const cost = BUILDING_RULES.Farm.buildCost;
    if (!window.confirm(`Build Farm for ${cost} gold?`)) return;
    
    await updateUpgrades([...upgrades, "Farm"]);
  }

  async function upgradeFarm() {
    if (!isOwner) return;
    if (region.underSiege && !isGM) return;
    const farmIdx = upgrades.indexOf("Farm");
    if (farmIdx === -1) {
      window.alert("No Farm to upgrade.");
      return;
    }
    
    const cost = BUILDING_RULES.Farm2.buildCost;
    if (!window.confirm(`Upgrade Farm to Farm2 for ${cost} gold?`)) return;
    
    const newUps = [...upgrades];
    newUps[farmIdx] = "Farm2";
    await updateUpgrades(newUps);
  }

  async function removeFarm() {
    if (!isOwner) return;
    if (region.underSiege && !isGM) return;
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

  async function addMine() {
    if (!isOwner) return;
    if (region.underSiege && !isGM) return;
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
    
    const cost = BUILDING_RULES.Mine.buildCost;
    if (!window.confirm(`Build Mine for ${cost} gold?`)) return;
    
    await updateUpgrades([...upgrades, "Mine"]);
  }

  async function upgradeMine() {
    if (!isOwner) return;
    if (region.underSiege && !isGM) return;
    const mineIdx = upgrades.indexOf("Mine");
    if (mineIdx === -1) {
      window.alert("No Mine to upgrade.");
      return;
    }
    
    const cost = BUILDING_RULES.Mine2.buildCost;
    if (!window.confirm(`Upgrade Mine to Mine2 for ${cost} gold?`)) return;
    
    const newUps = [...upgrades];
    newUps[mineIdx] = "Mine2";
    await updateUpgrades(newUps);
  }

  async function removeMine() {
    if (!isOwner) return;
    if (region.underSiege && !isGM) return;
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

  const hasKeep = upgrades.includes("Keep");
  const hasCastle = upgrades.includes("Castle");

  async function toggleKeep() {
    if (!isOwner) return;
    if (region.underSiege && !isGM) return;
    let newUps = [...upgrades];
    if (hasKeep) {
      newUps = newUps.filter((u) => u !== "Keep" && u !== "Castle");
    } else {
      const check = canAddBuilding(terrain, "Keep", upgrades);
      if (!check.allowed) {
        window.alert(check.reason);
        return;
      }
      
      const baseCost = BUILDING_RULES.Keep.buildCost;
      const cost = getModifiedBuildingCost('Keep', baseCost);
      const costMessage = cost < baseCost 
        ? `Build Keep for ${cost} gold? (Normally ${baseCost}g - Umara's blessing)`
        : `Build Keep for ${cost} gold?`;
      
      if (!window.confirm(costMessage)) return;
      
      newUps.push("Keep");
    }
    await updateUpgrades(newUps);
  }

  async function upgradeToCastle() {
    if (!isOwner) return;
    if (region.underSiege && !isGM) return;
    if (!hasKeep) {
      window.alert("Need Keep first.");
      return;
    }
    const check = canAddBuilding(terrain, "Castle", upgrades);
    if (!check.allowed) {
      window.alert(check.reason);
      return;
    }
    
    const baseCost = BUILDING_RULES.Castle.buildCost;
    const cost = getModifiedBuildingCost('Castle', baseCost);
    const costMessage = cost < baseCost 
      ? `Upgrade Keep to Castle for ${cost} gold? (Normally ${baseCost}g - Umara's blessing)`
      : `Upgrade Keep to Castle for ${cost} gold?`;
    
    if (!window.confirm(costMessage)) return;
    
    await updateUpgrades([...upgrades, "Castle"]);
  }

  async function removeCastle() {
    if (!isOwner) return;
    if (region.underSiege && !isGM) return;
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

  const summaryParts = [];
  if (farmCount) summaryParts.push(`${farmCount} Farm`);
  if (farm2Count) summaryParts.push(`${farm2Count} Farm2`);
  if (mineCount) summaryParts.push(`${mineCount} Mine`);
  if (mine2Count) summaryParts.push(`${mine2Count} Mine2`);
  if (hasKeep) summaryParts.push("Keep");
  if (hasCastle) summaryParts.push("Castle");
  const summaryText = summaryParts.length ? summaryParts.join(" Â· ") : "No buildings";

  const villageReqs = getSettlementRequirements("Village");
  const townReqs = getSettlementRequirements("Town");
  const cityReqs = getSettlementRequirements("City");

  // Get fortification costs with deity modifiers
  const keepBaseCost = BUILDING_RULES.Keep.buildCost;
  const keepCost = getModifiedBuildingCost('Keep', keepBaseCost);
  const castleBaseCost = BUILDING_RULES.Castle.buildCost;
  const castleCost = getModifiedBuildingCost('Castle', castleBaseCost);

  // Check if region is under siege
  const underSiege = region.underSiege || false;

  return (
    <div className="card" style={{ 
      marginBottom: "12px",
      background: underSiege ? "#3a1a1a" : "#201712",
      border: underSiege ? "2px solid #8b3a3a" : "1px solid #4c3b2a"
    }}>
      {/* Siege Banner */}
      {underSiege && (
        <div style={{
          background: "linear-gradient(90deg, #8b3a3a 0%, #5a2020 100%)",
          color: "#fff",
          padding: "8px 12px",
          marginBottom: "12px",
          borderRadius: "6px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontWeight: "bold"
        }}>
          <span>UNDER SIEGE - All production disabled</span>
          {isGM && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleSiege(); }}
              className="small"
              style={{
                margin: 0,
                padding: "4px 10px",
                background: "#4a6642",
                borderColor: "#5a7a52"
              }}
            >
              Lift Siege
            </button>
          )}
        </div>
      )}

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
                backgroundColor: underSiege ? "#5a2020" : "#30425d",
                border: underSiege ? "1.5px solid #8b3a3a" : "1.5px solid #4a5d7a",
                color: "#f8f4e6",
              }}
            >
              {region.code || region.name}
              {capital === region.code && (
                <span style={{ marginLeft: "6px", color: "#FFD700" }} title="Capital">★</span>
              )}
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
                  Save
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
                  Cancel
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
                  Edit
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

            {/* GM Siege Toggle Button */}
            {isGM && !underSiege && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleSiege(); }}
                className="small"
                style={{
                  margin: 0,
                  padding: "4px 10px",
                  minHeight: "28px",
                  background: "#5a2020",
                  borderColor: "#8b3a3a",
                  color: "#ffaaaa"
                }}
                title="Put region under siege"
              >
                Siege
              </button>
            )}
          </div>
          {!expanded && (
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#c7bca5" }}>
              {settlement !== "None" ? settlement : "No settlement"}
              {summaryParts.length > 0 && ` · ${summaryParts.join(" · ")}`}
            </p>
          )}
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {isOwner && !underSiege && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setSettlement("None"); }}
                className="small"
                style={{
                  background: settlement === "None" ? "#30425d" : undefined,
                  borderColor: settlement === "None" ? "#4a5d7a" : undefined,
                  margin: "0 2px",
                  padding: "4px 8px",
                  minHeight: "28px",
                }}
              >
                None
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); setSettlement("Village"); }}
                disabled={!villageReqs.allowed}
                className="small"
                title={villageReqs.tooltip}
                style={{
                  background: settlement === "Village" ? "#30425d" : undefined,
                  borderColor: settlement === "Village" ? "#4a5d7a" : undefined,
                  opacity: !villageReqs.allowed ? 0.5 : 1,
                  margin: "0 2px",
                  padding: "4px 8px",
                  minHeight: "28px",
                }}
              >
                Village
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); setSettlement("Town"); }}
                disabled={!townReqs.allowed}
                className="small"
                title={townReqs.tooltip}
                style={{
                  background: settlement === "Town" ? "#30425d" : undefined,
                  borderColor: settlement === "Town" ? "#4a5d7a" : undefined,
                  opacity: !townReqs.allowed ? 0.5 : 1,
                  margin: "0 2px",
                  padding: "4px 8px",
                  minHeight: "28px",
                }}
              >
                Town
              </button>
              
              <button
                onClick={(e) => { e.stopPropagation(); setSettlement("City"); }}
                disabled={!cityReqs.allowed}
                className="small"
                title={cityReqs.tooltip}
                style={{
                  background: settlement === "City" ? "#30425d" : undefined,
                  borderColor: settlement === "City" ? "#4a5d7a" : undefined,
                  opacity: !cityReqs.allowed ? 0.5 : 1,
                  margin: "0 2px",
                  padding: "4px 8px",
                  minHeight: "28px",
                }}
              >
                City
              </button>
            </>
          )}

          {/* Show disabled message for non-GM when under siege */}
          {isOwner && underSiege && !isGM && (
            <span style={{ 
              fontSize: "12px", 
              color: "#ff6666",
              fontStyle: "italic"
            }}>
              Building disabled during siege
            </span>
          )}

          {/* Set as Capital button - only show if no capital set */}
          {isOwner && !capital && onSetCapital && (
            <button
              onClick={(e) => { e.stopPropagation(); onSetCapital(region.code); }}
              className="small"
              style={{
                margin: "0 4px",
                padding: "4px 10px",
                minHeight: "28px",
                background: "#3a3020",
                borderColor: "#5e4934",
                color: "#FFD700",
              }}
              title="Set this region as your capital (permanent)"
            >
              ★ Set as Capital
            </button>
          )}
          
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

      {expanded && (
        <div
          style={{ marginTop: "16px" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Under Siege Notice */}
          {underSiege && (
            <div style={{
              background: "#2a1515",
              border: "1px solid #5a2020",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "16px",
              fontSize: "13px",
              color: "#ff8888"
            }}>
              ⚠️ This region is under siege. All construction and upgrades are disabled until the siege is lifted.
            </div>
          )}

          {/* Collapsible Requirements Section */}
          {isOwner && !underSiege && (
            <div style={{
              background: "#1a1410",
              borderRadius: "8px",
              border: "1px solid #3a2f24",
              marginBottom: "16px",
              overflow: "hidden"
            }}>
              <button
                onClick={() => setShowRequirements(!showRequirements)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  borderBottom: showRequirements ? "1px solid #3a2f24" : "none",
                  color: "#c7bca5",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  margin: 0,
                  minHeight: "auto"
                }}
              >
                <span>ℹ️ Settlement & Upgrade Requirements</span>
                <span style={{ fontSize: "11px" }}>{showRequirements ? "▲" : "▼"}</span>
              </button>
              
              {showRequirements && (
                <div style={{ padding: "12px", fontSize: "12px" }}>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", 
                    gap: "12px" 
                  }}>
                    {/* Village */}
                    <div style={{ 
                      padding: "8px", 
                      background: "#0a0806", 
                      borderRadius: "6px",
                      border: `1px solid ${villageReqs.allowed ? "#3a5a3a" : "#3a2f24"}`
                    }}>
                      <div style={{ 
                        fontWeight: "bold", 
                        marginBottom: "6px",
                        color: villageReqs.allowed ? "#b5e8a1" : "#f97373",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}>
                        {villageReqs.allowed ? "✓" : "✗"} Village
                      </div>
                      <div style={{ color: "#888", lineHeight: "1.4" }}>
                        {villageReqs.reasons?.length > 0 
                          ? villageReqs.reasons.map((r, i) => <div key={i}>{r}</div>)
                          : <div>Available</div>
                        }
                      </div>
                    </div>

                    {/* Town */}
                    <div style={{ 
                      padding: "8px", 
                      background: "#0a0806", 
                      borderRadius: "6px",
                      border: `1px solid ${townReqs.allowed ? "#3a5a3a" : "#3a2f24"}`
                    }}>
                      <div style={{ 
                        fontWeight: "bold", 
                        marginBottom: "6px",
                        color: townReqs.allowed ? "#b5e8a1" : "#f97373",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}>
                        {townReqs.allowed ? "✓" : "✗"} Town
                      </div>
                      <div style={{ color: "#888", lineHeight: "1.4" }}>
                        {townReqs.reasons?.length > 0 
                          ? townReqs.reasons.map((r, i) => <div key={i}>{r}</div>)
                          : <div>Available</div>
                        }
                      </div>
                    </div>

                    {/* City */}
                    <div style={{ 
                      padding: "8px", 
                      background: "#0a0806", 
                      borderRadius: "6px",
                      border: `1px solid ${cityReqs.allowed ? "#3a5a3a" : "#3a2f24"}`
                    }}>
                      <div style={{ 
                        fontWeight: "bold", 
                        marginBottom: "6px",
                        color: cityReqs.allowed ? "#b5e8a1" : "#f97373",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}>
                        {cityReqs.allowed ? "✓" : "✗"} City
                      </div>
                      <div style={{ color: "#888", lineHeight: "1.4" }}>
                        {cityReqs.reasons?.length > 0 
                          ? cityReqs.reasons.map((r, i) => <div key={i}>{r}</div>)
                          : <div>Available</div>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Terrain info */}
                  {(terrainInfo.bonuses?.length > 0 || terrainInfo.penalties?.length > 0) && (
                    <div style={{ 
                      marginTop: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid #3a2f24",
                      color: "#888"
                    }}>
                      <div style={{ marginBottom: "4px", color: "#c7bca5" }}>{terrainInfo.name} terrain:</div>
                      {terrainInfo.bonuses?.map((b, i) => (
                        <div key={i} style={{ color: "#b5e8a1" }}>+ {b}</div>
                      ))}
                      {terrainInfo.penalties?.map((p, i) => (
                        <div key={i} style={{ color: "#f97373" }}>− {p}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Buildings Grid */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
            gap: "12px",
            marginBottom: "16px"
          }}>
            {/* Farms Card */}
            <div style={{
              background: "#1a1410",
              borderRadius: "8px",
              border: "1px solid #3a2f24",
              padding: "12px"
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "8px"
              }}>
                <span style={{ fontSize: "14px", color: "#c7bca5" }}>🌾 Farms</span>
                <strong style={{ fontSize: "16px" }}>
                  {farmCount + farm2Count} / {terrainInfo.maxFarms}
                </strong>
              </div>
              {farm2Count > 0 && (
                <div style={{ fontSize: "11px", color: "#b5e8a1", marginBottom: "8px" }}>
                  {farm2Count} upgraded to Farm II
                </div>
              )}
              {isOwner && !underSiege && (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  <button 
                    className="small" 
                    onClick={addFarm}
                    disabled={(farmCount + farm2Count) >= terrainInfo.maxFarms}
                    style={{ margin: 0, padding: "4px 8px", minHeight: "26px", fontSize: "12px" }}
                  >
                    + Add ({BUILDING_RULES.Farm.buildCost}g)
                  </button>
                  {farmCount > 0 && (
                    <button 
                      className="small" 
                      onClick={upgradeFarm}
                      style={{ margin: 0, padding: "4px 8px", minHeight: "26px", fontSize: "12px" }}
                    >
                      ↑ Upgrade ({BUILDING_RULES.Farm2.buildCost}g)
                    </button>
                  )}
                  {(farmCount > 0 || farm2Count > 0) && (
                    <button 
                      className="small" 
                      onClick={removeFarm}
                      style={{ margin: 0, padding: "4px 8px", minHeight: "26px", fontSize: "12px" }}
                    >
                      −
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Mines Card */}
            <div style={{
              background: "#1a1410",
              borderRadius: "8px",
              border: "1px solid #3a2f24",
              padding: "12px"
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "8px"
              }}>
                <span style={{ fontSize: "14px", color: "#c7bca5" }}>⛏️ Mines</span>
                <strong style={{ fontSize: "16px" }}>
                  {mineCount + mine2Count} / {terrainInfo.maxMines}
                </strong>
              </div>
              {mine2Count > 0 && (
                <div style={{ fontSize: "11px", color: "#b5e8a1", marginBottom: "8px" }}>
                  {mine2Count} upgraded to Mine II
                </div>
              )}
              {isOwner && !underSiege && (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  <button 
                    className="small" 
                    onClick={addMine}
                    disabled={(mineCount + mine2Count) >= terrainInfo.maxMines}
                    style={{ margin: 0, padding: "4px 8px", minHeight: "26px", fontSize: "12px" }}
                  >
                    + Add ({BUILDING_RULES.Mine.buildCost}g)
                  </button>
                  {mineCount > 0 && (
                    <button 
                      className="small" 
                      onClick={upgradeMine}
                      style={{ margin: 0, padding: "4px 8px", minHeight: "26px", fontSize: "12px" }}
                    >
                      ↑ Upgrade ({BUILDING_RULES.Mine2.buildCost}g)
                    </button>
                  )}
                  {(mineCount > 0 || mine2Count > 0) && (
                    <button 
                      className="small" 
                      onClick={removeMine}
                      style={{ margin: 0, padding: "4px 8px", minHeight: "26px", fontSize: "12px" }}
                    >
                      −
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Fortification Card */}
            <div style={{
              background: "#1a1410",
              borderRadius: "8px",
              border: "1px solid #3a2f24",
              padding: "12px"
            }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center",
                marginBottom: "8px"
              }}>
                <span style={{ fontSize: "14px", color: "#c7bca5" }}>🏰 Fortification</span>
                <strong style={{ fontSize: "16px" }}>
                  {hasCastle ? "Castle" : hasKeep ? "Keep" : "None"}
                </strong>
              </div>
              {(hasKeep || hasCastle) && deity?.bonuses.keepHSG && (
                <div style={{ fontSize: "11px", color: "#b5e8a1", marginBottom: "8px" }}>
                  +{hasCastle ? (deity.bonuses.castleHSG || 0) : deity.bonuses.keepHSG} HSG capacity (deity)
                </div>
              )}
              {isOwner && !underSiege && (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {!hasKeep && !hasCastle && (
                    <button 
                      className="small" 
                      onClick={toggleKeep}
                      style={{ margin: 0, padding: "4px 8px", minHeight: "26px", fontSize: "12px" }}
                    >
                      + Keep ({keepCost !== keepBaseCost ? (
                        <><s style={{ opacity: 0.5 }}>{keepBaseCost}</s> <span style={{ color: "#b5e8a1" }}>{keepCost}</span></>
                      ) : keepBaseCost}g)
                    </button>
                  )}
                  {hasKeep && !hasCastle && (
                    <>
                      <button 
                        className="small" 
                        onClick={upgradeToCastle}
                        style={{ margin: 0, padding: "4px 8px", minHeight: "26px", fontSize: "12px" }}
                      >
                        ↑ Castle ({castleCost !== castleBaseCost ? (
                          <><s style={{ opacity: 0.5 }}>{castleBaseCost}</s> <span style={{ color: "#b5e8a1" }}>{castleCost}</span></>
                        ) : castleBaseCost}g)
                      </button>
                      <button 
                        className="small" 
                        onClick={toggleKeep}
                        style={{ margin: 0, padding: "4px 8px", minHeight: "26px", fontSize: "12px" }}
                      >
                        −
                      </button>
                    </>
                  )}
                  {hasCastle && (
                    <button 
                      className="small" 
                      onClick={removeCastle}
                      style={{ margin: 0, padding: "4px 8px", minHeight: "26px", fontSize: "12px" }}
                    >
                      − Remove
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Notes Section */}
          <div style={{
            background: "#1a1410",
            borderRadius: "8px",
            border: "1px solid #3a2f24",
            padding: "12px",
            marginBottom: isGM ? "16px" : "0"
          }}>
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              marginBottom: "8px"
            }}>
              <span style={{ fontSize: "14px", color: "#c7bca5" }}>📝 Notes</span>
              {isOwner && (
                <button 
                  onClick={saveNotes} 
                  className="small" 
                  style={{ margin: 0, padding: "4px 10px", minHeight: "26px", fontSize: "12px" }}
                >
                  Save
                </button>
              )}
            </div>
            {isOwner ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this region..."
                style={{
                  width: "100%",
                  height: "60px",
                  background: "#0a0806",
                  color: "#f4efe4",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px solid #3a2f24",
                  fontSize: "13px",
                  boxSizing: "border-box",
                  resize: "vertical"
                }}
              />
            ) : (
              <p style={{ fontSize: "13px", margin: 0, color: notes ? "#f4efe4" : "#666" }}>
                {notes || "No notes."}
              </p>
            )}
          </div>

          {/* GM Controls - Compact footer */}
          {isGM && (
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px",
              background: "#1a1410",
              borderRadius: "8px",
              border: "1px solid #3a2f24",
              flexWrap: "wrap",
              gap: "12px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "#888" }}>GM:</span>
                <select
                  value={region.owner}
                  onChange={(e) => changeOwner(e.target.value)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid #3a2f24",
                    background: "#0a0806",
                    color: "#f4efe4",
                    fontSize: "12px"
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
                    <option key={f} value={f}>{getFactionName(f)}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={toggleSiege}
                  className="small"
                  style={{ 
                    margin: 0,
                    padding: "4px 12px",
                    minHeight: "28px",
                    fontSize: "12px",
                    background: underSiege ? "#2a4a2a" : "#4a2a2a", 
                    borderColor: underSiege ? "#3a6a3a" : "#6a3a3a"
                  }}
                >
                  {underSiege ? "✓ Lift Siege" : "⚔ Siege"}
                </button>
                <button
                  onClick={deleteRegion}
                  className="small"
                  style={{ 
                    margin: 0,
                    padding: "4px 12px",
                    minHeight: "28px",
                    fontSize: "12px",
                    background: "#4a1a1a", 
                    borderColor: "#6a2a2a"
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}