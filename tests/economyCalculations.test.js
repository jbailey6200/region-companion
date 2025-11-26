// tests/economyCalculations.test.js
// Unit tests for economy calculation utilities

import {
  calculateEconomy,
  calculateUpkeeps,
  calculateHSGUsed,
  getModifiedUpkeep,
  AGENT_UPKEEP,
  LEVY_UPKEEP_PER_UNIT,
} from "../src/utils/economyCalculations.js";

// Mock the imports that economyCalculations.js needs
jest.mock("../src/config/buildingRules.js", () => ({
  BUILDING_RULES: {
    Village: { gold: 2, manpower: 10, buildCost: 5, levyInf: 20, farmEquivalent: 0, mineEquivalent: 0 },
    Town: { gold: 4, manpower: 20, buildCost: 10, levyInf: 40, farmEquivalent: 0, mineEquivalent: 0 },
    City: { gold: 8, manpower: 40, buildCost: 20, levyInf: 60, farmEquivalent: 0, mineEquivalent: 0 },
    Farm: { gold: 0, manpower: 5, farmEquivalent: 1, levyArch: 10 },
    Farm2: { gold: 0, manpower: 10, farmEquivalent: 2, levyArch: 20 },
    Mine: { gold: 3, manpower: 0, mineEquivalent: 1 },
    Mine2: { gold: 5, manpower: 0, mineEquivalent: 2 },
    Keep: { gold: -1, hsgCap: 10, manpowerCost: 5 },
    Castle: { gold: -2, hsgCap: 20, manpowerCost: 10 },
  },
}));

jest.mock("../src/config/religionRules.js", () => ({
  DEITIES: {
    erigan: { name: "Erigan", bonuses: { huscarlUpkeep: 0.5, riverGold: 1 } },
    durren: { name: "Durren", bonuses: { dismountedKnightUpkeep: 1, mountedKnightUpkeep: 2, mineGold: 1 } },
    trengar: { name: "Trengar", bonuses: { warshipUpkeep: 2, coastalGold: 2 } },
    comnea: { name: "Comnea", bonuses: { agitatorUpkeep: 2, agentStartLevel: 2 } },
    umara: { name: "Umara", bonuses: { fortificationCost: 0.5, keepHSG: 5, castleHSG: 10 } },
  },
}));

jest.mock("../src/config/terrainRules.js", () => ({
  TERRAIN_TYPES: {
    PLAINS: "plains",
    RIVER: "river",
    COAST: "coast",
    MOUNTAINS: "mountains",
    HILLS: "hills",
    FOREST: "forest",
  },
}));

