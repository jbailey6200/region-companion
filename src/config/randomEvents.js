// config/randomEvents.js - Random events that can be pushed to players

export const RANDOM_EVENTS = [
  // GOLD EVENTS (30% total)
  {
    id: "minor_windfall",
    name: "Minor Windfall",
    category: "gold",
    message: "A forgotten debt has been repaid, adding coin to your coffers.",
    icon: "🪙",
    effect: { type: "gold", value: 5 },
    weight: 6,
  },
  {
    id: "major_windfall",
    name: "Major Windfall",
    category: "gold",
    message: "A wealthy merchant has died without heirs, leaving his fortune to the crown.",
    icon: "💰",
    effect: { type: "gold", value: 20 },
    weight: 3,
  },
  {
    id: "bountiful_trade_routes",
    name: "Bountiful Trade Routes",
    category: "gold",
    message: "Merchant caravans report exceptional profits along your trade roads.",
    icon: "🐪",
    effect: { type: "gold", value: 20 },
    weight: 3,
  },
  {
    id: "bandit_king_slain",
    name: "Bandit King Slain",
    category: "gold",
    message: "Your forces have killed a notorious bandit leader. The roads are safer.",
    icon: "💀",
    effect: { type: "gold", value: 10 },
    weight: 4,
  },
  {
    id: "smugglers_cache",
    name: "Smuggler's Cache",
    category: "gold",
    message: "Your soldiers discovered a hidden smuggler's stash.",
    icon: "🏴‍☠️",
    effect: { type: "gold", value: 15 },
    weight: 3,
  },
  {
    id: "poor_investment",
    name: "Poor Investment",
    category: "gold",
    message: "A minor business dealing has gone sour.",
    icon: "😞",
    effect: { type: "gold", value: -5 },
    weight: 5,
  },
  {
    id: "bad_investment",
    name: "Bad Investment",
    category: "gold",
    message: "A venture you funded has failed to return the expected profits.",
    icon: "📉",
    effect: { type: "gold", value: -10 },
    weight: 4,
  },
  {
    id: "horrible_investment",
    name: "Horrible Investment",
    category: "gold",
    message: "Your investment in a trading expedition was a catastrophic failure.",
    icon: "💸",
    effect: { type: "gold", value: -15 },
    weight: 2,
  },

  // CHARACTER EVENTS (11% total)
  {
    id: "heir_comes_of_age",
    name: "Heir Comes of Age",
    category: "character",
    message: "A child of your noble house has reached maturity and is ready to serve the realm.",
    icon: "👶",
    effect: { type: "new_character", value: 1 },
    weight: 9,
  },
  {
    id: "twins_come_of_age",
    name: "Twins Come of Age",
    category: "character",
    message: "A blessing! Twin heirs of your house have come of age together.",
    icon: "👶👶",
    effect: { type: "new_character", value: 2 },
    weight: 2,
  },

  // REGION/BUILDING EVENTS (7% total)
  {
    id: "earthquake",
    name: "Earthquake",
    category: "building",
    message: "The earth has trembled! Buildings have collapsed and people flee in terror.",
    icon: "🌋",
    effect: { type: "destroy_building", value: ["farm", "mine"] },
    weight: 1,
  },
  {
    id: "fire_in_granary",
    name: "Fire in the Granary",
    category: "building",
    message: "A fire has destroyed stored grain and the building housing it.",
    icon: "🔥",
    effect: { type: "destroy_building", value: ["farm"] },
    weight: 1.5,
  },
  {
    id: "mine_collapse",
    name: "Mine Collapse",
    category: "building",
    message: "A tunnel has collapsed, killing miners and rendering the mine unusable.",
    icon: "⛏️",
    effect: { type: "destroy_building", value: ["mine"] },
    weight: 1.5,
  },
  {
    id: "expanded_farming",
    name: "Expanded Farming",
    category: "building",
    message: "Industrious peasants have cleared new fields and improved their techniques.",
    icon: "🌾",
    effect: { type: "free_upgrade", value: "farm_2" },
    weight: 2,
  },
  {
    id: "rightful_heir",
    name: "Rightful Heir",
    category: "building",
    message: "Ancient documents prove your claim to nearby unclaimed lands.",
    icon: "📜",
    effect: { type: "gain_region", value: "adjacent_uncontrolled" },
    weight: 1,
  },

  // ARMY EVENTS (6% total)
  {
    id: "bandits",
    name: "Bandits",
    category: "army",
    message: "Outlaws have gathered in force and now threaten your lands.",
    icon: "🏴‍☠️",
    effect: { type: "spawn_army", value: "bandits_in_territory" },
    weight: 2,
  },
  {
    id: "raiders_vestenlund",
    name: "Raiders from Vestenlund",
    category: "army",
    message: "War horns echo from the north! Raiders descend from Vestenlund seeking plunder.",
    icon: "⚔️",
    effect: { type: "spawn_army", value: "raiders_north" },
    revealToAll: true,
    weight: 2,
  },
  {
    id: "raiders_tarnek",
    name: "Raiders from Tarnek",
    category: "army",
    message: "Sails on the horizon! Tarnek longships have made landfall on the southern coast.",
    icon: "⛵",
    effect: { type: "spawn_army", value: "raiders_south" },
    revealToAll: true,
    weight: 2,
  },

  // TERRAIN EVENTS (3% total)
  {
    id: "drought",
    name: "Drought",
    category: "terrain",
    message: "The rivers run low. Fords appear where once there were none.",
    icon: "🏜️",
    effect: { type: "terrain_modifier", value: "rivers_crossable" },
    revealToAll: true,
    excludesWith: "flooding",
    weight: 1.5,
  },
  {
    id: "flooding",
    name: "Flooding",
    category: "terrain",
    message: "Torrential rains have swollen the rivers. Bridges have been washed away.",
    icon: "🌊",
    effect: { type: "terrain_modifier", value: "bridges_impassable" },
    revealToAll: true,
    excludesWith: "drought",
    weight: 1.5,
  },

  // FLAVOR EVENTS (15% total)
  {
    id: "good_weather",
    name: "Good Weather",
    category: "flavor",
    message: "The skies are clear and the harvest looks promising. A peaceful season.",
    icon: "☀️",
    effect: { type: "none" },
    weight: 2.5,
  },
  {
    id: "uneventful_season",
    name: "Uneventful Season",
    category: "flavor",
    message: "The realm is quiet. No news is good news.",
    icon: "📭",
    effect: { type: "none" },
    weight: 3,
  },
  {
    id: "strange_omen",
    name: "Strange Omen",
    category: "flavor",
    message: "A two-headed calf was born in a village. The peasants whisper of portents.",
    icon: "🌑",
    effect: { type: "none" },
    weight: 2,
  },
  {
    id: "visiting_bard",
    name: "Visiting Bard",
    category: "flavor",
    message: "A traveling bard has composed a song praising your house. How flattering.",
    icon: "🎵",
    effect: { type: "none" },
    weight: 2.5,
  },
  {
    id: "foreign_dignitary",
    name: "Foreign Dignitary",
    category: "flavor",
    message: "A diplomat from distant lands passes through, offering pleasantries and little else.",
    icon: "🎩",
    effect: { type: "none" },
    weight: 2,
  },
  {
    id: "local_festival",
    name: "Local Festival",
    category: "flavor",
    message: "The common folk celebrate a harvest festival. Spirits are high.",
    icon: "🎉",
    effect: { type: "none" },
    weight: 2,
  },
  {
    id: "comet_sighted",
    name: "Comet Sighted",
    category: "flavor",
    message: "A comet streaks across the night sky. Some say it is an omen, but of what?",
    icon: "☄️",
    effect: { type: "none" },
    weight: 1,
  },

  // PROWESS EVENTS (6.25% total)
  {
    id: "combat_training",
    name: "Combat Training",
    category: "prowess",
    message: "A wandering knight has offered to train your nobles in martial combat.",
    icon: "⚔️",
    effect: { type: "stat_change", stat: "prowess", value: 1 },
    weight: 2.75,
  },
  {
    id: "trial_by_combat",
    name: "Trial by Combat",
    category: "prowess",
    message: "Your champion emerged victorious from a duel, honing their skills.",
    icon: "🏆",
    effect: { type: "stat_change", stat: "prowess", value: 2 },
    weight: 1.5,
  },
  {
    id: "war_wound",
    name: "War Wound",
    category: "prowess",
    message: "An old injury flares up, limiting movement and strength.",
    icon: "🩸",
    effect: { type: "stat_change", stat: "prowess", value: -1 },
    weight: 1.25,
  },
  {
    id: "crippling_injury",
    name: "Crippling Injury",
    category: "prowess",
    message: "A terrible accident has left one of your nobles permanently maimed.",
    icon: "🦽",
    effect: { type: "stat_change", stat: "prowess", value: -2 },
    weight: 0.75,
  },

  // LEADERSHIP EVENTS (6.25% total)
  {
    id: "military_studies",
    name: "Military Studies",
    category: "leadership",
    message: "Your noble has been reading ancient texts on tactics and strategy.",
    icon: "📚",
    effect: { type: "stat_change", stat: "leadership", value: 1 },
    weight: 2.5,
  },
  {
    id: "renowned_tactician",
    name: "Renowned Tactician",
    category: "leadership",
    message: "Word spreads of your noble's brilliant maneuvers. Soldiers trust their lead.",
    icon: "🗺️",
    effect: { type: "stat_change", stat: "leadership", value: 1 },
    weight: 1.25,
  },
  {
    id: "veterans_wisdom",
    name: "Veteran's Wisdom",
    category: "leadership",
    message: "A retired general has taken one of your nobles under their wing.",
    icon: "🎖️",
    effect: { type: "stat_change", stat: "leadership", value: 2 },
    weight: 1,
  },
  {
    id: "lost_confidence",
    name: "Lost Confidence",
    category: "leadership",
    message: "A recent failure has shaken your noble's confidence in leading troops.",
    icon: "😔",
    effect: { type: "stat_change", stat: "leadership", value: -1 },
    weight: 1,
  },
  {
    id: "disastrous_blunder",
    name: "Disastrous Blunder",
    category: "leadership",
    message: "A catastrophic tactical error has ruined your noble's reputation with soldiers.",
    icon: "💀",
    effect: { type: "stat_change", stat: "leadership", value: -2 },
    weight: 0.5,
  },

  // INTRIGUE EVENTS (6.25% total)
  {
    id: "spy_network_expanded",
    name: "Spy Network Expanded",
    category: "intrigue",
    message: "Your agents have established new contacts in rival courts.",
    icon: "🕸️",
    effect: { type: "stat_change", stat: "intrigue", value: 1 },
    weight: 2.75,
  },
  {
    id: "blackmail_material",
    name: "Blackmail Material",
    category: "intrigue",
    message: "Compromising information about a rival has fallen into your noble's hands.",
    icon: "🤫",
    effect: { type: "stat_change", stat: "intrigue", value: 2 },
    weight: 1.5,
  },
  {
    id: "exposed_scheme",
    name: "Exposed Scheme",
    category: "intrigue",
    message: "A plot by one of your nobles was discovered. Their reputation for subtlety suffers.",
    icon: "🔦",
    effect: { type: "stat_change", stat: "intrigue", value: -1 },
    weight: 1.25,
  },
  {
    id: "double_agent",
    name: "Double Agent",
    category: "intrigue",
    message: "An agent your noble trusted was working for the enemy all along. A humiliating failure.",
    icon: "🎭",
    effect: { type: "stat_change", stat: "intrigue", value: -2 },
    weight: 0.75,
  },

  // STEWARDSHIP EVENTS (6.25% total)
  {
    id: "administrative_training",
    name: "Administrative Training",
    category: "stewardship",
    message: "A skilled steward has shared their methods for managing estates.",
    icon: "📋",
    effect: { type: "stat_change", stat: "stewardship", value: 1 },
    weight: 2.5,
  },
  {
    id: "efficient_reforms",
    name: "Efficient Reforms",
    category: "stewardship",
    message: "Your noble's reforms have streamlined tax collection.",
    icon: "📊",
    effect: { type: "stat_change", stat: "stewardship", value: 1 },
    weight: 1.25,
  },
  {
    id: "economic_genius",
    name: "Economic Genius",
    category: "stewardship",
    message: "Your noble has discovered innovative ways to maximize revenue.",
    icon: "🧮",
    effect: { type: "stat_change", stat: "stewardship", value: 2 },
    weight: 1,
  },
  {
    id: "poor_judgment",
    name: "Poor Judgment",
    category: "stewardship",
    message: "A series of bad decisions has called your noble's management into question.",
    icon: "🤦",
    effect: { type: "stat_change", stat: "stewardship", value: -1 },
    weight: 1,
  },
  {
    id: "embezzlement_discovered",
    name: "Embezzlement Discovered",
    category: "stewardship",
    message: "One of your nobles has been skimming from the treasury. Their reputation is ruined.",
    icon: "🐀",
    effect: { type: "stat_change", stat: "stewardship", value: -2 },
    weight: 0.5,
  },

  // CHARACTER DEATH EVENTS (3% total)
  {
    id: "hunting_accident",
    name: "Hunting Accident",
    category: "death",
    message: "A hunt gone wrong. A stray arrow, a spooked horse, a charging boar.",
    icon: "🦌",
    effect: { type: "kill_character" },
    weight: 0.33,
  },
  {
    id: "duel_of_honor",
    name: "Duel of Honor",
    category: "death",
    message: "A matter of honor could only be settled with steel. Your noble fell.",
    icon: "⚔️",
    effect: { type: "kill_character" },
    weight: 0.33,
  },
  {
    id: "sparring_accident",
    name: "Sparring Accident",
    category: "death",
    message: "What was meant to be friendly practice turned fatal with a single misstep.",
    icon: "🤺",
    effect: { type: "kill_character" },
    weight: 0.33,
  },
  {
    id: "plague",
    name: "Plague",
    category: "death",
    message: "A swift sickness took hold. The healers could do nothing.",
    icon: "🤒",
    effect: { type: "kill_character" },
    weight: 0.33,
  },
  {
    id: "thrown_from_horse",
    name: "Thrown from Horse",
    category: "death",
    message: "A sudden rear, a hard fall, a broken neck. The finest rider is not immortal.",
    icon: "🐴",
    effect: { type: "kill_character" },
    weight: 0.33,
  },
  {
    id: "drowned",
    name: "Drowned",
    category: "death",
    message: "The river was swollen, the current too strong. The body was found downstream.",
    icon: "🌊",
    effect: { type: "kill_character" },
    weight: 0.33,
  },
  {
    id: "collapsed_building",
    name: "Collapsed Building",
    category: "death",
    message: "The old tower gave way without warning, burying all within.",
    icon: "🏚️",
    effect: { type: "kill_character" },
    weight: 0.33,
  },
  {
    id: "fever",
    name: "Fever",
    category: "death",
    message: "A fever took hold and would not break. After three days, they were gone.",
    icon: "🥵",
    effect: { type: "kill_character" },
    weight: 0.33,
  },
  {
    id: "food_poisoning",
    name: "Food Poisoning",
    category: "death",
    message: "The feast was grand, but something foul lurked within. They did not wake.",
    icon: "🍖",
    effect: { type: "kill_character" },
    weight: 0.36,
  },
];

