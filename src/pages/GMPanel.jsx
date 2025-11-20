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
} from "firebase/firestore";
import RegionCard from "../components/RegionCard";
import ArmyCard from "../components/ArmyCard";
import CharacterCard from "../components/CharacterCard";
import Court from "../components/Court";
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
    deityBonuses: {
      gold: deityBonusGold,
      manpower: deityBonusManpower,
      hsgCap: deityBonusHSG,
    },
  };
}

// Calculate unit upkeep with deity bonuses
function calculateUnitUpkeep(armies, warships, agents, patronDeity) {
  const deity = patronDeity ? DEITIES[patronDeity] : null;
  let hsgUpkeep = 0;
  let levyUpkeep = 0;
  let navyUpkeep = 0;
  let agentUpkeep = 0;
  
  // HSG upkeep
  armies.forEach(army => {
    if (army.deleted) return;
    hsgUpkeep += (army.huscarls || 0) * (deity?.bonuses.huscarlUpkeep || 2);
    hsgUpkeep += (army.dismountedKnights || 0) * (deity?.bonuses.dismountedKnightUpkeep || 3);
    hsgUpkeep += (army.mountedKnights || 0) * (deity?.bonuses.mountedKnightUpkeep || 4);
    hsgUpkeep += (army.lightHorse || 0) * 2;
    
    // Levy upkeep
    const levyTotal = (army.levyInfantry || 0) + (army.levyArchers || 0);
    levyUpkeep += Math.round(levyTotal * LEVY_UPKEEP_PER_UNIT);
  });
  
  // Navy upkeep
  navyUpkeep = warships * (deity?.bonuses.warshipUpkeep || 3);
  
  // Agent upkeep
  agents.forEach(agent => {
    const type = agent.type;
    if (type === 'spy') agentUpkeep += 1;
    else if (type === 'agitator') agentUpkeep += deity?.bonuses.agitatorUpkeep || 4;
    else if (type === 'enforcer') agentUpkeep += 2;
  });
  
  return { hsgUpkeep, levyUpkeep, navyUpkeep, agentUpkeep };
}

