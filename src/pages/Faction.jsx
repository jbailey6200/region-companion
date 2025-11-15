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
import { getAuthState } from "../utils/auth";

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
   CONSTANTS / ECONOMY
-------------------------------------------------------- */

const BUILDING_RULES = {
  Village: {
    gold: 3,
    manpower: 20,
    manpowerCost: 2,
    hsgCap: 50,
    levyInf: 200,
    settlement: true,
  },
  Town: {
    gold: 5,
    manpower: 40,
    manpowerCost: 4,
    hsgCap: 100,
    levyInf: 400,
    settlement: true,
  },
  City: {
    gold: 8,
    manpower: 80,
    manpowerCost: 10,
    hsgCap: 150,
    levyInf: 800,
    settlement: true,
  },

  Farm: {
    gold: 0,
    manpower: 0,
    manpowerCost: 2,
    levyArch: 40,
    farmEquivalent: 1,
  },
  Farm2: {
    gold: 0,
    manpower: 0,
    manpowerCost: 4,
    levyArch: 80,
    farmEquivalent: 2,
  },

  Mine: {
    gold: 2,
    manpower: 0,
    manpowerCost: 2,
    mineEquivalent: 1,
  },
  Mine2: {
    gold: 4,
    manpower: 0,
    manpowerCost: 4,
    mineEquivalent: 2,
  },

  Keep: {
    gold: -3,
    manpower: 0,
    manpowerCost: 2,
    hsgCap: 150,
  },
  Castle: {
    gold: -6,
    manpower: 0,
    manpowerCost: 4,
    hsgCap: 250,
  },
};

const AGENT_UPKEEP = {
  spy: 1,
  agitator: 4,
  enforcer: 2,
};

function calculateEconomy(regions) {
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

  for (const r of regions) {
    const ups = r.upgrades || [];
    const disabled = r.disabledUpgrades || [];

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

      regionGold += (rule.gold || 0) * count;
      regionManProd += (rule.manpower || 0) * count;
      regionManCost += (rule.manpowerCost || 0) * count;
      regionHsgCap += (rule.hsgCap || 0) * count;
      regionFarmEq += (rule.farmEquivalent || 0) * count;
      regionMineEq += (rule.mineEquivalent || 0) * count;
      regionLevyInf += (rule.levyInf || 0) * count;
      regionLevyArch += (rule.levyArch || 0) * count;

      if (name === "Town") townCountTotal += count;
      if (name === "City") cityCountTotal += count;
      if (name === "Village") villageCountTotal += count;
    });

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
  };
}

