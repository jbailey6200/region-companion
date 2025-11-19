// components/Court.jsx
// High Court management component - FIXED VERSION

import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { COURT_POSITIONS } from "../config/courtPositions";
import { DEITIES } from "../config/religionRules";

export default function Court({ isGM, myFactionId, factionNames, patronDeity }) {
  const [courtPositions, setCourtPositions] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPosition, setEditingPosition] = useState(null);
  const [saving, setSaving] = useState(false);
  const [characterStats, setCharacterStats] = useState({});
  
  // Load current court positions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "court"), (snap) => {
      const positions = {};
      snap.docs.forEach(doc => {
        const data = doc.data();
        positions[data.position] = {
          id: doc.id,
          ...data
        };
      });
      setCourtPositions(positions);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Load all characters (GM only)
  useEffect(() => {
    if (!isGM) return;

    const unsubscribers = [];
    const charactersByFaction = {};

    for (let factionId = 1; factionId <= 8; factionId++) {
      const unsub = onSnapshot(
        collection(db, "factions", String(factionId), "characters"),
        (snap) => {
          charactersByFaction[factionId] = snap.docs.map(doc => {
            const data = doc.data();
            // Build proper character name
            const firstName = data.firstName || "";
            const lastName = data.lastName || "";
            const fullName = `${firstName} ${lastName}`.trim() || "Unnamed Character";
            
            return {
              id: doc.id,
              factionId: factionId,
              factionName: factionNames[factionId] || `Faction ${factionId}`,
              firstName: firstName,
              lastName: lastName,
              fullName: fullName,
              leadership: data.leadership || 1,
              prowess: data.prowess || 1,
              stewardship: data.stewardship || 1,
              intrigue: data.intrigue || 1,
              ...data
            };
          });
          
          // Combine all characters
          const allChars = [];
          Object.values(charactersByFaction).forEach(chars => {
            allChars.push(...chars);
          });
          setAllCharacters(allChars);
        }
      );
      unsubscribers.push(unsub);
    }

    return () => unsubscribers.forEach(unsub => unsub());
  }, [isGM, factionNames]);

  // Fetch live stats for appointed characters
  useEffect(() => {
    const unsubscribers = [];
    const stats = {};
    
    // For each court position with a character
    Object.values(courtPositions).forEach(position => {
      if (position.characterId && position.factionId) {
        // Listen to the character's live data
        const unsub = onSnapshot(
          doc(db, "factions", String(position.factionId), "characters", position.characterId),
          (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              stats[position.characterId] = {
                leadership: data.leadership || 1,
                prowess: data.prowess || 1,
                stewardship: data.stewardship || 1,
                intrigue: data.intrigue || 1,
              };
              setCharacterStats(prevStats => ({...prevStats, ...stats}));
            }
          }
        );
        unsubscribers.push(unsub);
      }
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [courtPositions]);

  // Appoint character to position
  async function appointToPosition(positionName, character) {
    setSaving(true);
    try {
      // Use position name directly as document ID (replace spaces with underscores)
      const docId = positionName.replace(/ /g, '_');
      const positionDoc = doc(db, "court", docId);
      
      if (!character) {
        // Remove appointment
        await deleteDoc(positionDoc);
        console.log("Position cleared:", positionName);
      } else {
        // Appoint character - INCLUDE STATS
        const appointmentData = {
          position: positionName,
          characterId: character.id,
          characterName: character.fullName,
          factionId: character.factionId,
          factionName: character.factionName,
          // Add character stats
          leadership: character.leadership || 1,
          prowess: character.prowess || 1,
          stewardship: character.stewardship || 1,
          intrigue: character.intrigue || 1,
          appointedAt: new Date().toISOString(),
          appointedBy: 'GM'
        };
        
        await setDoc(positionDoc, appointmentData);
        console.log("Appointed:", appointmentData);
      }
      
      setEditingPosition(null);
    } catch (error) {
      console.error("Error appointing position:", error);
      alert(`Failed to update position: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  // Count positions by faction
  const positionsByFaction = {};
  Object.values(courtPositions).forEach(pos => {
    if (!positionsByFaction[pos.factionId]) {
      positionsByFaction[pos.factionId] = [];
    }
    positionsByFaction[pos.factionId].push(pos);
  });

  // UPDATED BRIGHTER COLORS
  const ENHANCED_COLORS = {
    'Lord Marshal': '#ff4444',      // Bright red
    'Lord Steward': '#FFD700',       // Gold
    'Lord Spymaster': '#9370DB',     // Medium purple
    'Lord Justiciar': '#ff69b4',     // Hot pink
    'Lord Arbiter': '#4169E1'        // Royal blue
  };

  if (loading) {
    return (
      <div className="card" style={{ padding: "20px", textAlign: "center" }}>
        Loading court positions...
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: "20px" }}>
      <h2 style={{ marginTop: 0, marginBottom: "20px" }}>
        ⚜️ High Court of the Realm ⚜️
      </h2>

      <p style={{ 
        fontSize: "14px", 
        color: "#c7bca5", 
        marginBottom: "20px",
        fontStyle: "italic" 
      }}>
        The highest offices of the realm, appointed by royal decree. 
        Each position grants unique powers and responsibilities.
      </p>

      {/* Faction Summary */}
      {Object.keys(positionsByFaction).length > 0 && (
        <div style={{
          marginBottom: "24px",
          padding: "12px",
          background: "#1a1410",
          borderRadius: "8px",
          border: "1px solid #4c3b2a"
        }}>
          <h4 style={{ marginTop: 0, marginBottom: "8px" }}>Court Influence by Faction</h4>
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "8px"
          }}>
            {Object.entries(positionsByFaction).map(([factionId, positions]) => (
              <div key={factionId} style={{
                padding: "6px",
                background: factionId == myFactionId ? "#2a3f2a" : "#241b15",
                borderRadius: "4px",
                fontSize: "13px"
              }}>
                <strong>{factionNames[factionId]}</strong>: {positions.length} position{positions.length !== 1 ? 's' : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Court Positions Grid */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: "16px"
      }}>
        {Object.entries(COURT_POSITIONS).map(([positionKey, config]) => {
          const currentHolder = courtPositions[positionKey];
          const isMyFaction = currentHolder?.factionId === myFactionId;
          const isEditing = editingPosition === positionKey;
          const enhancedColor = ENHANCED_COLORS[positionKey] || config.color;

          return (
            <div key={positionKey} style={{
              padding: "16px",
              background: isMyFaction ? "#1f2a1f" : "#241b15",
              border: `2px solid ${currentHolder ? enhancedColor : '#3a2f24'}`,
              borderRadius: "8px",
              position: "relative",
              transition: "all 0.3s",
              boxShadow: currentHolder ? `0 0 10px ${enhancedColor}40` : 'none'
            }}>
              {/* Position Header */}
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "8px",
                marginBottom: "8px"
              }}>
                <span style={{ fontSize: "24px" }}>{config.icon}</span>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: "16px",
                  color: enhancedColor,
                  textShadow: `0 0 10px ${enhancedColor}60`
                }}>
                  {config.name}
                </h3>
              </div>

              {/* Position Description */}
              <p style={{ 
                fontSize: "12px", 
                color: "#a89a7a",
                marginBottom: "8px",
                fontStyle: "italic"
              }}>
                {config.description}
              </p>

              {/* Position Effects */}
              <div style={{
                padding: "8px",
                background: "#1a1410",
                borderRadius: "4px",
                marginBottom: "12px",
                fontSize: "12px"
              }}>
                <strong>Effects:</strong>
                <div style={{ color: "#7db569", marginTop: "4px" }}>
                  {config.tooltip}
                </div>
              </div>

              {/* Current Holder or Vacant */}
              <div style={{
                padding: "10px",
                background: "#1a1410",
                borderRadius: "6px",
                border: `1px solid ${currentHolder ? enhancedColor : '#3a2f24'}`,
                minHeight: "80px"
              }}>
                {currentHolder ? (
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "bold", color: "#f4efe4" }}>
                      {currentHolder.characterName}
                    </div>
                    <div style={{ 
                      fontSize: "12px", 
                      color: "#c7bca5",
                      marginTop: "4px"
                    }}>
                      {currentHolder.factionName}
                    </div>
                    {/* DISPLAY CHARACTER STATS WITH DEITY BONUSES */}
                    <div style={{
                      marginTop: "8px",
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "4px",
                      fontSize: "11px",
                      color: "#8B8B8B"
                    }}>
                      {(() => {
                        // Get deity bonuses if this is our faction
                        const deity = (currentHolder.factionId === myFactionId && patronDeity) 
                          ? DEITIES[patronDeity] 
                          : null;
                        const leadershipBonus = deity?.bonuses?.characterLeadership || 0;
                        const prowessBonus = deity?.bonuses?.characterProwess || 0;
                        const intrigueBonus = deity?.bonuses?.characterIntrigue || 0;
                        
                        const currentStats = characterStats[currentHolder.characterId] || currentHolder;
                        
                        return (
                          <>
                            <div>
                              <span style={{ color: "#d1b26b" }}>Lead:</span> {currentStats.leadership || 1}
                              {leadershipBonus > 0 && (
                                <span style={{ color: "#b5e8a1", fontWeight: "bold" }}> (+{leadershipBonus})</span>
                              )}
                            </div>
                            <div>
                              <span style={{ color: "#c77d7d" }}>Prow:</span> {currentStats.prowess || 1}
                              {prowessBonus > 0 && (
                                <span style={{ color: "#b5e8a1", fontWeight: "bold" }}> (+{prowessBonus})</span>
                              )}
                              {positionKey === 'Lord Justiciar' && (
                                <span style={{ color: "#FFD700", fontWeight: "bold" }}> (+6)</span>
                              )}
                            </div>
                            <div>
                              <span style={{ color: "#7db5d1" }}>Stew:</span> {currentStats.stewardship || 1}
                            </div>
                            <div>
                              <span style={{ color: "#9d7dd1" }}>Intr:</span> {currentStats.intrigue || 1}
                              {intrigueBonus > 0 && (
                                <span style={{ color: "#b5e8a1", fontWeight: "bold" }}> (+{intrigueBonus})</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    textAlign: "center", 
                    color: "#666",
                    fontStyle: "italic",
                    padding: "20px 0"
                  }}>
                    Position Vacant
                  </div>
                )}
              </div>

              {/* GM Controls */}
              {isGM && (
                <div style={{ marginTop: "12px" }}>
                  {isEditing ? (
                    <div>
                      <select
                        onChange={(e) => {
                          const charId = e.target.value;
                          const character = charId ? 
                            allCharacters.find(c => c.id === charId) : 
                            null;
                          appointToPosition(positionKey, character);
                        }}
                        disabled={saving}
                        style={{
                          width: "100%",
                          padding: "6px",
                          background: "#241b15",
                          border: "1px solid #4c3b2a",
                          borderRadius: "4px",
                          color: "#f4efe4",
                          fontSize: "12px",
                          fontFamily: "Georgia, serif"
                        }}
                        defaultValue={currentHolder?.characterId || ''}
                      >
                        <option value="">-- Vacant --</option>
                        {allCharacters
                          .sort((a, b) => {
                            if (a.factionId !== b.factionId) {
                              return a.factionId - b.factionId;
                            }
                            return a.fullName.localeCompare(b.fullName);
                          })
                          .map(char => {
                            // Format character display with stats
                            const displayName = `${char.fullName} (${char.factionName}) - L:${char.leadership} P:${char.prowess} S:${char.stewardship} I:${char.intrigue}`;
                            
                            return (
                              <option key={char.id} value={char.id}>
                                {displayName}
                              </option>
                            );
                          })}
                      </select>
                      <button
                        onClick={() => setEditingPosition(null)}
                        className="small"
                        style={{
                          width: "100%",
                          marginTop: "6px",
                          padding: "4px",
                          fontSize: "12px"
                        }}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingPosition(positionKey)}
                      className="small"
                      style={{
                        width: "100%",
                        padding: "6px",
                        fontSize: "12px"
                      }}
                    >
                      {currentHolder ? 'Change Appointment' : 'Appoint Character'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend for non-GM */}
      {!isGM && (
        <div style={{
          marginTop: "24px",
          padding: "12px",
          background: "#1a1410",
          borderRadius: "8px",
          border: "1px solid #3a2f24",
          fontSize: "12px",
          color: "#a89a7a"
        }}>
          <strong>Note:</strong> Court positions are appointed by the Game Master. 
          Members of your faction holding court positions provide their bonuses to your faction's economy and capabilities.
        </div>
      )}

      {/* Your Faction's Benefits */}
      {positionsByFaction[myFactionId] && (
        <div style={{
          marginTop: "20px",
          padding: "16px",
          background: "#1f2a1f",
          borderRadius: "8px",
          border: "2px solid #4a6642"
        }}>
          <h4 style={{ marginTop: 0, marginBottom: "12px", color: "#b5e8a1" }}>
            Your Court Bonuses
          </h4>
          <div style={{ display: "grid", gap: "8px" }}>
            {positionsByFaction[myFactionId].map(pos => {
              const config = COURT_POSITIONS[pos.position];
              return (
                <div key={pos.position} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px",
                  background: "#1a1410",
                  borderRadius: "4px"
                }}>
                  <span>
                    {config.icon} {pos.characterName} ({config.name})
                  </span>
                  <span style={{ color: "#FFD700" }}>
                    +{config.goldBonus} gold
                  </span>
                </div>
              );
            })}
            <div style={{
              borderTop: "1px solid #4a6642",
              paddingTop: "8px",
              marginTop: "4px",
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold"
            }}>
              <span>Total Court Bonus:</span>
              <span style={{ color: "#FFD700" }}>
                +{positionsByFaction[myFactionId].reduce(
                  (sum, pos) => sum + (COURT_POSITIONS[pos.position]?.goldBonus || 0), 
                  0
                )} gold/turn
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}