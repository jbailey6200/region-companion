// utils/economyCalculations.js - Shared economy and upkeep calculations

import { BUILDING_RULES } from "../config/buildingRules";
import { DEITIES } from "../config/religionRules";
import { TERRAIN_TYPES } from "../config/terrainRules";

/**
 * Get modified upkeep for a unit type based on deity bonuses
 */
export function getModifiedUpkeep(unitType, baseUpkeep, patronDeity) {
  const deity = patronDeity ? DEITIES[patronDeity] : null;
  if (!deity) return baseUpkeep;

  switch (unitType) {
    case "huscarls":
      return deity.bonuses.huscarlUpkeep ?? baseUpkeep;
    case "dismountedKnights":
      return deity.bonuses.dismountedKnightUpkeep ?? baseUpkeep;
    case "mountedKnights":
      return deity.bonuses.mountedKnightUpkeep ?? baseUpkeep;
    case "warships":
      return deity.bonuses.warshipUpkeep ?? baseUpkeep;
    case "agitator":
      return deity.bonuses.agitatorUpkeep ?? baseUpkeep;
    case "menAtArms":
    case "crossbowmen":
    case "pikemen":
    case "lightHorse":
    default:
      return baseUpkeep;
  }
}

/**
 * Calculate economy for a faction's regions with deity bonuses
 */
