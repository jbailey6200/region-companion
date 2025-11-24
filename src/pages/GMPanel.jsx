// pages/GMPanel.jsx - COMPLETE REBUILD AS GAME MASTER CONTROL CENTER

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import RegionCard from "../components/RegionCard";
import ArmyCard from "../components/ArmyCard";
import CharacterCard from "../components/CharacterCard";
import Court from "../components/Court";
import GMMissionPanel from "../components/GmMissionPanel";
import { BUILDING_RULES, HSG_UNITS, LEVY_UPKEEP_PER_UNIT } from "../config/buildingRules";
import { DEITIES } from "../config/religionRules";
import { TERRAIN_TYPES, getTerrainFromMapPosition } from "../config/terrainRules";
import { getCourtBonuses, COURT_POSITIONS } from "../config/courtPositions";

// Enhanced economy calculation with deity bonuses
function calculateEconomyWithDeity(regions, patronDeity = null) {
  let goldTotal = 0;
  let manpowerProdTotal = 0;
  let manpowerCostTotal = 0;
  let hsgCapTotal = 0;
  let farmEqTotal = 0;
  let mineEqTotal = 0;
  let levyInfTotal = 0;
  let levyArchTotal = 0;
  let townCount = 0;
  let cityCount = 0;
  let villageCount = 0;
  let deityBonusGold = 0;
  let deityBonusManpower = 0;
  let deityBonusHSG = 0;

  const deity = patronDeity ? DEITIES[patronDeity] : null;

  regions.forEach((r) => {
    // Skip regions under siege
    if (r.underSiege) return;
    
    const ups = r.upgrades || [];
    const disabled = r.disabledUpgrades || [];
    const terrain = r.terrain || TERRAIN_TYPES.PLAINS;

    const counts = {};
    ups.forEach((u) => {
      counts[u] = (counts[u] || 0) + 1;
    });
    disabled.forEach((d) => {
      if (counts[d]) counts[d] -= 1;
    });

    let regionGold = 0;
    let regionManProd = 0;
    let regionManCost = 0;
    let regionHsgCap = 0;
    let regionFarmEq = 0;
    let regionMineEq = 0;
    let regionLevyInf = 0;
    let regionLevyArch = 0;

    Object.entries(counts).forEach(([name, count]) => {
      if (count <= 0) return;
      const rule = BUILDING_RULES[name];
      if (!rule) return;

      let gold = rule.gold || 0;
      let manpower = rule.manpower || 0;
      let manpowerCost = rule.manpowerCost || 0;
      let hsgCap = rule.hsgCap || 0;
      let levyArch = rule.levyArch || 0;

      // Apply deity bonuses
      if (deity) {
        if (deity.bonuses.townGold && name === "Town") {
          gold += deity.bonuses.townGold;
          deityBonusGold += deity.bonuses.townGold * count;
        }
        if (deity.bonuses.cityGold && name === "City") {
          gold += deity.bonuses.cityGold;
          deityBonusGold += deity.bonuses.cityGold * count;
        }
        if (deity.bonuses.mineGold && (name === "Mine" || name === "Mine2")) {
          gold += deity.bonuses.mineGold;
          deityBonusGold += deity.bonuses.mineGold * count;
        }
        if (deity.bonuses.settlementManpower &&
          (name === "Village" || name === "Town" || name === "City")) {
          manpower += deity.bonuses.settlementManpower;
          deityBonusManpower += deity.bonuses.settlementManpower * count;
        }
        if (name === "Keep" && deity.bonuses.keepHSG) {
          hsgCap += deity.bonuses.keepHSG;
          deityBonusHSG += deity.bonuses.keepHSG * count;
        }
        if (name === "Castle" && deity.bonuses.castleHSG) {
          hsgCap += deity.bonuses.castleHSG;
          deityBonusHSG += deity.bonuses.castleHSG * count;
        }
      }

      regionGold += gold * count;
      regionManProd += manpower * count;
      regionManCost += manpowerCost * count;
      regionHsgCap += hsgCap * count;
      regionFarmEq += (rule.farmEquivalent || 0) * count;
      regionMineEq += (rule.mineEquivalent || 0) * count;
      regionLevyInf += (rule.levyInf || 0) * count;
      regionLevyArch += levyArch * count;

      if (name === "Town") townCount += count;
      if (name === "City") cityCount += count;
      if (name === "Village") villageCount += count;
    });

    // Terrain bonuses from deity
    if (deity) {
      if (terrain === TERRAIN_TYPES.RIVER && deity.bonuses.riverGold) {
        regionGold += deity.bonuses.riverGold;
        deityBonusGold += deity.bonuses.riverGold;
      }
      if ((terrain === TERRAIN_TYPES.MOUNTAINS || terrain === TERRAIN_TYPES.HILLS) && 
          deity.bonuses.mountainHillsGold) {
        regionGold += deity.bonuses.mountainHillsGold;
        deityBonusGold += deity.bonuses.mountainHillsGold;
      }
      if (terrain === TERRAIN_TYPES.COAST && deity.bonuses.coastalGold) {
        regionGold += deity.bonuses.coastalGold;
        deityBonusGold += deity.bonuses.coastalGold;
      }
      if (terrain === TERRAIN_TYPES.MOUNTAINS && deity.bonuses.mountainGold) {
        regionGold += deity.bonuses.mountainGold;
        deityBonusGold += deity.bonuses.mountainGold;
      }
    }

    goldTotal += regionGold;
    manpowerProdTotal += regionManProd;
    manpowerCostTotal += regionManCost;
    hsgCapTotal += regionHsgCap;
    farmEqTotal += regionFarmEq;
    mineEqTotal += regionMineEq;
    levyInfTotal += regionLevyInf;
    levyArchTotal += regionLevyArch;
  });

  return {
    goldPerTurn: goldTotal,
    manpowerProduced: manpowerProdTotal,
    manpowerUpkeep: manpowerCostTotal,
    manpowerNet: manpowerProdTotal - manpowerCostTotal,
    hsgCap: hsgCapTotal,
    farmEquivalent: farmEqTotal,
    mineEquivalent: mineEqTotal,
    levyInfantry: levyInfTotal,
    levyArchers: levyArchTotal,
    townCount,
    cityCount,
    villageCount,
    deityBonusGold,
    deityBonusManpower,
    deityBonusHSG,
  };
}