// Enhanced Faction Card Component
function FactionCard({ 
  factionId, 
  factionData, 
  regions, 
  armies, 
  agents, 
  courtPositions,
  onNavigate 
}) {
  const faction = factionData[factionId];
  const patronDeity = faction?.patronDeity;
  const factionRegions = regions.filter(r => r.owner === factionId);
  const factionArmies = armies.filter(a => a.factionId === factionId && !a.deleted);
  const factionAgents = agents.filter(a => a.factionId === factionId);
  
  // Calculate economy with deity bonuses
  const eco = calculateEconomyWithDeity(factionRegions, patronDeity);
  
  // Calculate court bonuses
  const courtBonuses = getCourtBonuses(courtPositions, factionId);
  
  // Calculate unit upkeeps
  const upkeeps = calculateUnitUpkeep(
    factionArmies, 
    faction?.navy?.warships || 0,
    factionAgents,
    patronDeity
  );
  
  // Calculate totals
  const totalGold = eco.goldPerTurn + courtBonuses.gold;
  const totalGoldAfterUpkeep = totalGold - upkeeps.hsgUpkeep - upkeeps.levyUpkeep - 
                               upkeeps.navyUpkeep - upkeeps.agentUpkeep;
  
  // Count units
  const totalHSGUnits = factionArmies.reduce((sum, a) => 
    sum + (a.huscarls || 0) + (a.dismountedKnights || 0) + 
    (a.mountedKnights || 0) + (a.lightHorse || 0), 0);
  
  const totalLevyUnits = factionArmies.reduce((sum, a) => 
    sum + (a.levyInfantry || 0) + (a.levyArchers || 0), 0);
  
  const hsgUsed = totalHSGUnits * 10;
  const overCap = hsgUsed > eco.hsgCap;
  
  return (
    <div className="card" style={{ 
      padding: "16px",
      background: "#241b15",
      marginBottom: "12px"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "12px"
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: "18px",
          color: "#f4efe4"
        }}>
          {faction?.name || `Faction ${factionId}`}
        </h3>
        <button 
          onClick={() => onNavigate(`/faction/${factionId}`)}
          style={{
            padding: "6px 12px",
            background: "#30425d",
            borderColor: "#4a5d7a",
            fontSize: "13px"
          }}
        >
          View as Faction →
        </button>
      </div>
      
      {/* Territory & Military */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr 1fr",
        gap: "12px",
        marginBottom: "12px",
        fontSize: "13px"
      }}>
        <div>
          <strong style={{ color: "#d1b26b" }}>Territory</strong>
          <div>Regions: <strong>{factionRegions.length}</strong></div>
          <div>Towns: {eco.townCount} | Cities: {eco.cityCount}</div>
        </div>
        
        <div>
          <strong style={{ color: "#c77d7d" }}>Military</strong>
          <div>Armies: <strong>{factionArmies.length}</strong></div>
          <div>HSG: {totalHSGUnits} | Levies: {totalLevyUnits}</div>
          <div>Warships: {faction?.navy?.warships || 0}</div>
        </div>
      </div>
      
      {/* Economy Breakdown */}
      <div style={{
        padding: "10px",
        background: "#1a1410",
        borderRadius: "6px",
        fontSize: "12px",
        marginBottom: "12px"
      }}>
        <strong style={{ color: "#FFD700" }}>Economy Breakdown</strong>
        
        <div style={{ marginTop: "8px" }}>
          <div>Base Buildings: <strong>+{eco.goldPerTurn - eco.deityBonuses.gold}</strong></div>
          {eco.deityBonuses.gold > 0 && (
            <div style={{ color: "#b5e8a1" }}>
              Deity Bonus: <strong>+{eco.deityBonuses.gold}</strong>
            </div>
          )}
          {courtBonuses.gold > 0 && (
            <div style={{ color: "#8B008B" }}>
              Court Bonus: <strong>+{courtBonuses.gold}</strong>
            </div>
          )}
          <div style={{ 
            borderTop: "1px solid #4c3b2a", 
            paddingTop: "4px",
            marginTop: "4px"
          }}>
            Gross Income: <strong style={{ color: "#FFD700" }}>+{totalGold}</strong>
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
function NeutralForces({ armies, characters, onNavigate }) {
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
            <div style={{ display: "grid", gap: "8px" }}>
              <input
                type="text"
                placeholder="Army Name"
                value={newArmyData.name}
                onChange={(e) => setNewArmyData({...newArmyData, name: e.target.value})}
              />
              <input
                type="text"
                placeholder="Location (Region Code)"
                value={newArmyData.location}
                onChange={(e) => setNewArmyData({...newArmyData, location: e.target.value})}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" }}>
                <label style={{ fontSize: "12px" }}>
                  Huscarls:
                  <input
                    type="number"
                    min="0"
                    value={newArmyData.huscarls}
                    onChange={(e) => setNewArmyData({...newArmyData, huscarls: Number(e.target.value)})}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                <label style={{ fontSize: "12px" }}>
                  Dismounted Knights:
                  <input
                    type="number"
                    min="0"
                    value={newArmyData.dismountedKnights}
                    onChange={(e) => setNewArmyData({...newArmyData, dismountedKnights: Number(e.target.value)})}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                <label style={{ fontSize: "12px" }}>
                  Mounted Knights:
                  <input
                    type="number"
                    min="0"
                    value={newArmyData.mountedKnights}
                    onChange={(e) => setNewArmyData({...newArmyData, mountedKnights: Number(e.target.value)})}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                <label style={{ fontSize: "12px" }}>
                  Light Horse:
                  <input
                    type="number"
                    min="0"
                    value={newArmyData.lightHorse}
                    onChange={(e) => setNewArmyData({...newArmyData, lightHorse: Number(e.target.value)})}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                <label style={{ fontSize: "12px" }}>
                  Levy Infantry:
                  <input
                    type="number"
                    min="0"
                    value={newArmyData.levyInfantry}
                    onChange={(e) => setNewArmyData({...newArmyData, levyInfantry: Number(e.target.value)})}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                <label style={{ fontSize: "12px" }}>
                  Levy Archers:
                  <input
                    type="number"
                    min="0"
                    value={newArmyData.levyArchers}
                    onChange={(e) => setNewArmyData({...newArmyData, levyArchers: Number(e.target.value)})}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={createNeutralArmy} className="green">Create</button>
                <button onClick={() => setIsCreatingArmy(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {armies.length === 0 ? (
          <p style={{ color: "#888" }}>No neutral armies yet</p>
        ) : (
          armies.map(army => (
            <div key={army.id} className="card" style={{ marginBottom: "12px" }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px"
              }}>
                <h3 style={{ margin: 0, fontSize: "16px" }}>
                  {army.name || "Unnamed Army"}
                </h3>
                <button
                  onClick={() => deleteNeutralArmy(army.id)}
                  className="small"
                  style={{
                    background: "#8b3a3a",
                    border: "1px solid #6d2828",
                  }}
                >
                  Delete
                </button>
              </div>
              <p style={{ fontSize: "13px", color: "#c7bca5", margin: "4px 0" }}>
                Location: {army.location || "Unknown"}
              </p>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "8px",
                fontSize: "12px"
              }}>
                <div>Huscarls: <strong>{army.huscarls || 0}</strong></div>
                <div>Dis. Knights: <strong>{army.dismountedKnights || 0}</strong></div>
                <div>Mtd. Knights: <strong>{army.mountedKnights || 0}</strong></div>
                <div>Light Horse: <strong>{army.lightHorse || 0}</strong></div>
                <div>Levy Inf: <strong>{army.levyInfantry || 0}</strong></div>
                <div>Levy Arch: <strong>{army.levyArchers || 0}</strong></div>
              </div>
            </div>
          ))
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
            <div style={{ display: "grid", gap: "8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="First Name"
                  value={newCharData.firstName}
                  onChange={(e) => setNewCharData({...newCharData, firstName: e.target.value})}
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={newCharData.lastName}
                  onChange={(e) => setNewCharData({...newCharData, lastName: e.target.value})}
                />
              </div>
              <textarea
                placeholder="Description (optional)"
                value={newCharData.description}
                onChange={(e) => setNewCharData({...newCharData, description: e.target.value})}
                style={{ minHeight: "60px" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                <label style={{ fontSize: "12px" }}>
                  Leadership:
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newCharData.leadership}
                    onChange={(e) => setNewCharData({...newCharData, leadership: Number(e.target.value)})}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                <label style={{ fontSize: "12px" }}>
                  Prowess:
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newCharData.prowess}
                    onChange={(e) => setNewCharData({...newCharData, prowess: Number(e.target.value)})}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                <label style={{ fontSize: "12px" }}>
                  Stewardship:
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newCharData.stewardship}
                    onChange={(e) => setNewCharData({...newCharData, stewardship: Number(e.target.value)})}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
                <label style={{ fontSize: "12px" }}>
                  Intrigue:
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={newCharData.intrigue}
                    onChange={(e) => setNewCharData({...newCharData, intrigue: Number(e.target.value)})}
                    style={{ width: "100%", marginTop: "4px" }}
                  />
                </label>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={createNeutralCharacter} className="green">Create</button>
                <button onClick={() => setIsCreatingCharacter(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {characters.length === 0 ? (
          <p style={{ color: "#888" }}>No neutral characters yet</p>
        ) : (
          characters.map(char => (
            <div key={char.id} className="card" style={{ marginBottom: "12px" }}>
              <div style={{ 
                display: "flex", 
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px"
              }}>
                <h3 style={{ margin: 0, fontSize: "16px" }}>
                  {char.firstName || "Unnamed"} {char.lastName || "Character"}
                </h3>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span style={{
                    padding: "4px 8px",
                    background: "#2a2218",
                    borderRadius: "4px",
                    border: "1px solid #808080",
                    fontSize: "12px",
                    color: "#c7bca5"
                  }}>
                    ⚠️ Court Eligible
                  </span>
                  <button
                    onClick={() => deleteNeutralCharacter(char.id)}
                    className="small"
                    style={{
                      background: "#8b3a3a",
                      border: "1px solid #6d2828",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              {char.description && (
                <p style={{ fontSize: "12px", color: "#a89a7a", fontStyle: "italic", margin: "8px 0" }}>
                  {char.description}
                </p>
              )}
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "8px",
                fontSize: "12px"
              }}>
                <div>Leadership: <strong style={{ color: "#d1b26b" }}>{char.leadership}</strong></div>
                <div>Prowess: <strong style={{ color: "#c77d7d" }}>{char.prowess}</strong></div>
                <div>Stewardship: <strong style={{ color: "#7db5d1" }}>{char.stewardship}</strong></div>
                <div>Intrigue: <strong style={{ color: "#9d7dd1" }}>{char.intrigue}</strong></div>
              </div>
            </div>
          ))
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
  const [courtPositions, setCourtPositions] = useState([]);
  
  // Region creation states
  const [newRegionName, setNewRegionName] = useState("");
  const [newRegionCode, setNewRegionCode] = useState("");
  const [newRegionOwner, setNewRegionOwner] = useState(1);

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
    });

    setNewRegionName("");
    setNewRegionCode("");
  }

  if (role !== "gm") {
    return (
      <div className="container">
        <h1>Access Denied</h1>
        <p>GM access required</p>
        <button onClick={() => navigate("/")}>← Home</button>
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
          style={{ opacity: 0.5 }}
        >
          Agents (Soon)
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
                <div key={region.id} className="card" style={{ padding: "12px" }}>
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

      {/* Agents Tab (placeholder) */}
      {activeTab === "agents" && (
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          <h2>Agent Management</h2>
          <p style={{ color: "#888" }}>
            Complete agent mission system coming soon...
          </p>
          <ul style={{ textAlign: "left", display: "inline-block", color: "#c7bca5", fontSize: "13px" }}>
            <li>View all agents across factions</li>
            <li>Assign missions and track progress</li>
            <li>Agent vs agent interactions</li>
            <li>Success/failure rolls</li>
            <li>Complete mission history</li>
          </ul>
        </div>
      )}
    </div>
  );
}