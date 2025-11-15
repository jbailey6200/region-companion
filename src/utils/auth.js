import { db } from "../firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";

/**
 * Verify a PIN for a given role
 * @param {string} role - "gm" or "faction1" through "faction8"
 * @param {string} pin - 4-digit PIN to verify
 * @returns {Promise<boolean>} - true if PIN is correct
 */
export async function verifyPin(role, pin) {
  try {
    const authDoc = await getDoc(doc(db, "auth", role));
    
    // If no PIN is set yet, auto-create with provided PIN
    if (!authDoc.exists()) {
      await setDoc(doc(db, "auth", role), { pin });
      return true;
    }
    
    return authDoc.data().pin === pin;
  } catch (error) {
    console.error("Error verifying PIN:", error);
    return false;
  }
}

/**
 * Check if user is authenticated
 * @returns {object|null} - { role: string, factionId: number|null } or null
 */
export function getAuthState() {
  const role = localStorage.getItem("role");
  const factionId = localStorage.getItem("factionId");
  const authenticated = localStorage.getItem("authenticated");
  
  if (authenticated === "true" && role) {
    return {
      role,
      factionId: factionId ? Number(factionId) : null,
    };
  }
  
  return null;
}

/**
 * Set authenticated state in localStorage
 * @param {string} role - "gm" or "faction"
 * @param {number|null} factionId - faction ID (1-8) or null for GM
 */
export function setAuthState(role, factionId = null) {
  localStorage.setItem("role", role);
  localStorage.setItem("authenticated", "true");
  if (factionId !== null) {
    localStorage.setItem("factionId", String(factionId));
  } else {
    localStorage.removeItem("factionId");
  }
}

/**
 * Clear authentication state
 */
export function clearAuthState() {
  localStorage.removeItem("role");
  localStorage.removeItem("factionId");
  localStorage.removeItem("authenticated");
}

/**
 * Update PIN for a role (GM only function)
 * @param {string} role - "gm" or "faction1" through "faction8"
 * @param {string} newPin - new 4-digit PIN
 */
export async function updatePin(role, newPin) {
  await setDoc(doc(db, "auth", role), { pin: newPin });
}
