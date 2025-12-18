// utils/gameState.js - Turn management, gold tracking, and game state utilities

import { db } from "../firebase/config";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";
import { calculateEconomy, calculateUpkeeps } from "./economyCalculations";
import { getCourtBonuses } from "../config/courtPositions";

// Game state document reference
const GAME_STATE_DOC = "gameState";
const GAME_STATE_COLLECTION = "game";

/**
 * Subscribe to game state changes
 */
export function subscribeToGameState(callback) {
  const ref = doc(db, GAME_STATE_COLLECTION, GAME_STATE_DOC);
  return onSnapshot(ref, async (snap) => {
    if (snap.exists()) {
      callback(snap.data());
    } else {
      // Initialize game state if it doesn't exist
      const initialState = {
        currentTurn: 0,
        turnStartedAt: serverTimestamp(),
        gameStartedAt: serverTimestamp(),
      };
      await setDoc(ref, initialState);
      callback({ currentTurn: 0 });
    }
  });
}

/**
 * Initialize a faction's turn state if it doesn't exist
 */
export async function initializeFactionTurnState(factionId) {
  const factionRef = doc(db, "factions", String(factionId));
  const snap = await getDoc(factionRef);
  
  if (snap.exists()) {
    const data = snap.data();
    if (!data.turnState || data.gold === undefined) {
      await updateDoc(factionRef, {
        gold: data.gold ?? 0,
        turnState: data.turnState || {
          buildingsBuiltThisTurn: {},
          armyMovementsThisTurn: {},
          agentMovementsThisTurn: {},
        }
      });
    }
  }
}

/**
 * Advance to next turn - GM only
 * Calculates income/upkeep for all factions and updates gold
 */
export async function advanceToNextTurn() {
  const batch = writeBatch(db);
  
  // Get current game state
  const gameStateRef = doc(db, GAME_STATE_COLLECTION, GAME_STATE_DOC);
  const gameStateSnap = await getDoc(gameStateRef);
  const currentTurn = gameStateSnap.exists() ? (gameStateSnap.data().currentTurn || 0) : 0;
  
  // Update game state
  batch.set(gameStateRef, {
    currentTurn: currentTurn + 1,
    turnStartedAt: serverTimestamp(),
    gameStartedAt: gameStateSnap.exists() ? gameStateSnap.data().gameStartedAt : serverTimestamp(),
  }, { merge: true });
  
  // Get all regions for economy calculation
  const regionsSnap = await getDocs(collection(db, "regions"));
  const allRegions = regionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Get all agents once
  const agentsSnap = await getDocs(collection(db, "agents"));
  const allAgents = agentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Get court positions once
  const courtSnap = await getDocs(collection(db, "court"));
  const courtPositions = courtSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  // Process each faction
  for (let factionId = 1; factionId <= 8; factionId++) {
    const factionRef = doc(db, "factions", String(factionId));
    const factionSnap = await getDoc(factionRef);
    
    if (!factionSnap.exists()) continue;
    
    const factionData = factionSnap.data();
    const factionRegions = allRegions.filter(r => r.owner === factionId);
    
    // Get armies
    const armiesSnap = await getDocs(collection(db, "factions", String(factionId), "armies"));
    const armies = armiesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(a => !a.deleted);
    
    // Filter agents for this faction
    const agents = allAgents.filter(a => a.factionId === factionId);
    
    // Get court bonuses for this faction
    const courtBonuses = getCourtBonuses(courtPositions, factionId);
    
    // Calculate economy and upkeeps
    const eco = calculateEconomy(factionRegions, factionData.patronDeity);
    const upkeeps = calculateUpkeeps(armies, factionData, agents, factionData.patronDeity);
    
    // Calculate net gold change (including court bonuses)
    const income = eco.goldPerTurn + courtBonuses.gold;
    const totalUpkeep = upkeeps.total;
    const netChange = income - totalUpkeep;
    
    // Get current gold and add net change
    const currentGold = factionData.gold || 0;
    const newGold = currentGold + netChange;
    
    // Update faction with new gold and reset turn state
    batch.update(factionRef, {
      gold: newGold,
      turnState: {
        buildingsBuiltThisTurn: {},
        armyMovementsThisTurn: {},
        agentMovementsThisTurn: {},
      }
    });
  }
  
  await batch.commit();
  return currentTurn + 1;
}

