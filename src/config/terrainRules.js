// terrainRules.js - Terrain-based building restrictions
// Add this file to src/config/ or src/utils/

export const TERRAIN_TYPES = {
  PLAINS: "plains",
  MOUNTAINS: "mountains",
  FOREST: "forest",
  COAST: "coast",
  RIVER: "river",
  HILLS: "hills",
};

// Building limits per terrain type
export const TERRAIN_RULES = {
  plains: {
    name: "Plains",
    color: "#c4b896",
    icon: "🌾",
    description: "Fertile flatlands perfect for farming and settlement",
    maxFarms: 3,
    maxMines: 1,
    maxSettlements: 1,
    canHaveKeep: true,
    canHaveCastle: true,
    bonuses: ["Best for farms", "Any settlement type allowed"],
  },
  
  mountains: {
    name: "Mountains",
    color: "#7a6d5a",
    icon: "⛰️",
    description: "Rocky peaks rich in minerals but harsh for large settlements",
    maxFarms: 1,
    maxMines: 3,
    maxSettlements: 1,
    allowedSettlements: ["Village"],
    canHaveKeep: true,
    canHaveCastle: true,
    bonuses: ["Best for mines (3 max)", "Keeps & Castles allowed", "Excellent defense"],
    penalties: ["Villages only (no Town/City)", "Limited farming (1 max)"],
  },
  
  forest: {
    name: "Forest",
    color: "#4a5d3f",
    icon: "🌲",
    description: "Dense woodlands with farmable clearings",
    maxFarms: 2,
    maxMines: 1,
    maxSettlements: 1,
    allowedSettlements: ["Village", "Town"],
    canHaveKeep: true,
    canHaveCastle: false,
    bonuses: ["Villages & Towns allowed", "Keeps allowed", "Defensive terrain"],
    penalties: ["No Cities", "No Castles"],
  },
  
  coast: {
    name: "Coast",
    color: "#6b8aa3",
    icon: "🌊",
    description: "Coastal regions with access to the sea",
    maxFarms: 2,
    maxMines: 0,
    maxSettlements: 1,
    canHaveKeep: true,
    canHaveCastle: true,
    bonuses: ["Naval access", "Trade bonus (+1 gold if Town/City)", "Any settlement type"],
    penalties: ["No mines"],
    special: "Naval power projection",
  },
  
  river: {
    name: "River",
    color: "#5a8aa8",
    icon: "〰️",
    description: "Fertile river valleys perfect for agriculture and trade",
    maxFarms: 3,
    maxMines: 2,
    maxSettlements: 1,
    canHaveKeep: true,
    canHaveCastle: true,
    bonuses: ["Great for farms", "Trade routes (+1 gold)", "Any settlement type"],
    penalties: [],
  },
  
  hills: {
    name: "Hills",
    color: "#8a7d5a",
    icon: "⛰",
    description: "Rolling hills good for both farming and mining",
    maxFarms: 2,
    maxMines: 2,
    maxSettlements: 1,
    canHaveKeep: true,
    canHaveCastle: true,
    bonuses: ["Balanced terrain", "Good defense", "Any settlement type"],
    penalties: [],
  },
};

/**
 * Check if a building can be added to a region based on terrain
 */
