import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { db } from "../firebase/config";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  onSnapshot as onDocSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import RegionCard from "../components/RegionCard";
import ArmyCard from "../components/ArmyCard";
import CharacterCard from "../components/CharacterCard";
import CharacterForm from "../components/CharacterForm";
import Court from "../components/Court";
import AgentMissions from "../components/AgentMissions";
import { Mailbox } from "../components/MessageSystem";
import { getAuthState } from "../utils/auth";
import { BUILDING_RULES } from "../config/buildingRules";
import { DEITIES } from "../config/religionRules";
import { TERRAIN_TYPES } from "../config/terrainRules";
import { getCourtBonuses, getMaxArmyCap, canRaiseAgentWithCourt } from "../config/courtPositions";
import {
  calculateEconomy,
  getModifiedUpkeep,
  AGENT_UPKEEP,
  LEVY_UPKEEP_PER_UNIT,
} from "../utils/economyCalculations";

/* -------------------------------------------------------
   TOAST SYSTEM
-------------------------------------------------------- */

function Toast({ toasts, remove }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <div className="toast-title">{t.title}</div>
          <div>{t.message}</div>
          <button
            className="small"
            style={{ marginTop: 6 }}
            onClick={() => remove(t.id)}
          >
            Close
          </button>
        </div>
      ))}
    </div>
  );
}