export const EVENT_CATEGORIES = {
  gold: { name: "Gold", color: "#d4a32c" },
  character: { name: "New Character", color: "#27ae60" },
  building: { name: "Building/Region", color: "#8e44ad" },
  army: { name: "Army", color: "#c0392b" },
  terrain: { name: "Terrain", color: "#3498db" },
  flavor: { name: "Flavor", color: "#95a5a6" },
  prowess: { name: "Prowess", color: "#e74c3c" },
  leadership: { name: "Leadership", color: "#f39c12" },
  intrigue: { name: "Intrigue", color: "#9b59b6" },
  stewardship: { name: "Stewardship", color: "#1abc9c" },
  death: { name: "Death", color: "#2c3e50" },
};

// Calculate total weight for weighted random selection
const TOTAL_WEIGHT = RANDOM_EVENTS.reduce((sum, event) => sum + event.weight, 0);

// Get a random event using weighted selection
export function getRandomEvent(excludeEventId = null) {
  let pool = RANDOM_EVENTS;
  
  // Handle exclusions (e.g., drought excludes flooding)
  if (excludeEventId) {
    const excludedEvent = RANDOM_EVENTS.find(e => e.id === excludeEventId);
    if (excludedEvent?.excludesWith) {
      pool = pool.filter(e => e.id !== excludedEvent.excludesWith);
    }
  }
  
  const totalWeight = pool.reduce((sum, event) => sum + event.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const event of pool) {
    random -= event.weight;
    if (random <= 0) {
      return event;
    }
  }
  
  // Fallback (should never reach here)
  return pool[pool.length - 1];
}

