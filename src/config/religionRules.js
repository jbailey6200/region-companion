// src/config/religionRules.js - NEW FILE

export const DEITIES = {
  durren: {
    name: "Durren",
    title: "Adiri of Justice and Chivalry",
    type: "adiri",
    bonuses: {
      characterLeadership: 1,
      dismountedKnightUpkeep: 2, // instead of 3
      mountedKnightUpkeep: 3, // instead of 4
    },
    description: [
      "+1 Leadership to characters",
      "Dismounted Knights cost 2g upkeep",
      "Mounted Knights cost 3g upkeep"
    ]
  },
  erigan: {
    name: "Erigan",
    title: "Adiri of War",
    type: "adiri",
    bonuses: {
      characterProwess: 1,
      huscarlUpkeep: 0.5, // instead of 1
    },
    description: [
      "+1 Prowess to characters",
      "Huscarls cost 0.5g upkeep"
    ]
  },
  pynthar: {
    name: "Pynthar",
    title: "Adiri of Wealth",
    type: "adiri",
    bonuses: {
      townGold: 2,
      cityGold: 3,
    },
    description: [
      "+2 gold per Town",
      "+3 gold per City"
    ]
  },
  altaea: {
    name: "Altaea",
    title: "Adiri of the Harvest",
    type: "adiri",
    bonuses: {
      farmLevyBonus: 10,
      farm2LevyBonus: 20,
    },
    description: [
      "Farms produce +10 levy archers",
      "Farm2 produces +20 levy archers"
    ]
  },
  kurimbor: {
    name: "Kurimbor",
    title: "Adiri of Travel",
    type: "adiri",
    bonuses: {
      armyMovement: 1,
      riverGold: 1,
    },
    description: [
      "Armies can move 1 additional region",
      "River regions produce +1 gold"
    ]
  },
  ombrax: {
    name: "Ombrax",
    title: "Adiri of Mining",
    type: "adiri",
    bonuses: {
      mineGold: 1,
      mountainHillsGold: 1,
    },
    description: [
      "Mines produce +1 gold",
      "Mountain/Hills regions +1 gold"
    ]
  },
  seyluna: {
    name: "Seyluna",
    title: "Adiri of Battle",
    type: "adiri",
    bonuses: {
      characterProwess: 2,
      levyInfantryCF: 1,
    },
    description: [
      "+2 Prowess to characters",
      "Levy Infantry +1 Combat Factor"
    ]
  },
  comnea: {
    name: "Comnea",
    title: "Adiri of Plotting",
    type: "adiri",
    bonuses: {
      characterIntrigue: 2,
      agentStartLevel: 2,
      agitatorUpkeep: 2, // instead of 4
    },
    description: [
      "+2 Intrigue to characters",
      "Agents start at level 2",
      "Agitators cost 2g upkeep"
    ]
  },
  kyrenKyrena: {
    name: "Kyren and Kyrena",
    title: "Adiri of Fertility",
    type: "adiri",
    bonuses: {
      settlementManpower: 20,
    },
    description: [
      "+20 manpower per Village/Town/City"
    ]
  },
  trengar: {
    name: "Trengar",
    title: "Adaar of the Seas",
    type: "adaar",
    bonuses: {
      warshipUpkeep: 2, // instead of 3
      coastalGold: 2,
    },
    description: [
      "Warships cost 2g upkeep",
      "Coastal regions +2 gold"
    ]
  },
  umara: {
    name: "Umara",
    title: "Adaar of the Earth",
    type: "adaar",
    bonuses: {
      keepHSG: 20,
      castleHSG: 40,
      fortificationCost: 0.5, // multiplier
    },
    description: [
      "Keeps provide +20 HSG capacity",
      "Castles provide +40 HSG capacity",
      "Fortifications cost half to build"
    ]
  },
  ulfus: {
    name: "Ulfus",
    title: "Adaar of the Mountains",
    type: "adaar",
    bonuses: {
      mountainGold: 3,
    },
    description: [
      "Mountain regions +3 gold"
    ]
  }
};