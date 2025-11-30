// config/buildingRules.js - NEW FILE - Create this to centralize building rules

export const BUILDING_RULES = {
  Village: {
    gold: 2,
    manpower: 10,
    manpowerCost: 0,
    hsgCap: 10,
    levyInf: 100,
    settlement: true,
    buildCost: 20,
  },
  Town: {
    gold: 4,
    manpower: 20,
    manpowerCost: 0,
    hsgCap: 30,
    levyInf: 200,
    settlement: true,
    buildCost: 40,
  },
  City: {
    gold: 6,
    manpower: 30,
    manpowerCost: 0,
    hsgCap: 80,
    levyInf: 300,
    settlement: true,
    buildCost: 80,
  },

  Farm: {
    gold: 0,
    manpower: 0,
    manpowerCost: 2,
    levyArch: 20,
    farmEquivalent: 1,
    buildCost: 5,
  },
  Farm2: {
    gold: 0,
    manpower: 0,
    manpowerCost: 3,
    levyArch: 40,
    farmEquivalent: 2,
    buildCost: 10, // upgrade cost
  },

  Mine: {
    gold: 2,
    manpower: 0,
    manpowerCost: 2,
    mineEquivalent: 1,
    buildCost: 10,
  },
  Mine2: {
    gold: 3,
    manpower: 0,
    manpowerCost: 3,
    mineEquivalent: 2,
    buildCost: 20, // upgrade cost
  },

  Keep: {
    gold: -5,
    manpower: 0,
    manpowerCost: 2,
    hsgCap: 150,
    buildCost: 30,
  },
  Castle: {
    gold: -10,
    manpower: 0,
    manpowerCost: 4,
    hsgCap: 250,
    buildCost: 50, // upgrade cost
  },
};

export const HSG_UNITS = [
  { key: "huscarls", label: "Huscarls", upkeep: 2 },
  { key: "dismountedKnights", label: "Dismounted Knights", upkeep: 3 },
  { key: "mountedKnights", label: "Mounted Knights", upkeep: 4 },
  { key: "lightHorse", label: "Light Horse", upkeep: 2 },
];

export const NAVY_UNITS = [{ key: "warships", label: "Warships", upkeep: 3 }];

export const AGENT_UPKEEP = {
  spy: 2,
  agitator: 6,
  enforcer: 3,
};

export const LEVY_RAISE_COST = 1;
export const LEVY_UPKEEP_PER_UNIT = 0.25;