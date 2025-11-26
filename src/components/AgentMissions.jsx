// components/AgentMissions.jsx
// Player interface for initiating agent missions

import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
} from "firebase/firestore";
import {
  MISSION_TYPES,
  getAvailableMissions,
  calculateMissionDifficulty,
  calculateAgentBonus,
  OUTCOME_STYLES,
  MISSION_STATUS,
} from "../config/agentMissions";
import {
  getRegionsInRange,
  getHexDistance,
  AGENT_ACTION_RANGE,
} from "../config/hexUtils";

export default function AgentMissions({
  factionId,
  factionName,
  agents,
  allRegions,
  allArmies,
  allCharacters,
  revealedEnemyAgents,
  isOwner,
}) {
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [pendingMissions, setPendingMissions] = useState([]);
  const [completedMissions, setCompletedMissions] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load missions for this faction
  useEffect(() => {
    const missionsRef = collection(db, "missions");
    const q = query(
      missionsRef,
      where("factionId", "==", factionId),
      orderBy("createdAt", "desc")
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const missions = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setPendingMissions(missions.filter(m => 
        m.status === MISSION_STATUS.PENDING || m.status === MISSION_STATUS.APPROVED
      ));
      setCompletedMissions(missions.filter(m => 
        m.status === MISSION_STATUS.COMPLETED || m.status === MISSION_STATUS.REJECTED
      ).slice(0, 20));
    });
    
    return () => unsub();
  }, [factionId]);

  // Get available missions when agent is selected
  const availableMissions = selectedAgent 
    ? getAvailableMissions(selectedAgent.type)
    : [];

  // Get mission config
  const missionConfig = selectedMission ? MISSION_TYPES[selectedMission] : null;

  // Get regions in range of selected agent
  const regionsInRange = selectedAgent?.location
    ? getRegionsInRange(selectedAgent.location, AGENT_ACTION_RANGE, allRegions)
    : [];

  // Sort regions for display
  const sortedRegionsInRange = [...regionsInRange].sort((a, b) => {
    if (a.code && b.code) return a.code.localeCompare(b.code);
    return (a.name || '').localeCompare(b.name || '');
  });

  // Calculate difficulty preview
  const difficultyPreview = selectedMission && selectedRegion
    ? calculateDifficultyForMission()
    : null;

  function calculateDifficultyForMission() {
    const region = allRegions.find(r => r.id === selectedRegion || r.code === selectedRegion);
    if (!region) return null;

    const context = {
      hasKeep: region.upgrades?.includes('Keep') || false,
      hasCastle: region.upgrades?.includes('Castle') || false,
      enforcerCount: 0, // Would need revealed agent data
      garrisonStrength: 0,
      friendlyAgentCount: agents.filter(a => 
        a.factionId === factionId && 
        a.location === region.code &&
        a.id !== selectedAgent?.id
      ).length,
    };

    // Add target-specific modifiers
    if (selectedTarget) {
      if (selectedMission === 'ASSASSINATE_COMMANDER' || selectedMission === 'ASSASSINATE_LEADER') {
        const targetChar = allCharacters?.find(c => c.id === selectedTarget);
        if (targetChar) {
          context.targetProwess = targetChar.prowess || 1;
          context.targetIntrigue = targetChar.intrigue || 1;
        }
      }
      if (selectedMission === 'KILL_AGENT') {
        const targetAgent = revealedEnemyAgents?.find(a => a.id === selectedTarget);
        if (targetAgent) {
          context.targetAgentLevel = targetAgent.level || 1;
          context.targetRevealed = true;
        }
      }
    }

    return calculateMissionDifficulty(selectedMission, context);
  }

  // Get agent bonus
  const agentBonus = selectedAgent && selectedMission
    ? calculateAgentBonus(selectedAgent.level || 1, selectedMission)
    : 0;

  // Get valid targets based on mission type
  function getValidTargets() {
    if (!missionConfig || !selectedRegion) return [];

    const region = allRegions.find(r => r.id === selectedRegion || r.code === selectedRegion);
    if (!region) return [];

    if (missionConfig.requiresArmyTarget) {
      return allArmies?.filter(a => 
        a.location === region.code && 
        a.factionId !== factionId &&
        !a.deleted
      ) || [];
    }

    if (missionConfig.requiresCommanderTarget) {
      const armiesInRegion = allArmies?.filter(a => 
        a.location === region.code && 
        a.factionId !== factionId &&
        !a.deleted
      ) || [];
      
      const commanders = [];
      armiesInRegion.forEach(army => {
        (army.commanders || []).forEach(cmdId => {
          const char = allCharacters?.find(c => c.id === cmdId);
          if (char) {
            commanders.push({
              ...char,
              armyName: army.name,
              armyId: army.id,
            });
          }
        });
      });
      return commanders;
    }

    if (missionConfig.requiresLeaderTarget) {
      return allCharacters?.filter(c => 
        c.factionId === region.owner && 
        c.factionId !== factionId
      ) || [];
    }

    if (missionConfig.requiresAgentTarget) {
      return revealedEnemyAgents?.filter(a => 
        a.location === region.code &&
        a.factionId !== factionId
      ) || [];
    }

    return [];
  }

  const validTargets = getValidTargets();

  // Check if agent has a location set
  const agentHasLocation = selectedAgent?.location && selectedAgent.location.trim() !== '';

  async function handleSubmitMission() {
    if (!selectedAgent || !selectedMission || !selectedRegion) return;
    if (missionConfig?.requiresAgentTarget && !selectedTarget) return;
    if (missionConfig?.requiresCommanderTarget && !selectedTarget) return;

    setIsSubmitting(true);

    try {
      const region = allRegions.find(r => r.id === selectedRegion || r.code === selectedRegion);
      
      // Build target info
      let targetInfo = null;
      if (selectedTarget) {
        if (missionConfig.requiresCommanderTarget) {
          const target = validTargets.find(t => t.id === selectedTarget);
          // Find the army to get its factionId
          const targetArmy = allArmies?.find(a => a.id === target?.armyId);
          targetInfo = {
            type: 'commander',
            id: selectedTarget,
            name: target ? `${target.firstName} ${target.lastName}` : 'Unknown',
            prowess: target?.prowess || 1,
            armyId: target?.armyId,
            factionId: targetArmy?.factionId || null,
          };
        } else if (missionConfig.requiresAgentTarget) {
          const target = revealedEnemyAgents.find(a => a.id === selectedTarget);
          targetInfo = {
            type: 'agent',
            id: selectedTarget,
            name: target?.name || 'Unknown',
            level: target?.level || 1,
            factionId: target?.factionId || null,
          };
        } else if (missionConfig.requiresLeaderTarget) {
          const target = allCharacters.find(c => c.id === selectedTarget);
          targetInfo = {
            type: 'leader',
            id: selectedTarget,
            name: target ? `${target.firstName} ${target.lastName}` : 'Unknown',
            prowess: target?.prowess || 1,
            intrigue: target?.intrigue || 1,
            factionId: target?.factionId || null,
          };
        } else if (missionConfig.requiresArmyTarget) {
          const target = validTargets.find(t => t.id === selectedTarget);
          targetInfo = {
            type: 'army',
            id: selectedTarget,
            name: target?.name || 'Unknown',
            factionId: target?.factionId || null,
          };
        }
      }

      const missionData = {
        factionId,
        factionName,
        agentId: selectedAgent.id,
        agentName: selectedAgent.name,
        agentType: selectedAgent.type,
        agentLevel: selectedAgent.level || 1,
        agentLocation: selectedAgent.location,
        missionType: selectedMission,
        missionName: missionConfig.name,
        regionId: region?.id,
        regionCode: region?.code,
        regionName: region?.name,
        target: targetInfo,
        status: MISSION_STATUS.PENDING,
        createdAt: new Date(),
        difficultyContext: {
          hasKeep: region?.upgrades?.includes('Keep') || false,
          hasCastle: region?.upgrades?.includes('Castle') || false,
        },
      };

      await addDoc(collection(db, "missions"), missionData);

      // Reset form
      setSelectedAgent(null);
      setSelectedMission(null);
      setSelectedRegion("");
      setSelectedTarget("");

    } catch (error) {
      console.error("Error submitting mission:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Reset dependent selections when agent changes
  function handleAgentChange(agentId) {
    const agent = agents.find(a => a.id === agentId);
    setSelectedAgent(agent || null);
    setSelectedMission(null);
    setSelectedRegion("");
    setSelectedTarget("");
  }

  return (
    <div>
      <h2 style={{ marginBottom: "16px" }}> Agent Missions </h2>

      {/* Pending Missions */}
      {pendingMissions.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "16px", marginBottom: "12px", color: "#fbbf24" }}>
            ⚠️ Pending Missions ({pendingMissions.length})
          </h3>
          {pendingMissions.map(mission => (
            <div
              key={mission.id}
              style={{
                padding: "12px",
                background: mission.status === 'approved' ? "#1f2a1f" : "#241b15",
                border: mission.status === 'approved' ? "1px solid #4a6642" : "1px solid #5e4934",
                borderRadius: "8px",
                marginBottom: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{mission.agentName}</strong>
                  <span style={{ color: "#a89a7a", margin: "0 8px" }}> </span>
                  <span style={{ color: "#d1b26b" }}>{mission.missionName}</span>
                  <span style={{ color: "#a89a7a", margin: "0 8px" }}>in</span>
                  <span>[{mission.regionCode}] {mission.regionName}</span>
                </div>
                <span style={{
                  padding: "4px 10px",
                  background: mission.status === 'approved' ? "#2a3a2a" : "#2a2520",
                  borderRadius: "4px",
                  fontSize: "12px",
                  color: mission.status === 'approved' ? "#4ade80" : "#fbbf24",
                }}>
                  {mission.status === 'approved' ? 'Ready to Roll' : 'Awaiting Approval'}
                </span>
              </div>
              {mission.target && (
                <div style={{ fontSize: "12px", color: "#a89a7a", marginTop: "4px" }}>
                  Target: {mission.target.name}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New Mission Form */}
      {isOwner && (
        <div className="card" style={{ padding: "16px", marginBottom: "24px" }}>
          <h3 style={{ marginTop: 0, marginBottom: "16px" }}>Assign New Mission</h3>

          {/* Step 1: Select Agent */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#d1b26b" }}>
              1. Select Agent
            </label>
            <select
              value={selectedAgent?.id || ""}
              onChange={(e) => handleAgentChange(e.target.value)}
              style={{
                width: "100%",
                maxWidth: "400px",
                padding: "8px 12px",
                background: "#1b130d",
                border: "1px solid #5e4934",
                borderRadius: "6px",
                color: "#f4efe4",
                fontSize: "14px",
              }}
            >
              <option value="">-- Select Agent --</option>
              {agents.filter(a => !a.deleted).map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.type} Lvl {agent.level || 1}) 
                  {agent.location ? ` @ ${agent.location}` : ' - NO LOCATION'}
                  {agent.revealed ? ' [REVEALED]' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Warning if agent has no location */}
          {selectedAgent && !agentHasLocation && (
            <div style={{
              padding: "12px",
              background: "#3a1a1a",
              border: "1px solid #8b3a3a",
              borderRadius: "6px",
              marginBottom: "16px",
              color: "#ff6b6b",
              fontSize: "13px",
            }}>
              âš ï¸ This agent has no location assigned. Please set their location in the Agents tab before assigning missions.
            </div>
          )}

          {/* Step 2: Select Mission Type */}
          {selectedAgent && agentHasLocation && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#d1b26b" }}>
                2. Select Mission Type
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                {availableMissions.map(mission => (
                  <button
                    key={mission.key}
                    onClick={() => {
                      setSelectedMission(mission.key);
                      setSelectedRegion("");
                      setSelectedTarget("");
                    }}
                    style={{
                      padding: "10px 12px",
                      background: selectedMission === mission.key ? "#3a3020" : "#241b15",
                      border: selectedMission === mission.key ? "2px solid #d1b26b" : "1px solid #5e4934",
                      borderRadius: "6px",
                      textAlign: "left",
                      cursor: "pointer",
                      color: "#f4efe4",
                    }}
                  >
                    <div style={{ fontWeight: "bold", fontSize: "13px" }}>{mission.name}</div>
                    <div style={{ fontSize: "11px", color: "#a89a7a", marginTop: "4px" }}>
                      {mission.description}
                    </div>
                    <div style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>
                      Base Difficulty: {mission.baseDifficulty}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Select Target Region */}
          {selectedMission && agentHasLocation && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#d1b26b" }}>
                3. Select Target Region
                <span style={{ fontSize: "12px", color: "#a89a7a", marginLeft: "8px" }}>
                  (within {AGENT_ACTION_RANGE} hexes of {selectedAgent.location})
                </span>
              </label>
              {sortedRegionsInRange.length === 0 ? (
                <p style={{ color: "#f97373", fontSize: "13px" }}>
                  No regions in range. Agent must be in a valid location.
                </p>
              ) : (
                <select
                  value={selectedRegion}
                  onChange={(e) => {
                    setSelectedRegion(e.target.value);
                    setSelectedTarget("");
                  }}
                  style={{
                    width: "100%",
                    maxWidth: "400px",
                    padding: "8px 12px",
                    background: "#1b130d",
                    border: "1px solid #5e4934",
                    borderRadius: "6px",
                    color: "#f4efe4",
                    fontSize: "14px",
                  }}
                >
                  <option value="">-- Select Region --</option>
                  {sortedRegionsInRange.map(region => {
                    const distance = getHexDistance(selectedAgent.location, region.code);
                    return (
                      <option key={region.id} value={region.code || region.id}>
                        [{region.code}] {region.name} (Owner: Faction {region.owner}) - {distance} hex{distance !== 1 ? 'es' : ''} away
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          )}

          {/* Step 4: Select Target (if required) */}
          {selectedRegion && (missionConfig?.requiresCommanderTarget || missionConfig?.requiresAgentTarget || missionConfig?.requiresArmyTarget || missionConfig?.requiresLeaderTarget) && (
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", color: "#d1b26b" }}>
                4. Select Target
              </label>
              {validTargets.length === 0 ? (
                <p style={{ color: "#f97373", fontSize: "13px" }}>
                  No valid targets found in this region.
                  {missionConfig.requiresAgentTarget && " (Requires revealed enemy agents)"}
                  {missionConfig.requiresCommanderTarget && " (Requires enemy armies with commanders)"}
                  {missionConfig.requiresLeaderTarget && " (Requires enemy faction characters)"}
                  {missionConfig.requiresArmyTarget && " (Requires enemy armies)"}
                </p>
              ) : (
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  style={{
                    width: "100%",
                    maxWidth: "400px",
                    padding: "8px 12px",
                    background: "#1b130d",
                    border: "1px solid #5e4934",
                    borderRadius: "6px",
                    color: "#f4efe4",
                    fontSize: "14px",
                  }}
                >
                  <option value="">-- Select Target --</option>
                  {validTargets.map(target => (
                    <option key={target.id} value={target.id}>
                      {missionConfig.requiresCommanderTarget && 
                        `${target.firstName} ${target.lastName} (Prow: ${target.prowess}) - ${target.armyName}`}
                      {missionConfig.requiresAgentTarget && 
                        `${target.name} (${target.type} Lvl ${target.level})`}
                      {missionConfig.requiresArmyTarget && 
                        `${target.name}`}
                      {missionConfig.requiresLeaderTarget &&
                        `${target.firstName} ${target.lastName} (Prow: ${target.prowess}, Int: ${target.intrigue})`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Difficulty Preview */}
          {difficultyPreview && (
            <div style={{
              padding: "12px",
              background: "#1a1410",
              borderRadius: "8px",
              marginBottom: "16px",
              border: "1px solid #3a2f24",
            }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#d1b26b" }}>
                Mission Preview
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
                <div>
                  <div style={{ color: "#a89a7a", marginBottom: "4px" }}>Difficulty Breakdown:</div>
                  {difficultyPreview.breakdown.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{item.label}</span>
                      <span style={{ color: String(item.value).startsWith('-') ? "#4ade80" : "#f4efe4" }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                  <div style={{ 
                    borderTop: "1px solid #3a2f24", 
                    marginTop: "6px", 
                    paddingTop: "6px",
                    fontWeight: "bold",
                    display: "flex",
                    justifyContent: "space-between"
                  }}>
                    <span>Final Difficulty:</span>
                    <span style={{ color: "#ef4444" }}>{difficultyPreview.difficulty}</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: "#a89a7a", marginBottom: "4px" }}>Your Agent:</div>
                  <div>Level {selectedAgent?.level || 1} {selectedAgent?.type}</div>
                  <div>Bonus: <span style={{ color: "#4ade80" }}>+{agentBonus}</span></div>
                  <div style={{ marginTop: "8px", color: "#a89a7a" }}>
                    Roll needed: <strong style={{ color: "#fbbf24" }}>
                      {Math.max(1, difficultyPreview.difficulty - agentBonus)}+
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmitMission}
            disabled={
              isSubmitting || 
              !selectedAgent || 
              !selectedMission || 
              !selectedRegion ||
              !agentHasLocation ||
              ((missionConfig?.requiresCommanderTarget || missionConfig?.requiresAgentTarget || missionConfig?.requiresLeaderTarget || missionConfig?.requiresArmyTarget) && !selectedTarget)
            }
            className="green"
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              opacity: isSubmitting ? 0.5 : 1,
            }}
          >
            {isSubmitting ? "Submitting..." : "Submit Mission for GM Approval"}
          </button>
        </div>
      )}

      {/* Completed Missions Log */}
      {completedMissions.length > 0 && (
        <div>
          <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>
            📜 Mission History
          </h3>
          {completedMissions.map(mission => {
            const outcomeStyle = OUTCOME_STYLES[mission.result?.outcome] || {};
            return (
              <div
                key={mission.id}
                style={{
                  padding: "12px",
                  background: "#1a1410",
                  border: `1px solid ${outcomeStyle.color || "#3a2f24"}`,
                  borderRadius: "8px",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{mission.agentName}</strong>
                    <span style={{ color: "#a89a7a", margin: "0 8px" }}>â†’</span>
                    <span>{mission.missionName}</span>
                    <span style={{ color: "#a89a7a", margin: "0 8px" }}>in</span>
                    <span>[{mission.regionCode}]</span>
                  </div>
                  {mission.result && (
                    <span style={{
                      padding: "4px 10px",
                      background: outcomeStyle.color + "22",
                      border: `1px solid ${outcomeStyle.color}`,
                      borderRadius: "4px",
                      fontSize: "12px",
                      color: outcomeStyle.color,
                    }}>
                      {outcomeStyle.icon} {outcomeStyle.label}
                    </span>
                  )}
                  {mission.status === 'rejected' && (
                    <span style={{
                      padding: "4px 10px",
                      background: "#3a2f24",
                      borderRadius: "4px",
                      fontSize: "12px",
                      color: "#a89a7a",
                    }}>
                      Rejected by GM
                    </span>
                  )}
                </div>
                {mission.result && (
                  <div style={{ fontSize: "12px", color: "#a89a7a", marginTop: "6px" }}>
                    Roll: {mission.result.roll} + {mission.result.agentBonus} = {mission.result.finalScore} vs {mission.result.difficulty}
                    <span style={{ marginLeft: "8px" }}>
                      (margin: {mission.result.margin > 0 ? '+' : ''}{mission.result.margin})
                    </span>
                    {mission.result.agentFate === 'dead' && (
                      <span style={{ color: "#ef4444", marginLeft: "10px" }}>ðŸ’€ Agent was killed</span>
                    )}
                    {mission.result.agentFate === 'revealed' && (
                      <span style={{ color: "#f97316", marginLeft: "10px" }}>ðŸ‘ Agent was revealed</span>
                    )}
                  </div>
                )}
                {mission.effects?.length > 0 && mission.result?.success && (
                  <div style={{ 
                    marginTop: "8px", 
                    padding: "8px",
                    background: "#0a1a0a",
                    borderRadius: "4px",
                    fontSize: "12px"
                  }}>
                    <div style={{ color: "#4ade80", marginBottom: "4px" }}>Effects:</div>
                    {mission.effects.map((effect, idx) => (
                      <div key={idx} style={{ color: "#a89a7a", marginLeft: "10px" }}>â€¢ {effect}</div>
                    ))}
                  </div>
                )}
                {mission.rejectReason && (
                  <div style={{ fontSize: "12px", color: "#f97316", marginTop: "6px" }}>
                    Reason: {mission.rejectReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}