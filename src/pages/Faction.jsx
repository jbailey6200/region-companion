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
// import Map from "../components/Map";
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

      if (deity) {
        if (deity.bonuses.townGold && name === "Town") gold += deity.bonuses.townGold;
        if (deity.bonuses.cityGold && name === "City") gold += deity.bonuses.cityGold;

        if (deity.bonuses.mineGold && (name === "Mine" || name === "Mine2"))
          gold += deity.bonuses.mineGold;

        if (deity.bonuses.settlementManpower &&
          (name === "Village" || name === "Town" || name === "City"))
          manpower += deity.bonuses.settlementManpower;

        if (name === "Keep" && deity.bonuses.keepHSG) hsgCap += deity.bonuses.keepHSG;
        if (name === "Castle" && deity.bonuses.castleHSG) hsgCap += deity.bonuses.castleHSG;

        if (name === "Farm" && deity.bonuses.farmLevyBonus)
          levyArch += deity.bonuses.farmLevyBonus;
        if (name === "Farm2" && deity.bonuses.farm2LevyBonus)
          levyArch += deity.bonuses.farm2LevyBonus;
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

    if (deity) {
      if (terrain === TERRAIN_TYPES.RIVER && deity.bonuses.riverGold)
        regionGold += deity.bonuses.riverGold;

      if (
        deity.bonuses.mountainHillsGold &&
        (terrain === TERRAIN_TYPES.MOUNTAINS || terrain === TERRAIN_TYPES.HILLS)
      )
        regionGold += deity.bonuses.mountainHillsGold;

      if (terrain === TERRAIN_TYPES.COAST && deity.bonuses.coastalGold)
        regionGold += deity.bonuses.coastalGold;

      if (terrain === TERRAIN_TYPES.MOUNTAINS && deity.bonuses.mountainGold)
        regionGold += deity.bonuses.mountainGold;
    }

    const unrest = r.unrest || 0;

    switch (unrest) {
      case 2:
        regionLevyInf = Math.round(regionLevyInf * 0.75);
        regionLevyArch = Math.round(regionLevyArch * 0.75);
        break;
      case 3:
        regionLevyInf = Math.round(regionLevyInf * 0.5);
        regionLevyArch = Math.round(regionLevyArch * 0.5);
        regionGold -= 1;
        break;
      case 4:
        regionLevyInf = 0;
        regionLevyArch = 0;
        regionGold -= 3;
        regionHsgCap = Math.floor(regionHsgCap * 0.75);
        break;
      case 5:
        regionLevyInf = 0;
        regionLevyArch = 0;
        regionGold = 0;
        regionHsgCap = 0;
        break;
      default:
        break;
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
  "1": null,
  "2": "/holmes.png",
  "3": null,
  "4": null,
  "5": null,
  "6": null,
  "7": "/stanford.png",
  "8": null,
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

  const [factionData, setFactionData] = useState(null);
  const [armies, setArmies] = useState([]);

  const [agents, setAgents] = useState([]);
  const [newAgentType, setNewAgentType] = useState("spy");
  const [newAgentName, setNewAgentName] = useState("");

  const [characters, setCharacters] = useState([]);
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [newCharFirstName, setNewCharFirstName] = useState("");
  const [newCharLastName, setNewCharLastName] = useState("");

  const [patronDeity, setPatronDeity] = useState(null);

  const [role, setRole] = useState(null);
  const [myFactionId, setMyFactionId] = useState(null);

  const [isEditingFactionName, setIsEditingFactionName] = useState(false);
  const [editedFactionName, setEditedFactionName] = useState("");

  const [factionCrest, setFactionCrest] = useState(null);

  // NEW: Court positions state
  const [courtPositions, setCourtPositions] = useState([]);

  // FIX: Add proper faction names loading for Court
  const [allFactionNames, setAllFactionNames] = useState({});

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

  // FIX: Load ALL faction names properly for Court
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

  // NEW: Load court positions
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

  // NEW: Get court bonuses for current faction
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
        // Provide default values for all expected fields
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
        // Override with actual data
        ...d.data(),
      }));
      // Filter out any armies that might have bad data
      const validArmies = list.filter(army => {
        // Ensure commanders is always an array
        if (!Array.isArray(army.commanders)) {
          army.commanders = [];
        }
        return true; // Keep all armies now that we've fixed them
      });
      setArmies(validArmies);
    });
    return () => unsub();
  }, [id]);

  async function addArmy() {
    if (!isOwnerView) return;
    
    // Check army cap with court bonus
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
    const ref = doc(
      db,
      "factions",
      String(id),
      "armies",
      armyId
    );
    await updateDoc(ref, { commanders: commanderIds });
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

  const townCount = eco?.townCount || 0;
  const cityCount = eco?.cityCount || 0;

  const maxAgents = townCount * 1 + cityCount * 2;
  const agentsCount = agents.length;

  const totalAgentUpkeep = agents.reduce((sum, a) => {
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

  async function handleHireAgent(e) {
    e.preventDefault();
    if (!canEditAgents) return;

    // Check agent cap with court bonus
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
    });

    show(
      "Agent Hired",
      `${name} (${type}) hired${
        startingLevel > 1 ? " at level 2" : ""
      }.`
    );

    setNewAgentName("");
  }

  async function handleDeleteAgent(agentId) {
    if (!canEditAgents) return;
    if (!window.confirm("Delete this agent?")) return;
    const ref = doc(db, "agents", agentId);
    await deleteDoc(ref);
    show("Agent Deleted", "The agent has been removed.");
  }

  async function handleAgentLevelChange(agentId, newLevel) {
    if (!canEditAgents) return;
    const level = Math.max(
      1,
      Math.min(10, Number(newLevel))
    );
    const ref = doc(db, "agents", agentId);
    await updateDoc(ref, { level });
  }

  function renderAgentCard(agent) {
    const typeLabel =
      agent.type === "spy"
        ? "Spy"
        : agent.type === "agitator"
        ? "Agitator"
        : "Enforcer";

    const typeColor =
      agent.type === "spy"
        ? "#4a607d"
        : agent.type === "agitator"
        ? "#b3403d"
        : "#6a8f4e";

    const baseUpkeep = AGENT_UPKEEP[agent.type] || 0;
    const modifiedUpkeep = getModifiedUpkeep(
      agent.type,
      baseUpkeep,
      patronDeity
    );

    return (
      <div
        key={agent.id}
        className="card"
        style={{ marginBottom: 12 }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <h3 style={{ margin: 0, flex: 1 }}>
              {agent.name || "Unnamed Agent"}
            </h3>

            {canEditAgents && (
              <button
                className="small"
                onClick={() =>
                  handleDeleteAgent(agent.id)
                }
                style={{
                  background: "#8b3a3a",
                  border: "1px solid #6d2828",
                  margin: 0,
                  flexShrink: 0,
                }}
              >
                Delete
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                padding: "3px 10px",
                borderRadius: 999,
                border: "1px solid #4c3b2a",
                background: typeColor,
                color: "#f8f4e8",
                fontFamily: "Georgia, serif",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {typeLabel}
            </span>

            <span
              style={{
                color: "#c7bca5",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 13,
              }}
            >
              Level
              <input
                type="number"
                min="1"
                max="10"
                value={agent.level || 1}
                onChange={(e) =>
                  handleAgentLevelChange(
                    agent.id,
                    e.target.value
                  )
                }
                disabled={!canEditAgents}
                style={{
                  width: 50,
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid #5e4934",
                  background: canEditAgents
                    ? "#1d1610"
                    : "#2a2218",
                  color: "#f3eadc",
                  fontFamily: "Georgia, serif",
                  fontSize: 14,
                }}
              />
            </span>

            <span
              style={{
                color: "#a89a7a",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              Upkeep:{" "}
              {baseUpkeep !== modifiedUpkeep ? (
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

              <label
                style={{
                  fontSize: 14,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Name:</span>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) =>
                    setNewAgentName(e.target.value)
                  }
                  placeholder="Optional agent name"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #5e4934",
                    background: "#1d1610",
                    color: "#f3eadc",
                    fontFamily: "Georgia, serif",
                    fontSize: 16,
                  }}
                />
              </label>

              <button
                type="submit"
                disabled={!canRaiseAgentWithCourt(agentsCount, maxAgents, courtBonuses)}
                style={{ margin: 0 }}
              >
                Hire Agent
              </button>
            </form>
          </div>
        )}

        <h2
          style={{
            fontSize: 18,
            marginTop: 8,
          }}
        >
          Active Agents
        </h2>
        {agents.length === 0 && (
          <p style={{ color: "#c7bca5" }}>
            No agents yet. Hire an agent to begin
            building your network.
          </p>
        )}
        {agents.map((agent) => renderAgentCard(agent))}
      </>
    );
  }

  function renderCharactersTab() {
    return (
      <>
        <div className="summary-row">
          <div className="summary-card">
            <h3>House Members</h3>
            <p>
              Total Characters:{" "}
              <strong>{characters.length}</strong>
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#c7bca5",
              }}
            >
              Track your noble house members and
              their abilities
            </p>
          </div>
        </div>

        {isOwnerView && (
          <>
            {!isAddingCharacter ? (
              <button
                onClick={() =>
                  setIsAddingCharacter(true)
                }
                className="green"
                style={{ marginBottom: 16 }}
              >
                + Add House Member
              </button>
            ) : (
              <div
                className="card"
                style={{ marginBottom: 16 }}
              >
                <h3 style={{ marginTop: 0 }}>
                  New House Member
                </h3>
                <p
                  style={{
                    fontSize: 12,
                    color: "#c7bca5",
                    marginBottom: 12,
                  }}
                >
                  Stats will be randomly generated
                  (1-10 scale)
                </p>
                <form
                  onSubmit={handleAddCharacter}
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    type="text"
                    value={newCharFirstName}
                    onChange={(e) =>
                      setNewCharFirstName(
                        e.target.value
                      )
                    }
                    placeholder="First name"
                    autoFocus
                    style={{
                      flex: "1 1 150px",
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid #5e4934",
                      background: "#1d1610",
                      color: "#f3eadc",
                      fontFamily: "Georgia, serif",
                      fontSize: 16,
                    }}
                  />
                  <input
                    type="text"
                    value={newCharLastName}
                    onChange={(e) =>
                      setNewCharLastName(
                        e.target.value
                      )
                    }
                    placeholder="Last name"
                    style={{
                      flex: "1 1 150px",
                      padding: "8px 12px",
                      borderRadius: 8,
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
              Select Patron Deity
            </h3>
            <p
              style={{
                fontSize: 12,
                color: "#c7bca5",
                marginBottom: 12,
              }}
            >
              Choose a deity to receive
              faction-wide bonuses
            </p>

            <select
              value={patronDeity || ""}
              onChange={(e) =>
                changePatronDeity(e.target.value)
              }
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 8,
                border: "1px solid #5e4934",
                background: "#1d1610",
                color: "#f4efe4",
                fontFamily: "Georgia, serif",
                fontSize: 16,
              }}
            >
              <option value="">
                No Patron Deity
              </option>
              <optgroup label="Adiri (New Gods)">
                {Object.entries(DEITIES)
                  .filter(
                    ([_, d]) => d.type === "adiri"
                  )
                  .map(([key, deity]) => (
                    <option key={key} value={key}>
                      {deity.name} - {deity.title}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Adaar (Old Gods)">
                {Object.entries(DEITIES)
                  .filter(
                    ([_, d]) => d.type === "adaar"
                  )
                  .map(([key, deity]) => (
                    <option key={key} value={key}>
                      {deity.name} - {deity.title}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        )}

        {currentDeity && (
          <div className="card">
            <h2
              style={{
                fontSize: 20,
                marginTop: 0,
                marginBottom: 12,
              }}
            >
              {currentDeity.name}
            </h2>
            <p
              style={{
                color: "#d1b26b",
                marginBottom: 12,
              }}
            >
              {currentDeity.title}
            </p>

            <h3
              style={{
                fontSize: 16,
                marginBottom: 8,
              }}
            >
              Divine Bonuses:
            </h3>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
              }}
            >
              {currentDeity.description.map(
                (bonus, idx) => (
                  <li
                    key={idx}
                    style={{
                      marginBottom: 6,
                      color: "#b5e8a1",
                    }}
                  >
                    {bonus}
                  </li>
                )
              )}
            </ul>

            {(currentDeity.bonuses
              .characterLeadership ||
              currentDeity.bonuses
                .characterProwess ||
              currentDeity.bonuses
                .characterIntrigue) && (
              <p
                style={{
                  fontSize: 12,
                  color: "#a89a7a",
                  marginTop: 12,
                }}
              >
                * Character bonuses are shown in
                green on character cards
              </p>
            )}

            {currentDeity.bonuses
              .armyMovement && (
              <p
                style={{
                  fontSize: 12,
                  color: "#a89a7a",
                  marginTop: 8,
                }}
              >
                * Army movement bonus is handled at
                the table
              </p>
            )}
          </div>
        )}
      </>
    );
  }

  const totalHsgUnits = useMemo(
    () =>
      armies.reduce(
        (sum, a) =>
          sum +
          (a.huscarls || 0) +
          (a.dismountedKnights || 0) +
          (a.mountedKnights || 0) +
          (a.lightHorse || 0),
        0
      ),
    [armies]
  );

  const hsgCap = eco?.hsgCap || 0;
  const hsgUsed = totalHsgUnits * 10;
  const overHsgCap = hsgUsed > hsgCap;

  const hsgGoldUpkeep = useMemo(
    () =>
      armies.reduce(
        (sum, a) =>
          sum +
          (a.huscarls || 0) *
            getModifiedUpkeep(
              "huscarls",
              2,
              patronDeity
            ) +
          (a.dismountedKnights || 0) *
            getModifiedUpkeep(
              "dismountedKnights",
              3,
              patronDeity
            ) +
          (a.mountedKnights || 0) *
            getModifiedUpkeep(
              "mountedKnights",
              4,
              patronDeity
            ) +
          (a.lightHorse || 0) *
            getModifiedUpkeep("lightHorse", 2, patronDeity),
        0
      ),
    [armies, patronDeity]
  );

  const levyUnitsTotal =
    totalLevyInfantryUnits + totalLevyArcherUnits;
  const levyGoldUpkeep = Math.round(
    levyUnitsTotal * LEVY_UPKEEP_PER_UNIT
  );

  const levyInfPotential = eco?.levyInfantry || 0;
  const levyArchPotential = eco?.levyArchers || 0;

  const levyInfPotentialUnits = Math.floor(
    levyInfPotential / 10
  );
  const levyArchPotentialUnits = Math.floor(
    levyArchPotential / 10
  );

  const warships =
    factionData?.navy?.warships != null
      ? factionData.navy.warships
      : 0;

  const navyGoldUpkeep =
    warships *
    getModifiedUpkeep("warships", 3, patronDeity);

  const buildingsGold = eco?.goldPerTurn || 0;
  const manpowerNet = eco?.manpowerNet || 0;

  const netGoldPerTurn =
    buildingsGold -
    hsgGoldUpkeep -
    levyGoldUpkeep -
    navyGoldUpkeep -
    totalAgentUpkeep;

  const goldNegative = netGoldPerTurn < 0;
  const manpowerNegative = manpowerNet < 0;

  const deity = patronDeity ? DEITIES[patronDeity] : null;

  const factionName =
    factionData?.name && factionData.name.trim() !== ""
      ? factionData.name
      : `Faction ${id}`;

  if (!role) {
    return (
      <div className="container">
        <h1>Loading...</h1>
      </div>
    );
  }

  // Get the army cap
  const maxArmyCap = getMaxArmyCap(3, courtBonuses);

  return (
    <div className="container">
      <Toast toasts={toasts} remove={remove} />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <button
            onClick={() => navigate("/")}
            style={{ marginBottom: 0 }}
          >
            ← Home
          </button>
          {isGM && (
            <button
              onClick={() => navigate("/gm")}
              className="small"
            >
              GM Panel
            </button>
          )}
        </div>

        {role === "faction" && (
          <p
            style={{
              marginTop: 0,
              marginBottom: 0,
              color: "#c7bca5",
              fontSize: 14,
            }}
          >
            You are{" "}
            <strong>
              Faction {myFactionId ?? "?"}
              {isOwnerView && !isGM
                ? " (this is you)"
                : ""}
            </strong>
          </p>
        )}
        {isGM && (
          <p
            style={{
              marginTop: 0,
              marginBottom: 0,
              color: "#c7bca5",
              fontSize: 13,
            }}
          >
            <strong>GM mode</strong>
          </p>
        )}
      </div>

      {factionCrest && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 150,
              height: 150,
              background: "#1a1410",
              borderRadius: 12,
              border: "2px solid #4c3b2a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow:
                "0 8px 24px rgba(0, 0, 0, 0.7)",
            }}
          >
            <img
              src={factionCrest}
              alt="Faction Crest"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                padding: 10,
              }}
              onError={(e) => {
                e.target.style.display = "none";
                e.target.parentElement.innerHTML =
                  '<span style="color: #c7bca5; font-size: 12px; text-align: center;">No Crest<br/>Add image to<br/>public folder</span>';
              }}
            />
          </div>
        </div>
      )}

      {isEditingFactionName ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <input
            type="text"
            value={editedFactionName}
            onChange={(e) =>
              setEditedFactionName(e.target.value)
            }
            placeholder={`Faction ${id}`}
            autoFocus
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #5e4934",
              background: "#1d1610",
              color: "#eaddc0",
              fontFamily: "Georgia, serif",
              fontSize: 28,
              fontWeight: "bold",
              flex: 1,
              maxWidth: 400,
            }}
          />
          <button
            onClick={saveFactionName}
            className="small"
            style={{
              padding: "8px 16px",
              background: "#4a6642",
              borderColor: "#5a7a52",
            }}
          >
            Save
          </button>
          <button
            onClick={cancelEditFactionName}
            className="small"
            style={{ padding: "8px 16px" }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
            justifyContent: "center",
          }}
        >
          <h1
            style={{
              fontFamily: "Georgia, serif",
              color: "#eaddc0",
              fontSize: 30,
              margin: 0,
              wordBreak: "break-word",
            }}
          >
            {factionName}
          </h1>
          {isOwnerView && (
            <button
              onClick={() => {
                setEditedFactionName(factionData?.name || "");
                setIsEditingFactionName(true);
              }}
              className="small"
              style={{
                padding: "6px 12px",
                background: "transparent",
                border: "1px solid #5e4934",
              }}
              title="Edit faction name"
            >
              Edit
            </button>
          )}
        </div>
      )}

      <div className="summary-row">
        <div className="summary-card">
          <h3>Buildings Economy</h3>
          <p>
            Gold/turn:{" "}
            <strong>{buildingsGold}</strong>
            {deity && eco?.deityBonuses && (
              <span
                style={{
                  fontSize: 11,
                  color: "#b5e8a1",
                }}
              >
                {" "}
                (includes deity bonuses)
              </span>
            )}
            {courtBonuses.gold > 0 && (
              <span
                style={{
                  fontSize: 11,
                  color: "#8B008B",
                }}
              >
                {" "}
                (includes +{courtBonuses.gold} court)
              </span>
            )}
          </p>
          <p title="If negative, shut off manpower-consuming buildings until >= 0.">
            Manpower/turn:{" "}
            <strong
              className={
                manpowerNegative ? "warning" : "ok"
              }
            >
              {manpowerNet}
            </strong>
          </p>
        </div>

        <div className="summary-card">
          <h3>HSG & Capacity</h3>
          <p>
            HSG cap: <strong>{hsgCap}</strong>
            {deity?.bonuses.keepHSG && (
              <span
                style={{
                  fontSize: 11,
                  color: "#b5e8a1",
                }}
              >
                {" "}
                (Umara bonus)
              </span>
            )}
          </p>
          <p>
            HSG used:{" "}
            <strong
              className={
                overHsgCap ? "warning" : "ok"
              }
            >
              {hsgUsed} / {hsgCap}
            </strong>
          </p>
          <p
            style={{
              fontSize: 12,
              color: "#c7bca5",
            }}
          >
            Each HSG unit represents 10 men.
          </p>
        </div>

        <div className="summary-card">
          <h3>Net Gold</h3>
          <p>
            HSG upkeep: {hsgGoldUpkeep}
            {(deity?.bonuses.huscarlUpkeep ||
              deity?.bonuses
                .dismountedKnightUpkeep ||
              deity?.bonuses
                .mountedKnightUpkeep) && (
              <span
                style={{
                  fontSize: 11,
                  color: "#b5e8a1",
                }}
              >
                {" "}
                *
              </span>
            )}
          </p>
          <p>Levies upkeep: {levyGoldUpkeep}</p>
          <p>
            Warship upkeep: {navyGoldUpkeep}
            {deity?.bonuses.warshipUpkeep && (
              <span
                style={{
                  fontSize: 11,
                  color: "#b5e8a1",
                }}
              >
                {" "}
                *
              </span>
            )}
          </p>
          <p>
            Agent upkeep: {totalAgentUpkeep}
            {deity?.bonuses.agitatorUpkeep && (
              <span
                style={{
                  fontSize: 11,
                  color: "#b5e8a1",
                }}
              >
                {" "}
                *
              </span>
            )}
          </p>
          {courtBonuses.positions.length > 0 && (
            <>
              <p style={{ borderTop: "1px solid #4c3b2a", paddingTop: 4, marginTop: 4, fontSize: 12, color: "#8B008B" }}>
                Court Bonuses:
              </p>
              {courtBonuses.positions.map((pos, idx) => (
                <p key={idx} style={{ fontSize: 11, color: "#8B008B", marginLeft: 10, margin: "2px 0 2px 10px" }}>
                  {pos.icon} {pos.name}: +{pos.goldBonus}
                </p>
              ))}
            </>
          )}
          <p title="If negative, disband units first; then shut off gold-costing buildings.">
            Net Gold/turn:{" "}
            <strong
              className={
                goldNegative ? "warning" : "ok"
              }
            >
              {netGoldPerTurn}
            </strong>
          </p>
        </div>

        <div className="summary-card">
          <h3>Farms, Mines, Levies</h3>
          <p>
            Farms (eq):{" "}
            <strong>{eco?.farmEquivalent ?? 0}</strong>
          </p>
          <p>
            Mines (eq):{" "}
            <strong>{eco?.mineEquivalent ?? 0}</strong>
          </p>
          <p>
            Levy Inf Potential:{" "}
            <strong>{levyInfPotential}</strong>
            {deity?.bonuses.levyInfantryCF && (
              <span
                style={{
                  fontSize: 11,
                  color: "#b5e8a1",
                }}
              >
                {" "}
                (+1 CF)
              </span>
            )}
          </p>
          <p>
            Levy Inf Raised:{" "}
            <strong>
              {totalLevyInfantryUnits} units
            </strong>
          </p>
          <p>
            Levy Arch Potential:{" "}
            <strong>{levyArchPotential}</strong>
            {deity?.bonuses.farmLevyBonus && (
              <span
                style={{
                  fontSize: 11,
                  color: "#b5e8a1",
                }}
              >
                {" "}
                (Altaea)
              </span>
            )}
          </p>
          <p>
            Levy Arch Raised:{" "}
            <strong>
              {totalLevyArcherUnits} units
            </strong>
          </p>
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
      {activeTab === "agents" && renderAgentsTab()}

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
          factionNames={allFactionNames}  // FIX: Use the properly loaded faction names
          patronDeity={patronDeity}
        />
      )}
    </div>
  );
}