describe("economyCalculations", () => {
  describe("getModifiedUpkeep", () => {
    test("returns base upkeep when no deity", () => {
      expect(getModifiedUpkeep("huscarls", 1, null)).toBe(1);
      expect(getModifiedUpkeep("dismountedKnights", 2, null)).toBe(2);
      expect(getModifiedUpkeep("mountedKnights", 3, null)).toBe(3);
    });

    test("returns modified upkeep for Erigan huscarls", () => {
      expect(getModifiedUpkeep("huscarls", 1, "erigan")).toBe(0.5);
    });

    test("returns modified upkeep for Durren knights", () => {
      expect(getModifiedUpkeep("dismountedKnights", 2, "durren")).toBe(1);
      expect(getModifiedUpkeep("mountedKnights", 3, "durren")).toBe(2);
    });

    test("returns modified upkeep for Trengar warships", () => {
      expect(getModifiedUpkeep("warships", 3, "trengar")).toBe(2);
    });

    test("returns modified upkeep for Comnea agitators", () => {
      expect(getModifiedUpkeep("agitator", 4, "comnea")).toBe(2);
    });

    test("returns base upkeep for unaffected unit types", () => {
      expect(getModifiedUpkeep("lightHorse", 1, "erigan")).toBe(1);
      expect(getModifiedUpkeep("huscarls", 1, "durren")).toBe(1);
    });
  });

  describe("calculateHSGUsed", () => {
    test("returns 0 for empty army list", () => {
      expect(calculateHSGUsed([])).toBe(0);
    });

    test("calculates HSG from single army", () => {
      const armies = [{ huscarls: 5, dismountedKnights: 3, mountedKnights: 2, lightHorse: 4 }];
      expect(calculateHSGUsed(armies)).toBe(14);
    });

    test("calculates HSG from multiple armies", () => {
      const armies = [
        { huscarls: 5, dismountedKnights: 0, mountedKnights: 0, lightHorse: 0 },
        { huscarls: 0, dismountedKnights: 3, mountedKnights: 2, lightHorse: 4 },
      ];
      expect(calculateHSGUsed(armies)).toBe(14);
    });

    test("ignores deleted armies", () => {
      const armies = [
        { huscarls: 5, dismountedKnights: 0, mountedKnights: 0, lightHorse: 0 },
        { huscarls: 10, dismountedKnights: 10, mountedKnights: 10, lightHorse: 10, deleted: true },
      ];
      expect(calculateHSGUsed(armies)).toBe(5);
    });

    test("handles missing unit fields", () => {
      const armies = [{ huscarls: 5 }];
      expect(calculateHSGUsed(armies)).toBe(5);
    });
  });

  describe("calculateUpkeeps", () => {
    test("calculates HSG upkeep correctly", () => {
      const armies = [{ huscarls: 10, dismountedKnights: 5, mountedKnights: 2, lightHorse: 3, levyInfantry: 0, levyArchers: 0 }];
      const result = calculateUpkeeps(armies, {}, [], null);
      expect(result.hsgUpkeep).toBe(29);
    });

    test("calculates levy upkeep correctly", () => {
      const armies = [{ huscarls: 0, dismountedKnights: 0, mountedKnights: 0, lightHorse: 0, levyInfantry: 10, levyArchers: 6 }];
      const result = calculateUpkeeps(armies, {}, [], null);
      expect(result.levyUpkeep).toBe(4);
    });

    test("calculates navy upkeep correctly", () => {
      const factionData = { navy: { warships: 5 } };
      const result = calculateUpkeeps([], factionData, [], null);
      expect(result.navyUpkeep).toBe(15);
    });

    test("calculates agent upkeep correctly", () => {
      const agents = [{ type: "spy" }, { type: "spy" }, { type: "agitator" }, { type: "enforcer" }];
      const result = calculateUpkeeps([], {}, agents, null);
      expect(result.agentUpkeep).toBe(8);
    });

    test("applies deity bonuses to upkeeps", () => {
      const armies = [{ huscarls: 10, dismountedKnights: 0, mountedKnights: 0, lightHorse: 0 }];
      const result = calculateUpkeeps(armies, {}, [], "erigan");
      expect(result.hsgUpkeep).toBe(5);
    });

    test("calculates total upkeep correctly", () => {
      const armies = [{ huscarls: 10, levyInfantry: 4, levyArchers: 4 }];
      const factionData = { navy: { warships: 2 } };
      const agents = [{ type: "spy" }];
      const result = calculateUpkeeps(armies, factionData, agents, null);
      expect(result.total).toBe(19);
    });

    test("ignores deleted armies", () => {
      const armies = [{ huscarls: 10, deleted: false }, { huscarls: 100, deleted: true }];
      const result = calculateUpkeeps(armies, {}, [], null);
      expect(result.hsgUpkeep).toBe(10);
    });
  });

  describe("calculateEconomy", () => {
    test("returns zeroes for empty regions", () => {
      const result = calculateEconomy([], null);
      expect(result.goldPerTurn).toBe(0);
      expect(result.manpowerProduced).toBe(0);
      expect(result.hsgCap).toBe(0);
    });

    test("calculates gold from settlements", () => {
      const regions = [
        { upgrades: ["Village"], terrain: "plains" },
        { upgrades: ["Town"], terrain: "plains" },
      ];
      const result = calculateEconomy(regions, null);
      expect(result.goldPerTurn).toBe(6);
    });

    test("calculates gold from mines", () => {
      const regions = [
        { upgrades: ["Mine", "Mine"], terrain: "plains" },
        { upgrades: ["Mine2"], terrain: "plains" },
      ];
      const result = calculateEconomy(regions, null);
      expect(result.goldPerTurn).toBe(11);
    });

    test("calculates HSG capacity from fortifications", () => {
      const regions = [
        { upgrades: ["Keep"], terrain: "plains" },
        { upgrades: ["Castle"], terrain: "plains" },
      ];
      const result = calculateEconomy(regions, null);
      expect(result.hsgCap).toBe(30);
    });

    test("calculates manpower correctly", () => {
      const regions = [{ upgrades: ["Village", "Farm"], terrain: "plains" }];
      const result = calculateEconomy(regions, null);
      expect(result.manpowerProduced).toBe(15);
    });

    test("calculates levy potential", () => {
      const regions = [{ upgrades: ["Village", "Farm"], terrain: "plains" }];
      const result = calculateEconomy(regions, null);
      expect(result.levyInfantry).toBe(20);
      expect(result.levyArchers).toBe(10);
    });

    test("counts settlements correctly", () => {
      const regions = [
        { upgrades: ["Village"], terrain: "plains" },
        { upgrades: ["Town"], terrain: "plains" },
        { upgrades: ["Town"], terrain: "plains" },
        { upgrades: ["City"], terrain: "plains" },
      ];
      const result = calculateEconomy(regions, null);
      expect(result.villageCount).toBe(1);
      expect(result.townCount).toBe(2);
      expect(result.cityCount).toBe(1);
    });

    test("skips regions under siege", () => {
      const regions = [
        { upgrades: ["Town"], terrain: "plains", underSiege: false },
        { upgrades: ["City"], terrain: "plains", underSiege: true },
      ];
      const result = calculateEconomy(regions, null);
      expect(result.goldPerTurn).toBe(4);
      expect(result.townCount).toBe(1);
      expect(result.cityCount).toBe(0);
    });

    test("handles disabled upgrades", () => {
      const regions = [{ upgrades: ["Mine", "Mine"], disabledUpgrades: ["Mine"], terrain: "plains" }];
      const result = calculateEconomy(regions, null);
      expect(result.goldPerTurn).toBe(3);
    });

    test("applies deity mine bonus", () => {
      const regions = [{ upgrades: ["Mine"], terrain: "plains" }];
      const result = calculateEconomy(regions, "durren");
      expect(result.goldPerTurn).toBe(4);
    });

    test("applies deity terrain bonus for river", () => {
      const regions = [{ upgrades: [], terrain: "river" }];
      const result = calculateEconomy(regions, "erigan");
      expect(result.goldPerTurn).toBe(1);
    });

    test("applies deity terrain bonus for coast", () => {
      const regions = [{ upgrades: [], terrain: "coast" }];
      const result = calculateEconomy(regions, "trengar");
      expect(result.goldPerTurn).toBe(2);
    });

    test("applies deity HSG bonus to fortifications", () => {
      const regions = [{ upgrades: ["Keep"], terrain: "plains" }];
      const result = calculateEconomy(regions, "umara");
      expect(result.hsgCap).toBe(15);
    });

    test("calculates farm and mine equivalents", () => {
      const regions = [{ upgrades: ["Farm", "Farm2", "Mine", "Mine2"], terrain: "plains" }];
      const result = calculateEconomy(regions, null);
      expect(result.farmEquivalent).toBe(3);
      expect(result.mineEquivalent).toBe(3);
    });

    test("calculates income breakdown", () => {
      const regions = [{ upgrades: ["Town", "Mine", "Keep"], terrain: "plains" }];
      const result = calculateEconomy(regions, null);
      expect(result.incomeBreakdown.settlements).toBe(4);
      expect(result.incomeBreakdown.mines).toBe(3);
      expect(result.incomeBreakdown.fortifications).toBe(1);
    });
  });

  describe("constants", () => {
    test("AGENT_UPKEEP values are correct", () => {
      expect(AGENT_UPKEEP.spy).toBe(1);
      expect(AGENT_UPKEEP.agitator).toBe(4);
      expect(AGENT_UPKEEP.enforcer).toBe(2);
    });

    test("LEVY_UPKEEP_PER_UNIT is correct", () => {
      expect(LEVY_UPKEEP_PER_UNIT).toBe(0.25);
    });
  });
});