// Get a random event filtered by category
export function getRandomEventByCategory(category) {
  const pool = RANDOM_EVENTS.filter(e => e.category === category);
  if (pool.length === 0) return null;
  
  const totalWeight = pool.reduce((sum, event) => sum + event.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const event of pool) {
    random -= event.weight;
    if (random <= 0) {
      return event;
    }
  }
  
  return pool[pool.length - 1];
}

// Get multiple unique random events (for assigning to multiple factions)
// Handles terrain event exclusivity (drought/flooding can't both happen)
export function getRandomEventsForFactions(factionIds) {
  const results = {};
  let terrainEventId = null;
  
  for (const factionId of factionIds) {
    let event;
    
    // If a terrain event was already assigned, exclude its opposite
    if (terrainEventId) {
      const terrainEvent = RANDOM_EVENTS.find(e => e.id === terrainEventId);
      if (terrainEvent?.excludesWith) {
        // Keep re-rolling until we don't get the excluded event
        do {
          event = getRandomEvent();
        } while (event.id === terrainEvent.excludesWith);
      } else {
        event = getRandomEvent();
      }
    } else {
      event = getRandomEvent();
    }
    
    results[factionId] = event;
    
    // Track terrain events for exclusivity
    if (event.category === "terrain") {
      terrainEventId = event.id;
    }
  }
  
  return results;
}

