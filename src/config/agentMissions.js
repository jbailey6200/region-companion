// config/agentMissions.js
// Agent Mission System

export const MISSION_TYPES = {
  // SPY MISSIONS
  SPY_REGION: {
    id: 'spy_region',
    name: 'Spy on Region',
    agentType: 'spy',
    description: 'Gather intelligence on a region\'s buildings, defenses, and garrison',
    baseDifficulty: 30,
    levelBonus: 8,
  },
  
  SPY_ARMY: {
    id: 'spy_army',
    name: 'Spy on Army',
    agentType: 'spy',
    description: 'Gather intelligence on an army\'s composition and commanders',
    baseDifficulty: 45,
    levelBonus: 8,
    requiresArmyTarget: true,
  },
  
  ASSASSINATE_COMMANDER: {
    id: 'assassinate_commander',
    name: 'Assassinate Commander',
    agentType: 'spy',
    description: 'Attempt to kill a commander attached to an army',
    baseDifficulty: 65,
    levelBonus: 7,
    requiresCommanderTarget: true,
  },
  
  ASSASSINATE_LEADER: {
    id: 'assassinate_leader',
    name: 'Assassinate Leader',
    agentType: 'spy',
    description: 'Attempt to kill a faction leader. Must be in their capital.',
    baseDifficulty: 80,
    levelBonus: 6,
    requiresCapital: true,
    requiresLeaderTarget: true,
  },
  
  // AGITATOR MISSIONS
  CAUSE_RIOTS: {
    id: 'cause_riots',
    name: 'Cause Riots',
    agentType: 'agitator',
    description: 'Incite riots to destroy infrastructure. Higher rolls destroy better targets.',
    baseDifficulty: 45,
    levelBonus: 8,
  },
  
  STIR_REBELLION: {
    id: 'stir_rebellion',
    name: 'Stir Rebellion',
    agentType: 'agitator',
    description: 'Foment rebellion. Success spawns rebel army and sieges the region.',
    baseDifficulty: 70,
    levelBonus: 7,
  },
  
  // ENFORCER MISSIONS
  HUNT_AGENTS: {
    id: 'hunt_agents',
    name: 'Hunt Enemy Agents',
    agentType: 'enforcer',
    description: 'Search for enemy agents in all adjacent regions (including your location). Success reveals all enemy agents found.',
    baseDifficulty: 35,
    levelBonus: 9,
  },
  
  KILL_AGENT: {
    id: 'kill_agent',
    name: 'Kill Enemy Agent',
    agentType: 'enforcer',
    description: 'Eliminate a known enemy agent.',
    baseDifficulty: 50,
    levelBonus: 8,
    requiresAgentTarget: true,
  },
};

// Difficulty modifiers
export const DIFFICULTY_MODIFIERS = {
  // Defense (increases difficulty)
  hasKeep: 10,
  hasCastle: 25,
  enforcerInRegion: 15, // per enforcer
  garrisonPer100: 5,
  targetProwess: 3, // per point (for assassinations)
  targetIntrigue: 2, // per point (for leader assassination)
  targetAgentLevel: 5, // per level (for kill agent)
  
  // Advantages (decreases difficulty)
  targetRevealed: -15,
  friendlyAgentSupport: -5, // per friendly agent in region
};