// Calculate upkeeps for a faction
function calculateUpkeeps(factionArmies, factionData, agents, patronDeity) {
  const deity = patronDeity ? DEITIES[patronDeity] : null;
  
  // HSG upkeep
  let hsgUpkeep = 0;
  let levyUpkeep = 0;
  
  factionArmies.forEach(army => {
    if (army.deleted) return;
    
    const huscarlUp = deity?.bonuses.huscarlUpkeep ?? 1;
    const dkUp = deity?.bonuses.dismountedKnightUpkeep ?? 2;
    const mkUp = deity?.bonuses.mountedKnightUpkeep ?? 3;
    
    hsgUpkeep += (army.huscarls || 0) * huscarlUp;
    hsgUpkeep += (army.dismountedKnights || 0) * dkUp;
    hsgUpkeep += (army.mountedKnights || 0) * mkUp;
    hsgUpkeep += (army.lightHorse || 0) * 1;
    
    levyUpkeep += ((army.levyInfantry || 0) + (army.levyArchers || 0)) * 0.25;
  });
  
  // Navy upkeep
  const warshipUp = deity?.bonuses.warshipUpkeep ?? 3;
  const navyUpkeep = (factionData?.navy?.warships || 0) * warshipUp;
  
  // Agent upkeep
  let agentUpkeep = 0;
  const agitatorUp = deity?.bonuses.agitatorUpkeep ?? 4;
  agents.forEach(agent => {
    if (agent.type === 'spy') agentUpkeep += 1;
    else if (agent.type === 'agitator') agentUpkeep += agitatorUp;
    else if (agent.type === 'enforcer') agentUpkeep += 2;
  });
  
  return {
    hsgUpkeep,
    levyUpkeep: Math.floor(levyUpkeep),
    navyUpkeep,
    agentUpkeep,
    total: hsgUpkeep + Math.floor(levyUpkeep) + navyUpkeep + agentUpkeep
  };
}