/**
 * Reset the entire game - GM only
 * Resets to turn 0 with 0 gold for all factions
 */
export async function resetGame() {
  const batch = writeBatch(db);
  
  // Reset game state to turn 0
  const gameStateRef = doc(db, GAME_STATE_COLLECTION, GAME_STATE_DOC);
  batch.set(gameStateRef, {
    currentTurn: 0,
    turnStartedAt: serverTimestamp(),
    gameStartedAt: serverTimestamp(),
  });
  
  // Reset all factions to 0 gold and clear turn tracking
  for (let factionId = 1; factionId <= 8; factionId++) {
    const factionRef = doc(db, "factions", String(factionId));
    batch.set(factionRef, {
      gold: 0,
      turnState: {
        buildingsBuiltThisTurn: {},
        armyMovementsThisTurn: {},
        agentMovementsThisTurn: {},
      }
    }, { merge: true });
  }
  
  await batch.commit();
  return 0;
}

/**
 * Deduct gold from faction treasury (for building, raising levies, etc.)
 * Returns { success: true, newGold } if successful, { success: false, currentGold } if not enough gold
 */
export async function spendGold(factionId, amount, description = "") {
  const factionRef = doc(db, "factions", String(factionId));
  const snap = await getDoc(factionRef);
  
  if (!snap.exists()) return { success: false, currentGold: 0 };
  
  const currentGold = snap.data().gold || 0;
  
  // Reject if not enough gold
  if (currentGold < amount) {
    return { success: false, currentGold };
  }
  
  const newGold = currentGold - amount;
  
  await updateDoc(factionRef, { gold: newGold });
  
  return { success: true, newGold };
}

/**
 * Add gold to faction treasury (for events, etc.)
 */
export async function addGold(factionId, amount) {
  const factionRef = doc(db, "factions", String(factionId));
  const snap = await getDoc(factionRef);
  
  if (!snap.exists()) return;
  
  const currentGold = snap.data().gold || 0;
  await updateDoc(factionRef, { gold: currentGold + amount });
}

/**
 * Get faction's current gold
 */
export async function getGold(factionId) {
  const factionRef = doc(db, "factions", String(factionId));
  const snap = await getDoc(factionRef);
  
  if (!snap.exists()) return 0;
  return snap.data().gold || 0;
}

/**
 * Track building in a region for this turn
 */
export async function trackBuildingBuilt(factionId, regionId) {
  const factionRef = doc(db, "factions", String(factionId));
  const snap = await getDoc(factionRef);
  const data = snap.data() || {};
  const turnState = data.turnState || { buildingsBuiltThisTurn: {} };
  const buildingsBuilt = turnState.buildingsBuiltThisTurn || {};
  
  const currentCount = buildingsBuilt[regionId] || 0;
  
  await updateDoc(factionRef, {
    "turnState.buildingsBuiltThisTurn": {
      ...buildingsBuilt,
      [regionId]: currentCount + 1
    }
  });
}

/**
 * Check if faction can build in region this turn
 */
export function canBuildInRegion(turnState, regionId) {
  if (!turnState) return true; // If no turnState yet, allow building
  const buildingsBuilt = turnState.buildingsBuiltThisTurn || {};
  const builtThisTurn = buildingsBuilt[regionId] || 0;
  return builtThisTurn < 1;
}

/**
 * Track army movement
 */
export async function trackArmyMovement(factionId, armyId) {
  const factionRef = doc(db, "factions", String(factionId));
  const snap = await getDoc(factionRef);
  const data = snap.data() || {};
  const turnState = data.turnState || { armyMovementsThisTurn: {} };
  const armyMovements = turnState.armyMovementsThisTurn || {};
  
  const currentCount = armyMovements[armyId] || 0;
  
  await updateDoc(factionRef, {
    "turnState.armyMovementsThisTurn": {
      ...armyMovements,
      [armyId]: currentCount + 1
    }
  });
}