// Calculate mission difficulty
export function calculateMissionDifficulty(missionType, context) {
  const mission = MISSION_TYPES[missionType];
  if (!mission) return { difficulty: 100, breakdown: [] };
  
  let difficulty = mission.baseDifficulty;
  const breakdown = [{ label: 'Base difficulty', value: mission.baseDifficulty }];
  
  // Keep
  if (context.hasKeep) {
    difficulty += DIFFICULTY_MODIFIERS.hasKeep;
    breakdown.push({ label: 'Keep in region', value: `+${DIFFICULTY_MODIFIERS.hasKeep}` });
  }
  
  // Castle
  if (context.hasCastle) {
    difficulty += DIFFICULTY_MODIFIERS.hasCastle;
    breakdown.push({ label: 'Castle in region', value: `+${DIFFICULTY_MODIFIERS.hasCastle}` });
  }
  
  // Enemy enforcers
  if (context.enforcerCount > 0) {
    const mod = DIFFICULTY_MODIFIERS.enforcerInRegion * context.enforcerCount;
    difficulty += mod;
    breakdown.push({ label: `Enemy enforcers (${context.enforcerCount})`, value: `+${mod}` });
  }
  
  // Garrison
  if (context.garrisonStrength > 0) {
    const mod = Math.floor(context.garrisonStrength / 100) * DIFFICULTY_MODIFIERS.garrisonPer100;
    if (mod > 0) {
      difficulty += mod;
      breakdown.push({ label: `Garrison (~${context.garrisonStrength})`, value: `+${mod}` });
    }
  }
  
  // Target prowess (assassinations)
  if (context.targetProwess && (missionType === 'ASSASSINATE_COMMANDER' || missionType === 'ASSASSINATE_LEADER')) {
    const mod = context.targetProwess * DIFFICULTY_MODIFIERS.targetProwess;
    difficulty += mod;
    breakdown.push({ label: `Target prowess (${context.targetProwess})`, value: `+${mod}` });
  }
  
  // Target intrigue (leader assassination only)
  if (context.targetIntrigue && missionType === 'ASSASSINATE_LEADER') {
    const mod = context.targetIntrigue * DIFFICULTY_MODIFIERS.targetIntrigue;
    difficulty += mod;
    breakdown.push({ label: `Target intrigue (${context.targetIntrigue})`, value: `+${mod}` });
  }
  
  // Target agent level (kill agent)
  if (context.targetAgentLevel && missionType === 'KILL_AGENT') {
    const mod = context.targetAgentLevel * DIFFICULTY_MODIFIERS.targetAgentLevel;
    difficulty += mod;
    breakdown.push({ label: `Target agent level (${context.targetAgentLevel})`, value: `+${mod}` });
  }
  
  // Target revealed (kill agent)
  if (context.targetRevealed && missionType === 'KILL_AGENT') {
    difficulty += DIFFICULTY_MODIFIERS.targetRevealed;
    breakdown.push({ label: 'Target revealed', value: `${DIFFICULTY_MODIFIERS.targetRevealed}` });
  }
  
  // Friendly agent support
  if (context.friendlyAgentCount > 0) {
    const mod = context.friendlyAgentCount * DIFFICULTY_MODIFIERS.friendlyAgentSupport;
    difficulty += mod;
    breakdown.push({ label: `Friendly agents (${context.friendlyAgentCount})`, value: `${mod}` });
  }
  
  difficulty = Math.max(5, Math.min(95, difficulty));
  
  return { difficulty, breakdown };
}

// Calculate agent bonus
export function calculateAgentBonus(agentLevel, missionType) {
  const mission = MISSION_TYPES[missionType];
  if (!mission) return 0;
  return agentLevel * mission.levelBonus;
}

// Roll d100
export function rollD100() {
  return Math.floor(Math.random() * 100) + 1;
}

/*
  OUTCOME TABLE (margin = roll + bonus - difficulty)
  
  For SPIES and AGITATORS:
    +30 or more   CRITICAL SUCCESS (success + bonus effects)
    +15 to +29    SUCCESS (but REVEALED - mission works but agent exposed)
    +0 to +14     SUCCESS (clean - mission works, agent hidden)
    -1 to -10     FAILURE (agent stays hidden)
    -11 to -25    FAILURE + REVEALED (failed and exposed)
    -26 or less   DEATH (agent killed)
  
  For ENFORCERS:
    +30 or more   CRITICAL SUCCESS
    +0 to +29     SUCCESS
    -1 to -15     FAILURE (agent safe)
    -16 or less   DEATH (agent killed)
*/