const LEVY_UPKEEP_PER_UNIT = 0.25;

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

  const [role, setRole] = useState(null);
  const [myFactionId, setMyFactionId] = useState(null);

  // Authorization check
  useEffect(() => {
    const auth = getAuthState();
    
    if (!auth) {
      navigate("/");
      return;
    }

    setRole(auth.role);
    setMyFactionId(auth.factionId);

    // GM can view any faction
    if (auth.role === "gm") {
      return;
    }

    // Faction players can only view their own faction
    if (auth.role === "faction" && auth.factionId !== Number(id)) {
      navigate(`/faction/${auth.factionId}`);
    }
  }, [id, navigate]);

  const isGM = role === "gm";
  const isOwnerView = (role === "faction" && myFactionId === Number(id)) || isGM;
  const canEditAgents = isOwnerView || isGM;

  /* ---------------- REGIONS ---------------- */

  useEffect(() => {
    const q = query(
      collection(db, "regions"),
      where("owner", "==", Number(id))
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRegions(list);
      setEco(calculateEconomy(list));
    });

    return () => unsub();
  }, [id]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "regions"), (snap) => {
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAllRegions(list);
    });

    return () => unsub();
  }, []);

  /* ---------------- FACTION DOC ---------------- */

  useEffect(() => {
    const ref = doc(db, "factions", String(id));
    const unsub = onDocSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        const defaultData = { navy: { warships: 0 } };
        setDoc(ref, defaultData);
        setFactionData(defaultData);
      } else {
        const data = snap.data();
        setFactionData({
          navy: { warships: 0, ...(data.navy || {}) },
          name: data.name || "",
        });
      }
    });

    return () => unsub();
  }, [id]);

  /* ---------------- ARMIES ---------------- */

  useEffect(() => {
    const armiesRef = collection(db, "factions", String(id), "armies");
    const unsub = onSnapshot(armiesRef, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setArmies(list);
    });
    return () => unsub();
  }, [id]);

  async function addArmy() {
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

  async function changeArmyLevy(armyId, field, delta) {
    if (!isOwnerView) return;
    
    const army = armies.find((a) => a.id === armyId);
    const current = army[field] || 0;
    const next = Math.max(0, current + delta);
    
    const newTotalInf = totalLevyInfantryUnits + (field === "levyInfantry" ? (next - current) : 0);
    const newTotalArch = totalLevyArcherUnits + (field === "levyArchers" ? (next - current) : 0);
    
    if (field === "levyInfantry" && newTotalInf > levyInfPotentialUnits) {
      window.alert(
        `Cannot raise more levy infantry.\n\n` +
        `Current: ${totalLevyInfantryUnits} / ${levyInfPotentialUnits} units\n` +
        `Attempted: ${newTotalInf} units\n\n` +
        `Build more settlements (Villages, Towns, Cities) to increase your levy potential.`
      );
      return;
    }
    
    if (field === "levyArchers" && newTotalArch > levyArchPotentialUnits) {
      window.alert(
        `Cannot raise more levy archers.\n\n` +
        `Current: ${totalLevyArcherUnits} / ${levyArchPotentialUnits} units\n` +
        `Attempted: ${newTotalArch} units\n\n` +
        `Build more Farms to increase your levy archer potential.`
      );
      return;
    }
    
    const ref = doc(db, "factions", String(id), "armies", armyId);
    await updateDoc(ref, { [field]: next });
  }

  /* ---------------- NAVY ---------------- */

  async function changeWarships(delta) {
    if (!isOwnerView || !factionData) return;
    const ref = doc(db, "factions", String(id));
    const current = factionData.navy?.warships || 0;
    const next = Math.max(0, current + delta);
    await updateDoc(ref, { "navy.warships": next });
  }

  /* ---------------- AGENTS ---------------- */

  useEffect(() => {
    const agentsRef = collection(db, "agents");
    const qAgents = query(agentsRef, where("factionId", "==", Number(id)));
    const unsub = onSnapshot(qAgents, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAgents(list);
    });
    return () => unsub();
  }, [id]);

  const townCount = eco?.townCount || 0;
  const cityCount = eco?.cityCount || 0;
  const maxAgents = townCount * 1 + cityCount * 2;
  const agentsCount = agents.length;

  const totalAgentUpkeep = agents.reduce((sum, a) => {
    return sum + (AGENT_UPKEEP[a.type] || 0);
  }, 0);

  /* ---------------- ECONOMY DERIVED ---------------- */

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

  const totalLevyInfantryUnits = useMemo(
    () => armies.reduce((sum, a) => sum + (a.levyInfantry || 0), 0),
    [armies]
  );
  const totalLevyArcherUnits = useMemo(
    () => armies.reduce((sum, a) => sum + (a.levyArchers || 0), 0),
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
          (a.huscarls || 0) * 2 +
          (a.dismountedKnights || 0) * 3 +
          (a.mountedKnights || 0) * 4 +
          (a.lightHorse || 0) * 2,
        0
      ),
    [armies]
  );

  const levyUnitsTotal = totalLevyInfantryUnits + totalLevyArcherUnits;
  const levyGoldUpkeep = Math.round(levyUnitsTotal * LEVY_UPKEEP_PER_UNIT);

  const levyInfPotential = eco?.levyInfantry || 0;
  const levyArchPotential = eco?.levyArchers || 0;
  const levyInfPotentialUnits = Math.floor(levyInfPotential / 10);
  const levyArchPotentialUnits = Math.floor(levyArchPotential / 10);

  const warships =
    factionData?.navy?.warships != null ? factionData.navy.warships : 0;
  const navyGoldUpkeep = warships * 3;

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

  /* ---------------- AGENT MANAGEMENT ---------------- */

  async function handleHireAgent(e) {
    e.preventDefault();
    if (!canEditAgents) return;

    if (agentsCount >= maxAgents) {
      const msg = `You've met your agent cap (${agentsCount}/${maxAgents})! Build more Towns or Cities to recruit more agents.`;
      show("Agent Cap Reached", msg);
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

    const agentsRef = collection(db, "agents");
    await addDoc(agentsRef, {
      factionId: Number(id),
      name,
      type,
      level: 1,
    });

    show("Agent Hired", `${name} (${type}) hired.`);

    setNewAgentName("");
  }

  async function handleDeleteAgent(agentId) {
    if (!canEditAgents) return;
    if (window.confirm("Delete this agent? This cannot be undone.")) {
      const ref = doc(db, "agents", agentId);
      await deleteDoc(ref);
      show("Agent Deleted", "The agent has been removed.");
    }
  }

  async function handleAgentLevelChange(agentId, newLevel) {
    if (!canEditAgents) return;
    const level = Math.max(1, Math.min(10, Number(newLevel)));
    const ref = doc(db, "agents", agentId);
    await updateDoc(ref, { level });
  }

  /* ---------------- RENDER HELPERS ---------------- */

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

    return (
      <div key={agent.id} className="card" style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <h3 style={{ margin: 0, flex: 1 }}>
              {agent.name || "Unnamed Agent"}
            </h3>

            {canEditAgents && (
              <button
                className="small"
                onClick={() => handleDeleteAgent(agent.id)}
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

            <span style={{ color: "#c7bca5", display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
              Level
              <input
                type="number"
                min="1"
                max="10"
                value={agent.level || 1}
                onChange={(e) =>
                  handleAgentLevelChange(agent.id, e.target.value)
                }
                disabled={!canEditAgents}
                style={{
                  width: 50,
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "1px solid #5e4934",
                  background: canEditAgents ? "#1d1610" : "#2a2218",
                  color: "#f3eadc",
                  fontFamily: "Georgia, serif",
                  fontSize: 14,
                }}
              />
            </span>

            <span style={{ color: "#a89a7a", fontSize: 12, whiteSpace: "nowrap" }}>
              Upkeep: {AGENT_UPKEEP[agent.type] || 0}g/turn
            </span>
          </div>
        </div>
      </div>
    );
  }

  function renderAgentsTab() {
    return (
      <>
        <div className="summary-row">
          <div className="summary-card">
            <h3>Agents & Cap</h3>
            <p>
              Agents:{" "}
              <strong>
                {agentsCount} / {maxAgents}
              </strong>
            </p>
            <p>
              From settlements: Towns: <strong>{townCount}</strong>, Cities:{" "}
              <strong>{cityCount}</strong>
            </p>
            <p style={{ fontSize: 12, color: "#c7bca5" }}>
              Cap = 1 per Town, 2 per City. Villages do not support agents.
            </p>
          </div>

          <div className="summary-card">
            <h3>Agent Upkeep (Gold)</h3>
            <p>
              Total agent upkeep: <strong>{totalAgentUpkeep}</strong>{" "}
              gold/turn
            </p>
            <p style={{ fontSize: 12, color: "#c7bca5" }}>
              Spy: 1g, Agitator: 4g, Enforcer: 2g per turn.
            </p>
          </div>
        </div>

        {canEditAgents && (
          <div className="card" style={{ marginTop: 8, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Hire New Agent</h3>
            <p style={{ fontSize: 12, color: "#c7bca5", marginTop: 0, marginBottom: 12 }}>
              Agents are managed at the table. GM and players can adjust levels and locations. Upkeep: Spy 1g, Agitator 4g, Enforcer 2g per turn.
            </p>
            <form
              onSubmit={handleHireAgent}
              className="agent-hire-form"
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
                  <option value="agitator">Agitator (4g)</option>
                  <option value="enforcer">Enforcer (2g)</option>
                </select>
              </label>

              <label style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                <span>Name:</span>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
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

              <button type="submit" disabled={agentsCount >= maxAgents} style={{ margin: 0 }}>
                Hire Agent
              </button>
            </form>
          </div>
        )}

        <h2 style={{ fontSize: 18, marginTop: 8 }}>Active Agents</h2>
        {agents.length === 0 && (
          <p style={{ color: "#c7bca5" }}>
            No agents yet. Hire an agent to begin building your network.
          </p>
        )}
        {agents.map((agent) => renderAgentCard(agent))}
      </>
    );
  }

  const factionName =
    factionData?.name && factionData.name.trim() !== ""
      ? factionData.name
      : `Faction ${id}`;

  // Don't render until role is set
  if (!role) {
    return (
      <div className="container">
        <h1>Loading...</h1>
      </div>
    );
  }

  /* ---------------- RENDER MAIN ---------------- */

  return (
    <div className="container">
      {/* Toasts overlay */}
      <Toast toasts={toasts} remove={remove} />

      {/* Top nav */}
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => navigate("/")} style={{ marginBottom: 0 }}>
            ← Home
          </button>
          {isGM && (
            <button onClick={() => navigate("/gm")} className="small">
              GM Panel
            </button>
          )}
        </div>

        {role === "faction" && (
          <p style={{ marginTop: 0, marginBottom: 0, color: "#c7bca5", fontSize: 14 }}>
            You are{" "}
            <strong>
              Faction {myFactionId ?? "?"}
              {isOwnerView && !isGM ? " (this is you)" : ""}
            </strong>
          </p>
        )}
        {isGM && (
          <p style={{ marginTop: 0, marginBottom: 0, color: "#c7bca5", fontSize: 13 }}>
            <strong>GM mode</strong>
          </p>
        )}
      </div>

      <h1
        style={{
          fontFamily: "Georgia, serif",
          color: "#eaddc0",
          fontSize: 30,
          marginBottom: 10,
          marginTop: 0,
          wordBreak: "break-word",
        }}
      >
        {factionName}
      </h1>

      {/* Top econ summary */}
      <div className="summary-row">
        <div className="summary-card">
          <h3>Buildings Economy</h3>
          <p>
            Gold/turn: <strong>{buildingsGold}</strong>
          </p>
          <p title="If negative, shut off manpower-consuming buildings until â‰¥ 0.">
            Manpower/turn:{" "}
            <strong className={manpowerNegative ? "warning" : "ok"}>
              {manpowerNet}
            </strong>
          </p>
        </div>

        <div className="summary-card">
          <h3>HSG & Capacity</h3>
          <p>
            HSG cap: <strong>{hsgCap}</strong>
          </p>
          <p>
            HSG used:{" "}
            <strong className={overHsgCap ? "warning" : "ok"}>
              {hsgUsed} / {hsgCap}
            </strong>
          </p>
          <p style={{ fontSize: 12, color: "#c7bca5" }}>
            Each HSG unit represents 10 men.
          </p>
        </div>

        <div className="summary-card">
          <h3>Net Gold</h3>
          <p>HSG upkeep: {hsgGoldUpkeep}</p>
          <p>Levies upkeep: {levyGoldUpkeep}</p>
          <p>Warship upkeep: {navyGoldUpkeep}</p>
          <p>Agent upkeep: {totalAgentUpkeep}</p>
          <p title="If negative, disband units first; then shut off gold-costing buildings.">
            Net Gold/turn:{" "}
            <strong className={goldNegative ? "warning" : "ok"}>
              {netGoldPerTurn}
            </strong>
          </p>
        </div>

        <div className="summary-card">
          <h3>Farms, Mines, Levies</h3>
          <p>
            Farms (eq): <strong>{eco?.farmEquivalent ?? 0}</strong>
          </p>
          <p>
            Mines (eq): <strong>{eco?.mineEquivalent ?? 0}</strong>
          </p>
          <p>
            Levy Inf Potential: <strong>{levyInfPotential}</strong>
          </p>
          <p>
            Levy Inf Raised: <strong>{totalLevyInfantryUnits} units</strong>
          </p>
          <p>
            Levy Arch Potential: <strong>{levyArchPotential}</strong>
          </p>
          <p>
            Levy Arch Raised: <strong>{totalLevyArcherUnits} units</strong>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === "regions" ? "active" : ""}`}
          onClick={() => setActiveTab("regions")}
        >
          Regions
        </button>
        <button
          className={`tab ${activeTab === "army" ? "active" : ""}`}
          onClick={() => setActiveTab("army")}
        >
          Army & Navy
        </button>
        <button
          className={`tab ${activeTab === "agents" ? "active" : ""}`}
          onClick={() => setActiveTab("agents")}
        >
          Agents
        </button>
      </div>

      {/* Regions tab */}
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
            />
          ))}
        </>
      )}

      {/* Army & Navy tab */}
      {activeTab === "army" && (
        <>
          {/* Warships */}
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
                Upkeep: 3 gold/turn per warship
              </p>
              <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #4c3b2a" }}>
                <strong>Total Navy Upkeep:</strong> {navyGoldUpkeep} gold/turn
              </div>
            </div>
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
            <h2 style={{ fontSize: 18, margin: 0 }}>Armies</h2>
            {isOwnerView && (
              <button className="green" onClick={addArmy}>
                + Raise New Army
              </button>
            )}
          </div>

          {armies.length === 0 && (
            <p style={{ color: "#c7bca5" }}>
              No armies yet. Use "Raise New Army" to create one and assign units
              to it.
            </p>
          )}

          {armies
            .filter((a) => !a.deleted)
            .map((army) => (
              <ArmyCard
                key={army.id}
                army={army}
                isOwner={isOwnerView}
                onChangeUnit={changeArmyUnit}
                onChangeLevy={changeArmyLevy}
                onChangeField={changeArmyField}
                onDelete={deleteArmy}
              />
            ))}
        </>
      )}

      {/* Agents tab */}
      {activeTab === "agents" && renderAgentsTab()}
    </div>
  );
}