/**
 * Get remaining army movements for this turn
 */
export function getArmyMovesRemaining(turnState, armyId, hasKurimborBonus = false) {
  const maxMoves = hasKurimborBonus ? 2 : 1;
  if (!turnState) return maxMoves;
  
  const armyMovements = turnState.armyMovementsThisTurn || {};
  const movedThisTurn = armyMovements[armyId] || 0;
  
  return Math.max(0, maxMoves - movedThisTurn);
}

/**
 * Track agent movement
 */
export async function trackAgentMovement(factionId, agentId) {
  const factionRef = doc(db, "factions", String(factionId));
  const snap = await getDoc(factionRef);
  const data = snap.data() || {};
  const turnState = data.turnState || { agentMovementsThisTurn: {} };
  const agentMovements = turnState.agentMovementsThisTurn || {};
  
  const currentCount = agentMovements[agentId] || 0;
  
  await updateDoc(factionRef, {
    "turnState.agentMovementsThisTurn": {
      ...agentMovements,
      [agentId]: currentCount + 1
    }
  });
}

/**
 * Get remaining agent movements for this turn
 * Agents can move 2 spaces per turn (1 hex at a time)
 */
export function getAgentMovesRemaining(turnState, agentId) {
  const maxMoves = 2;
  if (!turnState) return maxMoves;
  
  const agentMovements = turnState.agentMovementsThisTurn || {};
  const movedThisTurn = agentMovements[agentId] || 0;
  
  return Math.max(0, maxMoves - movedThisTurn);
}

/**
 * Send gold to another faction (creates escrow message)
 * Gold is deducted immediately from sender, recipient must claim
 */
export async function sendGoldTransfer(fromFactionId, toFactionId, amount, senderName) {
  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }
  
  if (fromFactionId === toFactionId) {
    return { success: false, error: "Cannot send gold to yourself" };
  }
  
  const fromRef = doc(db, "factions", String(fromFactionId));
  const fromSnap = await getDoc(fromRef);
  
  if (!fromSnap.exists()) {
    return { success: false, error: "Sender faction not found" };
  }
  
  const currentGold = fromSnap.data().gold || 0;
  
  if (currentGold < amount) {
    return { success: false, error: "Insufficient gold", currentGold };
  }
  
  // Deduct from sender
  await updateDoc(fromRef, { gold: currentGold - amount });
  
  // Create gold transfer message
  const messagesRef = collection(db, "messages");
  await addDoc(messagesRef, {
    type: "gold_transfer",
    fromFactionId: Number(fromFactionId),
    fromFactionName: senderName,
    toFactionId: Number(toFactionId),
    goldAmount: amount,
    claimed: false,
    read: false,
    createdAt: serverTimestamp(),
  });
  
  return { success: true, newGold: currentGold - amount };
}

/**
 * Claim gold from a transfer message
 */
export async function claimGoldTransfer(messageId, factionId) {
  const messageRef = doc(db, "messages", messageId);
  const messageSnap = await getDoc(messageRef);
  
  if (!messageSnap.exists()) {
    return { success: false, error: "Message not found" };
  }
  
  const messageData = messageSnap.data();
  
  if (messageData.type !== "gold_transfer") {
    return { success: false, error: "Not a gold transfer" };
  }
  
  if (messageData.toFactionId !== Number(factionId)) {
    return { success: false, error: "This transfer is not for you" };
  }
  
  if (messageData.claimed) {
    return { success: false, error: "Already claimed" };
  }
  
  // Add gold to recipient
  const factionRef = doc(db, "factions", String(factionId));
  const factionSnap = await getDoc(factionRef);
  const currentGold = factionSnap.exists() ? (factionSnap.data().gold || 0) : 0;
  
  await updateDoc(factionRef, { gold: currentGold + messageData.goldAmount });
  
  // Mark as claimed
  await updateDoc(messageRef, { claimed: true, claimedAt: serverTimestamp() });
  
  return { success: true, amount: messageData.goldAmount, newGold: currentGold + messageData.goldAmount };
}