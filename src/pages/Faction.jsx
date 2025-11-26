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
import Court from "../components/Court";
import AgentMissions from "../components/AgentMissions";
import { getAuthState } from "../utils/auth";
import { BUILDING_RULES } from "../config/buildingRules";
import { DEITIES } from "../config/religionRules";
import { TERRAIN_TYPES } from "../config/terrainRules";
import { getCourtBonuses, getMaxArmyCap, canRaiseAgentWithCourt } from "../config/courtPositions";

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
   CONSTANTS / ECONOMY WITH DEITY BONUSES
-------------------------------------------------------- */

const AGENT_UPKEEP = {
  spy: 1,
  agitator: 4,
  enforcer: 2,
};

function calculateEconomy(regions, patronDeity = null) {
  let goldTotal = 0;
  let manpowerProdTotal = 0;
  let manpowerCostTotal = 0;
  let hsgCapTotal = 0;
  let farmEqTotal = 0;
  let mineEqTotal = 0;
  let levyInfTotal = 0;
  let levyArchTotal = 0;

  // Income breakdown tracking
  let settlementGold = 0;
  let mineGold = 0;
  let fortificationCost = 0;
  let deityGold = 0;

  let townCountTotal = 0;
  let cityCountTotal = 0;
  let villageCountTotal = 0;

  let riverRegionCount = 0;
  let coastalRegionCount = 0;
  let mountainRegionCount = 0;
  let hillsRegionCount = 0;
  let totalMineCount = 0;

  const deity = patronDeity ? DEITIES[patronDeity] : null;

  for (const r of regions) {
    // Skip regions under siege - they contribute nothing
    if (r.underSiege) continue;

    const ups = r.upgrades || [];
    const disabled = r.disabledUpgrades || [];
    const terrain = r.terrain || TERRAIN_TYPES.PLAINS;

    if (terrain === TERRAIN_TYPES.RIVER) riverRegionCount++;
    if (terrain === TERRAIN_TYPES.COAST) coastalRegionCount++;
    if (terrain === TERRAIN_TYPES.MOUNTAINS) mountainRegionCount++;
    if (terrain === TERRAIN_TYPES.HILLS) hillsRegionCount++;

    const counts = {};
    ups.forEach((u) => {
      counts[u] = (counts[u] || 0) + 1;
    });
    disabled.forEach((d) => {
      if (counts[d]) counts[d] -= 1;
    });

    let regionGold = 0;
    let regionManProd = 0;
    let regionManCost = 0;
    let regionHsgCap = 0;
    let regionFarmEq = 0;
    let regionMineEq = 0;
    let regionLevyInf = 0;
    let regionLevyArch = 0;

    Object.entries(counts).forEach(([name, count]) => {
      if (count <= 0) return;
      const rule = BUILDING_RULES[name];
      if (!rule) return;

      let gold = rule.gold || 0;
      let manpower = rule.manpower || 0;
      let manpowerCost = rule.manpowerCost || 0;
      let hsgCap = rule.hsgCap || 0;
      let levyArch = rule.levyArch || 0;

      // Track base gold by source before deity bonuses
      if (name === "Village" || name === "Town" || name === "City") {
        settlementGold += (rule.gold || 0) * count;
      }
      if (name === "Mine" || name === "Mine2") {
        mineGold += (rule.gold || 0) * count;
      }
      if (name === "Keep" || name === "Castle") {
        fortificationCost += Math.abs(rule.gold || 0) * count;
      }

      if (deity) {
        if (deity.bonuses.townGold && name === "Town") {
          gold += deity.bonuses.townGold;
          deityGold += deity.bonuses.townGold * count;
        }
        if (deity.bonuses.cityGold && name === "City") {
          gold += deity.bonuses.cityGold;
          deityGold += deity.bonuses.cityGold * count;
        }

        if (deity.bonuses.mineGold && (name === "Mine" || name === "Mine2")) {
          gold += deity.bonuses.mineGold;
          deityGold += deity.bonuses.mineGold * count;
        }

        if (deity.bonuses.settlementManpower &&
          (name === "Village" || name === "Town" || name === "City"))
          manpower += deity.bonuses.settlementManpower;

        if (name === "Keep" && deity.bonuses.keepHSG)
          hsgCap += deity.bonuses.keepHSG;

        if (name === "Castle" && deity.bonuses.castleHSG)
          hsgCap += deity.bonuses.castleHSG;

        if (deity.bonuses.farmLevyBonus && (name === "Farm" || name === "Farm2"))
          levyArch += deity.bonuses.farmLevyBonus;
      }

      regionGold += gold * count;
      regionManProd += manpower * count;
      regionManCost += manpowerCost * count;
      regionHsgCap += hsgCap * count;
      regionFarmEq += (rule.farmEquivalent || 0) * count;
      regionMineEq += (rule.mineEquivalent || 0) * count;
      regionLevyInf += (rule.levyInf || 0) * count;
      regionLevyArch += levyArch * count;

      if (name === "Town") townCountTotal += count;
      if (name === "City") cityCountTotal += count;
      if (name === "Village") villageCountTotal += count;
      if (name === "Mine" || name === "Mine2") totalMineCount += count;
    });

    // Terrain bonuses
    if (deity) {
      if (terrain === TERRAIN_TYPES.RIVER && deity.bonuses.riverGold) {
        regionGold += deity.bonuses.riverGold;
        deityGold += deity.bonuses.riverGold;
      }
      if ((terrain === TERRAIN_TYPES.MOUNTAINS || terrain === TERRAIN_TYPES.HILLS) && deity.bonuses.mountainHillsGold) {
        regionGold += deity.bonuses.mountainHillsGold;
        deityGold += deity.bonuses.mountainHillsGold;
      }
      if (terrain === TERRAIN_TYPES.COAST && deity.bonuses.coastalGold) {
        regionGold += deity.bonuses.coastalGold;
        deityGold += deity.bonuses.coastalGold;
      }
      if (terrain === TERRAIN_TYPES.MOUNTAINS && deity.bonuses.mountainGold) {
        regionGold += deity.bonuses.mountainGold;
        deityGold += deity.bonuses.mountainGold;
      }
    }

    goldTotal += regionGold;
    manpowerProdTotal += regionManProd;
    manpowerCostTotal += regionManCost;
    hsgCapTotal += regionHsgCap;
    farmEqTotal += regionFarmEq;
    mineEqTotal += regionMineEq;
    levyInfTotal += regionLevyInf;
    levyArchTotal += regionLevyArch;
  }

  return {
    goldPerTurn: goldTotal,
    manpowerProduced: manpowerProdTotal,
    manpowerUpkeep: manpowerCostTotal,
    manpowerNet: manpowerProdTotal - manpowerCostTotal,
    hsgCap: hsgCapTotal,
    farmEquivalent: farmEqTotal,
    mineEquivalent: mineEqTotal,
    levyInfantry: levyInfTotal,
    levyArchers: levyArchTotal,
    townCount: townCountTotal,
    cityCount: cityCountTotal,
    villageCount: villageCountTotal,
    // Income breakdown
    incomeBreakdown: {
      settlements: settlementGold,
      mines: mineGold,
      fortifications: fortificationCost,
      deity: deityGold,
    },
    deityBonuses: patronDeity
      ? {
          riverRegions: riverRegionCount,
          coastalRegions: coastalRegionCount,
          mountainRegions: mountainRegionCount,
          hillsRegions: hillsRegionCount,
          mines: totalMineCount,
        }
      : null,
  };
}

