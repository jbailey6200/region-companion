// components/GMMissionPanel.jsx
// GM interface for managing agent missions

import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import {
  collection,
  query,
  onSnapshot,
  updateDoc,
  doc,
  orderBy,
  addDoc,
  deleteDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import {
  MISSION_TYPES,
  calculateMissionDifficulty,
  calculateAgentBonus,
  determineMissionOutcome,
  getMissionEffects,
  rollD100,
  OUTCOME_STYLES,
  MISSION_STATUS,
  DIFFICULTY_MODIFIERS,
} from "../config/agentMissions";

export default function GMMissionPanel({ factionNames, allRegions, allAgents }) {
  const [pendingMissions, setPendingMissions] = useState([]);
  const [approvedMissions, setApprovedMissions] = useState([]);
  const [completedMissions, setCompletedMissions] = useState([]);
  const [selectedMission, setSelectedMission] = useState(null);
  const [difficultyOverrides, setDifficultyOverrides] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastRollResult, setLastRollResult] = useState(null);

  // Load all missions
  useEffect(() => {
    const missionsRef = collection(db, "missions");
    const q = query(missionsRef, orderBy("createdAt", "desc"));
    
    const unsub = onSnapshot(q, (snap) => {
      const missions = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setPendingMissions(missions.filter(m => m.status === MISSION_STATUS.PENDING));
      setApprovedMissions(missions.filter(m => m.status === MISSION_STATUS.APPROVED));
      setCompletedMissions(missions.filter(m => 
        m.status === MISSION_STATUS.COMPLETED || m.status === MISSION_STATUS.REJECTED
      ).slice(0, 50));
    });
    
    return () => unsub();
  }, []);

  // Calculate full difficulty with GM overrides
  function calculateFullDifficulty(mission) {
    const overrides = difficultyOverrides[mission.id] || {};
    
    const context = {
      hasKeep: overrides.hasKeep ?? mission.difficultyContext?.hasKeep ?? false,
      hasCastle: overrides.hasCastle ?? mission.difficultyContext?.hasCastle ?? false,
      enforcerCount: overrides.enforcerCount ?? 0,
      garrisonStrength: overrides.garrisonStrength ?? 0,
      targetProwess: mission.target?.prowess ?? 0,
      targetIntrigue: mission.target?.intrigue ?? 0,
      targetAgentLevel: mission.target?.level ?? 0,
      targetRevealed: mission.target?.type === 'agent',
      friendlyAgentCount: overrides.friendlyAgentCount ?? 0,
    };

    return calculateMissionDifficulty(mission.missionType, context);
  }

  async function handleApprove(mission) {
    setIsProcessing(true);
    try {
      const missionRef = doc(db, "missions", mission.id);
      const { difficulty, breakdown } = calculateFullDifficulty(mission);
      
      await updateDoc(missionRef, {
        status: MISSION_STATUS.APPROVED,
        approvedAt: new Date(),
        finalDifficulty: difficulty,
        difficultyBreakdown: breakdown,
      });
    } catch (error) {
      console.error("Error approving mission:", error);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleReject(mission, reason = "") {
    setIsProcessing(true);
    try {
      const missionRef = doc(db, "missions", mission.id);
      await updateDoc(missionRef, {
        status: MISSION_STATUS.REJECTED,
        rejectedAt: new Date(),
        rejectReason: reason,
      });
    } catch (error) {
      console.error("Error rejecting mission:", error);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleExecuteMission(mission) {
    setIsProcessing(true);
    setLastRollResult(null);
    
    try {
      const roll = rollD100();
      const agentBonus = calculateAgentBonus(mission.agentLevel, mission.missionType);
      const difficulty = mission.finalDifficulty;
      
      const result = determineMissionOutcome(roll, agentBonus, difficulty, mission.agentType);
      const effects = getMissionEffects(mission.missionType, result.outcome, result.isCritical, {
        targetName: mission.target?.name,
      });

      // Store result for display
      setLastRollResult({
        missionId: mission.id,
        missionName: mission.missionName,
        factionName: mission.factionName,
        agentName: mission.agentName,
        regionCode: mission.regionCode,
        roll,
        agentBonus,
        difficulty,
        result,
        effects,
      });

      const missionRef = doc(db, "missions", mission.id);
      await updateDoc(missionRef, {
        status: MISSION_STATUS.COMPLETED,
        completedAt: new Date(),
        result: result,
        effects: effects,
      });

      // Handle agent fate
      if (result.agentFate === 'dead') {
        const agentRef = doc(db, "agents", mission.agentId);
        await updateDoc(agentRef, { deleted: true, deathMission: mission.id });
      } else if (result.agentFate === 'revealed') {
        const agentRef = doc(db, "agents", mission.agentId);
        await updateDoc(agentRef, { revealed: true, revealedAt: new Date() });
      }

      // Send notification to faction mailbox
      let messageBody = "";
      if (result.success) {
        messageBody = `Your agent ${mission.agentName} has completed their ${mission.missionName} mission in [${mission.regionCode}] ${mission.regionName}. `;
        if (effects && effects.length > 0) {
          messageBody += effects.join(" ");
        }
      } else {
        messageBody = `Your agent ${mission.agentName} has failed their ${mission.missionName} mission in [${mission.regionCode}] ${mission.regionName}. `;
        if (result.agentFate === 'dead') {
          messageBody += `Tragically, ${mission.agentName} was killed during the operation.`;
        } else if (result.agentFate === 'revealed') {
          messageBody += `${mission.agentName}'s identity has been compromised.`;
        }
      }

      await addDoc(collection(db, "messages"), {
        fromFactionId: 0,
        fromFactionName: "Intelligence Service",
        toFactionId: mission.factionId,
        toType: "faction",
        body: messageBody,
        createdAt: new Date(),
        read: false,
        type: "mission",
        success: result.success,
        missionId: mission.id,
      });

    } catch (error) {
      console.error("Error executing mission:", error);
    } finally {
      setIsProcessing(false);
    }
  }

  function updateDifficultyOverride(missionId, field, value) {
    setDifficultyOverrides(prev => ({
      ...prev,
      [missionId]: {
        ...(prev[missionId] || {}),
        [field]: value,
      }
    }));
  }

  function dismissRollResult() {
    setLastRollResult(null);
  }

  async function clearMissionLog() {
    if (!window.confirm("Are you sure you want to clear all completed/rejected missions from the log? This cannot be undone.")) {
      return;
    }
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      
      // Get all completed and rejected missions
      const missionsRef = collection(db, "missions");
      const snap = await getDocs(missionsRef);
      
      let deleteCount = 0;
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status === MISSION_STATUS.COMPLETED || data.status === MISSION_STATUS.REJECTED) {
          batch.delete(doc(db, "missions", docSnap.id));
          deleteCount++;
        }
      });
      
      if (deleteCount > 0) {
        await batch.commit();
        console.log(`Cleared ${deleteCount} missions from log`);
      }
    } catch (error) {
      console.error("Error clearing mission log:", error);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>🕵 Agent Mission Control</h2>

      {/* Roll Result Modal */}
      {lastRollResult && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "#1a1410",
            border: `3px solid ${OUTCOME_STYLES[lastRollResult.result.outcome]?.color || "#5e4934"}`,
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "500px",
            width: "90%",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>
              {OUTCOME_STYLES[lastRollResult.result.outcome]?.icon || "?"}
            </div>
            <h2 style={{ 
              color: OUTCOME_STYLES[lastRollResult.result.outcome]?.color || "#f4efe4",
              margin: "0 0 8px 0"
            }}>
              {OUTCOME_STYLES[lastRollResult.result.outcome]?.label || "Unknown"}
            </h2>
            <p style={{ color: "#c7bca5", margin: "0 0 16px 0" }}>
              {lastRollResult.result.description}
            </p>
            
            <div style={{
              background: "#241b15",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "16px",
              textAlign: "left",
            }}>
              <div style={{ marginBottom: "8px" }}>
                <strong>{lastRollResult.factionName}</strong>
                <span style={{ color: "#a89a7a" }}> - </span>
                <span style={{ color: "#d1b26b" }}>{lastRollResult.missionName}</span>
              </div>
              <div style={{ fontSize: "13px", color: "#a89a7a", marginBottom: "8px" }}>
                {lastRollResult.agentName} → [{lastRollResult.regionCode}]
              </div>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 1fr 1fr", 
                gap: "8px",
                fontSize: "14px",
                textAlign: "center",
                padding: "8px",
                background: "#1a1410",
                borderRadius: "6px",
              }}>
                <div>
                  <div style={{ color: "#a89a7a", fontSize: "11px" }}>ROLL</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#f4efe4" }}>
                    {lastRollResult.roll}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#a89a7a", fontSize: "11px" }}>+ BONUS</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#4ade80" }}>
                    +{lastRollResult.agentBonus}
                  </div>
                </div>
                <div>
                  <div style={{ color: "#a89a7a", fontSize: "11px" }}>vs DIFF</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ef4444" }}>
                    {lastRollResult.difficulty}
                  </div>
                </div>
              </div>
              <div style={{ 
                textAlign: "center", 
                marginTop: "8px",
                fontSize: "16px",
                color: lastRollResult.result.margin >= 0 ? "#4ade80" : "#ef4444"
              }}>
                Final: {lastRollResult.result.finalScore} (Margin: {lastRollResult.result.margin >= 0 ? '+' : ''}{lastRollResult.result.margin})
              </div>
            </div>

            {/* Agent Fate */}
            {lastRollResult.result.agentFate === 'dead' && (
              <div style={{
                background: "#3a1a1a",
                border: "1px solid #8b3a3a",
                borderRadius: "6px",
                padding: "8px 12px",
                marginBottom: "12px",
                color: "#ef4444",
              }}>
                [SKULL]  Agent {lastRollResult.agentName} has been killed!
              </div>
            )}
            {lastRollResult.result.agentFate === 'revealed' && (
              <div style={{
                background: "#3a2a1a",
                border: "1px solid #8b6b3a",
                borderRadius: "6px",
                padding: "8px 12px",
                marginBottom: "12px",
                color: "#f97316",
              }}>
                [EYE]  Agent {lastRollResult.agentName} has been revealed!
              </div>
            )}

            {/* Effects */}
            {lastRollResult.effects?.length > 0 && lastRollResult.result.success && (
              <div style={{
                background: "#1a2a1a",
                border: "1px solid #3a5a3a",
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "16px",
                textAlign: "left",
              }}>
                <div style={{ color: "#4ade80", marginBottom: "8px", fontWeight: "bold" }}>
                  Mission Effects:
                </div>
                {lastRollResult.effects.map((effect, idx) => (
                  <div key={idx} style={{ color: "#a89a7a", marginLeft: "10px", marginBottom: "4px" }}>
                    • {effect}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={dismissRollResult}
              className="green"
              style={{ padding: "12px 32px", fontSize: "16px" }}
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Pending Missions */}
      <div style={{ marginBottom: "32px" }}>
        <h3 style={{ 
          fontSize: "18px", 
          marginBottom: "16px", 
          color: "#fbbf24",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          Pending Approval ({pendingMissions.length})
        </h3>

        {pendingMissions.length === 0 ? (
          <p style={{ color: "#a89a7a" }}>No missions awaiting approval.</p>
        ) : (
          pendingMissions.map(mission => {
            const { difficulty, breakdown } = calculateFullDifficulty(mission);
            const agentBonus = calculateAgentBonus(mission.agentLevel, mission.missionType);
            const overrides = difficultyOverrides[mission.id] || {};

            return (
              <div
                key={mission.id}
                style={{
                  padding: "16px",
                  background: "#241b15",
                  border: "2px solid #5e4934",
                  borderRadius: "8px",
                  marginBottom: "16px",
                }}
              >
                {/* Header */}
                <div style={{
                  background: "#1a1410",
                  margin: "-16px -16px 16px -16px",
                  padding: "12px 16px",
                  borderRadius: "6px 6px 0 0",
                  borderBottom: "1px solid #4c3b2a",
                }}>
                  <div style={{ fontSize: "16px", fontWeight: "bold", color: "#f4efe4" }}>
                    {mission.factionName} is attempting:
                  </div>
                  <div style={{ fontSize: "18px", color: "#d1b26b", marginTop: "4px" }}>
                    {mission.missionName}
                  </div>
                  <div style={{ fontSize: "14px", color: "#a89a7a", marginTop: "4px" }}>
                    Agent: <strong>{mission.agentName}</strong> ({mission.agentType} Lvl {mission.agentLevel})
                    <span style={{ margin: "0 8px" }}>→</span>
                    [{mission.regionCode}] {mission.regionName}
                  </div>
                  {mission.target && (
                    <div style={{ fontSize: "13px", color: "#c7bca5", marginTop: "4px" }}>
                      Target: <strong>{mission.target.name}</strong>
                      {mission.target.prowess && ` (Prowess: ${mission.target.prowess})`}
                      {mission.target.level && ` (Level: ${mission.target.level})`}
                    </div>
                  )}
                </div>

                {/* Difficulty Breakdown */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#d1b26b" }}>
                      Difficulty Calculation
                    </h4>
                    {breakdown.map((item, idx) => (
                      <div key={idx} style={{ 
                        display: "flex", 
                        justifyContent: "space-between",
                        fontSize: "13px",
                        marginBottom: "4px"
                      }}>
                        <span style={{ color: "#a89a7a" }}>{item.label}</span>
                        <span style={{ 
                          color: String(item.value).startsWith('-') ? "#4ade80" : 
                                 String(item.value).startsWith('+') ? "#ef4444" : "#f4efe4"
                        }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                    <div style={{
                      borderTop: "1px solid #4c3b2a",
                      marginTop: "8px",
                      paddingTop: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      fontWeight: "bold",
                    }}>
                      <span>Final Difficulty:</span>
                      <span style={{ color: "#ef4444" }}>{difficulty}</span>
                    </div>
                  </div>

                  {/* GM Overrides */}
                  <div>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#d1b26b" }}>
                      GM Adjustments
                    </h4>
                    <div style={{ fontSize: "12px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <input
                          type="checkbox"
                          checked={overrides.hasKeep ?? mission.difficultyContext?.hasKeep ?? false}
                          onChange={(e) => updateDifficultyOverride(mission.id, 'hasKeep', e.target.checked)}
                        />
                        Keep in region (+{DIFFICULTY_MODIFIERS.hasKeep})
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <input
                          type="checkbox"
                          checked={overrides.hasCastle ?? mission.difficultyContext?.hasCastle ?? false}
                          onChange={(e) => updateDifficultyOverride(mission.id, 'hasCastle', e.target.checked)}
                        />
                        Castle in region (+{DIFFICULTY_MODIFIERS.hasCastle})
                      </label>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span>Enemy Enforcers:</span>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          value={overrides.enforcerCount ?? 0}
                          onChange={(e) => updateDifficultyOverride(mission.id, 'enforcerCount', Number(e.target.value))}
                          style={{ width: "50px", padding: "2px 6px" }}
                        />
                        <span style={{ color: "#a89a7a" }}>(+{DIFFICULTY_MODIFIERS.enforcerInRegion}/each)</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <span>Friendly Agents:</span>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          value={overrides.friendlyAgentCount ?? 0}
                          onChange={(e) => updateDifficultyOverride(mission.id, 'friendlyAgentCount', Number(e.target.value))}
                          style={{ width: "50px", padding: "2px 6px" }}
                        />
                        <span style={{ color: "#4ade80" }}>({DIFFICULTY_MODIFIERS.friendlyAgentSupport}/each)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                <div style={{
                  background: "#1a1410",
                  padding: "12px",
                  borderRadius: "6px",
                  marginTop: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                  <div style={{ fontSize: "14px" }}>
                    <span style={{ color: "#a89a7a" }}>Agent Bonus: </span>
                    <strong style={{ color: "#4ade80" }}>+{agentBonus}</strong>
                    <span style={{ margin: "0 12px", color: "#4c3b2a" }}>|</span>
                    <span style={{ color: "#a89a7a" }}>Roll Needed: </span>
                    <strong style={{ color: "#fbbf24" }}>{Math.max(1, difficulty - agentBonus)}+</strong>
                    <span style={{ margin: "0 12px", color: "#4c3b2a" }}>|</span>
                    <span style={{ color: "#a89a7a" }}>Success Rate: </span>
                    <strong style={{ color: "#f4efe4" }}>
                      {Math.min(100, Math.max(0, 101 - Math.max(1, difficulty - agentBonus)))}%
                    </strong>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ 
                  display: "flex", 
                  gap: "10px", 
                  marginTop: "16px",
                  paddingTop: "16px",
                  borderTop: "1px solid #4c3b2a"
                }}>
                  <button
                    onClick={() => handleApprove(mission)}
                    disabled={isProcessing}
                    className="green"
                    style={{ padding: "10px 20px" }}
                  >
                    [OK]  Approve Mission
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt("Reason for rejection (optional):");
                      handleReject(mission, reason);
                    }}
                    disabled={isProcessing}
                    style={{ 
                      padding: "10px 20px",
                      background: "#5a2020",
                      borderColor: "#8b3a3a"
                    }}
                  >
                    [X] Reject
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Approved Missions - Ready to Roll */}
      {approvedMissions.length > 0 && (
        <div style={{ marginBottom: "32px" }}>
          <h3 style={{ 
            fontSize: "18px", 
            marginBottom: "16px", 
            color: "#4ade80",
          }}>
            🎲 Ready to Execute ({approvedMissions.length})
          </h3>

          {approvedMissions.map(mission => {
            const agentBonus = calculateAgentBonus(mission.agentLevel, mission.missionType);
            
            return (
              <div
                key={mission.id}
                style={{
                  padding: "16px",
                  background: "#1f2a1f",
                  border: "2px solid #4a6642",
                  borderRadius: "8px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: "15px" }}>
                      {mission.factionName}: {mission.missionName}
                    </div>
                    <div style={{ fontSize: "13px", color: "#a89a7a", marginTop: "4px" }}>
                      {mission.agentName} ({mission.agentType} Lvl {mission.agentLevel})
                      → [{mission.regionCode}] {mission.regionName}
                    </div>
                    <div style={{ fontSize: "12px", color: "#c7bca5", marginTop: "4px" }}>
                      Difficulty: <strong>{mission.finalDifficulty}</strong>
                      <span style={{ margin: "0 8px" }}>|</span>
                      Agent Bonus: <strong>+{agentBonus}</strong>
                      <span style={{ margin: "0 8px" }}>|</span>
                      Needs: <strong>{Math.max(1, mission.finalDifficulty - agentBonus)}+</strong>
                    </div>
                  </div>
                  <button
                    onClick={() => handleExecuteMission(mission)}
                    disabled={isProcessing}
                    style={{
                      padding: "12px 24px",
                      background: "linear-gradient(180deg, #4a6642 0%, #35502f 100%)",
                      border: "2px solid #5a7a52",
                      borderRadius: "8px",
                      color: "#f4efe4",
                      fontWeight: "bold",
                      fontSize: "15px",
                      cursor: "pointer",
                    }}
                  >
                    🎲 Roll Mission
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Missions Log */}
      <div>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "16px"
        }}>
          <h3 style={{ fontSize: "18px", margin: 0 }}>
            📜 Mission Log
          </h3>
          {completedMissions.length > 0 && (
            <button
              onClick={clearMissionLog}
              disabled={isProcessing}
              style={{
                padding: "6px 12px",
                background: "#3a2020",
                border: "1px solid #5a3030",
                borderRadius: "4px",
                color: "#ef4444",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              🗑 Clear Log ({completedMissions.length})
            </button>
          )}
        </div>

        {completedMissions.length === 0 ? (
          <p style={{ color: "#a89a7a" }}>No completed missions yet.</p>
        ) : (
          completedMissions.map(mission => {
            const outcomeStyle = OUTCOME_STYLES[mission.result?.outcome] || {};
            
            return (
              <div
                key={mission.id}
                style={{
                  padding: "12px 16px",
                  background: "#1a1410",
                  border: `1px solid ${outcomeStyle.color || "#3a2f24"}`,
                  borderRadius: "8px",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ 
                        fontWeight: "bold",
                        color: "#f4efe4"
                      }}>
                        {mission.factionName}
                      </span>
                      <span style={{ color: "#a89a7a" }}>→</span>
                      <span style={{ color: "#d1b26b" }}>{mission.missionName}</span>
                      <span style={{ color: "#a89a7a" }}>in</span>
                      <span>[{mission.regionCode}]</span>
                    </div>
                    
                    <div style={{ fontSize: "12px", color: "#a89a7a", marginTop: "4px" }}>
                      {mission.agentName} ({mission.agentType} Lvl {mission.agentLevel})
                      {mission.target && ` → Target: ${mission.target.name}`}
                    </div>
                    
                    {mission.result && (
                      <div style={{ fontSize: "12px", marginTop: "6px" }}>
                        <span style={{ color: "#c7bca5" }}>
                          Roll: {mission.result.roll} + {mission.result.agentBonus} = {mission.result.finalScore}
                          {" vs "}{mission.result.difficulty}
                          {" (margin: "}{mission.result.margin > 0 ? "+" : ""}{mission.result.margin})
                        </span>
                      </div>
                    )}
                    
                    {mission.result?.agentFate === 'dead' && (
                      <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px" }}>
                        [SKULL]  Agent {mission.agentName} was killed
                      </div>
                    )}
                    {mission.result?.agentFate === 'revealed' && (
                      <div style={{ fontSize: "12px", color: "#f97316", marginTop: "4px" }}>
                        [EYE]  Agent {mission.agentName} was revealed
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
                          <div key={idx} style={{ color: "#a89a7a", marginLeft: "10px" }}>• {effect}</div>
                        ))}
                      </div>
                    )}

                    {mission.status === 'rejected' && (
                      <div style={{ fontSize: "12px", color: "#f97316", marginTop: "4px" }}>
                        Rejected{mission.rejectReason ? `: ${mission.rejectReason}` : ''}
                      </div>
                    )}
                  </div>
                  
                  {mission.result && (
                    <div style={{
                      padding: "6px 12px",
                      background: (outcomeStyle.color || "#666") + "22",
                      border: `1px solid ${outcomeStyle.color || "#666"}`,
                      borderRadius: "6px",
                      textAlign: "center",
                      minWidth: "120px",
                    }}>
                      <div style={{ fontSize: "18px" }}>{outcomeStyle.icon}</div>
                      <div style={{ fontSize: "12px", color: outcomeStyle.color, fontWeight: "bold" }}>
                        {outcomeStyle.label}
                      </div>
                    </div>
                  )}
                  {mission.status === 'rejected' && !mission.result && (
                    <div style={{
                      padding: "6px 12px",
                      background: "#3a2f24",
                      border: "1px solid #5e4934",
                      borderRadius: "6px",
                      textAlign: "center",
                      minWidth: "120px",
                    }}>
                      <div style={{ fontSize: "18px" }}>[X]</div>
                      <div style={{ fontSize: "12px", color: "#a89a7a", fontWeight: "bold" }}>
                        Rejected
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}