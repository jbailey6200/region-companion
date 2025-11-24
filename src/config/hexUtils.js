// config/hexUtils.js
// Hex grid utilities for movement and range calculations

// Convert region code (like "A1", "B12") to row/col
export function parseRegionCode(code) {
  if (!code || typeof code !== 'string') return null;
  
  const match = code.match(/^([A-I])(\d+)$/i);
  if (!match) return null;
  
  const row = match[1].toUpperCase().charCodeAt(0) - 65; // A=0, B=1, etc.
  const col = parseInt(match[2], 10) - 1; // 1-indexed to 0-indexed
  
  return { row, col };
}

// Convert offset coordinates to cube coordinates (even-r horizontal layout)
// Even rows (A, C, E, G, I) are shifted right relative to odd rows
function offsetToCube(col, row) {
  const x = col - Math.floor((row + (row & 1)) / 2);
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

// Calculate hex distance using cube coordinates
export function getHexDistance(code1, code2) {
  const pos1 = parseRegionCode(code1);
  const pos2 = parseRegionCode(code2);
  
  if (!pos1 || !pos2) return Infinity;
  
  const cube1 = offsetToCube(pos1.col, pos1.row);
  const cube2 = offsetToCube(pos2.col, pos2.row);
  
  return Math.max(
    Math.abs(cube1.x - cube2.x),
    Math.abs(cube1.y - cube2.y),
    Math.abs(cube1.z - cube2.z)
  );
}

// Get all region codes within a certain range
export function getRegionsInRange(centerCode, maxDistance, allRegions) {
  if (!centerCode) return [];
  
  return allRegions.filter(region => {
    const regionCode = region.code;
    if (!regionCode) return false;
    const distance = getHexDistance(centerCode, regionCode);
    return distance <= maxDistance;
  });
}

// Check if movement/action is valid (within range)
export function isInRange(fromCode, toCode, maxDistance) {
  if (!fromCode || !toCode) return false;
  const distance = getHexDistance(fromCode, toCode);
  return distance <= maxDistance;
}

// Get adjacent regions (distance 1)
export function getAdjacentRegions(centerCode, allRegions) {
  return getRegionsInRange(centerCode, 1, allRegions);
}

// Range constants
export const AGENT_ACTION_RANGE = 2;
export const ARMY_MOVE_RANGE = 1;
export const ARMY_MOVE_RANGE_KURIMBOR = 3;