function getModifiedUpkeep(unitType, baseUpkeep, patronDeity) {
  const deity = patronDeity ? DEITIES[patronDeity] : null;
  if (!deity) return baseUpkeep;

  switch (unitType) {
    case "huscarls":
      return deity.bonuses.huscarlUpkeep ?? baseUpkeep;
    case "dismountedKnights":
      return deity.bonuses.dismountedKnightUpkeep ?? baseUpkeep;
    case "mountedKnights":
      return deity.bonuses.mountedKnightUpkeep ?? baseUpkeep;
    case "warships":
      return deity.bonuses.warshipUpkeep ?? baseUpkeep;
    case "agitator":
      return deity.bonuses.agitatorUpkeep ?? baseUpkeep;
    default:
      return baseUpkeep;
  }
}

const LEVY_UPKEEP_PER_UNIT = 0.25;

const DEFAULT_CRESTS = {
  "1": "/faction1.png",
  "2": "/holmes.png",       
  "3": "/faction3.png",
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
  const [agentSubTab, setAgentSubTab] = useState("roster"); // "roster" or "missions"

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
  const [newCharFirstName, setNewCharFirstName] = useState("");
  const [newCharLastName, setNewCharLastName] = useState("");

  const [patronDeity, setPatronDeity] = useState(null);

  const [role, setRole] = useState(null);
  const [myFactionId, setMyFactionId] = useState(null);

  const [isEditingFactionName, setIsEditingFactionName] = useState(false);
  const [editedFactionName, setEditedFactionName] = useState("");

  const [factionCrest, setFactionCrest] = useState(null);

  // Court positions state
  const [courtPositions, setCourtPositions] = useState([]);

  // Faction names for Court
  const [allFactionNames, setAllFactionNames] = useState({});

  // Mailbox state
  const [messages, setMessages] = useState([]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("gm");
  const [composeBody, setComposeBody] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);

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
  const isOwnerView =
    (role === "faction" && myFactionId === Number(id)) || isGM;

  const canEditAgents = isOwnerView || isGM;

  useEffect(() => {
    const q = query(
      collection(db, "regions"),
      where("owner", "==", Number(id))
    );

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
      const positions = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCourtPositions(positions);
    });
    return () => unsub();
  }, []);

  // Load mailbox messages for this faction
  useEffect(() => {
    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("toFactionId", "==", Number(id))
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by date, newest first
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

  useEffect(() => {
    if (regions.length > 0 || patronDeity) {
      let baseEco = calculateEconomy(regions, patronDeity);
      // Add court bonuses
      baseEco.goldPerTurn += courtBonuses.gold;
      baseEco.courtBonuses = courtBonuses.positions;
      setEco(baseEco);
    }
  }, [regions, patronDeity, courtBonuses]);

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
        setFactionCrest(
          data.crest || DEFAULT_CRESTS[String(id)] || null
        );
      }
    });

    return () => unsub();
  }, [id]);

  async function saveFactionName() {
    if (!isOwnerView) return;
    const ref = doc(db, "factions", String(id));
    await updateDoc(ref, { name: editedFactionName });
    setIsEditingFactionName(false);
    show(
      "Faction Renamed",
      `Faction is now called "${
        editedFactionName || `Faction ${id}`
      }"`
    );
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

  // Mailbox functions
  async function sendMessage() {
    if (!composeBody.trim()) return;
    
    // Character count check for player-to-player messages (250 char max)
    if (composeTo !== "gm" && composeBody.trim().length > 250) {
      show("Message Too Long", "Messages to other lords are limited to 250 characters.");
      return;
    }

    const myFactionName = factionData?.name || `Faction ${id}`;
    
    try {
      await addDoc(collection(db, "messages"), {
        fromFactionId: Number(id),
        fromFactionName: myFactionName,
        toFactionId: composeTo === "gm" ? 0 : Number(composeTo),
        toType: composeTo === "gm" ? "gm" : "faction",
        body: composeBody.trim(),
        createdAt: new Date(),
        read: false,
        type: "player",
      });
      
      setComposeBody("");
      setComposeOpen(false);
      show("Message Sent", composeTo === "gm" ? "Your message has been sent to the Game Master." : "Your raven has been dispatched.");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  async function deleteMessage(messageId) {
    try {
      await deleteDoc(doc(db, "messages", messageId));
      setSelectedMessage(null);
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  }

  async function markMessageRead(messageId) {
    try {
      await updateDoc(doc(db, "messages", messageId), { read: true });
    } catch (error) {
      console.error("Error marking message read:", error);
    }
  }

  const unreadCount = messages.filter(m => !m.read).length;

  useEffect(() => {
    const armiesRef = collection(
      db,
      "factions",
      String(id),
      "armies"
    );
    const unsub = onSnapshot(armiesRef, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: "",
        location: "",
        huscarls: 0,
        dismountedKnights: 0,
        mountedKnights: 0,
        lightHorse: 0,
        levyInfantry: 0,
        levyArchers: 0,
        commanders: [],
        deleted: false,
        ...d.data(),
      }));
      const validArmies = list.filter(army => {
        if (!Array.isArray(army.commanders)) {
          army.commanders = [];
        }
        return true;
      });
      setArmies(validArmies);
    });
    return () => unsub();
  }, [id]);

  // Load ALL armies across all factions (for mission targeting)
  useEffect(() => {
    const unsubscribers = [];
    
    for (let factionId = 1; factionId <= 8; factionId++) {
      const unsub = onSnapshot(
        collection(db, "factions", String(factionId), "armies"),
        (snap) => {
          const factionArmies = snap.docs.map(d => ({
            id: d.id,
            factionId: factionId,
            ...d.data(),
          }));
          
          setAllArmies(prev => {
            const otherArmies = prev.filter(a => a.factionId !== factionId);
            return [...otherArmies, ...factionArmies];
          });
        }
      );
      unsubscribers.push(unsub);
    }
    
    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  async function addArmy() {
    if (!isOwnerView) return;
    
    const maxArmies = getMaxArmyCap(3, courtBonuses);
    if (armies.filter(a => !a.deleted).length >= maxArmies) {
      show("Army Cap Reached", `You can maintain a maximum of ${maxArmies} armies${maxArmies > 3 ? ' (including Lord Marshal bonus)' : ''}.`);
      return;
    }
    
    const armiesRef = collection(
      db,
      "factions",
      String(id),
      "armies"
    );
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
    const ref = doc(
      db,
      "factions",
      String(id),
      "armies",
      armyId
    );
    await updateDoc(ref, { deleted: true });
  }

  async function changeArmyField(armyId, field, value) {
    if (!isOwnerView) return;
    const ref = doc(
      db,
      "factions",
      String(id),
      "armies",
      armyId
    );
    await updateDoc(ref, { [field]: value });
  }

  async function changeArmyUnit(armyId, field, delta) {
    if (!isOwnerView) return;
    const army = armies.find((a) => a.id === armyId);
    const current = army[field] || 0;
    const next = Math.max(0, current + delta);
    const ref = doc(
      db,
      "factions",
      String(id),
      "armies",
      armyId
    );
    await updateDoc(ref, { [field]: next });
  }

  const totalLevyInfantryUnits = useMemo(
    () =>
      armies.reduce(
        (sum, a) => sum + (a.levyInfantry || 0),
        0
      ),
    [armies]
  );

  const totalLevyArcherUnits = useMemo(
    () =>
      armies.reduce((sum, a) => sum + (a.levyArchers || 0), 0),
    [armies]
  );

  async function changeArmyLevy(armyId, field, delta) {
    if (!isOwnerView) return;

    const army = armies.find((a) => a.id === armyId);
    const current = army[field] || 0;
    const next = Math.max(0, current + delta);

    const newTotalInf =
      totalLevyInfantryUnits +
      (field === "levyInfantry" ? next - current : 0);

    const newTotalArch =
      totalLevyArcherUnits +
      (field === "levyArchers" ? next - current : 0);

    const levyInfPotential = eco?.levyInfantry || 0;
    const levyArchPotential = eco?.levyArchers || 0;

    const levyInfUnits = Math.floor(levyInfPotential / 10);
    const levyArchUnits = Math.floor(levyArchPotential / 10);

    if (field === "levyInfantry" && newTotalInf > levyInfUnits) {
      window.alert(
        `Cannot raise more levy infantry.\n\nCurrent: ${totalLevyInfantryUnits} / ${levyInfUnits}`
      );
      return;
    }

    if (field === "levyArchers" && newTotalArch > levyArchUnits) {
      window.alert(
        `Cannot raise more levy archers.\n\nCurrent: ${totalLevyArcherUnits} / ${levyArchUnits}`
      );
      return;
    }

    const ref = doc(
      db,
      "factions",
      String(id),
      "armies",
      armyId
    );
    await updateDoc(ref, { [field]: next });
  }

  async function updateArmyCommanders(armyId, commanderIds) {
    if (!isOwnerView) return;
    
    // Find the army to get current commanders
    const army = armies.find(a => a.id === armyId);
    const oldCommanders = army?.commanders || [];
    
    // Find commanders that were removed
    const removedCommanders = oldCommanders.filter(cmdId => !commanderIds.includes(cmdId));
    
    // Update the army
    const armyRef = doc(
      db,
      "factions",
      String(id),
      "armies",
      armyId
    );
    await updateDoc(armyRef, { commanders: commanderIds });
    
    // Update location of removed commanders to capital
    const capital = factionData?.capital;
    for (const cmdId of removedCommanders) {
      const charRef = doc(
        db,
        "factions",
        String(id),
        "characters",
        cmdId
      );
      await updateDoc(charRef, { location: capital || null });
    }
  }

  async function changeWarships(delta) {
    if (!isOwnerView || !factionData) return;
    const ref = doc(db, "factions", String(id));
    const current = factionData.navy?.warships || 0;
    const next = Math.max(0, current + delta);
    await updateDoc(ref, { "navy.warships": next });
  }

  useEffect(() => {
    const agentsRef = collection(db, "agents");
    const qAgents = query(
      agentsRef,
      where("factionId", "==", Number(id))
    );
    const unsub = onSnapshot(qAgents, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setAgents(list);
    });
    return () => unsub();
  }, [id]);

  // Load ALL agents (for revealed enemy agents in missions)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => {
      const list = snap.docs.map(d => ({
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
  const activeAgents = agents.filter(a => !a.deleted);
  const agentsCount = activeAgents.length;

  const totalAgentUpkeep = activeAgents.reduce((sum, a) => {
    const baseUpkeep = AGENT_UPKEEP[a.type] || 0;
    return (
      sum +
      getModifiedUpkeep(a.type, baseUpkeep, patronDeity)
    );
  }, 0);

  useEffect(() => {
    const charactersRef = collection(
      db,
      "factions",
      String(id),
      "characters"
    );
    const unsub = onSnapshot(charactersRef, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setCharacters(list);
    });
    return () => unsub();
  }, [id]);

  // Load ALL characters across all factions (for mission targeting)
  useEffect(() => {
    const unsubscribers = [];
    
    for (let factionId = 1; factionId <= 8; factionId++) {
      const unsub = onSnapshot(
        collection(db, "factions", String(factionId), "characters"),
        (snap) => {
          const factionChars = snap.docs.map(d => ({
            id: d.id,
            factionId: factionId,
            ...d.data(),
          }));
          
          setAllCharacters(prev => {
            const otherChars = prev.filter(c => c.factionId !== factionId);
            return [...otherChars, ...factionChars];
          });
        }
      );
      unsubscribers.push(unsub);
    }
    
    return () => unsubscribers.forEach(unsub => unsub());
  }, []);

  function generateRandomStats() {
    return {
      leadership: Math.floor(Math.random() * 10) + 1,
      prowess: Math.floor(Math.random() * 10) + 1,
      stewardship: Math.floor(Math.random() * 10) + 1,
      intrigue: Math.floor(Math.random() * 10) + 1,
    };
  }

  async function handleAddCharacter(e) {
    e.preventDefault();
    if (!isOwnerView) return;

    if (!newCharFirstName.trim() && !newCharLastName.trim()) {
      show(
        "Name Required",
        "Please enter at least a first or last name."
      );
      return;
    }

    const stats = generateRandomStats();

    const charactersRef = collection(
      db,
      "factions",
      String(id),
      "characters"
    );

    await addDoc(charactersRef, {
      firstName: newCharFirstName.trim() || "Unnamed",
      lastName: newCharLastName.trim() || "",
      ...stats,
      courtPosition: "",
      location: factionData?.capital || null,
      createdAt: new Date(),
    });

    show(
      "Character Added",
      `${newCharFirstName} ${newCharLastName} has joined your house!`
    );

    setNewCharFirstName("");
    setNewCharLastName("");
    setIsAddingCharacter(false);
  }

  async function updateCharacterField(charId, field, value) {
    if (!isOwnerView && !isGM) return;
    const ref = doc(
      db,
      "factions",
      String(id),
      "characters",
      charId
    );
    await updateDoc(ref, { [field]: value });
  }

  async function deleteCharacter(charId) {
    if (!isOwnerView && !isGM) return;
    if (
      !window.confirm("Remove this character from your house?")
    )
      return;
    const ref = doc(
      db,
      "factions",
      String(id),
      "characters",
      charId
    );
    await deleteDoc(ref);
    show(
      "Character Removed",
      "The character has been removed from your house."
    );
  }

  async function changePatronDeity(deityKey) {
    if (!isOwnerView) return;
    const ref = doc(db, "factions", String(id));
    await updateDoc(ref, {
      patronDeity: deityKey || null,
    });
    setPatronDeity(deityKey || null);
    show(
      "Patron Deity Changed",
      deityKey
        ? `Now following ${DEITIES[deityKey].name}`
        : "No patron deity selected"
    );
  }

  const deity = patronDeity ? DEITIES[patronDeity] : null;

  async function handleHireAgent(e) {
    e.preventDefault();
    if (!canEditAgents) return;

    const canHire = canRaiseAgentWithCourt(agentsCount, maxAgents, courtBonuses);
    
    if (!canHire) {
      show(
        "Agent Cap Reached",
        `You've met your agent cap (${agentsCount}/${maxAgents})!`
      );
      return;
    }

    const type = newAgentType;
    const name =
      newAgentName.trim() ||
      (type === "spy"
        ? "Unnamed Spy"
        : type === "agitator"
        ? "Unnamed Agitator"
        : "Unnamed Enforcer");

    const startingLevel =
      deity?.bonuses.agentStartLevel &&
      patronDeity === "comnea"
        ? 2
        : 1;

    const agentsRef = collection(db, "agents");
    await addDoc(agentsRef, {
      factionId: Number(id),
      name,
      type,
      level: startingLevel,
      location: newAgentLocation || "",
    });

    show(
      "Agent Hired",
      `${name} (${type}) hired${
        startingLevel > 1 ? " at level 2" : ""
      }.`
    );

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

  // Army cap from court
  const maxArmyCap = getMaxArmyCap(3, courtBonuses);

  // HSG calculations
  const hsgUsed = useMemo(() => {
    return armies.reduce((sum, a) => {
      if (a.deleted) return sum;
      return (
        sum +
        (a.huscarls || 0) +
        (a.dismountedKnights || 0) +
        (a.mountedKnights || 0) +
        (a.lightHorse || 0)
      );
    }, 0);
  }, [armies]);

  const hsgCap = eco?.hsgCap || 0;
  const overCap = hsgUsed > hsgCap;

  // Gold calculations
  const warships = factionData?.navy?.warships || 0;

  const hsgGoldUpkeep = useMemo(() => {
    return armies.reduce((sum, a) => {
      if (a.deleted) return sum;
      return (
        sum +
        (a.huscarls || 0) * getModifiedUpkeep("huscarls", 1, patronDeity) +
        (a.dismountedKnights || 0) * getModifiedUpkeep("dismountedKnights", 2, patronDeity) +
        (a.mountedKnights || 0) * getModifiedUpkeep("mountedKnights", 3, patronDeity) +
        (a.lightHorse || 0) * 1
      );
    }, 0);
  }, [armies, patronDeity]);

  const levyGoldUpkeep = useMemo(() => {
    return Math.floor((totalLevyInfantryUnits + totalLevyArcherUnits) * LEVY_UPKEEP_PER_UNIT);
  }, [totalLevyInfantryUnits, totalLevyArcherUnits]);

  const navyGoldUpkeep = warships * getModifiedUpkeep("warships", 3, patronDeity);

  const netGoldPerTurn =
    (eco?.goldPerTurn || 0) -
    hsgGoldUpkeep -
    levyGoldUpkeep -
    navyGoldUpkeep -
    totalAgentUpkeep;

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
                  onChange={(e) =>
                    updateAgentField(agent.id, "name", e.target.value)
                  }
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
                  color:
                    agent.type === "spy"
                      ? "#9d7dd1"
                      : agent.type === "agitator"
                      ? "#d17d7d"
                      : "#7dd1a3",
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
                    onChange={(e) =>
                      updateAgentField(
                        agent.id,
                        "level",
                        Number(e.target.value)
                      )
                    }
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
                    onChange={(e) =>
                      updateAgentField(agent.id, "location", e.target.value)
                    }
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
                      .sort((a, b) =>
                        (a.code || "").localeCompare(b.code || "")
                      )
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
          <span>
            Upkeep:{" "}
            {modifiedUpkeep !== baseUpkeep ? (
              <>
                <span
                  style={{
                    textDecoration: "line-through",
                    opacity: 0.5,
                  }}
                >
                  {baseUpkeep}
                </span>{" "}
                <span
                  style={{
                    color: "#b5e8a1",
                    fontWeight: "bold",
                  }}
                >
                  {modifiedUpkeep}
                </span>
              </>
            ) : (
              baseUpkeep
            )}
            g/turn
            {agent.type === "agitator" &&
              patronDeity === "comnea" && (
                <span
                  style={{
                    color: "#b5e8a1",
                    fontSize: 11,
                  }}
                >
                  {" "}
                  (Comnea)
                </span>
              )}
          </span>
        </div>
      </div>
    );
  }

  function renderAgentsTab() {
    const hasSpymaster = courtBonuses.positions.some(
      p => p.position === 'Lord Spymaster'
    );
    const effectiveAgentCap = hasSpymaster ? `${maxAgents} + 1 free agent` : maxAgents;

    return (
      <>
        <div className="summary-row">
          <div className="summary-card">
            <h3>Agents & Cap</h3>
            <p>
              Agents:{" "}
              <strong>
                {agentsCount} / {effectiveAgentCap}
              </strong>
            </p>
            <p>
              From settlements: Towns:{" "}
              <strong>{townCount}</strong>, Cities:{" "}
              <strong>{cityCount}</strong>
            </p>
            {hasSpymaster && (
              <p style={{ fontSize: 12, color: "#b5e8a1" }}>
                Lord Spymaster grants +1 free agent
              </p>
            )}
            <p
              style={{
                fontSize: 12,
                color: "#c7bca5",
              }}
            >
              Cap = 1 per Town, 2 per City. Villages do
              not support agents.
            </p>
          </div>

          <div className="summary-card">
            <h3>Agent Upkeep (Gold)</h3>
            <p>
              Total agent upkeep:{" "}
              <strong>{totalAgentUpkeep}</strong>{" "}
              gold/turn
              {patronDeity === "comnea" &&
                agents.some(
                  (a) => a.type === "agitator"
                ) && (
                  <span
                    style={{
                      color: "#b5e8a1",
                      fontSize: 11,
                    }}
                  >
                    {" "}
                    (Comnea bonus applied)
                  </span>
                )}
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#c7bca5",
              }}
            >
              Spy: 1g, Agitator:{" "}
              {getModifiedUpkeep(
                "agitator",
                4,
                patronDeity
              )}
              g, Enforcer: 2g per turn.
            </p>
            {patronDeity === "comnea" && (
              <p
                style={{
                  fontSize: 12,
                  color: "#b5e8a1",
                }}
              >
                New agents start at level 2
              </p>
            )}
          </div>
        </div>

        {canEditAgents && (
          <div
            className="card"
            style={{
              marginTop: 8,
              marginBottom: 16,
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              Hire New Agent
            </h3>
            <p
              style={{
                fontSize: 12,
                color: "#c7bca5",
                marginTop: 0,
                marginBottom: 12,
              }}
            >
              Agents are managed at the table. GM and
              players can adjust levels and locations.
              Upkeep: Spy 1g, Agitator{" "}
              {getModifiedUpkeep(
                "agitator",
                4,
                patronDeity
              )}
              g, Enforcer 2g per turn.
              {patronDeity === "comnea" && (
                <span
                  style={{
                    color: "#b5e8a1",
                  }}
                >
                  {" "}
                  New agents start at level 2!
                </span>
              )}
            </p>
            <form
              onSubmit={handleHireAgent}
              className="agent-hire-form"
              style={{ gridTemplateColumns: "auto minmax(180px, 1fr) minmax(180px, 1fr) auto" }}
            >
              <label
                style={{
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Type:</span>
                <select
                  value={newAgentType}
                  onChange={(e) =>
                    setNewAgentType(e.target.value)
                  }
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
                  <option value="agitator">
                    Agitator (
                    {getModifiedUpkeep(
                      "agitator",
                      4,
                      patronDeity
                    )}
                    g)
                  </option>
                  <option value="enforcer">
                    Enforcer (2g)
                  </option>
                </select>
              </label>

              <input
                type="text"
                placeholder="Agent name (optional)"
                value={newAgentName}
                onChange={(e) =>
                  setNewAgentName(e.target.value)
                }
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
                onChange={(e) =>
                  setNewAgentLocation(e.target.value)
                }
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
                <option value="">
                  Starting location (optional)
                </option>
                {allRegions
                  .sort((a, b) =>
                    (a.code || "").localeCompare(
                      b.code || ""
                    )
                  )
                  .map((r) => (
                    <option
                      key={r.id}
                      value={r.code || r.id}
                    >
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
          <p style={{ color: "#c7bca5" }}>
            No agents yet. Hire agents to gather
            intelligence and destabilize rivals.
          </p>
        )}

        {agents.filter(a => !a.deleted).map(renderAgentCard)}
      </>
    );
  }

  function renderCharactersTab() {
    return (
      <>
        {isOwnerView && (
          <>
            {!isAddingCharacter ? (
              <button
                onClick={() => setIsAddingCharacter(true)}
                className="green"
                style={{ marginBottom: 16 }}
              >
                + Add Character
              </button>
            ) : (
              <div
                className="card"
                style={{
                  marginBottom: 16,
                  padding: 16,
                }}
              >
                <h3 style={{ marginTop: 0 }}>
                  New House Member
                </h3>
                <p
                  style={{
                    fontSize: 12,
                    color: "#c7bca5",
                    marginTop: 0,
                  }}
                >
                  Stats will be randomly generated (1-10
                  each).
                </p>
                <form
                  onSubmit={handleAddCharacter}
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    placeholder="First name"
                    value={newCharFirstName}
                    onChange={(e) =>
                      setNewCharFirstName(e.target.value)
                    }
                    style={{
                      flex: "1 1 120px",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #5e4934",
                      background: "#1d1610",
                      color: "#f3eadc",
                      fontFamily: "Georgia, serif",
                      fontSize: 16,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={newCharLastName}
                    onChange={(e) =>
                      setNewCharLastName(e.target.value)
                    }
                    style={{
                      flex: "1 1 120px",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #5e4934",
                      background: "#1d1610",
                      color: "#f3eadc",
                      fontFamily: "Georgia, serif",
                      fontSize: 16,
                    }}
                  />
                  <button
                    type="submit"
                    style={{ margin: 0 }}
                  >
                    Create Character
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCharacter(false);
                      setNewCharFirstName("");
                      setNewCharLastName("");
                    }}
                    style={{ margin: 0 }}
                  >
                    Cancel
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {characters.length === 0 && (
          <p style={{ color: "#c7bca5" }}>
            No house members yet. Add characters to
            build your noble house.
          </p>
        )}

        {characters
          .sort((a, b) => {
            const aDate = a.createdAt?.seconds || 0;
            const bDate = b.createdAt?.seconds || 0;
            return bDate - aDate;
          })
          .map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
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

  function renderReligionTab() {
    const currentDeity = patronDeity
      ? DEITIES[patronDeity]
      : null;

    return (
      <>
        <div className="summary-row">
          <div className="summary-card">
            <h3>Patron Deity</h3>
            <p>
              Current:{" "}
              <strong>
                {currentDeity
                  ? currentDeity.name
                  : "None"}
              </strong>
            </p>
            {currentDeity && (
              <p
                style={{
                  fontSize: 12,
                  color: "#c7bca5",
                }}
              >
                {currentDeity.title}
              </p>
            )}
          </div>

          {deity &&
            eco?.deityBonuses && (
              <div className="summary-card">
                <h3>Active Regional Bonuses</h3>
                {deity.bonuses.riverGold &&
                  eco.deityBonuses
                    .riverRegions > 0 && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#b5e8a1",
                      }}
                    >
                      +
                      {
                        eco.deityBonuses
                          .riverRegions
                      }{" "}
                      gold from{" "}
                      {
                        eco.deityBonuses
                          .riverRegions
                      }{" "}
                      river region(s)
                    </p>
                  )}
                {deity.bonuses.coastalGold &&
                  eco.deityBonuses
                    .coastalRegions > 0 && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#b5e8a1",
                      }}
                    >
                      +
                      {eco.deityBonuses.coastalRegions *
                        2}{" "}
                      gold from{" "}
                      {
                        eco.deityBonuses
                          .coastalRegions
                      }{" "}
                      coastal region(s)
                    </p>
                  )}
                {deity.bonuses.mountainGold &&
                  eco.deityBonuses
                    .mountainRegions > 0 && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#b5e8a1",
                      }}
                    >
                      +
                      {eco.deityBonuses.mountainRegions *
                        3}{" "}
                      gold from{" "}
                      {
                        eco.deityBonuses
                          .mountainRegions
                      }{" "}
                      mountain region(s)
                    </p>
                  )}
                {deity.bonuses
                  .mountainHillsGold &&
                  (eco.deityBonuses
                    .mountainRegions +
                    eco.deityBonuses
                      .hillsRegions >
                    0) && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#b5e8a1",
                      }}
                    >
                      +
                      {eco.deityBonuses
                        .mountainRegions +
                        eco.deityBonuses
                          .hillsRegions}{" "}
                      gold from mountains/hills
                    </p>
                  )}
                {deity.bonuses.mineGold &&
                  eco.deityBonuses.mines > 0 && (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#b5e8a1",
                      }}
                    >
                      +
                      {eco.deityBonuses.mines} gold
                      from{" "}
                      {eco.deityBonuses.mines}{" "}
                      mine(s)
                    </p>
                  )}
              </div>
            )}
        </div>

        {isOwnerView && (
          <div
            className="card"
            style={{ marginBottom: 16 }}
          >
            <h3 style={{ marginTop: 0 }}>
              Choose Patron Deity
            </h3>
            <p
              style={{
                fontSize: 12,
                color: "#c7bca5",
                marginTop: 0,
              }}
            >
              Select a deity to receive their divine
              blessings. This can be changed at any time.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              <button
                onClick={() => changePatronDeity(null)}
                style={{
                  padding: "10px 16px",
                  background:
                    !patronDeity
                      ? "#3a3020"
                      : "#241b15",
                  border: !patronDeity
                    ? "2px solid #d1b26b"
                    : "1px solid #5e4934",
                  textAlign: "left",
                }}
              >
                <strong>None</strong>
                <br />
                <span
                  style={{
                    fontSize: 11,
                    color: "#a89a7a",
                  }}
                >
                  No patron deity
                </span>
              </button>
              {Object.entries(DEITIES).map(
                ([key, d]) => (
                  <button
                    key={key}
                    onClick={() =>
                      changePatronDeity(key)
                    }
                    style={{
                      padding: "10px 16px",
                      background:
                        patronDeity === key
                          ? "#3a3020"
                          : "#241b15",
                      border:
                        patronDeity === key
                          ? "2px solid #d1b26b"
                          : "1px solid #5e4934",
                      textAlign: "left",
                    }}
                  >
                    <strong>{d.name}</strong>
                    <br />
                    <span
                      style={{
                        fontSize: 11,
                        color: "#a89a7a",
                      }}
                    >
                      {d.title}
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {currentDeity && (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              {currentDeity.name}'s Blessings
            </h3>
            <p
              style={{
                fontStyle: "italic",
                color: "#c7bca5",
                marginBottom: 16,
              }}
            >
              {currentDeity.title}
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                color: "#b5e8a1",
              }}
            >
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
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={editedFactionName}
                onChange={(e) =>
                  setEditedFactionName(e.target.value)
                }
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
              <button
                onClick={saveFactionName}
                className="green small"
              >
                Save
              </button>
              <button
                onClick={cancelEditFactionName}
                className="small"
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1
              style={{
                margin: 0,
                cursor: isOwnerView
                  ? "pointer"
                  : "default",
              }}
              onClick={() =>
                isOwnerView &&
                setIsEditingFactionName(true)
              }
              title={
                isOwnerView
                  ? "Click to edit name"
                  : undefined
              }
            >
              {factionData?.name || `Faction ${id}`}
              {isOwnerView && (
                <span
                  style={{
                    fontSize: 14,
                    color: "#a89a7a",
                    marginLeft: 8,
                  }}
                >
                  [EDIT] 
                </span>
              )}
            </h1>
          )}
          <p
            style={{
              margin: "4px 0 0 0",
              color: "#a89a7a",
              fontSize: 14,
            }}
          >
            {regions.length} region
            {regions.length !== 1 ? "s" : ""} {" "}
            {armies.filter((a) => !a.deleted).length}{" "}
            {armies.filter((a) => !a.deleted).length !== 1
              ? "armies"
              : "army"}{" "}
             {characters.length} character
            {characters.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button onClick={() => navigate("/")}>
           Home
        </button>
      </div>

      {/* SUMMARY CARDS - 2 consolidated cards */}
      <div className="summary-row">
        {/* ECONOMY CARD */}
        <div className="summary-card">
          <h3>Economy</h3>
          {/* Income breakdown */}
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
          {/* Upkeep breakdown */}
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
            <strong style={{ color: (eco?.manpowerNet || 0) < 0 ? "#ff4444" : "#b5e8a1" }}>
              {eco?.manpowerNet || 0}
            </strong>
          </div>
        </div>

        {/* MILITARY CAPACITY CARD */}
        <div className="summary-card">
          <h3>Military Capacity</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #3a2f24" }}>
            <span style={{ color: "#c7bca5" }}>HSG:</span>
            <strong style={{ color: overCap ? "#ff4444" : "#b5e8a1" }}>
              {hsgUsed} / {hsgCap}
              {overCap && <span style={{ fontSize: 11, marginLeft: 4 }}>OVER!</span>}
            </strong>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ color: "#c7bca5" }}>Levy Infantry:</span>
              <span>
                <strong>{totalLevyInfantryUnits}</strong>
                <span style={{ color: "#888" }}> / {levyInfPotential}</span>
                {deity?.bonuses.levyInfantryCF && (
                  <span style={{ fontSize: 10, color: "#b5e8a1", marginLeft: 4 }}>+1 CF</span>
                )}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ color: "#c7bca5" }}>Levy Archers:</span>
              <span>
                <strong>{totalLevyArcherUnits}</strong>
                <span style={{ color: "#888" }}> / {levyArchPotential}</span>
                {deity?.bonuses.farmLevyBonus && (
                  <span style={{ fontSize: 10, color: "#b5e8a1", marginLeft: 4 }}>Altaea</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs">
        <button
          className={`tab ${
            activeTab === "regions" ? "active" : ""
          }`}
          onClick={() => setActiveTab("regions")}
        >
          Regions
        </button>
        <button
          className={`tab ${
            activeTab === "army" ? "active" : ""
          }`}
          onClick={() => setActiveTab("army")}
        >
          Army & Navy
        </button>
        <button
          className={`tab ${
            activeTab === "agents" ? "active" : ""
          }`}
          onClick={() => setActiveTab("agents")}
        >
          Agents
        </button>
        <button
          className={`tab ${
            activeTab === "mailbox" ? "active" : ""
          }`}
          onClick={() => setActiveTab("mailbox")}
          style={{ position: "relative" }}
        >
          Mailbox
          {unreadCount > 0 && (
            <span style={{
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
            }}>
              {unreadCount}
            </span>
          )}
        </button>
        <button
          className={`tab ${
            activeTab === "characters" ? "active" : ""
          }`}
          onClick={() => setActiveTab("characters")}
        >
          Characters
        </button>
        <button
          className={`tab ${
            activeTab === "religion" ? "active" : ""
          }`}
          onClick={() => setActiveTab("religion")}
        >
          Religion
        </button>
        <button
          className={`tab ${
            activeTab === "court" ? "active" : ""
          }`}
          onClick={() => setActiveTab("court")}
        >
          High Court
        </button>
      </div>

      {/* REGIONS TAB */}
      {activeTab === "regions" && (
        <>
          {regions.length === 0 && (
            <p>No regions found.</p>
          )}
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
                  <button
                    onClick={() => changeWarships(-1)}
                  >
                    -
                  </button>
                  <button
                    onClick={() => changeWarships(1)}
                  >
                    +
                  </button>
                </div>
              )}
              <p
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "#c7bca5",
                }}
              >
                Upkeep:{" "}
                {getModifiedUpkeep(
                  "warships",
                  3,
                  patronDeity
                )}{" "}
                gold/turn per warship
                {deity?.bonuses.warshipUpkeep && (
                  <span
                    style={{
                      color: "#b5e8a1",
                    }}
                  >
                    {" "}
                    (Trengar bonus)
                  </span>
                )}
              </p>
              <div
                style={{
                  marginTop: "8px",
                  paddingTop: "8px",
                  borderTop:
                    "1px solid #4c3b2a",
                }}
              >
                <strong>Total Navy Upkeep:</strong>{" "}
                {navyGoldUpkeep} gold/turn
              </div>
            </div>

            {courtBonuses.positions.some(p => p.position === 'Lord Marshal') && (
              <div className="summary-card">
                <h3>Army Capacity</h3>
                <p style={{ color: "#8B008B", fontSize: 14 }}>
                  <strong>Lord Marshal Bonus:</strong> Can maintain up to {maxArmyCap} armies
                </p>
                <p style={{ fontSize: 12, color: "#c7bca5" }}>
                  Current armies: {armies.filter(a => !a.deleted).length} / {maxArmyCap}
                </p>
              </div>
            )}

            {deity?.bonuses.armyMovement && (
              <div className="summary-card">
                <h3>Divine Movement</h3>
                <p
                  style={{
                    color: "#b5e8a1",
                    fontSize: 14,
                  }}
                >
                  <strong>
                    Kurimbor's Blessing:
                  </strong>{" "}
                  Armies can move 2 regions per turn
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "#c7bca5",
                  }}
                >
                  This bonus is handled at the table
                </p>
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 16,
              marginBottom: 8,
            }}
          >
            <h2
              style={{
                fontSize: 18,
                margin: 0,
              }}
            >
              Armies ({armies.filter(a => !a.deleted).length}/{maxArmyCap})
            </h2>
            {isOwnerView && (
              <button
                className="green"
                onClick={addArmy}
                disabled={armies.filter(a => !a.deleted).length >= maxArmyCap}
              >
                + Raise New Army
              </button>
            )}
          </div>

          {deity?.bonuses.levyInfantryCF && (
            <p
              style={{
                fontSize: 12,
                color: "#b5e8a1",
                marginBottom: 8,
              }}
            >
              * Seyluna grants +1 Combat Factor to all
              Levy Infantry
            </p>
          )}

          {armies.length === 0 && (
            <p style={{ color: "#c7bca5" }}>
              No armies yet. Use "Raise New Army" to
              create one and assign units to it.
            </p>
          )}

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

      {/* AGENTS TAB (combined with Missions) */}
      {activeTab === "agents" && (
        <>
          {/* Sub-tab toggle */}
          <div style={{ 
            display: "flex", 
            gap: 8, 
            marginBottom: 16,
            borderBottom: "1px solid #3a2f24",
            paddingBottom: 12
          }}>
            <button
              onClick={() => setAgentSubTab("roster")}
              style={{
                padding: "8px 16px",
                background: agentSubTab === "roster" ? "#30425d" : "transparent",
                border: agentSubTab === "roster" ? "1px solid #d1b26b" : "1px solid #5e4934",
                borderRadius: 6,
                color: agentSubTab === "roster" ? "#f9f4e6" : "#c7bca5",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Agent Roster
            </button>
            <button
              onClick={() => setAgentSubTab("missions")}
              style={{
                padding: "8px 16px",
                background: agentSubTab === "missions" ? "#30425d" : "transparent",
                border: agentSubTab === "missions" ? "1px solid #d1b26b" : "1px solid #5e4934",
                borderRadius: 6,
                color: agentSubTab === "missions" ? "#f9f4e6" : "#c7bca5",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Missions
            </button>
          </div>

          {/* Sub-tab content */}
          {agentSubTab === "roster" && renderAgentsTab()}
          {agentSubTab === "missions" && (
            <AgentMissions
              factionId={Number(id)}
              factionName={factionData?.name || `Faction ${id}`}
              agents={agents.filter(a => !a.deleted)}
              allRegions={allRegions}
              allArmies={allArmies.filter(a => !a.deleted)}
              allCharacters={allCharacters}
              revealedEnemyAgents={allAgents.filter(a => 
                a.revealed && 
                a.factionId !== Number(id) && 
                !a.deleted
              )}
              isOwner={isOwnerView}
            />
          )}
        </>
      )}

      {/* MAILBOX TAB */}
      {activeTab === "mailbox" && (
        <div>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "20px"
          }}>
            <h2 style={{ margin: 0 }}> Royal Correspondence</h2>
            {isOwnerView && (
              <button 
                className="green"
                onClick={() => setComposeOpen(true)}
              >
                 Compose Message
              </button>
            )}
          </div>

          {/* Compose Modal */}
          {composeOpen && (
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
                border: "2px solid #5e4934",
                borderRadius: "12px",
                padding: "24px",
                maxWidth: "500px",
                width: "90%",
              }}>
                <h3 style={{ marginTop: 0 }}>Compose Message</h3>
                
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}>
                    Send To:
                  </label>
                  <select
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="gm">Game Master (No word limit)</option>
                    {Object.entries(allFactionNames)
                      .filter(([fId]) => Number(fId) !== Number(id))
                      .map(([fId, name]) => (
                        <option key={fId} value={fId}>
                          {name} (250 char limit)
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}>
                    Message: {composeTo !== "gm" && (
                      <span style={{ 
                        color: composeBody.trim().length > 250 ? "#ef4444" : 
                               composeBody.trim().length > 200 ? "#f97316" : "#c7bca5"
                      }}>
                        ({composeBody.trim().length}/250 characters)
                      </span>
                    )}
                  </label>
                  <textarea
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder={composeTo === "gm" 
                      ? "Write your message to the Game Master..." 
                      : "Write your message (250 characters max)..."}
                    style={{ 
                      width: "100%", 
                      minHeight: "100px",
                      resize: "vertical"
                    }}
                  />
                </div>

                {/* Preview */}
                {composeBody.trim() && (
                  <div style={{
                    background: "#0a0806",
                    border: "1px solid #3a2f24",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "16px",
                  }}>
                    <div style={{ fontSize: "11px", color: "#a89a7a", marginBottom: "8px" }}>
                      Preview:
                    </div>
                    <p style={{ 
                      fontStyle: "italic", 
                      margin: 0,
                      color: "#f4efe4",
                      lineHeight: "1.6"
                    }}>
                      My Lord,
                      <br /><br />
                      {composeBody.trim()}
                      <br /><br />
                      Signed,
                      <br />
                      {factionData?.name || `Lord of Faction ${id}`}
                    </p>
                  </div>
                )}

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  <button onClick={() => {
                    setComposeOpen(false);
                    setComposeBody("");
                  }}>
                    Cancel
                  </button>
                  <button 
                    className="green"
                    onClick={sendMessage}
                    disabled={!composeBody.trim()}
                  >
                    Send Raven
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Message List */}
          {messages.length === 0 ? (
            <div style={{ 
              textAlign: "center", 
              color: "#a89a7a",
              padding: "40px",
              background: "#1a1410",
              borderRadius: "8px",
              border: "1px solid #3a2f24"
            }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}></div>
              <p>Your mailbox is empty.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {messages.map(msg => (
                <div
                  key={msg.id}
                  onClick={() => {
                    setSelectedMessage(msg);
                    if (!msg.read) markMessageRead(msg.id);
                  }}
                  style={{
                    padding: "16px",
                    background: msg.read ? "#1a1410" : "#1f1a14",
                    border: `1px solid ${msg.read ? "#3a2f24" : "#5e4934"}`,
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "border-color 0.2s",
                  }}
                >
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between",
                    alignItems: "flex-start"
                  }}>
                    <div>
                      <div style={{ 
                        fontWeight: msg.read ? "normal" : "bold",
                        color: msg.read ? "#c7bca5" : "#f4efe4",
                        marginBottom: "4px"
                      }}>
                        {msg.type === "mission" ? " Mission Report" : " Message"}: From {msg.fromFactionName || (msg.toType === "gm" ? "System" : "Unknown")}
                      </div>
                      <div style={{ fontSize: "12px", color: "#a89a7a" }}>
                        {msg.createdAt?.toDate?.().toLocaleDateString() || "Unknown date"}
                      </div>
                    </div>
                    {!msg.read && (
                      <span style={{
                        background: "#d4a32c",
                        color: "#000",
                        fontSize: "10px",
                        fontWeight: "bold",
                        padding: "2px 8px",
                        borderRadius: "4px",
                      }}>
                        NEW
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Message Detail Modal */}
          {selectedMessage && (
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
                border: "2px solid #5e4934",
                borderRadius: "12px",
                padding: "24px",
                maxWidth: "600px",
                width: "90%",
                maxHeight: "80vh",
                overflow: "auto",
              }}>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "16px"
                }}>
                  <div>
                    <h3 style={{ margin: 0 }}>
                      {selectedMessage.type === "mission" ? " Mission Report" : " Royal Message"}
                    </h3>
                    <div style={{ fontSize: "12px", color: "#a89a7a", marginTop: "4px" }}>
                      From: {selectedMessage.fromFactionName || "System"}  {selectedMessage.createdAt?.toDate?.().toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: "#0a0806",
                  border: "1px solid #3a2f24",
                  borderRadius: "8px",
                  padding: "20px",
                  marginBottom: "16px",
                }}>
                  {selectedMessage.type === "mission" ? (
                    <div>
                      <div style={{ 
                        color: selectedMessage.success ? "#4ade80" : "#ef4444",
                        fontWeight: "bold",
                        marginBottom: "12px",
                        fontSize: "16px"
                      }}>
                        {selectedMessage.success ? " Mission Successful" : " Mission Failed"}
                      </div>
                      <p style={{ 
                        fontStyle: "italic", 
                        margin: 0,
                        color: "#f4efe4",
                        lineHeight: "1.6"
                      }}>
                        My Lord,
                        <br /><br />
                        {selectedMessage.body}
                        <br /><br />
                        <span style={{ color: "#a89a7a" }}>- Your humble spymaster</span>
                      </p>
                    </div>
                  ) : (
                    <p style={{ 
                      fontStyle: "italic", 
                      margin: 0,
                      color: "#f4efe4",
                      lineHeight: "1.6"
                    }}>
                      My Lord,
                      <br /><br />
                      {selectedMessage.body}
                      <br /><br />
                      Signed,
                      <br />
                      {selectedMessage.fromFactionName}
                    </p>
                  )}
                </div>

                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                  <button 
                    onClick={() => deleteMessage(selectedMessage.id)}
                    style={{ 
                      background: "#3a2020",
                      borderColor: "#5a3030"
                    }}
                  >
                     Delete
                  </button>
                  <button onClick={() => setSelectedMessage(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHARACTERS TAB */}
      {activeTab === "characters" &&
        renderCharactersTab()}

      {/* RELIGION TAB */}
      {activeTab === "religion" &&
        renderReligionTab()}

      {/* COURT TAB */}
      {activeTab === "court" && (
        <Court 
          isGM={isGM}
          myFactionId={Number(id)}
          factionNames={allFactionNames}
          patronDeity={patronDeity}
        />
      )}
    </div>
  );
}