// Faction Summary Card Component
function FactionCard({ factionId, factionData, regions, armies, agents, courtPositions, onNavigate }) {
  const faction = factionData[factionId];
  const factionRegions = regions.filter(r => r.owner === factionId);
  const factionArmies = armies.filter(a => a.factionId === factionId && !a.deleted);
  const factionAgents = agents.filter(a => a.factionId === factionId);
  const patronDeity = faction?.patronDeity;
  
  const eco = calculateEconomyWithDeity(factionRegions, patronDeity);
  const upkeeps = calculateUpkeeps(factionArmies, faction, factionAgents, patronDeity);
  const courtBonuses = getCourtBonuses(courtPositions, factionId);
  
  // Calculate HSG
  const hsgUsed = factionArmies.reduce((sum, a) => {
    return sum + (a.huscarls || 0) + (a.dismountedKnights || 0) + 
           (a.mountedKnights || 0) + (a.lightHorse || 0);
  }, 0);
  const overCap = hsgUsed > eco.hsgCap;
  
  // Net gold including court bonuses
  const totalGoldAfterUpkeep = eco.goldPerTurn + courtBonuses.gold - upkeeps.total;
  
  return (
    <div 
      className="card" 
      style={{ 
        padding: "16px",
        background: totalGoldAfterUpkeep < 0 ? "#2a1a1a" : "#201712",
        border: totalGoldAfterUpkeep < 0 ? "1px solid #5a2a2a" : "1px solid #4c3b2a",
        cursor: "pointer"
      }}
      onClick={() => onNavigate(`/faction/${factionId}`)}
    >
      {/* Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "12px",
        paddingBottom: "8px",
        borderBottom: "1px solid #4c3b2a"
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "16px" }}>
            {faction?.name || `Faction ${factionId}`}
          </h3>
          <span style={{ fontSize: "12px", color: "#a89a7a" }}>
            {factionRegions.length} regions • {factionArmies.length} armies • {factionAgents.length} agents
          </span>
        </div>
        <button 
          className="small"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(`/faction/${factionId}`);
          }}
        >
          View →
        </button>
      </div>
      
      {/* Economy Summary */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr",
        gap: "8px",
        marginBottom: "8px"
      }}>
        <div>
          <strong style={{ color: "#d1b26b" }}>Income</strong>
          <div style={{ fontSize: "13px" }}>
            Base Gold: <strong>{eco.goldPerTurn}</strong>
            {courtBonuses.gold > 0 && (
              <span style={{ color: "#8B008B" }}> +{courtBonuses.gold}</span>
            )}
          </div>
        </div>
        
        <div style={{ marginTop: "8px" }}>
          {upkeeps.hsgUpkeep > 0 && <div>HSG Upkeep: <strong>-{upkeeps.hsgUpkeep}</strong></div>}
          {upkeeps.levyUpkeep > 0 && <div>Levy Upkeep: <strong>-{upkeeps.levyUpkeep}</strong></div>}
          {upkeeps.navyUpkeep > 0 && <div>Navy Upkeep: <strong>-{upkeeps.navyUpkeep}</strong></div>}
          {upkeeps.agentUpkeep > 0 && <div>Agent Upkeep: <strong>-{upkeeps.agentUpkeep}</strong></div>}
          <div style={{ 
            borderTop: "1px solid #4c3b2a", 
            paddingTop: "4px",
            marginTop: "4px",
            fontWeight: "bold"
          }}>
            Net Gold/Turn: 
            <strong style={{ 
              color: totalGoldAfterUpkeep < 0 ? "#ff4444" : "#b5e8a1",
              marginLeft: "6px"
            }}>
              {totalGoldAfterUpkeep > 0 ? '+' : ''}{totalGoldAfterUpkeep}
            </strong>
          </div>
        </div>
      </div>
      
      {/* Other Stats */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
        fontSize: "12px"
      }}>
        <div>
          <strong>Capacity</strong>
          <div>
            HSG: <span style={{ color: overCap ? "#ff4444" : "#b5e8a1" }}>
              {hsgUsed}/{eco.hsgCap}
            </span>
          </div>
          <div>
            Agents: {factionAgents.length}/{eco.townCount + eco.cityCount * 2}
          </div>
        </div>
        
        <div>
          <strong>Other</strong>
          <div>Patron: {patronDeity ? DEITIES[patronDeity].name : "None"}</div>
          {courtBonuses.positions.length > 0 && (
            <div style={{ color: "#8B008B" }}>
              Court: {courtBonuses.positions.map(p => p.position).join(", ")}
            </div>
          )}
        </div>
      </div>
      
      {/* Manpower */}
      <div style={{
        marginTop: "8px",
        padding: "6px",
        background: eco.manpowerNet < 0 ? "#3a1a1a" : "#1a1410",
        borderRadius: "4px",
        fontSize: "12px"
      }}>
        Manpower: <strong style={{ 
          color: eco.manpowerNet < 0 ? "#ff4444" : "#b5e8a1" 
        }}>
          {eco.manpowerNet > 0 ? '+' : ''}{eco.manpowerNet}
        </strong> 
        <span style={{ color: "#888", marginLeft: "6px" }}>
          (prod {eco.manpowerProduced}, cost {eco.manpowerUpkeep})
        </span>
      </div>
    </div>
  );
}

