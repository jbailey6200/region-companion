// pages/GMPanel.jsx - FULL FILE WITH CUSTOM FACTION NAMES

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import RegionCard from "../components/RegionCard";
import { BUILDING_RULES } from "../config/buildingRules";
import Court from "../components/Court";

function calculateEconomy(regions) {
  let gold = 0;
  let manpowerProd = 0;
  let manpowerCost = 0;
  let hsgCap = 0;
  let farmEq = 0;
  let mineEq = 0;

  regions.forEach((r) => {
    const ups = r.upgrades || [];
    const disabled = r.disabledUpgrades || [];

    const counts = {};
    ups.forEach((u) => {
      counts[u] = (counts[u] || 0) + 1;
    });
    disabled.forEach((d) => {
      if (counts[d]) counts[d] -= 1;
    });

    Object.entries(counts).forEach(([name, count]) => {
      if (count <= 0) return;
      const rule = BUILDING_RULES[name];
      if (!rule) return;

      gold += (rule.gold || 0) * count;
      manpowerProd += (rule.manpower || 0) * count;
      manpowerCost += (rule.manpowerCost || 0) * count;
      hsgCap += (rule.hsgCap || 0) * count;
      farmEq += (rule.farmEquivalent || 0) * count;
      mineEq += (rule.mineEquivalent || 0) * count;
    });
  });

  return {
    goldPerTurn: gold,
    manpowerProduced: manpowerProd,
    manpowerUpkeep: manpowerCost,
    manpowerNet: manpowerProd - manpowerCost,
    hsgCap,
    farmEquivalent: farmEq,
    mineEquivalent: mineEq,
  };
}

export default function GMPanel() {
  const [regions, setRegions] = useState([]);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState(1);
  const [role, setRole] = useState(null);
  const [factionNames, setFactionNames] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const r = localStorage.getItem("role");
    if (r) setRole(r);
  }, []);

  // Load faction names
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "factions"), (snap) => {
      const names = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        const factionId = doc.id;
        names[factionId] = data.name || `Faction ${factionId}`;
      });
      setFactionNames(names);
    });

    return () => unsub();
  }, []);

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

  async function createRegion() {
    if (!name.trim()) return;
    if (role !== "gm") return;

    await addDoc(collection(db, "regions"), {
      name,
      owner: Number(owner),
      upgrades: [],
      disabledUpgrades: [],
      notes: "",
    });

    setName("");
  }

  // per-faction summarized econ
  const factionSummaries = {};
  for (let f = 1; f <= 8; f++) {
    const fr = regions.filter((r) => r.owner === f);
    factionSummaries[f] = calculateEconomy(fr);
  }

  async function changeRegionOwner(regionId, newOwner) {
    if (role !== "gm") return;
    await updateDoc(doc(db, "regions", regionId), {
      owner: Number(newOwner),
    });
  }

  function getFactionName(factionId) {
    return factionNames[String(factionId)] || `Faction ${factionId}`;
  }

  if (role !== "gm") {
    return (
      <div className="container">
        <button onClick={() => navigate("/")} style={{ marginBottom: "10px" }}>
          ← Home
        </button>
        <h1>GM Panel</h1>
        <p>You are not in GM mode. Switch to GM on the home screen.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <button onClick={() => navigate("/")} style={{ marginBottom: "10px" }}>
        ← Home
      </button>

      <h1>GM Panel</h1>

      <h2>Create New Region</h2>

      <div
        className="card"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "20px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Region Name</label>
          <input
            placeholder="Greyreach"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #555",
              background: "#222",
              color: "white",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <label>Faction Owner</label>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            style={{
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #555",
              background: "#222",
              color: "white",
            }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
              <option key={f} value={f}>
                {getFactionName(f)}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={createRegion}
          style={{
            marginTop: "10px",
            background: "#0066cc",
            borderColor: "#004d99",
          }}
        >
          Create Region
        </button>
      </div>

      <h2>Faction Summaries</h2>
      <div className="summary-row">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => {
          const eco = factionSummaries[f];
          return (
            <div key={f} className="summary-card">
              <h3 style={{
                fontSize: "16px",
                marginBottom: "8px",
                wordBreak: "break-word",
                lineHeight: "1.3"
              }}>
                {getFactionName(f)}
              </h3>
              <p>
                Gold/turn: <strong>{eco.goldPerTurn}</strong>
              </p>
              <p>
                Manpower:{" "}
                <strong>{eco.manpowerNet}</strong> (prod{" "}
                {eco.manpowerProduced}, upkeep{" "}
                {eco.manpowerUpkeep})
              </p>
              <p>
                HSG cap: <strong>{eco.hsgCap}</strong>
              </p>
              <p>
                Farms (eq): <strong>{eco.farmEquivalent}</strong>
              </p>
              <p>
                Mines (eq): <strong>{eco.mineEquivalent}</strong>
              </p>
            </div>
          );
        })}
      </div>

      <h2>All Regions</h2>
      {regions.map((region) => (
        <div key={region.id} className="card">
          <RegionCard 
            region={region} 
            role="gm"
            eco={null}
            myFactionId={null}
          />
          <div style={{ marginTop: "8px" }}>
            <label>Transfer to faction: </label>
            <select
              value={region.owner}
              onChange={(e) =>
                changeRegionOwner(region.id, Number(e.target.value))
              }
              style={{
                padding: "6px",
                borderRadius: "6px",
                border: "1px solid #555",
                background: "#222",
                color: "white",
                marginLeft: "4px",
              }}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
                <option key={f} value={f}>
                  {getFactionName(f)}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      {/* Court Management Section */}
<h2>High Court Appointments</h2>
<Court 
  isGM={true}
  myFactionId={null}  // GM sees all
  factionNames={factionNames}
/>
    </div>
  );
}