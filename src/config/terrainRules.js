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
 * Updated to match the actual circled terrain types from the map
 */
export function getTerrainFromMapPosition(code) {
  // Based on the actual map with terrain circles:
  // Red = Mountains, Green = Forest, Blue = Coast, Purple = River, Black = Hills
  
  // Coast (Blue outline - southern coastal regions)
  const coastRegions = [
    'F8', 'F12', 'F13',
    'G4', 'G5', 'G6', 'G7', 'G8',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'I1'
  ];
  if (coastRegions.includes(code)) return TERRAIN_TYPES.COAST;
  
  // River (Purple circles)
  const riverRegions = [
    'A4', 'A5', 'A6',
    'B4', 'B5', 'B14',
    'C3', 'C4',
    'D2', 'D3', 'D4', 'D12',
    'E2', 'E11',
    'F2',
    'G1'
  ];
  if (riverRegions.includes(code)) return TERRAIN_TYPES.RIVER;
  
  // Mountains (Red circles)
  const mountainRegions = [
    'B7', 'B8', 'B9',
    'C8', 'C9', 'C10', 'C13', 'C14',
    'D6', 'D10', 'D15', 'D16',
    'E4', 'E5', 'E14', 'E15',
    'F4'
  ];
  if (mountainRegions.includes(code)) return TERRAIN_TYPES.MOUNTAINS;
  
  // Forest (Green boxes/circles)
  const forestRegions = [
    'A10', 'A11', 'A12', 'A13', 'A14', 'A15',
    'B10', 'B11', 'B15', 'B16',
    'C1', 'C2', 'C11', 'C12',
    'D8', 'D9', 'D14',
    'E1', 'E8', 'E9', 'E13',
    'F14'
  ];
  if (forestRegions.includes(code)) return TERRAIN_TYPES.FOREST;
  
  // Hills (Black circles)
  const hillsRegions = [
    'C6', 'C7',
    'D7',
    'F3', 'F5',
    'G2'
  ];
  if (hillsRegions.includes(code)) return TERRAIN_TYPES.HILLS;
  
  // Everything else is plains (uncircled regions)
  return TERRAIN_TYPES.PLAINS;
}