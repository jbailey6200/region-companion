// pages/GMPanel.jsx - Refactored with shared components

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import RegionCard from "../components/RegionCard";
import ArmyCard from "../components/ArmyCard";
import CharacterCard from "../components/CharacterCard";
import Court from "../components/Court";
import GMMissionPanel from "../components/GmMissionPanel";
import ArmyForm from "../components/ArmyForm";
import CharacterForm from "../components/CharacterForm";
import { Mailbox } from "../components/MessageSystem";
import {
  calculateEconomy,
  calculateUpkeeps,
  calculateHSGUsed,
  getModifiedUpkeep,
} from "../utils/economyCalculations";
import { BUILDING_RULES, HSG_UNITS, LEVY_UPKEEP_PER_UNIT } from "../config/buildingRules";
import { DEITIES } from "../config/religionRules";
import { TERRAIN_TYPES, getTerrainFromMapPosition } from "../config/terrainRules";
import { getCourtBonuses, COURT_POSITIONS } from "../config/courtPositions";
import { 
  RANDOM_EVENTS, 
  EVENT_CATEGORIES, 
  getRandomEvent, 
  getRandomEventByCategory,
  getRandomEventsForFactions,
  formatEventMessage 
} from "../config/randomEvents";

// Faction Summary Card Component
function FactionCard({ factionId, factionData, regions, armies, agents, courtPositions, onNavigate }) {
  const faction = factionData[factionId];
  const factionRegions = regions.filter((r) => r.owner === factionId);
  const factionArmies = armies.filter((a) => a.factionId === factionId && !a.deleted);
  const factionAgents = agents.filter((a) => a.factionId === factionId);
  const patronDeity = faction?.patronDeity;

  const eco = calculateEconomy(factionRegions, patronDeity);
  const upkeeps = calculateUpkeeps(factionArmies, faction, factionAgents, patronDeity);
  const courtBonuses = getCourtBonuses(courtPositions, factionId);

  const hsgUsed = calculateHSGUsed(factionArmies);
  const overCap = hsgUsed > eco.hsgCap;

  // Net gold including court bonuses
  const totalGoldAfterUpkeep = eco.goldPerTurn + courtBonuses.gold - upkeeps.total;

  return (
    <div
      className="card"
      style={{
        padding: "16px",
        background: totalGoldAfterUpkeep < 0 ? "#2a1a1a" : "#201712",
        border: totalGoldAfterUpkeep < 0 ? "1px solid #5a2a2a" : "1px solid #4c3b2a",
        cursor: "pointer",
      }}
      onClick={() => onNavigate(`/faction/${factionId}`)}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          paddingBottom: "8px",
          borderBottom: "1px solid #4c3b2a",
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: "16px" }}>
            {faction?.name || `Faction ${factionId}`}
          </h3>
          <span style={{ fontSize: "12px", color: "#a89a7a" }}>
            {factionRegions.length} regions • {factionArmies.length} armies •{" "}
            {factionAgents.length} agents
          </span>
        </div>
        <button
          className="small"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(`/faction/${factionId}`);
          }}
        >
          View
        </button>
      </div>

      {/* Economy Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div>
          <strong style={{ color: "#d1b26b" }}>Income</strong>
          <div style={{ fontSize: "13px" }}>
            Base Gold: <strong>{eco.goldPerTurn}</strong>
            {courtBonuses.gold > 0 && (
              <span style={{ color: "#8B008B" }}> +{courtBonuses.gold}</span>
            )}
          </div>
        </div>

        <div style={{ marginTop: "8px" }}>
          {upkeeps.hsgUpkeep > 0 && (
            <div>
              HSG Upkeep: <strong>-{upkeeps.hsgUpkeep}</strong>
            </div>
          )}
          {upkeeps.levyUpkeep > 0 && (
            <div>
              Levy Upkeep: <strong>-{upkeeps.levyUpkeep}</strong>
            </div>
          )}
          {upkeeps.navyUpkeep > 0 && (
            <div>
              Navy Upkeep: <strong>-{upkeeps.navyUpkeep}</strong>
            </div>
          )}
          {upkeeps.agentUpkeep > 0 && (
            <div>
              Agent Upkeep: <strong>-{upkeeps.agentUpkeep}</strong>
            </div>
          )}
          <div
            style={{
              borderTop: "1px solid #4c3b2a",
              paddingTop: "4px",
              marginTop: "4px",
              fontWeight: "bold",
            }}
          >
            Net Gold/Turn:
            <strong
              style={{
                color: totalGoldAfterUpkeep < 0 ? "#ff4444" : "#b5e8a1",
                marginLeft: "6px",
              }}
            >
              {totalGoldAfterUpkeep > 0 ? "+" : ""}
              {totalGoldAfterUpkeep}
            </strong>
          </div>
        </div>
      </div>

      {/* Other Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          fontSize: "12px",
        }}
      >
        <div>
          <strong>Capacity</strong>
          <div>
            HSG:{" "}
            <span style={{ color: overCap ? "#ff4444" : "#b5e8a1" }}>
              {hsgUsed}/{eco.hsgCap}
            </span>
          </div>
          <div>
            Agents: {factionAgents.length}/{eco.townCount + eco.cityCount * 2}
          </div>
        </div>

        <div>
          <strong>Other</strong>
          <div>Patron: {patronDeity ? DEITIES[patronDeity].name : "None"}</div>
          {courtBonuses.positions.length > 0 && (
            <div style={{ color: "#8B008B" }}>
              Court: {courtBonuses.positions.map((p) => p.position).join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* Manpower */}
      <div
        style={{
          marginTop: "8px",
          padding: "6px",
          background: eco.manpowerNet < 0 ? "#3a1a1a" : "#1a1410",
          borderRadius: "4px",
          fontSize: "12px",
        }}
      >
        Manpower:{" "}
        <strong style={{ color: eco.manpowerNet < 0 ? "#ff4444" : "#b5e8a1" }}>
          {eco.manpowerNet > 0 ? "+" : ""}
          {eco.manpowerNet}
        </strong>
        <span style={{ color: "#888", marginLeft: "6px" }}>
          (prod {eco.manpowerProduced}, cost {eco.manpowerUpkeep})
        </span>
      </div>
    </div>
  );
}