export function calculateEconomy(regions, patronDeity = null) {
  let goldTotal = 0;
  let manpowerProdTotal = 0;
  let manpowerCostTotal = 0;
  let hsgCapTotal = 0;
  let farmEqTotal = 0;
  let mineEqTotal = 0;
  let levyInfTotal = 0;
  let levyArchTotal = 0;

  // Income breakdown tracking
  let settlementGold = 0;
  let mineGold = 0;
  let fortificationCost = 0;
  let deityGold = 0;

  let townCountTotal = 0;
  let cityCountTotal = 0;
  let villageCountTotal = 0;

  let riverRegionCount = 0;
  let coastalRegionCount = 0;
  let mountainRegionCount = 0;
  let hillsRegionCount = 0;
  let totalMineCount = 0;

  const deity = patronDeity ? DEITIES[patronDeity] : null;

  for (const r of regions) {
    // Skip regions under siege - they contribute nothing
    if (r.underSiege) continue;

    const ups = r.upgrades || [];
    const disabled = r.disabledUpgrades || [];
    const terrain = r.terrain || TERRAIN_TYPES.PLAINS;

    if (terrain === TERRAIN_TYPES.RIVER) riverRegionCount++;
    if (terrain === TERRAIN_TYPES.COAST) coastalRegionCount++;
    if (terrain === TERRAIN_TYPES.MOUNTAINS) mountainRegionCount++;
    if (terrain === TERRAIN_TYPES.HILLS) hillsRegionCount++;

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

      // Track base gold by source before deity bonuses
      if (name === "Village" || name === "Town" || name === "City") {
        settlementGold += (rule.gold || 0) * count;
      }
      if (name === "Mine" || name === "Mine2") {
        mineGold += (rule.gold || 0) * count;
      }
      if (name === "Keep" || name === "Castle") {
        fortificationCost += Math.abs(rule.gold || 0) * count;
      }

      // Apply deity bonuses
      if (deity) {
        if (deity.bonuses.townGold && name === "Town") {
          gold += deity.bonuses.townGold;
          deityGold += deity.bonuses.townGold * count;
        }
        if (deity.bonuses.cityGold && name === "City") {
          gold += deity.bonuses.cityGold;
          deityGold += deity.bonuses.cityGold * count;
        }
        if (deity.bonuses.mineGold && (name === "Mine" || name === "Mine2")) {
          gold += deity.bonuses.mineGold;
          deityGold += deity.bonuses.mineGold * count;
        }
        if (
          deity.bonuses.settlementManpower &&
          (name === "Village" || name === "Town" || name === "City")
        ) {
          manpower += deity.bonuses.settlementManpower;
        }
        if (name === "Keep" && deity.bonuses.keepHSG) {
          hsgCap += deity.bonuses.keepHSG;
        }
        if (name === "Castle" && deity.bonuses.castleHSG) {
          hsgCap += deity.bonuses.castleHSG;
        }
        if (deity.bonuses.farmLevyBonus && (name === "Farm" || name === "Farm2")) {
          levyArch += deity.bonuses.farmLevyBonus;
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
    });

    // Terrain bonuses from deity
    if (deity) {
      if (terrain === TERRAIN_TYPES.RIVER && deity.bonuses.riverGold) {
        regionGold += deity.bonuses.riverGold;
        deityGold += deity.bonuses.riverGold;
      }
      if (
        (terrain === TERRAIN_TYPES.MOUNTAINS || terrain === TERRAIN_TYPES.HILLS) &&
        deity.bonuses.mountainHillsGold
      ) {
        regionGold += deity.bonuses.mountainHillsGold;
        deityGold += deity.bonuses.mountainHillsGold;
      }
      if (terrain === TERRAIN_TYPES.COAST && deity.bonuses.coastalGold) {
        regionGold += deity.bonuses.coastalGold;
        deityGold += deity.bonuses.coastalGold;
      }
      if (terrain === TERRAIN_TYPES.MOUNTAINS && deity.bonuses.mountainGold) {
        regionGold += deity.bonuses.mountainGold;
        deityGold += deity.bonuses.mountainGold;
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
  }

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
    townCount: townCountTotal,
    cityCount: cityCountTotal,
    villageCount: villageCountTotal,
    // Income breakdown
    incomeBreakdown: {
      settlements: settlementGold,
      mines: mineGold,
      fortifications: fortificationCost,
      deity: deityGold,
    },
    deityBonuses: patronDeity
      ? {
          riverRegions: riverRegionCount,
          coastalRegions: coastalRegionCount,
          mountainRegions: mountainRegionCount,
          hillsRegions: hillsRegionCount,
          mines: totalMineCount,
        }
      : null,
    // For GM Panel summary
    deityBonusGold: deityGold,
    deityBonusManpower: 0, // Calculated separately if needed
    deityBonusHSG: 0, // Calculated separately if needed
  };
}

/**
 * Calculate upkeeps for a faction's armies, navy, and agents
 */
export function calculateUpkeeps(armies, factionData, agents, patronDeity) {
  const deity = patronDeity ? DEITIES[patronDeity] : null;

  // HSG upkeep
  let hsgUpkeep = 0;
  let levyUpkeep = 0;

  armies.forEach((army) => {
    if (army.deleted) return;

    const huscarlUp = deity?.bonuses.huscarlUpkeep ?? 2;
    const dkUp = deity?.bonuses.dismountedKnightUpkeep ?? 3;
    const mkUp = deity?.bonuses.mountedKnightUpkeep ?? 4;

    hsgUpkeep += (army.huscarls || 0) * huscarlUp;
    hsgUpkeep += (army.dismountedKnights || 0) * dkUp;
    hsgUpkeep += (army.mountedKnights || 0) * mkUp;
    hsgUpkeep += (army.lightHorse || 0) * 2;
    hsgUpkeep += (army.menAtArms || 0) * 2;
    hsgUpkeep += (army.crossbowmen || 0) * 1;
    hsgUpkeep += (army.pikemen || 0) * 3;

    levyUpkeep += ((army.levyInfantry || 0) + (army.levyArchers || 0)) * 0.25;
  });

  // Navy upkeep
  const warshipUp = deity?.bonuses.warshipUpkeep ?? 3;
  const navyUpkeep = (factionData?.navy?.warships || 0) * warshipUp;

  // Agent upkeep
  let agentUpkeep = 0;
  const agitatorUp = deity?.bonuses.agitatorUpkeep ?? 4;
  agents.forEach((agent) => {
    if (agent.type === "spy") agentUpkeep += 1;
    else if (agent.type === "agitator") agentUpkeep += agitatorUp;
    else if (agent.type === "enforcer") agentUpkeep += 2;
  });

  return {
    hsgUpkeep,
    levyUpkeep: Math.floor(levyUpkeep),
    navyUpkeep,
    agentUpkeep,
    total: hsgUpkeep + Math.floor(levyUpkeep) + navyUpkeep + agentUpkeep,
  };
}

/**
 * Calculate HSG used by armies
 */
export function calculateHSGUsed(armies) {
  return armies.reduce((sum, a) => {
    if (a.deleted) return sum;
    return (
      sum +
      (a.huscarls || 0) +
      (a.dismountedKnights || 0) +
      (a.mountedKnights || 0) +
      (a.lightHorse || 0) +
      (a.menAtArms || 0) +
      (a.crossbowmen || 0) +
      (a.pikemen || 0)
    );
  }, 0);
}

/**
 * Agent upkeep constants
 */
export const AGENT_UPKEEP = {
  spy: 1,
  agitator: 4,
  enforcer: 2,
};

export const LEVY_UPKEEP_PER_UNIT = 0.25;