export function canAddBuilding(terrain, buildingType, currentUpgrades) {
  const rules = TERRAIN_RULES[terrain];
  if (!rules) return { allowed: true, reason: "" }; // Unknown terrain = no restrictions
  
  const settlements = ["Village", "Town", "City"];
  const farms = ["Farm", "Farm2"];
  const mines = ["Mine", "Mine2"];
  
  // Check settlements
  if (settlements.includes(buildingType)) {
    const currentSettlement = currentUpgrades.find(u => settlements.includes(u));
    
    // Check if any settlement allowed
    if (rules.maxSettlements === 0) {
      return { allowed: false, reason: `${rules.name} cannot support settlements` };
    }
    
    // Check if this specific settlement type is allowed
    if (rules.allowedSettlements && !rules.allowedSettlements.includes(buildingType)) {
      return { 
        allowed: false, 
        reason: `${rules.name} can only have: ${rules.allowedSettlements.join(", ")}` 
      };
    }
    
    // Already has a settlement - check if it's an upgrade path
    if (currentSettlement) {
      // Allow Village → Town → City upgrades if terrain permits
      const settlementOrder = ["Village", "Town", "City"];
      const currentIndex = settlementOrder.indexOf(currentSettlement);
      const newIndex = settlementOrder.indexOf(buildingType);
      
      // If trying to downgrade, allow it (for setSettlement function)
      if (newIndex < currentIndex) {
        return { allowed: true, reason: "" };
      }
      
      // If trying to upgrade, check if target is allowed
      if (newIndex > currentIndex) {
        if (rules.allowedSettlements && !rules.allowedSettlements.includes(buildingType)) {
          return { 
            allowed: false, 
            reason: `${rules.name} can only have: ${rules.allowedSettlements.join(", ")}` 
          };
        }
      }
    }
  }
  
  // Check farms
  if (farms.includes(buildingType)) {
    const currentFarms = currentUpgrades.filter(u => farms.includes(u)).length;
    if (currentFarms >= rules.maxFarms) {
      return { 
        allowed: false, 
        reason: `${rules.name} can only support ${rules.maxFarms} farm(s)` 
      };
    }
  }
  
  // Check mines
  if (mines.includes(buildingType)) {
    const currentMines = currentUpgrades.filter(u => mines.includes(u)).length;
    if (currentMines >= rules.maxMines) {
      return { 
        allowed: false, 
        reason: `${rules.name} can only support ${rules.maxMines} mine(s)` 
      };
    }
  }
  
  // Check keeps
  if (buildingType === "Keep" && !rules.canHaveKeep) {
    return { allowed: false, reason: `${rules.name} cannot support keeps` };
  }
  
  // Check castles
  if (buildingType === "Castle" && !rules.canHaveCastle) {
    return { allowed: false, reason: `${rules.name} cannot support castles` };
  }
  
  return { allowed: true, reason: "" };
}

/**
 * Get terrain display info
 */
export function getTerrainInfo(terrain) {
  return TERRAIN_RULES[terrain] || {
    name: "Unknown",
    color: "#888",
    icon: "❓",
    description: "Unknown terrain type",
  };
}

/**
 * Get recommended terrain for a region based on map analysis
 * This is a helper for bulk assignment
 */
export function getTerrainFromMapPosition(code) {
  // Based on your map image analysis
  const row = code[0];
  const num = parseInt(code.slice(1));
  
  // Coastal regions (bottom of map)
  if (row === 'G' && num >= 5 && num <= 8) return TERRAIN_TYPES.COAST;
  if (row === 'H' || row === 'I') return TERRAIN_TYPES.COAST;
  
  // Mountain regions (scattered throughout)
  const mountainRegions = ['A7', 'B7', 'B8', 'C6', 'C7', 'C13', 'D6', 'D16', 'E4', 'E5', 'E6', 'E14', 'F4'];
  if (mountainRegions.includes(code)) return TERRAIN_TYPES.MOUNTAINS;
  
  // Forest regions (visible as dark green clusters)
  const forestRegions = [
    'A10', 'A11', 'A12', 'A14', 'A15',
    'B2', 'B11', 'B15',
    'C2', 'C11',
    'D1', 'D9', 'D10', 'D15',
    'E1', 'E8', 'E10',
    'F14'
  ];
  if (forestRegions.includes(code)) return TERRAIN_TYPES.FOREST;
  
  // River regions (blue lines on map)
  const riverRegions = ['A4', 'A5', 'B5', 'B16', 'C3', 'C4', 'D4', 'D8', 'D13', 'E12', 'F2', 'F12', 'G2'];
  if (riverRegions.includes(code)) return TERRAIN_TYPES.RIVER;
  
  // Everything else is plains
  return TERRAIN_TYPES.PLAINS;
}