export function determineMissionOutcome(roll, agentBonus, difficulty, agentType) {
  const finalScore = roll + agentBonus;
  const margin = finalScore - difficulty;
  
  let outcome;
  let success;
  let agentFate; // 'safe', 'revealed', 'dead'
  let description;
  let isCritical = false;
  
  if (agentType === 'enforcer') {
    // Enforcer outcomes: success, fail, or death (no revealed)
    if (margin >= 30) {
      outcome = 'critical_success';
      success = true;
      agentFate = 'safe';
      isCritical = true;
      description = 'Critical Success! Mission accomplished with exceptional results.';
    } else if (margin >= 0) {
      outcome = 'success';
      success = true;
      agentFate = 'safe';
      description = 'Success! Mission accomplished.';
    } else if (margin >= -15) {
      outcome = 'failure';
      success = false;
      agentFate = 'safe';
      description = 'Failed. Agent withdraws safely.';
    } else {
      outcome = 'death';
      success = false;
      agentFate = 'dead';
      description = 'Critical Failure! Agent has been killed.';
    }
  } else {
    // Spy and Agitator outcomes
    if (margin >= 30) {
      outcome = 'critical_success';
      success = true;
      agentFate = 'safe';
      isCritical = true;
      description = 'Critical Success! Mission accomplished with bonus effects.';
    } else if (margin >= 15) {
      outcome = 'success_revealed';
      success = true;
      agentFate = 'revealed';
      description = 'Success, but agent was spotted! Mission accomplished but agent is now revealed.';
    } else if (margin >= 0) {
      outcome = 'success';
      success = true;
      agentFate = 'safe';
      description = 'Success! Mission accomplished cleanly.';
    } else if (margin >= -10) {
      outcome = 'failure';
      success = false;
      agentFate = 'safe';
      description = 'Failed. Agent remains hidden.';
    } else if (margin >= -25) {
      outcome = 'failure_revealed';
      success = false;
      agentFate = 'revealed';
      description = 'Failed and exposed! Agent has been revealed to the enemy.';
    } else {
      outcome = 'death';
      success = false;
      agentFate = 'dead';
      description = 'Critical Failure! Agent has been killed.';
    }
  }
  
  return {
    roll,
    agentBonus,
    finalScore,
    difficulty,
    margin,
    outcome,
    success,
    isCritical,
    agentFate,
    description,
  };
}

// Mission effects based on outcome
export function getMissionEffects(missionType, outcome, isCritical, context = {}) {
  const effects = [];
  
  if (!outcome.startsWith('success') && outcome !== 'critical_success') {
    return effects; // No effects on failure
  }
  
  switch (missionType) {
    case 'SPY_REGION':
      effects.push('Reveal all buildings and upgrades in region');
      effects.push('Reveal garrison strength');
      if (isCritical) {
        effects.push('Reveal any enemy agents in the region');
      }
      break;
      
    case 'SPY_ARMY':
      effects.push('Reveal full army composition');
      effects.push('Reveal commander names');
      if (isCritical) {
        effects.push('Reveal commander stats');
        effects.push('Reveal army orders/destination');
      }
      break;
      
    case 'ASSASSINATE_COMMANDER':
      effects.push(`Commander ${context.targetName || 'target'} is killed`);
      if (isCritical) {
        effects.push('Death appears accidental - no suspicion raised');
      }
      break;
      
    case 'ASSASSINATE_LEADER':
      effects.push(`Faction leader ${context.targetName || 'target'} is killed`);
      if (isCritical) {
        effects.push('Succession crisis - faction loses 1 turn of income');
      }
      break;
      
    case 'CAUSE_RIOTS':
      if (isCritical) {
        effects.push('Settlement downgraded (CityTown, TownVillage, VillageNone)');
      } else {
        effects.push('Destroy one Farm/Mine or upgraded variant');
      }
      break;
      
    case 'STIR_REBELLION':
      effects.push('Region is now UNDER SIEGE');
      effects.push('Rebel army spawns (GM determines composition)');
      if (isCritical) {
        effects.push('Larger rebel army spawns');
        effects.push('Adjacent region gains unrest');
      }
      break;
      
    case 'HUNT_AGENTS':
      effects.push('Reveal all enemy agents in adjacent regions');
      if (isCritical) {
        effects.push('Learn agent types and levels');
      }
      break;
      
    case 'KILL_AGENT':
      effects.push(`Enemy agent ${context.targetName || 'target'} is killed`);
      if (isCritical) {
        effects.push('Recover intel - learn about recent enemy agent missions');
      }
      break;
  }
  
  return effects;
}

// Get available missions for an agent type
export function getAvailableMissions(agentType) {
  return Object.entries(MISSION_TYPES)
    .filter(([_, mission]) => mission.agentType === agentType)
    .map(([key, mission]) => ({ key, ...mission }));
}

// Status colors
export const OUTCOME_STYLES = {
  critical_success: { color: '#FFD700', icon: '', label: 'Critical Success' },
  success: { color: '#4ade80', icon: '', label: 'Success' },
  success_revealed: { color: '#fb923c', icon: '', label: 'Success (Revealed)' },
  failure: { color: '#94a3b8', icon: '', label: 'Failed' },
  failure_revealed: { color: '#f97316', icon: '', label: 'Failed (Revealed)' },
  death: { color: '#ef4444', icon: '', label: 'Agent Killed' },
};

// Mission status
export const MISSION_STATUS = {
  PENDING: 'pending',      // Waiting for GM approval
  APPROVED: 'approved',    // GM approved, ready to roll
  COMPLETED: 'completed',  // Roll done, results available
  REJECTED: 'rejected',    // GM rejected the mission
};