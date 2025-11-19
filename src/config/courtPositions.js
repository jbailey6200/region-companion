// config/courtPositions.js
// Configuration for High Court positions and their effects

export const COURT_POSITIONS = {
  'Lord Marshal': {
    name: 'Lord Marshal',
    icon: '⚔️',
    goldBonus: 4,
    description: 'Commands the realm\'s armies',
    tooltip: '+4 gold per turn, +1 army capacity (max 4)',
    effects: {
      goldPerTurn: 4,
      armyCapBonus: 1,
      maxArmyCap: 4
    },
    color: '#8B0000'
  },
  'Lord Steward': {
    name: 'Lord Steward', 
    icon: '💰',
    goldBonus: 10,
    description: 'Manages the realm\'s treasury',
    tooltip: '+10 gold per turn',
    effects: {
      goldPerTurn: 10
    },
    color: '#FFD700'
  },
  'Lord Spymaster': {
    name: 'Lord Spymaster',
    icon: '',
    goldBonus: 4,
    description: 'Oversees intelligence networks',
    tooltip: '+4 gold per turn, +1 free agent (ignores cap)',
    effects: {
      goldPerTurn: 4,
      freeAgent: 1
    },
    color: '#4B0082'
  },
  'Lord Justiciar': {
    name: 'Lord Justiciar',
    icon: '⚖️',
    goldBonus: 4,
    description: 'Wielder of Mercy',
    tooltip: '+4 gold per turn, wields Mercy (+6 prowess)',
    effects: {
      goldPerTurn: 4,
      prowessBonus: 6,
      wieldsWeapon: 'Mercy'
    },
    color: '#800080'
  },
  'Lord Arbiter': {
    name: 'Lord Arbiter',
    icon: '📜',
    goldBonus: 4,
    description: 'Settles disputes and interprets laws',
    tooltip: '+4 gold per turn, final authority on rules',
    effects: {
      goldPerTurn: 4,
      rulesAuthority: true
    },
    color: '#2F4F4F'
  }
};

// Helper functions for court effects
export function getCourtBonuses(courtPositions, factionId) {
  const bonuses = {
    gold: 0,
    armyCap: 0,
    freeAgents: 0,
    prowessBonus: {},  // characterId -> bonus
    positions: []      // List of position names held
  };

  courtPositions.forEach(position => {
    if (position.factionId === factionId) {
      const config = COURT_POSITIONS[position.position];
      if (!config) return;

      bonuses.gold += config.effects.goldPerTurn || 0;
      bonuses.armyCap += config.effects.armyCapBonus || 0;
      bonuses.freeAgents += config.effects.freeAgent || 0;
      
      if (config.effects.prowessBonus && position.characterId) {
        bonuses.prowessBonus[position.characterId] = config.effects.prowessBonus;
      }
      
      bonuses.positions.push({
        position: position.position,
        character: position.characterName,
        ...config
      });
    }
  });

  return bonuses;
}

export function getMaxArmyCap(baseCap, courtBonuses) {
  const marshalBonus = courtBonuses.positions.some(
    p => p.position === 'Lord Marshal'
  ) ? 1 : 0;
  
  return Math.min(baseCap + marshalBonus, 4); // Hard cap at 4
}

export function canRaiseAgentWithCourt(currentAgents, normalCap, courtBonuses) {
  const freeAgents = courtBonuses.freeAgents || 0;
  
  if (freeAgents > 0 && currentAgents < normalCap + freeAgents) {
    return true;
  }
  
  return currentAgents < normalCap;
}

export function getCharacterProwessWithCourt(baseProwess, characterId, courtBonuses) {
  const bonus = courtBonuses.prowessBonus[characterId] || 0;
  return baseProwess + bonus;
}

// Format court bonus for display in economy breakdown
export function formatCourtBonusLine(position) {
  const config = COURT_POSITIONS[position.position];
  return {
    label: `${config.icon} ${config.name}`,
    amount: config.goldBonus,
    color: config.color || '#8B008B'
  };
}