// Neutral Forces Component
function NeutralForces({ armies, characters, courtPositions, regions, onNavigate }) {
  const [isCreatingArmy, setIsCreatingArmy] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);
  const [newArmyData, setNewArmyData] = useState({
    name: "",
    location: "",
    huscarls: 0,
    dismountedKnights: 0,
    mountedKnights: 0,
    lightHorse: 0,
    levyInfantry: 0,
    levyArchers: 0,
  });
  const [newCharData, setNewCharData] = useState({
    firstName: "",
    lastName: "",
    leadership: 5,
    prowess: 5,
    stewardship: 5,
    intrigue: 5,
    description: "",
  });

  // Get court position for a character
  function getCharacterCourtPosition(charId) {
    return courtPositions.find(p => p.characterId === charId);
  }

  // Get prowess bonus from court position
  function getCourtProwessBonus(charId) {
    const pos = getCharacterCourtPosition(charId);
    if (!pos) return 0;
    const config = COURT_POSITIONS[pos.position];
    return config?.effects?.prowessBonus || 0;
  }

  async function createNeutralArmy() {
    const armiesRef = collection(db, "factions", "neutral", "armies");
    await addDoc(armiesRef, {
      ...newArmyData,
      isNeutral: true,
      commanders: [],
      deleted: false,
    });
    setIsCreatingArmy(false);
    setNewArmyData({
      name: "",
      location: "",
      huscarls: 0,
      dismountedKnights: 0,
      mountedKnights: 0,
      lightHorse: 0,
      levyInfantry: 0,
      levyArchers: 0,
    });
  }

  async function createNeutralCharacter() {
    const charsRef = collection(db, "factions", "neutral", "characters");
    await addDoc(charsRef, {
      ...newCharData,
      isNeutral: true,
      faction: null,
    });
    setIsCreatingCharacter(false);
    setNewCharData({
      firstName: "",
      lastName: "",
      leadership: 5,
      prowess: 5,
      stewardship: 5,
      intrigue: 5,
      description: "",
    });
  }

  async function deleteNeutralArmy(id) {
    if (!window.confirm("Delete this neutral army?")) return;
    await deleteDoc(doc(db, "factions", "neutral", "armies", id));
  }

  async function deleteNeutralCharacter(id) {
    if (!window.confirm("Delete this neutral character?")) return;
    await deleteDoc(doc(db, "factions", "neutral", "characters", id));
  }

  async function updateNeutralArmy(id, field, value) {
    await updateDoc(doc(db, "factions", "neutral", "armies", id), {
      [field]: value,
    });
  }

  async function updateNeutralCharacter(id, field, value) {
    await updateDoc(doc(db, "factions", "neutral", "characters", id), {
      [field]: value,
    });
  }

  async function updateArmyCommanders(armyId, commanderIds) {
    await updateDoc(doc(db, "factions", "neutral", "armies", armyId), {
      commanders: commanderIds,
    });
  }

  // Get commanders in other neutral armies
  function getCommandersInOtherArmies(currentArmyId) {
    return armies
      .filter(a => a.id !== currentArmyId && !a.deleted)
      .flatMap(a => a.commanders || []);
  }

  return (
    <div>
      {/* Neutral Armies */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "12px"
        }}>
          <h2 style={{ margin: 0 }}>Neutral Armies</h2>
          <button 
            onClick={() => setIsCreatingArmy(true)}
            className="green"
            style={{ padding: "8px 16px" }}
          >
            + Create Neutral Army
          </button>
        </div>

        {isCreatingArmy && (
          <div className="card" style={{ marginBottom: "16px", padding: "16px" }}>
            <h3 style={{ marginTop: 0 }}>New Neutral Army</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px" }}>Army Name</label>
                <input
                  type="text"
                  value={newArmyData.name}
                  onChange={(e) => setNewArmyData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Rebel Forces"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px" }}>Location</label>
                <select
                  value={newArmyData.location}
                  onChange={(e) => setNewArmyData(prev => ({ ...prev, location: e.target.value }))}
                  style={{ width: "100%" }}
                >
                  <option value="">-- Select Location --</option>
                  {regions
                    .sort((a, b) => (a.code || "").localeCompare(b.code || ""))
                    .map(r => (
                      <option key={r.id} value={r.code || r.name}>
                        [{r.code}] {r.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button onClick={createNeutralArmy} className="green">Create</button>
              <button onClick={() => setIsCreatingArmy(false)}>Cancel</button>
            </div>
          </div>
        )}

        {armies.filter(a => !a.deleted).length === 0 ? (
          <p style={{ color: "#a89a7a" }}>No neutral armies. Create one to represent rebels, bandits, or NPC forces.</p>
        ) : (
          armies.filter(a => !a.deleted).map(army => {
            const commandersInOther = getCommandersInOtherArmies(army.id);
            const availableCommanders = characters.filter(
              c => !commandersInOther.includes(c.id)
            );
            const currentCommanders = (army.commanders || [])
              .map(cid => characters.find(c => c.id === cid))
              .filter(Boolean);

            return (
              <div key={army.id} className="card" style={{ marginBottom: "12px", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <input
                      type="text"
                      value={army.name}
                      onChange={(e) => updateNeutralArmy(army.id, "name", e.target.value)}
                      style={{
                        fontWeight: "bold",
                        fontSize: "15px",
                        background: "transparent",
                        border: "none",
                        borderBottom: "1px solid #5e4934",
                        color: "#f4efe4",
                        padding: "2px 4px",
                        width: "150px",
                      }}
                    />
                    <select
                      value={army.location || ""}
                      onChange={(e) => updateNeutralArmy(army.id, "location", e.target.value)}
                      style={{
                        background: "#1a1410",
                        border: "1px solid #5e4934",
                        borderRadius: "4px",
                        color: "#f4efe4",
                        padding: "4px 8px",
                        fontSize: "12px",
                      }}
                    >
                      <option value="">-- Location --</option>
                      {regions
                        .sort((a, b) => (a.code || "").localeCompare(b.code || ""))
                        .map(r => (
                          <option key={r.id} value={r.code || r.name}>
                            [{r.code}] {r.name}
                          </option>
                        ))}
                    </select>
                  </div>
                  <button 
                    onClick={() => deleteNeutralArmy(army.id)}
                    style={{ 
                      padding: "4px 8px", 
                      fontSize: "11px",
                      background: "#3a1a1a",
                      border: "1px solid #5a2a2a",
                      color: "#ff6b6b"
                    }}
                  >
                    Delete
                  </button>
                </div>

                {/* Unit counts */}
                <div style={{ marginTop: "8px", fontSize: "12px", color: "#c7bca5" }}>
                  HSG: {(army.huscarls || 0) + (army.dismountedKnights || 0) + (army.mountedKnights || 0) + (army.lightHorse || 0)} |
                  Levies: {(army.levyInfantry || 0) + (army.levyArchers || 0)}
                </div>

                {/* Unit editing */}
                <div style={{ 
                  marginTop: "8px", 
                  display: "grid", 
                  gridTemplateColumns: "repeat(6, 1fr)", 
                  gap: "6px",
                  fontSize: "11px"
                }}>
                  {[
                    { key: "huscarls", label: "Husc" },
                    { key: "dismountedKnights", label: "DK" },
                    { key: "mountedKnights", label: "MK" },
                    { key: "lightHorse", label: "LH" },
                    { key: "levyInfantry", label: "LInf" },
                    { key: "levyArchers", label: "LArch" },
                  ].map(unit => (
                    <div key={unit.key}>
                      <label style={{ display: "block", color: "#a89a7a" }}>{unit.label}</label>
                      <input
                        type="number"
                        min="0"
                        value={army[unit.key] || 0}
                        onChange={(e) => updateNeutralArmy(army.id, unit.key, Number(e.target.value))}
                        style={{ width: "100%", padding: "2px 4px" }}
                      />
                    </div>
                  ))}
                </div>

                {/* Commander assignment */}
                <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #3a2f24" }}>
                  <div style={{ fontSize: "12px", color: "#a89a7a", marginBottom: "6px" }}>
                    Commanders:
                  </div>
                  {currentCommanders.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                      {currentCommanders.map(cmd => {
                        const courtPos = getCharacterCourtPosition(cmd.id);
                        const prowessBonus = getCourtProwessBonus(cmd.id);
                        return (
                          <div
                            key={cmd.id}
                            style={{
                              background: "#2a2018",
                              border: "1px solid #5e4934",
                              borderRadius: "4px",
                              padding: "4px 8px",
                              fontSize: "11px",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span>{cmd.firstName} {cmd.lastName}</span>
                            <span style={{ color: "#d1b26b" }}>L:{cmd.leadership}</span>
                            <span style={{ color: "#d17d7d" }}>
                              P:{cmd.prowess}{prowessBonus > 0 && <span style={{ color: "#8B008B" }}>+{prowessBonus}</span>}
                            </span>
                            {courtPos && (
                              <span style={{ color: "#8B008B", fontSize: "10px" }}>
                                ({courtPos.position})
                              </span>
                            )}
                            <button
                              onClick={() => {
                                const newCmds = (army.commanders || []).filter(id => id !== cmd.id);
                                updateArmyCommanders(army.id, newCmds);
                              }}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#ff6b6b",
                                cursor: "pointer",
                                padding: "0 2px",
                                fontSize: "12px",
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ fontSize: "11px", color: "#666", margin: "4px 0" }}>No commanders assigned</p>
                  )}
                  
                  {availableCommanders.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          const newCmds = [...(army.commanders || []), e.target.value];
                          updateArmyCommanders(army.id, newCmds);
                        }
                      }}
                      style={{
                        background: "#1a1410",
                        border: "1px solid #5e4934",
                        borderRadius: "4px",
                        color: "#f4efe4",
                        padding: "4px 8px",
                        fontSize: "11px",
                      }}
                    >
                      <option value="">+ Add Commander</option>
                      {availableCommanders.map(c => {
                        const courtPos = getCharacterCourtPosition(c.id);
                        return (
                          <option key={c.id} value={c.id}>
                            {c.firstName} {c.lastName} (L:{c.leadership} P:{c.prowess})
                            {courtPos ? ` - ${courtPos.position}` : ""}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Neutral Characters */}
      <div>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "12px"
        }}>
          <h2 style={{ margin: 0 }}>Neutral Characters</h2>
          <button 
            onClick={() => setIsCreatingCharacter(true)}
            className="green"
            style={{ padding: "8px 16px" }}
          >
            + Create Neutral Character
          </button>
        </div>

        {isCreatingCharacter && (
          <div className="card" style={{ marginBottom: "16px", padding: "16px" }}>
            <h3 style={{ marginTop: 0 }}>New Neutral Character</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px" }}>First Name</label>
                <input
                  type="text"
                  value={newCharData.firstName}
                  onChange={(e) => setNewCharData(prev => ({ ...prev, firstName: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px" }}>Last Name</label>
                <input
                  type="text"
                  value={newCharData.lastName}
                  onChange={(e) => setNewCharData(prev => ({ ...prev, lastName: e.target.value }))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginTop: "12px" }}>
              {["leadership", "prowess", "stewardship", "intrigue"].map(stat => (
                <div key={stat}>
                  <label style={{ fontSize: "11px", textTransform: "capitalize" }}>{stat}</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newCharData[stat]}
                    onChange={(e) => setNewCharData(prev => ({ ...prev, [stat]: Number(e.target.value) }))}
                    style={{ width: "100%" }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
              <button onClick={createNeutralCharacter} className="green">Create</button>
              <button onClick={() => setIsCreatingCharacter(false)}>Cancel</button>
            </div>
          </div>
        )}

        {characters.length === 0 ? (
          <p style={{ color: "#a89a7a" }}>No neutral characters. Create mercenary captains, quest givers, or other NPCs.</p>
        ) : (
          characters.map(char => {
            const courtPos = getCharacterCourtPosition(char.id);
            const prowessBonus = getCourtProwessBonus(char.id);
            return (
              <div key={char.id} className="card" style={{ marginBottom: "12px", padding: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "15px" }}>
                      {char.firstName} {char.lastName}
                      {courtPos && (
                        <span style={{ 
                          marginLeft: "10px", 
                          fontSize: "12px", 
                          color: "#8B008B",
                          padding: "2px 8px",
                          background: "#2a1a2a",
                          borderRadius: "4px"
                        }}>
                          {courtPos.position}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#c7bca5", marginTop: "4px" }}>
                      <div>Leadership: <strong style={{ color: "#d1b26b" }}>{char.leadership}</strong></div>
                      <div>
                        Prowess: <strong style={{ color: "#d17d7d" }}>{char.prowess}</strong>
                        {prowessBonus > 0 && (
                          <span style={{ color: "#8B008B", marginLeft: "6px" }}>
                            +{prowessBonus} ({courtPos.position}) = {char.prowess + prowessBonus}
                          </span>
                        )}
                      </div>
                      <div>Stewardship: <strong style={{ color: "#7db5d1" }}>{char.stewardship}</strong></div>
                      <div>Intrigue: <strong style={{ color: "#9d7dd1" }}>{char.intrigue}</strong></div>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteNeutralCharacter(char.id)}
                    style={{ 
                      padding: "4px 8px", 
                      fontSize: "11px",
                      background: "#3a1a1a",
                      border: "1px solid #5a2a2a",
                      color: "#ff6b6b"
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Main GM Panel Component
export default function GMPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("factions");
  const [role, setRole] = useState(null);
  
  // Data states
  const [regions, setRegions] = useState([]);
  const [factionData, setFactionData] = useState({});
  const [factionNames, setFactionNames] = useState({});
  const [armies, setArmies] = useState([]);
  const [neutralArmies, setNeutralArmies] = useState([]);
  const [neutralCharacters, setNeutralCharacters] = useState([]);
  const [agents, setAgents] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [courtPositions, setCourtPositions] = useState([]);
  
  // Region creation states
  const [newRegionName, setNewRegionName] = useState("");
  const [newRegionCode, setNewRegionCode] = useState("");
  const [newRegionOwner, setNewRegionOwner] = useState(1);

  // GM Mailbox states
  const [gmMessages, setGmMessages] = useState([]);
  const [gmComposeOpen, setGmComposeOpen] = useState(false);
  const [gmComposeTo, setGmComposeTo] = useState("1");
  const [gmComposeBody, setGmComposeBody] = useState("");
  const [selectedGmMessage, setSelectedGmMessage] = useState(null);

  // Check role
  useEffect(() => {
    const r = localStorage.getItem("role");
    if (r !== "gm") {
      navigate("/");
    } else {
      setRole(r);
    }
  }, [navigate]);

  // Load regions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "regions"), (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRegions(list);
    });
    return () => unsub();
  }, []);

  // Load faction data
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "factions"), (snap) => {
      const data = {};
      const names = {};
      snap.docs.forEach(doc => {
        const factionInfo = doc.data();
        const factionId = doc.id;
        if (factionId !== "neutral") {
          data[factionId] = factionInfo;
          names[factionId] = factionInfo.name || `Faction ${factionId}`;
        }
      });
      setFactionData(data);
      setFactionNames(names);
    });
    return () => unsub();
  }, []);

  // Load all armies
  useEffect(() => {
    const unsubscribers = [];
    
    // Load faction armies
    for (let factionId = 1; factionId <= 8; factionId++) {
      const unsub = onSnapshot(
        collection(db, "factions", String(factionId), "armies"),
        (snap) => {
          const factionArmies = snap.docs.map(doc => ({
            id: doc.id,
            factionId: factionId,
            ...doc.data(),
          }));
          
          setArmies(prev => {
            const otherArmies = prev.filter(a => a.factionId !== factionId);
            return [...otherArmies, ...factionArmies];
          });
        }
      );
      unsubscribers.push(unsub);
    }
    
    // Load neutral armies
    const neutralUnsub = onSnapshot(
      collection(db, "factions", "neutral", "armies"),
      (snap) => {
        const list = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNeutralArmies(list);
      }
    );
    unsubscribers.push(neutralUnsub);
    
    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  // Load neutral characters
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "factions", "neutral", "characters"),
      (snap) => {
        const list = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNeutralCharacters(list);
      }
    );
    return () => unsub();
  }, []);

  // Load agents
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAgents(list);
    });
    return () => unsub();
  }, []);

  // Load ALL characters across all factions
  useEffect(() => {
    const unsubscribers = [];
    
    for (let factionId = 1; factionId <= 8; factionId++) {
      const unsub = onSnapshot(
        collection(db, "factions", String(factionId), "characters"),
        (snap) => {
          const factionChars = snap.docs.map(doc => ({
            id: doc.id,
            factionId: factionId,
            ...doc.data(),
          }));
          
          setAllCharacters(prev => {
            const otherChars = prev.filter(c => c.factionId !== factionId);
            return [...otherChars, ...factionChars];
          });
        }
      );
      unsubscribers.push(unsub);
    }
    
    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  // Load court positions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "court"), (snap) => {
      const positions = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCourtPositions(positions);
    });
    return () => unsub();
  }, []);

  // Load GM messages (messages sent to GM)
  useEffect(() => {
    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("toFactionId", "==", 0),
      orderBy("createdAt", "desc")
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGmMessages(msgs);
    });
    return () => unsub();
  }, []);

  // GM message functions
  async function sendGmMessage() {
    if (!gmComposeBody.trim()) return;
    
    try {
      await addDoc(collection(db, "messages"), {
        fromFactionId: 0,
        fromFactionName: "Game Master",
        toFactionId: Number(gmComposeTo),
        toType: "faction",
        body: gmComposeBody.trim(),
        createdAt: new Date(),
        read: false,
        type: "gm",
      });
      
      setGmComposeBody("");
      setGmComposeOpen(false);
    } catch (error) {
      console.error("Error sending GM message:", error);
    }
  }

  async function deleteGmMessage(messageId) {
    try {
      await deleteDoc(doc(db, "messages", messageId));
      setSelectedGmMessage(null);
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  }

  const gmUnreadCount = gmMessages.filter(m => !m.read).length;

  // Create region function
  async function createRegion() {
    if (!newRegionName.trim()) return;
    
    const terrain = newRegionCode ? getTerrainFromMapPosition(newRegionCode.toUpperCase()) : TERRAIN_TYPES.PLAINS;
    
    await addDoc(collection(db, "regions"), {
      name: newRegionName,
      code: newRegionCode.toUpperCase(),
      owner: Number(newRegionOwner),
      terrain: terrain,
      upgrades: [],
      disabledUpgrades: [],
      notes: "",
      unrest: 0,
      underSiege: false,
    });

    setNewRegionName("");
    setNewRegionCode("");
  }

  if (role !== "gm") {
    return (
      <div className="container">
        <h1>Access Denied</h1>
        <p>GM access required</p>
        <button onClick={() => navigate("/")}>Back to Home</button>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "20px"
      }}>
        <h1 style={{ margin: 0 }}>Game Master Control Panel</h1>
        <button 
          onClick={() => navigate("/")}
          style={{ padding: "8px 16px" }}
        >
          ← Exit GM Panel
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === "factions" ? "active" : ""}`}
          onClick={() => setActiveTab("factions")}
        >
          Factions Overview
        </button>
        <button
          className={`tab ${activeTab === "regions" ? "active" : ""}`}
          onClick={() => setActiveTab("regions")}
        >
          Regions
        </button>
        <button
          className={`tab ${activeTab === "neutral" ? "active" : ""}`}
          onClick={() => setActiveTab("neutral")}
        >
          Neutral Forces
        </button>
        <button
          className={`tab ${activeTab === "court" ? "active" : ""}`}
          onClick={() => setActiveTab("court")}
        >
          High Court
        </button>
        <button
          className={`tab ${activeTab === "agents" ? "active" : ""}`}
          onClick={() => setActiveTab("agents")}
        >
          Agent Missions
        </button>
        <button
          className={`tab ${activeTab === "mailbox" ? "active" : ""}`}
          onClick={() => setActiveTab("mailbox")}
          style={{ position: "relative" }}
        >
          Mailbox
          {gmUnreadCount > 0 && (
            <span style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              background: "#ef4444",
              color: "#fff",
              fontSize: "10px",
              fontWeight: "bold",
              padding: "2px 6px",
              borderRadius: "10px",
              minWidth: "16px",
              textAlign: "center",
            }}>
              {gmUnreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Factions Overview Tab */}
      {activeTab === "factions" && (
        <div>
          <h2>Factions Overview</h2>
          <p style={{ fontSize: "13px", color: "#c7bca5", marginBottom: "16px" }}>
            Complete faction analytics with economy breakdowns and quick navigation
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "16px" }}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map(factionId => (
              <FactionCard
                key={factionId}
                factionId={factionId}
                factionData={factionData}
                regions={regions}
                armies={armies}
                agents={agents}
                courtPositions={courtPositions}
                onNavigate={navigate}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regions Tab */}
      {activeTab === "regions" && (
        <div>
          <h2>Region Management</h2>
          
          {/* Create Region */}
          <div className="card" style={{ marginBottom: "20px", padding: "16px" }}>
            <h3 style={{ marginTop: 0 }}>Create New Region</h3>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "10px", alignItems: "end" }}>
              <div>
                <label style={{ fontSize: "12px" }}>Region Name</label>
                <input
                  type="text"
                  placeholder="Greyreach"
                  value={newRegionName}
                  onChange={(e) => setNewRegionName(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px" }}>Code (optional)</label>
                <input
                  type="text"
                  placeholder="A1"
                  value={newRegionCode}
                  onChange={(e) => setNewRegionCode(e.target.value.toUpperCase())}
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px" }}>Owner</label>
                <select
                  value={newRegionOwner}
                  onChange={(e) => setNewRegionOwner(Number(e.target.value))}
                  style={{ width: "100%" }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(f => (
                    <option key={f} value={f}>{factionNames[f]}</option>
                  ))}
                </select>
              </div>
              <button onClick={createRegion} className="green">
                Create
              </button>
            </div>
            {newRegionCode && (
              <p style={{ fontSize: "11px", color: "#c7bca5", marginTop: "6px" }}>
                Terrain will be auto-detected: {getTerrainFromMapPosition(newRegionCode.toUpperCase())}
              </p>
            )}
          </div>

          {/* Regions List */}
          <h3>All Regions ({regions.length})</h3>
          <div style={{ display: "grid", gap: "8px" }}>
            {regions
              .sort((a, b) => (a.code || "").localeCompare(b.code || ""))
              .map(region => (
                <div key={region.id} className="card" style={{ 
                  padding: "12px",
                  background: region.underSiege ? "#3a1a1a" : "#201712",
                  border: region.underSiege ? "1px solid #8b3a3a" : "1px solid #4c3b2a"
                }}>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <strong style={{ fontSize: "14px" }}>
                        [{region.code || "??"}] {region.name || "Unnamed"}
                      </strong>
                      <span style={{ marginLeft: "12px", color: "#c7bca5", fontSize: "13px" }}>
                        Owner: {factionNames[region.owner]}
                      </span>
                      {region.underSiege && (
                        <span style={{ 
                          marginLeft: "12px", 
                          color: "#ff4444", 
                          fontSize: "12px",
                          fontWeight: "bold",
                          padding: "2px 8px",
                          background: "#3a1a1a",
                          borderRadius: "4px",
                          border: "1px solid #8b3a3a"
                        }}>
                          UNDER SIEGE
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => navigate(`/region/${region.id}`)}
                      className="small"
                    >
                      Edit →
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Neutral Forces Tab */}
      {activeTab === "neutral" && (
        <NeutralForces
          armies={neutralArmies}
          characters={neutralCharacters}
          courtPositions={courtPositions}
          regions={regions}
          onNavigate={navigate}
        />
      )}

      {/* Court Tab */}
      {activeTab === "court" && (
        <div>
          <h2>High Court Management</h2>
          <Court 
            isGM={true}
            myFactionId={null}
            factionNames={factionNames}
          />
        </div>
      )}

      {/* Agent Missions Tab */}
      {activeTab === "agents" && (
        <GMMissionPanel
          factionNames={factionNames}
          allRegions={regions}
          allAgents={agents}
          allCharacters={allCharacters}
          allArmies={armies}
        />
      )}

      {/* GM Mailbox Tab */}
      {activeTab === "mailbox" && (
        <div>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "20px"
          }}>
            <h2 style={{ margin: 0 }}>📜 Game Master Mailbox</h2>
            <button 
              className="green"
              onClick={() => setGmComposeOpen(true)}
            >
              ✉ Send Message to Faction
            </button>
          </div>

          {/* GM Compose Modal */}
          {gmComposeOpen && (
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}>
              <div style={{
                background: "#1a1410",
                border: "2px solid #5e4934",
                borderRadius: "12px",
                padding: "24px",
                maxWidth: "500px",
                width: "90%",
              }}>
                <h3 style={{ marginTop: 0 }}>Send Message as Game Master</h3>
                
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}>
                    Send To:
                  </label>
                  <select
                    value={gmComposeTo}
                    onChange={(e) => setGmComposeTo(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    {Object.entries(factionNames).map(([fId, name]) => (
                      <option key={fId} value={fId}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}>
                    Message:
                  </label>
                  <textarea
                    value={gmComposeBody}
                    onChange={(e) => setGmComposeBody(e.target.value)}
                    placeholder="Write your message to the faction..."
                    style={{ 
                      width: "100%", 
                      minHeight: "100px",
                      resize: "vertical"
                    }}
                  />
                </div>

                {/* Preview */}
                {gmComposeBody.trim() && (
                  <div style={{
                    background: "#0a0806",
                    border: "1px solid #3a2f24",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "16px",
                  }}>
                    <div style={{ fontSize: "11px", color: "#a89a7a", marginBottom: "8px" }}>
                      Preview:
                    </div>
                    <p style={{ 
                      fontStyle: "italic", 
                      margin: 0,
                      color: "#f4efe4",
                      lineHeight: "1.6"
                    }}>
                      My Lord, {gmComposeBody.trim()}
                      <br /><br />
                      Signed, Game Master
                    </p>
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  <button onClick={() => {
                    setGmComposeOpen(false);
                    setGmComposeBody("");
                  }}>
                    Cancel
                  </button>
                  <button 
                    className="green"
                    onClick={sendGmMessage}
                    disabled={!gmComposeBody.trim()}
                  >
                    Send Message
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Messages received from players */}
          <h3 style={{ marginBottom: "12px" }}>Messages from Players</h3>
          
          {gmMessages.length === 0 ? (
            <div style={{ 
              textAlign: "center", 
              color: "#a89a7a",
              padding: "40px",
              background: "#1a1410",
              borderRadius: "8px",
              border: "1px solid #3a2f24"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
              <p>No messages from players yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {gmMessages.map(msg => (
                <div
                  key={msg.id}
                  onClick={() => {
                    setSelectedGmMessage(msg);
                    if (!msg.read) {
                      updateDoc(doc(db, "messages", msg.id), { read: true });
                    }
                  }}
                  style={{
                    padding: "16px",
                    background: msg.read ? "#1a1410" : "#1f1a14",
                    border: `1px solid ${msg.read ? "#3a2f24" : "#5e4934"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                >
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    alignItems: "flex-start"
                  }}>
                    <div>
                      <div style={{ 
                        fontWeight: msg.read ? "normal" : "bold",
                        color: msg.read ? "#c7bca5" : "#f4efe4",
                        marginBottom: "4px"
                      }}>
                        From: {msg.fromFactionName || "Unknown"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#a89a7a" }}>
                        {msg.createdAt?.toDate?.().toLocaleDateString() || "Unknown date"}
                      </div>
                    </div>
                    {!msg.read && (
                      <span style={{
                        background: "#d4a32c",
                        color: "#000",
                        fontSize: "10px",
                        fontWeight: "bold",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}>
                        NEW
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Message Detail Modal */}
          {selectedGmMessage && (
            <div style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}>
              <div style={{
                background: "#1a1410",
                border: "2px solid #5e4934",
                borderRadius: "12px",
                padding: "24px",
                maxWidth: "600px",
                width: "90%",
                maxHeight: "80vh",
                overflow: "auto",
              }}>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "16px"
                }}>
                  <div>
                    <h3 style={{ margin: 0 }}>✉ Message from {selectedGmMessage.fromFactionName}</h3>
                    <div style={{ fontSize: "12px", color: "#a89a7a", marginTop: "4px" }}>
                      {selectedGmMessage.createdAt?.toDate?.().toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: "#0a0806",
                  border: "1px solid #3a2f24",
                  borderRadius: "8px",
                  padding: "20px",
                  marginBottom: "16px",
                }}>
                  <p style={{ 
                    fontStyle: "italic", 
                    margin: 0,
                    color: "#f4efe4",
                    lineHeight: "1.6"
                  }}>
                    My Lord, {selectedGmMessage.body}
                    <br /><br />
                    Signed, {selectedGmMessage.fromFactionName}
                  </p>
                </div>

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  <button 
                    onClick={() => deleteGmMessage(selectedGmMessage.id)}
                    style={{ 
                      background: "#3a2020",
                      borderColor: "#5a3030"
                    }}
                  >
                    🗑 Delete
                  </button>
                  <button onClick={() => setSelectedGmMessage(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}