function useToasts() {
  const [toasts, setToasts] = useState([]);

  function show(title, message) {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }

  function remove(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return { toasts, show, remove };
}

/* -------------------------------------------------------
   CONSTANTS
-------------------------------------------------------- */

const DEFAULT_CRESTS = {
  "1": "/faction1.png",
  "2": "/holmes.png",
  "3": "/faction3-1.png",
  "4": "/faction4.png",
  "5": "/faction5.png",
  "6": "/faction6.png",
  "7": "/stanford.png",
  "8": "/faction8.png",
};

/* -------------------------------------------------------
   MAIN COMPONENT
-------------------------------------------------------- */

export default function Faction() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { toasts, show, remove } = useToasts();

  const [regions, setRegions] = useState([]);
  const [allRegions, setAllRegions] = useState([]);
  const [eco, setEco] = useState(null);
  const [activeTab, setActiveTab] = useState("regions");
  const [agentSubTab, setAgentSubTab] = useState("roster");

  const [factionData, setFactionData] = useState(null);
  const [armies, setArmies] = useState([]);

  const [agents, setAgents] = useState([]);
  const [allAgents, setAllAgents] = useState([]);
  const [newAgentType, setNewAgentType] = useState("spy");
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentLocation, setNewAgentLocation] = useState("");

  const [characters, setCharacters] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [allArmies, setAllArmies] = useState([]);
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);

  const [patronDeity, setPatronDeity] = useState(null);

  const [role, setRole] = useState(null);
  const [myFactionId, setMyFactionId] = useState(null);

  const [isEditingFactionName, setIsEditingFactionName] = useState(false);
  const [editedFactionName, setEditedFactionName] = useState("");

  const [factionCrest, setFactionCrest] = useState(null);

  const [courtPositions, setCourtPositions] = useState([]);
  const [allFactionNames, setAllFactionNames] = useState({});

  // Mailbox state
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const auth = getAuthState();

    if (!auth) {
      navigate("/");
      return;
    }

    setRole(auth.role);
    setMyFactionId(auth.factionId);

    if (auth.role === "gm") return;

    if (auth.role === "faction" && auth.factionId !== Number(id)) {
      navigate(`/faction/${auth.factionId}`);
    }
  }, [id, navigate]);

  const isGM = role === "gm";
  const isOwnerView = (role === "faction" && myFactionId === Number(id)) || isGM;
  const canEditAgents = isOwnerView || isGM;

  // Load faction regions
  useEffect(() => {
    const q = query(collection(db, "regions"), where("owner", "==", Number(id)));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRegions(list);
    });

    return () => unsub();
  }, [id]);

  // Load ALL faction names for Court
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "factions"), (snap) => {
      const names = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        names[doc.id] = data.name || `Faction ${doc.id}`;
      });
      setAllFactionNames(names);
    });
    return () => unsub();
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

  // Load mailbox messages for this faction
  useEffect(() => {
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, where("toFactionId", "==", Number(id)));

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      msgs.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      setMessages(msgs);
    });
    return () => unsub();
  }, [id]);

  // Get court bonuses for current faction
  const courtBonuses = useMemo(() => {
    return getCourtBonuses(courtPositions, Number(id));
  }, [courtPositions, id]);

  // Calculate economy using shared function
  useEffect(() => {
    if (regions.length > 0 || patronDeity) {
      let baseEco = calculateEconomy(regions, patronDeity);
      baseEco.goldPerTurn += courtBonuses.gold;
      baseEco.courtBonuses = courtBonuses.positions;
      setEco(baseEco);
    }
  }, [regions, patronDeity, courtBonuses]);

  // Load all regions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "regions"), (snap) => {
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAllRegions(list);
    });

    return () => unsub();
  }, []);

  // Load faction data
  useEffect(() => {
    const ref = doc(db, "factions", String(id));
    const unsub = onDocSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        const defaultData = {
          navy: { warships: 0 },
          crest: DEFAULT_CRESTS[String(id)] || null,
        };
        setDoc(ref, defaultData);
        setFactionData(defaultData);
        setFactionCrest(DEFAULT_CRESTS[String(id)] || null);
      } else {
        const data = snap.data();
        setFactionData({
          navy: { warships: 0, ...(data.navy || {}) },
          name: data.name || "",
          patronDeity: data.patronDeity || null,
          crest: data.crest || DEFAULT_CRESTS[String(id)] || null,
          capital: data.capital || null,
        });
        setPatronDeity(data.patronDeity || null);
        setEditedFactionName(data.name || "");
        setFactionCrest(data.crest || DEFAULT_CRESTS[String(id)] || null);
      }
    });

    return () => unsub();
  }, [id]);

  // Load armies
  useEffect(() => {
    const armiesRef = collection(db, "factions", String(id), "armies");
    const unsub = onSnapshot(armiesRef, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setArmies(list);
    });
    return () => unsub();
  }, [id]);

  // Load all armies across factions
  useEffect(() => {
    const unsubscribers = [];

    for (let factionId = 1; factionId <= 8; factionId++) {
      const unsub = onSnapshot(
        collection(db, "factions", String(factionId), "armies"),
        (snap) => {
          const factionArmies = snap.docs.map((d) => ({
            id: d.id,
            factionId: factionId,
            ...d.data(),
          }));

          setAllArmies((prev) => {
            const otherArmies = prev.filter((a) => a.factionId !== factionId);
            return [...otherArmies, ...factionArmies];
          });
        }
      );
      unsubscribers.push(unsub);
    }

    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  // Faction name functions
  async function saveFactionName() {
    if (!isOwnerView) return;
    const ref = doc(db, "factions", String(id));
    await updateDoc(ref, { name: editedFactionName });
    setIsEditingFactionName(false);
    show("Faction Renamed", `Faction is now called "${editedFactionName || `Faction ${id}`}"`);
  }

  function cancelEditFactionName() {
    setEditedFactionName(factionData?.name || "");
    setIsEditingFactionName(false);
  }

  async function setCapital(regionCode) {
    if (!isOwnerView) return;
    if (factionData?.capital) {
      show("Capital Already Set", "Your capital has already been established and cannot be changed.");
      return;
    }
    const ref = doc(db, "factions", String(id));
    await updateDoc(ref, { capital: regionCode });
    show("Capital Established", `Your capital has been established at [${regionCode}]. This cannot be changed.`);
  }

  // Mailbox functions using shared component
  async function sendMessage({ to, body }) {
    const myFactionName = factionData?.name || `Faction ${id}`;

    try {
      await addDoc(collection(db, "messages"), {
        fromFactionId: Number(id),
        fromFactionName: myFactionName,
        toFactionId: to === "gm" ? 0 : Number(to),
        toType: to === "gm" ? "gm" : "faction",
        body: body,
        createdAt: new Date(),
        read: false,
        type: "message",
      });
      show("Message Sent", "Your raven has taken flight.");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  async function markMessageRead(messageId) {
    await updateDoc(doc(db, "messages", messageId), { read: true });
  }

  async function deleteMessage(messageId) {
    await deleteDoc(doc(db, "messages", messageId));
  }

  const unreadCount = messages.filter((m) => !m.read).length;

  // Build recipient list for mailbox
  const messageRecipients = useMemo(() => {
    const recipients = { gm: "Game Master" };
    Object.entries(allFactionNames).forEach(([fId, name]) => {
      if (fId !== String(id) && fId !== "neutral") {
        recipients[fId] = name;
      }
    });
    return recipients;
  }, [allFactionNames, id]);

  // Army functions
  async function createArmy() {
    if (!isOwnerView) return;
    const armiesRef = collection(db, "factions", String(id), "armies");
    const defaultName = `Army ${armies.length + 1}`;
    await addDoc(armiesRef, {
      name: defaultName,
      location: "",
      huscarls: 0,
      dismountedKnights: 0,
      mountedKnights: 0,
      lightHorse: 0,
      levyInfantry: 0,
      levyArchers: 0,
      commanders: [],
    });
  }

  async function deleteArmy(armyId) {
    if (!isOwnerView) return;
    const ref = doc(db, "factions", String(id), "armies", armyId);
    await updateDoc(ref, { deleted: true });
  }

  async function changeArmyField(armyId, field, value) {
    if (!isOwnerView) return;
    const ref = doc(db, "factions", String(id), "armies", armyId);
    await updateDoc(ref, { [field]: value });
  }

  async function changeArmyUnit(armyId, field, delta) {
    if (!isOwnerView) return;
    const army = armies.find((a) => a.id === armyId);
    const current = army[field] || 0;
    const next = Math.max(0, current + delta);
    const ref = doc(db, "factions", String(id), "armies", armyId);
    await updateDoc(ref, { [field]: next });
  }

  const totalLevyInfantryUnits = useMemo(
    () => armies.reduce((sum, a) => sum + (a.levyInfantry || 0), 0),
    [armies]
  );

  const totalLevyArcherUnits = useMemo(
    () => armies.reduce((sum, a) => sum + (a.levyArchers || 0), 0),
    [armies]
  );

  async function changeArmyLevy(armyId, field, delta) {
    if (!isOwnerView) return;

    const army = armies.find((a) => a.id === armyId);
    const current = army[field] || 0;
    const next = Math.max(0, current + delta);

    const newTotalInf = totalLevyInfantryUnits + (field === "levyInfantry" ? next - current : 0);
    const newTotalArch = totalLevyArcherUnits + (field === "levyArchers" ? next - current : 0);

    const levyInfPotential = eco?.levyInfantry || 0;
    const levyArchPotential = eco?.levyArchers || 0;

    const levyInfUnits = Math.floor(levyInfPotential / 10);
    const levyArchUnits = Math.floor(levyArchPotential / 10);

    if (field === "levyInfantry" && newTotalInf > levyInfUnits) {
      window.alert(`Cannot raise more levy infantry.\n\nCurrent: ${totalLevyInfantryUnits} / ${levyInfUnits}`);
      return;
    }

    if (field === "levyArchers" && newTotalArch > levyArchUnits) {
      window.alert(`Cannot raise more levy archers.\n\nCurrent: ${totalLevyArcherUnits} / ${levyArchUnits}`);
      return;
    }

    const ref = doc(db, "factions", String(id), "armies", armyId);
    await updateDoc(ref, { [field]: next });
  }

  async function updateArmyCommanders(armyId, commanderIds) {
    if (!isOwnerView) return;

    try {
      const army = armies.find((a) => a.id === armyId);
      const oldCommanders = army?.commanders || [];
      const removedCommanders = oldCommanders.filter((cmdId) => !commanderIds.includes(cmdId));

      const armyRef = doc(db, "factions", String(id), "armies", armyId);
      await updateDoc(armyRef, { commanders: commanderIds });

      const capital = factionData?.capital;
      for (const cmdId of removedCommanders) {
        const charRef = doc(db, "factions", String(id), "characters", cmdId);
        await updateDoc(charRef, { location: capital || null });
      }
    } catch (error) {
      console.error("Error updating commanders:", error);
      alert("Failed to save commanders. Please try again.");
    }
  }

  async function changeWarships(delta) {
    if (!isOwnerView || !factionData) return;
    const ref = doc(db, "factions", String(id));
    const current = factionData.navy?.warships || 0;
    const next = Math.max(0, current + delta);
    await updateDoc(ref, { "navy.warships": next });
  }

  // Agent functions
  useEffect(() => {
    const agentsRef = collection(db, "agents");
    const qAgents = query(agentsRef, where("factionId", "==", Number(id)));
    const unsub = onSnapshot(qAgents, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAgents(list);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAllAgents(list);
    });
    return () => unsub();
  }, []);

  const townCount = eco?.townCount || 0;
  const cityCount = eco?.cityCount || 0;
  const maxAgents = townCount * 1 + cityCount * 2;
  const activeAgents = agents.filter((a) => !a.deleted);
  const agentsCount = activeAgents.length;

  const totalAgentUpkeep = activeAgents.reduce((sum, a) => {
    const baseUpkeep = AGENT_UPKEEP[a.type] || 0;
    return sum + getModifiedUpkeep(a.type, baseUpkeep, patronDeity);
  }, 0);

  async function handleHireAgent(e) {
    e.preventDefault();
    if (!canEditAgents) return;

    const deity = patronDeity ? DEITIES[patronDeity] : null;
    const canHire = canRaiseAgentWithCourt(agentsCount, maxAgents, courtBonuses);

    if (!canHire) {
      show("Agent Cap Reached", `You've met your agent cap (${agentsCount}/${maxAgents})!`);
      return;
    }

    const type = newAgentType;
    const name =
      newAgentName.trim() ||
      (type === "spy" ? "Unnamed Spy" : type === "agitator" ? "Unnamed Agitator" : "Unnamed Enforcer");

    const startingLevel = deity?.bonuses.agentStartLevel && patronDeity === "comnea" ? 2 : 1;

    const agentsRef = collection(db, "agents");
    await addDoc(agentsRef, {
      factionId: Number(id),
      name,
      type,
      level: startingLevel,
      location: newAgentLocation || "",
    });

    show("Agent Hired", `${name} (${type}) hired${startingLevel > 1 ? " at level 2" : ""}.`);

    setNewAgentName("");
    setNewAgentLocation("");
  }

  async function updateAgentField(agentId, field, value) {
    if (!canEditAgents) return;
    const ref = doc(db, "agents", agentId);
    await updateDoc(ref, { [field]: value });
  }

  async function deleteAgent(agentId) {
    if (!canEditAgents) return;
    if (!window.confirm("Dismiss this agent?")) return;
    await deleteDoc(doc(db, "agents", agentId));
    show("Agent Dismissed", "The agent has been removed.");
  }

  // Character functions
  useEffect(() => {
    const charactersRef = collection(db, "factions", String(id), "characters");
    const unsub = onSnapshot(charactersRef, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setCharacters(list);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    const unsubscribers = [];

    for (let factionId = 1; factionId <= 8; factionId++) {
      const unsub = onSnapshot(collection(db, "factions", String(factionId), "characters"), (snap) => {
        const factionChars = snap.docs.map((d) => ({
          id: d.id,
          factionId: factionId,
          ...d.data(),
        }));

        setAllCharacters((prev) => {
          const otherChars = prev.filter((c) => c.factionId !== factionId);
          return [...otherChars, ...factionChars];
        });
      });
      unsubscribers.push(unsub);
    }

    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  async function handleAddCharacter(charData) {
    if (!isOwnerView) return;

    const charactersRef = collection(db, "factions", String(id), "characters");
    await addDoc(charactersRef, charData);

    show("Character Created", `${charData.firstName} ${charData.lastName} has joined your house.`);
    setIsAddingCharacter(false);
  }

  async function updateCharacterField(charId, field, value) {
    const ref = doc(db, "factions", String(id), "characters", charId);
    await updateDoc(ref, { [field]: value });
  }

  async function deleteCharacter(charId) {
    if (!window.confirm("Remove this character?")) return;
    await deleteDoc(doc(db, "factions", String(id), "characters", charId));
  }

  // Religion functions
  async function changePatronDeity(deityKey) {
    if (!isOwnerView) return;
    const ref = doc(db, "factions", String(id));
    await updateDoc(ref, { patronDeity: deityKey });

    if (deityKey) {
      show("Patron Deity Changed", `${DEITIES[deityKey].name} now watches over your realm.`);
    } else {
      show("Patron Deity Removed", "Your realm no longer follows a patron deity.");
    }
  }

  // Army cap from court
  const maxArmyCap = getMaxArmyCap(3, courtBonuses);

  // HSG calculations
  const hsgUsed = useMemo(() => {
    return armies.reduce((sum, a) => {
      if (a.deleted) return sum;
      return sum + (a.huscarls || 0) + (a.dismountedKnights || 0) + (a.mountedKnights || 0) + (a.lightHorse || 0);
    }, 0);
  }, [armies]);

  const hsgCap = eco?.hsgCap || 0;
  const overCap = hsgUsed * 10 > hsgCap;

  // Gold calculations
  const warships = factionData?.navy?.warships || 0;
  const deity = patronDeity ? DEITIES[patronDeity] : null;

  const hsgGoldUpkeep = useMemo(() => {
    return armies.reduce((sum, a) => {
      if (a.deleted) return sum;
      return (
        sum +
        (a.huscarls || 0) * getModifiedUpkeep("huscarls", 2, patronDeity) +
        (a.dismountedKnights || 0) * getModifiedUpkeep("dismountedKnights", 3, patronDeity) +
        (a.mountedKnights || 0) * getModifiedUpkeep("mountedKnights", 4, patronDeity) +
        (a.lightHorse || 0) * 2
      );
    }, 0);
  }, [armies, patronDeity]);

  const levyGoldUpkeep = useMemo(() => {
    return Math.floor((totalLevyInfantryUnits + totalLevyArcherUnits) * LEVY_UPKEEP_PER_UNIT);
  }, [totalLevyInfantryUnits, totalLevyArcherUnits]);

  const navyGoldUpkeep = warships * getModifiedUpkeep("warships", 3, patronDeity);

  const netGoldPerTurn = (eco?.goldPerTurn || 0) - hsgGoldUpkeep - levyGoldUpkeep - navyGoldUpkeep - totalAgentUpkeep;

  const goldNegative = netGoldPerTurn < 0;

  const levyInfPotential = eco?.levyInfantry || 0;
  const levyArchPotential = eco?.levyArchers || 0;

  // Agent card renderer
  function renderAgentCard(agent) {
    const baseUpkeep = AGENT_UPKEEP[agent.type] || 0;
    const modifiedUpkeep = getModifiedUpkeep(agent.type, baseUpkeep, patronDeity);

    return (
      <div
        key={agent.id}
        className="card"
        style={{
          marginBottom: 12,
          padding: 12,
          background: agent.revealed ? "#3a2a1a" : "#201712",
          border: agent.revealed ? "1px solid #8b6b3a" : "1px solid #4c3b2a",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              {canEditAgents ? (
                <input
                  type="text"
                  value={agent.name}
                  onChange={(e) => updateAgentField(agent.id, "name", e.target.value)}
                  style={{
                    fontWeight: "bold",
                    fontSize: 15,
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid #5e4934",
                    color: "#f4efe4",
                    padding: "2px 4px",
                    width: "auto",
                    minWidth: 120,
                  }}
                />
              ) : (
                <strong style={{ fontSize: 15 }}>{agent.name}</strong>
              )}
              <span
                style={{
                  fontSize: 12,
                  color: agent.type === "spy" ? "#9d7dd1" : agent.type === "agitator" ? "#d17d7d" : "#7dd1a3",
                  textTransform: "capitalize",
                  padding: "2px 8px",
                  background: "#1a1410",
                  borderRadius: 4,
                }}
              >
                {agent.type}
              </span>
              {agent.revealed && (
                <span
                  style={{
                    fontSize: 11,
                    color: "#f97316",
                    padding: "2px 6px",
                    background: "#3a1a0a",
                    borderRadius: 4,
                    border: "1px solid #8b4513",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  REVEALED
                  {isGM && (
                    <button
                      onClick={() => updateAgentField(agent.id, "revealed", false)}
                      style={{
                        padding: "1px 4px",
                        fontSize: 9,
                        background: "#4a3020",
                        border: "1px solid #6b4530",
                        borderRadius: 3,
                        color: "#f4efe4",
                        cursor: "pointer",
                        marginLeft: 2,
                      }}
                      title="Hide agent (remove revealed status)"
                    >
                      [OK]
                    </button>
                  )}
                </span>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 16,
                fontSize: 13,
                color: "#c7bca5",
              }}
            >
              <span>
                Level:{" "}
                {canEditAgents ? (
                  <select
                    value={agent.level || 1}
                    onChange={(e) => updateAgentField(agent.id, "level", Number(e.target.value))}
                    style={{
                      padding: "2px 6px",
                      background: "#241b15",
                      border: "1px solid #5e4934",
                      borderRadius: 4,
                      color: "#f4efe4",
                      fontSize: 13,
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                ) : (
                  <strong>{agent.level || 1}</strong>
                )}
              </span>
              <span>
                Location:{" "}
                {canEditAgents ? (
                  <select
                    value={agent.location || ""}
                    onChange={(e) => updateAgentField(agent.id, "location", e.target.value)}
                    style={{
                      padding: "2px 6px",
                      background: "#241b15",
                      border: "1px solid #5e4934",
                      borderRadius: 4,
                      color: "#f4efe4",
                      fontSize: 13,
                      maxWidth: 150,
                    }}
                  >
                    <option value="">Unknown</option>
                    {allRegions
                      .sort((a, b) => (a.code || "").localeCompare(b.code || ""))
                      .map((r) => (
                        <option key={r.id} value={r.code || r.id}>
                          [{r.code}] {r.name}
                        </option>
                      ))}
                  </select>
                ) : (
                  <strong>{agent.location || "Unknown"}</strong>
                )}
              </span>
            </div>
          </div>

          {canEditAgents && (
            <button
              onClick={() => deleteAgent(agent.id)}
              style={{
                padding: "4px 8px",
                fontSize: 11,
                background: "#3a1a1a",
                border: "1px solid #5a2a2a",
                color: "#ff6b6b",
              }}
            >
              Dismiss
            </button>
          )}
        </div>

        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid #3a2f24",
            fontSize: 12,
            color: "#a89a7a",
          }}
        >
          Upkeep: {modifiedUpkeep}g/turn
          {modifiedUpkeep !== baseUpkeep && <span style={{ color: "#b5e8a1" }}> (deity bonus)</span>}
        </div>
      </div>
    );
  }

  // Render characters tab
  function renderCharactersTab() {
    return (
      <>
        {isOwnerView && (
          <>
            {!isAddingCharacter ? (
              <button onClick={() => setIsAddingCharacter(true)} className="green" style={{ marginBottom: 16 }}>
                + Add Character
              </button>
            ) : (
              <CharacterForm
                onSubmit={handleAddCharacter}
                onCancel={() => setIsAddingCharacter(false)}
                randomStats={true}
                showStats={false}
                title="New House Member"
              />
            )}
          </>
        )}

        {characters.length === 0 && <p style={{ color: "#c7bca5" }}>No characters yet. Create your first!</p>}

        {characters.map((char) => (
          <CharacterCard
            key={char.id}
            character={char}
            isOwner={isOwnerView}
            isGM={isGM}
            patronDeity={patronDeity}
            courtBonuses={courtBonuses}
            armies={armies}
            onUpdateField={updateCharacterField}
            onDelete={deleteCharacter}
          />
        ))}
      </>
    );
  }

  // Render religion tab
  function renderReligionTab() {
    const currentDeity = patronDeity ? DEITIES[patronDeity] : null;

    return (
      <>
        <div className="summary-row">
          <div className="summary-card">
            <h3>Current Patron</h3>
            <p>
              <strong style={{ fontSize: 18 }}>{currentDeity?.name || "None"}</strong>
            </p>
            {currentDeity && (
              <p style={{ fontSize: 12, color: "#c7bca5" }}>{currentDeity.title}</p>
            )}
          </div>

          {deity && eco?.deityBonuses && (
            <div className="summary-card">
              <h3>Active Regional Bonuses</h3>
              {deity.bonuses.riverGold && eco.deityBonuses.riverRegions > 0 && (
                <p style={{ fontSize: 12, color: "#b5e8a1" }}>
                  +{eco.deityBonuses.riverRegions} gold from {eco.deityBonuses.riverRegions} river region(s)
                </p>
              )}
              {deity.bonuses.coastalGold && eco.deityBonuses.coastalRegions > 0 && (
                <p style={{ fontSize: 12, color: "#b5e8a1" }}>
                  +{eco.deityBonuses.coastalRegions * 2} gold from {eco.deityBonuses.coastalRegions} coastal region(s)
                </p>
              )}
              {deity.bonuses.mountainGold && eco.deityBonuses.mountainRegions > 0 && (
                <p style={{ fontSize: 12, color: "#b5e8a1" }}>
                  +{eco.deityBonuses.mountainRegions * 3} gold from {eco.deityBonuses.mountainRegions} mountain region(s)
                </p>
              )}
              {deity.bonuses.mountainHillsGold && (eco.deityBonuses.mountainRegions + eco.deityBonuses.hillsRegions > 0) && (
                <p style={{ fontSize: 12, color: "#b5e8a1" }}>
                  +{eco.deityBonuses.mountainRegions + eco.deityBonuses.hillsRegions} gold from mountains/hills
                </p>
              )}
              {deity.bonuses.mineGold && eco.deityBonuses.mines > 0 && (
                <p style={{ fontSize: 12, color: "#b5e8a1" }}>
                  +{eco.deityBonuses.mines} gold from {eco.deityBonuses.mines} mine(s)
                </p>
              )}
            </div>
          )}
        </div>

        {isOwnerView && (
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Choose Patron Deity</h3>
            <p style={{ fontSize: 12, color: "#c7bca5", marginTop: 0 }}>
              Select a deity to receive their divine blessings. This can be changed at any time.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              <button
                onClick={() => changePatronDeity(null)}
                style={{
                  padding: "10px 16px",
                  background: !patronDeity ? "#3a3020" : "#241b15",
                  border: !patronDeity ? "2px solid #d1b26b" : "1px solid #5e4934",
                  textAlign: "left",
                }}
              >
                <strong>None</strong>
                <br />
                <span style={{ fontSize: 11, color: "#a89a7a" }}>No patron deity</span>
              </button>
              {Object.entries(DEITIES).map(([key, d]) => (
                <button
                  key={key}
                  onClick={() => changePatronDeity(key)}
                  style={{
                    padding: "10px 16px",
                    background: patronDeity === key ? "#3a3020" : "#241b15",
                    border: patronDeity === key ? "2px solid #d1b26b" : "1px solid #5e4934",
                    textAlign: "left",
                  }}
                >
                  <strong>{d.name}</strong>
                  <br />
                  <span style={{ fontSize: 11, color: "#a89a7a" }}>{d.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentDeity && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{currentDeity.name}'s Blessings</h3>
            <p style={{ fontStyle: "italic", color: "#c7bca5", marginBottom: 16 }}>{currentDeity.title}</p>
            <ul style={{ margin: 0, paddingLeft: 20, color: "#b5e8a1" }}>
              {currentDeity.description.map((effect, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {effect}
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }

  if (!role) {
    return (
      <div className="container">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <Toast toasts={toasts} remove={remove} />

      {/* HEADER */}
      <div className="faction-header">
        {factionCrest && (
          <img
            src={factionCrest}
            alt="Faction Crest"
            style={{
              width: 64,
              height: 64,
              objectFit: "contain",
              borderRadius: 8,
              border: "2px solid #5e4934",
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          {isEditingFactionName ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text"
                value={editedFactionName}
                onChange={(e) => setEditedFactionName(e.target.value)}
                placeholder={`Faction ${id}`}
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  background: "#1d1610",
                  border: "1px solid #5e4934",
                  borderRadius: 6,
                  padding: "4px 12px",
                  color: "#f4efe4",
                  fontFamily: "Georgia, serif",
                }}
              />
              <button onClick={saveFactionName} className="green small">
                Save
              </button>
              <button onClick={cancelEditFactionName} className="small">
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ margin: 0 }}>{factionData?.name || `Faction ${id}`}</h1>
              {isOwnerView && (
                <button onClick={() => setIsEditingFactionName(true)} className="small" style={{ margin: 0 }}>
                  Edit
                </button>
              )}
            </div>
          )}
          <p style={{ margin: "4px 0 0", color: "#a89a7a" }}>
            {regions.length} region{regions.length !== 1 ? "s" : ""} •{" "}
            {armies.filter((a) => !a.deleted).length} {armies.filter((a) => !a.deleted).length !== 1 ? "armies" : "army"} •{" "}
            {characters.length} character{characters.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => navigate("/")}>Home</button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="summary-row">
        <div className="summary-card">
          <h3>Economy</h3>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #3a2f24" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Settlements:</span>
              <span style={{ color: "#b5e8a1" }}>+{eco?.incomeBreakdown?.settlements || 0}g</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Mines:</span>
              <span style={{ color: "#b5e8a1" }}>+{eco?.incomeBreakdown?.mines || 0}g</span>
            </div>
            {courtBonuses.gold > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#8B008B" }}>Court:</span>
                <span style={{ color: "#8B008B" }}>+{courtBonuses.gold}g</span>
              </div>
            )}
            {(eco?.incomeBreakdown?.deity || 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#b5e8a1" }}>Religion:</span>
                <span style={{ color: "#b5e8a1" }}>+{eco?.incomeBreakdown?.deity || 0}g</span>
              </div>
            )}
            {(eco?.incomeBreakdown?.fortifications || 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Fortifications:</span>
                <span style={{ color: "#f97373" }}>-{eco?.incomeBreakdown?.fortifications || 0}g</span>
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ color: "#c7bca5" }}>Gross Income:</span>
            <strong>{eco?.goldPerTurn || 0}g</strong>
          </div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #3a2f24" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>HSG troops:</span>
              <span>-{hsgGoldUpkeep}g</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Levies:</span>
              <span>-{levyGoldUpkeep}g</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Warships:</span>
              <span>-{navyGoldUpkeep}g</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Agents:</span>
              <span>-{totalAgentUpkeep}g</span>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontWeight: "bold" }}>Net Gold/turn:</span>
            <strong style={{ fontSize: 18 }} className={goldNegative ? "warning" : "ok"}>
              {netGoldPerTurn}g
            </strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: "1px solid #3a2f24" }}>
            <span style={{ color: "#c7bca5" }}>Manpower:</span>
            <strong style={{ color: (eco?.manpowerNet || 0) < 0 ? "#ff4444" : "#b5e8a1" }}>{eco?.manpowerNet || 0}</strong>
          </div>
        </div>

        <div className="summary-card">
          <h3>Military Capacity</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #3a2f24" }}>
            <span style={{ color: "#c7bca5" }}>HSG:</span>
            <strong style={{ color: overCap ? "#ff4444" : "#b5e8a1" }}>
              {hsgUsed * 10} / {hsgCap}
              {overCap && <span style={{ fontSize: 11, marginLeft: 4 }}>OVER!</span>}
            </strong>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ color: "#c7bca5" }}>Levy Infantry:</span>
              <span>
                <strong>{totalLevyInfantryUnits * 10}</strong>
                <span style={{ color: "#888" }}> / {levyInfPotential}</span>
                {deity?.bonuses.levyInfantryCF && <span style={{ fontSize: 10, color: "#b5e8a1", marginLeft: 4 }}>+1 CF</span>}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ color: "#c7bca5" }}>Levy Archers:</span>
              <span>
                <strong>{totalLevyArcherUnits * 10}</strong>
                <span style={{ color: "#888" }}> / {levyArchPotential}</span>
                {deity?.bonuses.farmLevyBonus && <span style={{ fontSize: 10, color: "#b5e8a1", marginLeft: 4 }}>Altaea</span>}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs">
        {["regions", "army", "agents", "mailbox", "characters", "religion", "court"].map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
            style={{ position: "relative" }}
          >
            {tab === "regions" && "Regions"}
            {tab === "army" && "Army & Navy"}
            {tab === "agents" && "Agents"}
            {tab === "mailbox" && "Mailbox"}
            {tab === "characters" && "Characters"}
            {tab === "religion" && "Religion"}
            {tab === "court" && "High Court"}
            {tab === "mailbox" && unreadCount > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: "bold",
                  padding: "2px 6px",
                  borderRadius: "10px",
                  minWidth: "16px",
                  textAlign: "center",
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* REGIONS TAB */}
      {activeTab === "regions" && (
        <>
          {regions.length === 0 && <p>No regions found.</p>}
          {regions.map((region) => (
            <RegionCard
              key={region.id}
              region={region}
              eco={eco}
              role={role}
              myFactionId={myFactionId}
              patronDeity={patronDeity}
              capital={factionData?.capital}
              onSetCapital={setCapital}
            />
          ))}
        </>
      )}

      {/* ARMY TAB */}
      {activeTab === "army" && (
        <>
          <div className="summary-row">
            <div className="summary-card">
              <h3>Warships</h3>
              <p>
                Warships: <strong>{warships}</strong>
              </p>
              {isOwnerView && (
                <div className="army-controls">
                  <button onClick={() => changeWarships(-1)}>-</button>
                  <button onClick={() => changeWarships(1)}>+</button>
                </div>
              )}
              <p style={{ marginTop: 6, fontSize: 12, color: "#c7bca5" }}>
                Upkeep: {getModifiedUpkeep("warships", 3, patronDeity)} gold/turn per warship
                {deity?.bonuses.warshipUpkeep && <span style={{ color: "#b5e8a1" }}> (Trengar bonus)</span>}
              </p>
              <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #4c3b2a" }}>
                <strong>Total Navy Upkeep:</strong> {navyGoldUpkeep} gold/turn
              </div>
            </div>

            {courtBonuses.positions.some((p) => p.position === "Lord Marshal") && (
              <div className="summary-card">
                <h3>Army Capacity</h3>
                <p style={{ color: "#8B008B", fontSize: 14 }}>
                  <strong>Lord Marshal Bonus:</strong> Can maintain up to {maxArmyCap} armies
                </p>
                <p style={{ fontSize: 12, color: "#c7bca5" }}>
                  Current armies: {armies.filter((a) => !a.deleted).length} / {maxArmyCap}
                </p>
              </div>
            )}

            {deity?.bonuses.armyMovement && (
              <div className="summary-card">
                <h3>Divine Movement</h3>
                <p style={{ color: "#b5e8a1", fontSize: 14 }}>
                  <strong>Kurimbor's Blessing:</strong> Armies can move +1 region per turn
                </p>
              </div>
            )}
          </div>

          {isOwnerView && (
            <button onClick={createArmy} className="green" style={{ marginBottom: 16 }}>
              + Create Army
            </button>
          )}

          {armies.filter((a) => !a.deleted).length === 0 && <p style={{ color: "#c7bca5" }}>No armies yet. Create your first!</p>}

          {armies
            .filter((a) => !a.deleted)
            .map((army) => (
              <ArmyCard
                key={army.id}
                army={army}
                isOwner={isOwnerView}
                characters={characters}
                allArmies={armies}
                allRegions={allRegions}
                patronDeity={patronDeity}
                courtBonuses={courtBonuses}
                onChangeUnit={changeArmyUnit}
                onChangeLevy={changeArmyLevy}
                onChangeField={changeArmyField}
                onDelete={deleteArmy}
                onUpdateCommanders={updateArmyCommanders}
              />
            ))}
        </>
      )}

      {/* AGENTS TAB */}
      {activeTab === "agents" && (
        <>
          <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
            <button className={agentSubTab === "roster" ? "green" : ""} onClick={() => setAgentSubTab("roster")}>
              Agent Roster
            </button>
            <button className={agentSubTab === "missions" ? "green" : ""} onClick={() => setAgentSubTab("missions")}>
              Missions
            </button>
          </div>

          {agentSubTab === "roster" && (
            <>
              <div className="summary-row">
                <div className="summary-card">
                  <h3>Agent Capacity</h3>
                  <p>
                    Agents: <strong>{agentsCount}</strong> / {maxAgents}
                  </p>
                  <p style={{ fontSize: 12, color: "#c7bca5" }}>1 per Town, 2 per City</p>
                </div>

                <div className="summary-card">
                  <h3>Agent Upkeep (Gold)</h3>
                  <p>
                    Total agent upkeep: <strong>{totalAgentUpkeep}</strong> gold/turn
                    {patronDeity === "comnea" && agents.some((a) => a.type === "agitator") && (
                      <span style={{ color: "#b5e8a1", fontSize: 11 }}> (Comnea bonus applied)</span>
                    )}
                  </p>
                  <p style={{ fontSize: 12, color: "#c7bca5" }}>
                    Spy: 1g, Agitator: {getModifiedUpkeep("agitator", 4, patronDeity)}g, Enforcer: 2g per turn.
                  </p>
                  {patronDeity === "comnea" && <p style={{ fontSize: 12, color: "#b5e8a1" }}>New agents start at level 2</p>}
                </div>
              </div>

              {canEditAgents && (
                <div className="card" style={{ marginTop: 8, marginBottom: 16 }}>
                  <h3 style={{ marginTop: 0 }}>Hire New Agent</h3>
                  <p style={{ fontSize: 12, color: "#c7bca5", marginTop: 0, marginBottom: 12 }}>
                    Agents are managed at the table. GM and players can adjust levels and locations. Upkeep: Spy 1g, Agitator{" "}
                    {getModifiedUpkeep("agitator", 4, patronDeity)}g, Enforcer 2g per turn.
                    {patronDeity === "comnea" && <span style={{ color: "#b5e8a1" }}> New agents start at level 2!</span>}
                  </p>
                  <form
                    onSubmit={handleHireAgent}
                    className="agent-hire-form"
                    style={{ gridTemplateColumns: "auto minmax(180px, 1fr) minmax(180px, 1fr) auto" }}
                  >
                    <label style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Type:</span>
                      <select
                        value={newAgentType}
                        onChange={(e) => setNewAgentType(e.target.value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 6,
                          border: "1px solid #5e4934",
                          background: "#241b15",
                          color: "#f4efe4",
                          fontFamily: "Georgia, serif",
                          fontSize: 14,
                        }}
                      >
                        <option value="spy">Spy (1g)</option>
                        <option value="agitator">Agitator ({getModifiedUpkeep("agitator", 4, patronDeity)}g)</option>
                        <option value="enforcer">Enforcer (2g)</option>
                      </select>
                    </label>

                    <input
                      type="text"
                      placeholder="Agent name (optional)"
                      value={newAgentName}
                      onChange={(e) => setNewAgentName(e.target.value)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #5e4934",
                        background: "#1d1610",
                        color: "#f3eadc",
                        fontFamily: "Georgia, serif",
                        fontSize: 14,
                      }}
                    />

                    <select
                      value={newAgentLocation}
                      onChange={(e) => setNewAgentLocation(e.target.value)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        border: "1px solid #5e4934",
                        background: "#241b15",
                        color: "#f4efe4",
                        fontFamily: "Georgia, serif",
                        fontSize: 14,
                      }}
                    >
                      <option value="">Starting location (optional)</option>
                      {allRegions
                        .sort((a, b) => (a.code || "").localeCompare(b.code || ""))
                        .map((r) => (
                          <option key={r.id} value={r.code || r.id}>
                            [{r.code}] {r.name}
                          </option>
                        ))}
                    </select>

                    <button type="submit" className="green">
                      Hire Agent
                    </button>
                  </form>
                </div>
              )}

              {agents.length === 0 && (
                <p style={{ color: "#c7bca5" }}>No agents yet. Hire agents to gather intelligence and destabilize rivals.</p>
              )}

              {agents.filter((a) => !a.deleted).map(renderAgentCard)}
            </>
          )}

          {agentSubTab === "missions" && (
            <AgentMissions
              agents={agents}
              allAgents={allAgents}
              allRegions={allRegions}
              allCharacters={allCharacters}
              allArmies={allArmies}
              revealedEnemyAgents={allAgents.filter(a => a.revealed && a.factionId !== Number(id) && !a.deleted)}
              factionId={Number(id)}
              factionName={factionData?.name || `Faction ${id}`}
              isOwner={isOwnerView}
            />
          )}
        </>
      )}

      {/* MAILBOX TAB - Now using shared Mailbox component */}
      {activeTab === "mailbox" && (
        <Mailbox
          messages={messages}
          recipients={messageRecipients}
          senderName={factionData?.name || `Lord of Faction ${id}`}
          myFactionId={Number(id)}
          onSend={sendMessage}
          onMarkRead={markMessageRead}
          onDelete={deleteMessage}
          maxLength={250}
          isGM={false}
          canCompose={isOwnerView}
        />
      )}

      {/* CHARACTERS TAB */}
      {activeTab === "characters" && renderCharactersTab()}

      {/* RELIGION TAB */}
      {activeTab === "religion" && renderReligionTab()}

      {/* COURT TAB */}
      {activeTab === "court" && (
        <Court isGM={isGM} myFactionId={Number(id)} factionNames={allFactionNames} patronDeity={patronDeity} />
      )}
    </div>
  );
}