// Neutral Forces Component - Now using shared ArmyCard and CharacterCard
function NeutralForces({ armies, characters, courtPositions, regions, onNavigate }) {
  const [isCreatingArmy, setIsCreatingArmy] = useState(false);
  const [isCreatingCharacter, setIsCreatingCharacter] = useState(false);

  // Get court position for a character
  function getCharacterCourtPosition(charId) {
    return courtPositions.find((p) => p.characterId === charId);
  }

  // Get prowess bonus from court position
  function getCourtProwessBonus(charId) {
    const pos = getCharacterCourtPosition(charId);
    if (!pos) return 0;
    const config = COURT_POSITIONS[pos.position];
    return config?.effects?.prowessBonus || 0;
  }

  async function createNeutralArmy(armyData) {
    const armiesRef = collection(db, "factions", "neutral", "armies");
    await addDoc(armiesRef, {
      ...armyData,
      name: armyData.name || "Neutral Army",
      isNeutral: true,
      commanders: [],
      deleted: false,
    });
    setIsCreatingArmy(false);
  }

  async function createNeutralCharacter(charData) {
    const charsRef = collection(db, "factions", "neutral", "characters");
    await addDoc(charsRef, {
      ...charData,
      isNeutral: true,
      faction: null,
    });
    setIsCreatingCharacter(false);
  }

  async function deleteNeutralArmy(id) {
    if (!window.confirm("Delete this neutral army?")) return;
    await deleteDoc(doc(db, "factions", "neutral", "armies", id));
  }

  async function deleteNeutralCharacter(id) {
    if (!window.confirm("Delete this neutral character?")) return;
    await deleteDoc(doc(db, "factions", "neutral", "characters", id));
  }

  async function updateNeutralArmy(id, field, value) {
    await updateDoc(doc(db, "factions", "neutral", "armies", id), {
      [field]: value,
    });
  }

  async function updateNeutralArmyUnit(id, field, delta) {
    const army = armies.find((a) => a.id === id);
    const current = army[field] || 0;
    const next = Math.max(0, current + delta);
    await updateDoc(doc(db, "factions", "neutral", "armies", id), {
      [field]: next,
    });
  }

  async function updateNeutralCharacter(id, field, value) {
    await updateDoc(doc(db, "factions", "neutral", "characters", id), {
      [field]: value,
    });
  }

  async function updateArmyCommanders(armyId, commanderIds) {
    try {
      await updateDoc(doc(db, "factions", "neutral", "armies", armyId), {
        commanders: commanderIds,
      });
    } catch (error) {
      console.error("Error updating commanders:", error);
      alert("Failed to save commanders. Please try again.");
    }
  }

  const activeArmies = armies.filter((a) => !a.deleted);

  return (
    <div>
      {/* Neutral Armies */}
      <div style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h2 style={{ margin: 0 }}>Neutral Armies</h2>
          <button
            onClick={() => setIsCreatingArmy(true)}
            className="green"
            style={{ padding: "8px 16px" }}
          >
            + Create Neutral Army
          </button>
        </div>

        {isCreatingArmy && (
          <ArmyForm
            regions={regions}
            onSubmit={createNeutralArmy}
            onCancel={() => setIsCreatingArmy(false)}
          />
        )}

        {activeArmies.length === 0 ? (
          <p style={{ color: "#a89a7a" }}>
            No neutral armies. Create one to represent rebels, bandits, or NPC forces.
          </p>
        ) : (
          activeArmies.map((army) => (
            <ArmyCard
              key={army.id}
              army={army}
              isOwner={true}
              characters={characters}
              allArmies={activeArmies}
              allRegions={regions}
              patronDeity={null}
              courtBonuses={null}
              onChangeUnit={(id, field, delta) => updateNeutralArmyUnit(id, field, delta)}
              onChangeLevy={(id, field, delta) => updateNeutralArmyUnit(id, field, delta)}
              onChangeField={(id, field, value) => updateNeutralArmy(id, field, value)}
              onDelete={deleteNeutralArmy}
              onUpdateCommanders={updateArmyCommanders}
            />
          ))
        )}
      </div>

      {/* Neutral Characters */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h2 style={{ margin: 0 }}>Neutral Characters</h2>
          <button
            onClick={() => setIsCreatingCharacter(true)}
            className="green"
            style={{ padding: "8px 16px" }}
          >
            + Create Neutral Character
          </button>
        </div>

        {isCreatingCharacter && (
          <CharacterForm
            onSubmit={createNeutralCharacter}
            onCancel={() => setIsCreatingCharacter(false)}
            randomStats={false}
            showStats={true}
            title="New Neutral Character"
            description="Create mercenary captains, quest givers, or other NPCs."
          />
        )}

        {characters.length === 0 ? (
          <p style={{ color: "#a89a7a" }}>
            No neutral characters. Create mercenary captains, quest givers, or other NPCs.
          </p>
        ) : (
          characters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              isOwner={true}
              isGM={true}
              patronDeity={null}
              courtBonuses={null}
              armies={armies}
              onUpdateField={(id, field, value) => updateNeutralCharacter(id, field, value)}
              onDelete={deleteNeutralCharacter}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Random Events Panel Component
function RandomEventsPanel({ factionNames, onSendEvent }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [previewEvents, setPreviewEvents] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [lastSentResults, setLastSentResults] = useState(null);

  // Get faction IDs (1-8)
  const factionIds = [1, 2, 3, 4, 5, 6, 7, 8];

  // Generate random events for all factions (weighted)
  function generateRandomEvents() {
    let newEvents = {};
    
    if (selectedCategory) {
      // Filter by category
      factionIds.forEach((fId) => {
        newEvents[fId] = getRandomEventByCategory(selectedCategory);
      });
    } else {
      // Use the faction-aware generator that handles terrain exclusivity
      newEvents = getRandomEventsForFactions(factionIds);
    }
    
    setPreviewEvents(newEvents);
    setLastSentResults(null);
  }

  // Regenerate event for a single faction
  function regenerateForFaction(factionId) {
    const newEvent = selectedCategory 
      ? getRandomEventByCategory(selectedCategory)
      : getRandomEvent();
    setPreviewEvents((prev) => ({
      ...prev,
      [factionId]: newEvent,
    }));
  }

  // Send all events to players
  async function sendAllEvents() {
    if (Object.keys(previewEvents).length === 0) return;

    setIsSending(true);
    const results = [];
    
    // Collect events that need to be revealed to all
    const revealToAllEvents = [];

    for (const factionId of factionIds) {
      const event = previewEvents[factionId];
      if (event) {
        try {
          await onSendEvent({
            to: factionId,
            body: formatEventMessage(event),
            type: "event",
          });
          results.push({ factionId, success: true, event });
          
          if (event.revealToAll) {
            revealToAllEvents.push({ factionId, event });
          }
        } catch (error) {
          results.push({ factionId, success: false, error });
        }
      }
    }
    
    // Send reveal notifications to all other factions for revealToAll events
    for (const { factionId: sourceFactionId, event } of revealToAllEvents) {
      const sourceFactionName = factionNames[sourceFactionId] || `Faction ${sourceFactionId}`;
      for (const targetFactionId of factionIds) {
        if (targetFactionId !== sourceFactionId) {
          try {
            await onSendEvent({
              to: targetFactionId,
              body: ` **Public Announcement**\n\n*${event.icon} ${event.name} has occurred!*\n\n*${event.message}*\n\n*This event affects all realms.*`,
              type: "event",
            });
          } catch (error) {
            console.error(`Failed to send reveal notification to faction ${targetFactionId}`, error);
          }
        }
      }
    }

    setIsSending(false);
    setLastSentResults(results);
    setPreviewEvents({});
  }

  return (
    <div>
      <h2>[DICE] Push Random Events</h2>
      <p style={{ color: "#a89a7a", marginBottom: "20px" }}>
        Generate and send random events to all players. Each player receives a different random event.
      </p>

      {/* Category Filter */}
      <div
        className="card"
        style={{ padding: "16px", marginBottom: "20px" }}
      >
        <h3 style={{ marginTop: 0 }}>Event Category (Optional)</h3>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              padding: "8px 16px",
              background: selectedCategory === null ? "#3a3020" : "#241b15",
              border: selectedCategory === null ? "2px solid #d1b26b" : "1px solid #5e4934",
            }}
          >
            All Categories
          </button>
          {Object.entries(EVENT_CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              style={{
                padding: "8px 16px",
                background: selectedCategory === key ? "#3a3020" : "#241b15",
                border: selectedCategory === key ? `2px solid ${cat.color}` : "1px solid #5e4934",
                color: selectedCategory === key ? cat.color : undefined,
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Generate Button */}
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={generateRandomEvents}
          className="green"
          style={{ padding: "12px 24px", fontSize: "16px" }}
        >
          [DICE] Generate Random Events for All Factions
        </button>
      </div>

      {/* Preview Events */}
      {Object.keys(previewEvents).length > 0 && (
        <div className="card" style={{ padding: "16px", marginBottom: "20px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h3 style={{ margin: 0 }}>Preview Events</h3>
            <button
              onClick={sendAllEvents}
              disabled={isSending}
              className="green"
              style={{ padding: "10px 20px" }}
            >
              {isSending ? "Sending..." : " Send All Events to Players"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "12px",
            }}
          >
            {factionIds.map((fId) => {
              const event = previewEvents[fId];
              if (!event) return null;
              const catInfo = EVENT_CATEGORIES[event.category];

              return (
                <div
                  key={fId}
                  style={{
                    padding: "12px",
                    background: "#1a1410",
                    border: "1px solid #4c3b2a",
                    borderRadius: "4px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <strong>{factionNames[fId] || `Faction ${fId}`}</strong>
                    <button
                      onClick={() => regenerateForFaction(fId)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        background: "#2a2015",
                      }}
                    >
                      Reroll
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ fontSize: "20px" }}>{event.icon}</span>
                    <span style={{ fontWeight: "bold", color: catInfo?.color }}>
                      {event.name}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      background: catInfo?.color + "33",
                      color: catInfo?.color,
                      borderRadius: "4px",
                    }}
                  >
                    {catInfo?.name}
                  </span>
                  {event.revealToAll && (
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        background: "#ff6b6b33",
                        color: "#ff6b6b",
                        borderRadius: "4px",
                        marginLeft: "4px",
                      }}
                    >
                      [!] Revealed to All
                    </span>
                  )}
                  <p style={{ fontSize: "13px", color: "#c9b896", margin: "8px 0 0 0" }}>
                    {event.message}
                  </p>
                  {/* Effect display */}
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "6px",
                      background: "#0a0a08",
                      borderRadius: "4px",
                      fontSize: "12px",
                      color: "#a89a7a",
                    }}
                  >
                    <strong>Effect: </strong>
                    {event.effect.type === "gold" && (
                      <span style={{ color: event.effect.value > 0 ? "#b5e8a1" : "#ff6b6b" }}>
                        {event.effect.value > 0 ? "+" : ""}{event.effect.value} gold
                      </span>
                    )}
                    {event.effect.type === "stat_change" && (
                      <span style={{ color: event.effect.value > 0 ? "#b5e8a1" : "#ff6b6b" }}>
                        {event.effect.value > 0 ? "+" : ""}{event.effect.value} {event.effect.stat}
                      </span>
                    )}
                    {event.effect.type === "new_character" && (
                      <span style={{ color: "#b5e8a1" }}>
                        Create {event.effect.value} new character{event.effect.value > 1 ? "s" : ""}
                      </span>
                    )}
                    {event.effect.type === "kill_character" && (
                      <span style={{ color: "#ff6b6b" }}>Random character dies</span>
                    )}
                    {event.effect.type === "destroy_building" && (
                      <span style={{ color: "#ff6b6b" }}>
                        Destroy 1 {event.effect.value.join(" or ")}
                      </span>
                    )}
                    {event.effect.type === "free_upgrade" && (
                      <span style={{ color: "#b5e8a1" }}>Free Farm Level 2 upgrade</span>
                    )}
                    {event.effect.type === "gain_region" && (
                      <span style={{ color: "#b5e8a1" }}>Gain adjacent uncontrolled region</span>
                    )}
                    {event.effect.type === "spawn_army" && (
                      <span style={{ color: "#ff6b6b" }}>GM spawns hostile forces</span>
                    )}
                    {event.effect.type === "terrain_modifier" && (
                      <span style={{ color: "#3498db" }}>
                        {event.effect.value === "rivers_crossable" 
                          ? "Rivers crossable this turn" 
                          : "Bridges impassable this turn"}
                      </span>
                    )}
                    {event.effect.type === "none" && (
                      <span style={{ color: "#666" }}>No mechanical effect</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Last Sent Results */}
      {lastSentResults && (
        <div
          className="card"
          style={{
            padding: "16px",
            background: "#1a2a1a",
            border: "1px solid #2a4a2a",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", color: "#b5e8a1" }}>
            âœ… Events Sent Successfully!
          </h3>
          <div style={{ fontSize: "13px" }}>
            {lastSentResults.map((result) => (
              <div key={result.factionId} style={{ marginBottom: "4px" }}>
                <strong>{factionNames[result.factionId] || `Faction ${result.factionId}`}</strong>
                {" â†’ "}
                {result.success ? (
                  <span style={{ color: "#b5e8a1" }}>
                    {result.event.icon} {result.event.name}
                  </span>
                ) : (
                  <span style={{ color: "#ff4444" }}>Failed to send</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Reference */}
      <details style={{ marginTop: "24px" }}>
        <summary style={{ cursor: "pointer", color: "#a89a7a", marginBottom: "12px" }}>
           View All Available Events ({RANDOM_EVENTS.length} total)
        </summary>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "8px",
            marginTop: "12px",
          }}
        >
          {RANDOM_EVENTS.map((event) => {
            const catInfo = EVENT_CATEGORIES[event.category];
            return (
              <div
                key={event.id}
                style={{
                  padding: "8px",
                  background: "#1a1410",
                  border: "1px solid #3c2b1a",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>{event.icon}</span>
                    <strong style={{ color: catInfo?.color }}>{event.name}</strong>
                  </div>
                  <span style={{ color: "#666", fontSize: "10px" }}>{event.weight}%</span>
                </div>
                <p style={{ margin: "4px 0 0 0", color: "#a89a7a" }}>{event.message}</p>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

// Main GM Panel Component
export default function GMPanel() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("factions");
  const [role, setRole] = useState(null);

  // Data states
  const [regions, setRegions] = useState([]);
  const [factionData, setFactionData] = useState({});
  const [factionNames, setFactionNames] = useState({});
  const [armies, setArmies] = useState([]);
  const [neutralArmies, setNeutralArmies] = useState([]);
  const [neutralCharacters, setNeutralCharacters] = useState([]);
  const [agents, setAgents] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [courtPositions, setCourtPositions] = useState([]);

  // Region creation states
  const [newRegionName, setNewRegionName] = useState("");
  const [newRegionCode, setNewRegionCode] = useState("");
  const [newRegionOwner, setNewRegionOwner] = useState(1);

  // GM Mailbox states
  const [gmMessages, setGmMessages] = useState([]);

  // Check role
  useEffect(() => {
    const r = localStorage.getItem("role");
    if (r !== "gm") {
      navigate("/");
    } else {
      setRole(r);
    }
  }, [navigate]);

  // Load regions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "regions"), (snap) => {
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRegions(list);
    });
    return () => unsub();
  }, []);

  // Load faction data
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "factions"), (snap) => {
      const data = {};
      const names = {};
      snap.docs.forEach((doc) => {
        const factionInfo = doc.data();
        const factionId = doc.id;
        if (factionId !== "neutral") {
          data[factionId] = factionInfo;
          names[factionId] = factionInfo.name || `Faction ${factionId}`;
        }
      });
      setFactionData(data);
      setFactionNames(names);
    });
    return () => unsub();
  }, []);

  // Load all armies
  useEffect(() => {
    const unsubscribers = [];

    // Load faction armies
    for (let factionId = 1; factionId <= 8; factionId++) {
      const unsub = onSnapshot(
        collection(db, "factions", String(factionId), "armies"),
        (snap) => {
          const factionArmies = snap.docs.map((doc) => ({
            id: doc.id,
            factionId: factionId,
            ...doc.data(),
          }));

          setArmies((prev) => {
            const otherArmies = prev.filter((a) => a.factionId !== factionId);
            return [...otherArmies, ...factionArmies];
          });
        }
      );
      unsubscribers.push(unsub);
    }

    // Load neutral armies
    const neutralUnsub = onSnapshot(
      collection(db, "factions", "neutral", "armies"),
      (snap) => {
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNeutralArmies(list);
      }
    );
    unsubscribers.push(neutralUnsub);

    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  // Load neutral characters
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "factions", "neutral", "characters"),
      (snap) => {
        const list = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNeutralCharacters(list);
      }
    );
    return () => unsub();
  }, []);

  // Load agents
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => {
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAgents(list);
    });
    return () => unsub();
  }, []);

  // Load ALL characters across all factions
  useEffect(() => {
    const unsubscribers = [];

    for (let factionId = 1; factionId <= 8; factionId++) {
      const unsub = onSnapshot(
        collection(db, "factions", String(factionId), "characters"),
        (snap) => {
          const factionChars = snap.docs.map((doc) => ({
            id: doc.id,
            factionId: factionId,
            ...doc.data(),
          }));

          setAllCharacters((prev) => {
            const otherChars = prev.filter((c) => c.factionId !== factionId);
            return [...otherChars, ...factionChars];
          });
        }
      );
      unsubscribers.push(unsub);
    }

    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  // Load court positions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "court"), (snap) => {
      const positions = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setCourtPositions(positions);
    });
    return () => unsub();
  }, []);

  // Load GM messages (messages sent to GM)
  useEffect(() => {
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, where("toFactionId", "==", 0), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setGmMessages(msgs);
    });
    return () => unsub();
  }, []);

  // GM message functions
  async function sendGmMessage({ to, body, type = "gm" }) {
    try {
      await addDoc(collection(db, "messages"), {
        fromFactionId: 0,
        fromFactionName: "Game Master",
        toFactionId: Number(to),
        toType: "faction",
        body: body,
        createdAt: new Date(),
        read: false,
        type: type,
      });
    } catch (error) {
      console.error("Error sending GM message:", error);
    }
  }

  async function markGmMessageRead(messageId) {
    await updateDoc(doc(db, "messages", messageId), { read: true });
  }

  async function deleteGmMessage(messageId) {
    try {
      await deleteDoc(doc(db, "messages", messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  }

  const gmUnreadCount = gmMessages.filter((m) => !m.read).length;

  // Create region function
  async function createRegion() {
    if (!newRegionName.trim()) return;

    const terrain = newRegionCode
      ? getTerrainFromMapPosition(newRegionCode.toUpperCase())
      : TERRAIN_TYPES.PLAINS;

    await addDoc(collection(db, "regions"), {
      name: newRegionName,
      code: newRegionCode.toUpperCase(),
      owner: Number(newRegionOwner),
      terrain: terrain,
      upgrades: [],
    });

    setNewRegionName("");
    setNewRegionCode("");
  }

  if (!role) {
    return (
      <div className="container">
        <p>Loading...</p>
      </div>
    );
  }

  const tabs = [
    { id: "factions", label: "Factions" },
    { id: "regions", label: "Regions" },
    { id: "neutral", label: "Neutral Forces" },
    { id: "missions", label: "Missions" },
    { id: "events", label: "Push Events" },
    { id: "court", label: "Court" },
    {
      id: "mailbox",
      label: "Mailbox",
      badge: gmUnreadCount > 0 ? gmUnreadCount : null,
    },
  ];

  return (
    <div className="container">
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h1 style={{ margin: 0 }}> Game Master Panel</h1>
        <button
          onClick={() => {
            localStorage.removeItem("role");
            localStorage.removeItem("factionId");
            navigate("/");
          }}
        >
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px",
              background: activeTab === tab.id ? "#3a3020" : "#241b15",
              border: activeTab === tab.id ? "2px solid #d1b26b" : "1px solid #5e4934",
              position: "relative",
            }}
          >
            {tab.label}
            {tab.badge && (
              <span
                style={{
                  position: "absolute",
                  top: "-8px",
                  right: "-8px",
                  background: "#d4a32c",
                  color: "#000",
                  fontSize: "11px",
                  fontWeight: "bold",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  minWidth: "18px",
                  textAlign: "center",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* FACTIONS TAB */}
      {activeTab === "factions" && (
        <div>
          <h2>All Factions Overview</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
              gap: "16px",
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((fId) => (
              <FactionCard
                key={fId}
                factionId={fId}
                factionData={factionData}
                regions={regions}
                armies={armies}
                agents={agents}
                courtPositions={courtPositions}
                onNavigate={navigate}
              />
            ))}
          </div>
        </div>
      )}

      {/* REGIONS TAB */}
      {activeTab === "regions" && (
        <div>
          <div
            className="card"
            style={{
              marginBottom: "24px",
              padding: "16px",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Create New Region</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 150px auto",
                gap: "12px",
                alignItems: "end",
              }}
            >
              <div>
                <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>
                  Region Name
                </label>
                <input
                  type="text"
                  value={newRegionName}
                  onChange={(e) => setNewRegionName(e.target.value)}
                  placeholder="e.g., Northwind Plains"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>
                  Map Code
                </label>
                <input
                  type="text"
                  value={newRegionCode}
                  onChange={(e) => setNewRegionCode(e.target.value)}
                  placeholder="e.g., A1"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>
                  Owner
                </label>
                <select
                  value={newRegionOwner}
                  onChange={(e) => setNewRegionOwner(e.target.value)}
                  style={{ width: "100%" }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
                    <option key={f} value={f}>
                      {factionNames[f] || `Faction ${f}`}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={createRegion} className="green">
                Create Region
              </button>
            </div>
          </div>

          <h2>All Regions</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
              gap: "16px",
            }}
          >
            {regions
              .sort((a, b) => (a.code || "").localeCompare(b.code || ""))
              .map((region) => {
                const ownerFaction = factionData[region.owner];
                const patronDeity = ownerFaction?.patronDeity;
                const factionRegions = regions.filter((r) => r.owner === region.owner);
                const eco = calculateEconomy(factionRegions, patronDeity);

                return (
                  <RegionCard
                    key={region.id}
                    region={region}
                    eco={eco}
                    role="gm"
                    myFactionId={null}
                    patronDeity={patronDeity}
                    capital={ownerFaction?.capital}
                  />
                );
              })}
          </div>
        </div>
      )}

      {/* NEUTRAL FORCES TAB */}
      {activeTab === "neutral" && (
        <NeutralForces
          armies={neutralArmies}
          characters={neutralCharacters}
          courtPositions={courtPositions}
          regions={regions}
          onNavigate={navigate}
        />
      )}

      {/* MISSIONS TAB */}
      {activeTab === "missions" && (
        <GMMissionPanel
          allAgents={agents}
          allRegions={regions}
          allCharacters={allCharacters}
          factionNames={factionNames}
        />
      )}

      {/* EVENTS TAB */}
      {activeTab === "events" && (
        <RandomEventsPanel
          factionNames={factionNames}
          onSendEvent={sendGmMessage}
        />
      )}

      {/* COURT TAB */}
      {activeTab === "court" && (
        <Court isGM={true} myFactionId={null} factionNames={factionNames} patronDeity={null} />
      )}

      {/* MAILBOX TAB */}
      {activeTab === "mailbox" && (
        <Mailbox
          messages={gmMessages}
          recipients={factionNames}
          senderName="Game Master"
          myFactionId={0}
          onSend={sendGmMessage}
          onMarkRead={markGmMessageRead}
          onDelete={deleteGmMessage}
          isGM={true}
          canCompose={true}
        />
      )}
    </div>
  );
}