// Format event message for sending
export function formatEventMessage(event) {
  let message = `${event.icon} **${event.name}**\n\n*${event.message}*`;
  
  // Add effect description
  if (event.effect.type === "gold") {
    const sign = event.effect.value > 0 ? "+" : "";
    message += `\n\nEffect: ${sign}${event.effect.value} gold`;
  } else if (event.effect.type === "stat_change") {
    const sign = event.effect.value > 0 ? "+" : "";
    message += `\n\nEffect: Random character ${sign}${event.effect.value} ${event.effect.stat}`;
  } else if (event.effect.type === "new_character") {
    message += `\n\nEffect: You may create ${event.effect.value} new character${event.effect.value > 1 ? "s" : ""}`;
  } else if (event.effect.type === "kill_character") {
    message += `\n\nEffect: A random character has died`;
  } else if (event.effect.type === "destroy_building") {
    message += `\n\nEffect: Destroy 1 ${event.effect.value.join(" or ")} in a random region`;
  } else if (event.effect.type === "free_upgrade") {
    message += `\n\nEffect: Free upgrade to Farm Level 2 in a random region`;
  } else if (event.effect.type === "gain_region") {
    message += `\n\nEffect: Gain 1 adjacent uncontrolled region`;
  } else if (event.effect.type === "spawn_army") {
    message += `\n\nEffect: GM will spawn hostile forces`;
  } else if (event.effect.type === "terrain_modifier") {
    if (event.effect.value === "rivers_crossable") {
      message += `\n\nEffect: All rivers are crossable this turn`;
    } else if (event.effect.value === "bridges_impassable") {
      message += `\n\nEffect: All bridges are impassable this turn`;
    }
  }
  
  if (event.revealToAll) {
    message += `\n\n*This event has been revealed to all players*`;
  }
  
  return message;
}