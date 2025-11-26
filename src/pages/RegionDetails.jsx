import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../firebase/config";
import {
  doc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot as onQuerySnapshot,
  onSnapshot as onDocSnapshot,
  setDoc,
} from "firebase/firestore";
import { BUILDING_RULES, HSG_UNITS, LEVY_UPKEEP_PER_UNIT } from "../config/buildingRules";

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
const SETTLEMENTS = ["Village", "Town", "City"];

export default function RegionDetails() {
  const { regionId } = useParams();
  const navigate = useNavigate();

  const [region, setRegion] = useState(null);
  const [notes, setNotes] = useState("");
  const [eco, setEco] = useState(null);          // faction-wide econ
  const [factionData, setFactionData] = useState(null); // HSG/navy/levies

  const [role, setRole] = useState(null); // "gm" | "faction" | null
  const [myFactionId, setMyFactionId] = useState(null);

  useEffect(() => {
    const r = localStorage.getItem("role");
    const f = localStorage.getItem("factionId");
    if (r) setRole(r);
    if (f) setMyFactionId(Number(f));
  }, []);

  // Load region
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "regions", regionId), (d) => {
      if (!d.exists()) {
        navigate("/");
        return;
      }
      const data = {
        id: d.id,
        disabledUpgrades: [],
        ...d.data(),
      };
      setRegion(data);
      setNotes(data.notes || "");
    });

    return () => unsub();
  }, [regionId, navigate]);

  // Load all regions for this faction (for econ + prereqs)
  useEffect(() => {
    if (!region) return;
    const q = query(
      collection(db, "regions"),
      where("owner", "==", region.owner)
    );
    const unsub = onQuerySnapshot(q, (snap) => {
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setEco(calculateEconomy(list));
    });
    return () => unsub();
  }, [region]);

  // Load faction army/navy/levies for econ view
  useEffect(() => {
    if (!region) return;
    const ref = doc(db, "factions", String(region.owner));
    const unsub = onDocSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        const defaultData = {
          army: {
            huscarls: 0,
            dismountedKnights: 0,
            mountedKnights: 0,
            lightHorse: 0,
          },
          navy: {
            warships: 0,
          },
          levies: {
            infantryRaised: 0,
            archersRaised: 0,
          },
        };
        setDoc(ref, defaultData);
        setFactionData(defaultData);
      } else {
        const data = snap.data();
        const merged = {
          army: {
            huscarls: 0,
            dismountedKnights: 0,
            mountedKnights: 0,
            lightHorse: 0,
            ...(data.army || {}),
          },
          navy: {
            warships: 0,
            ...(data.navy || {}),
          },
          levies: {
            infantryRaised: 0,
            archersRaised: 0,
            ...(data.levies || {}),
          },
        };
        setFactionData(merged);
      }
    });
    return () => unsub();
  }, [region]);

  if (!region) return <div className="container">Loading...</div>;

  const upgrades = region.upgrades || [];
  const disabledUpgrades = region.disabledUpgrades || [];

  const count = (name) =>
    upgrades.filter((u) => u === name).length;
  const disabledCount = (name) =>
    disabledUpgrades.filter((u) => u === name).length;
  const activeCount = (name) =>
    Math.max(0, count(name) - disabledCount(name));

  const countGroup = (names) =>
    upgrades.filter((u) => names.includes(u)).length;

  function getSettlement() {
    const ups = region.upgrades || [];
    if (ups.includes("City")) return "City";
    if (ups.includes("Town")) return "Town";
    if (ups.includes("Village")) return "Village";
    return "None";
  }

  const isGM = role === "gm";
  const isOwner = (role === "faction" && myFactionId === region.owner) || isGM;

  async function updateRegionFields(fields) {
    await updateDoc(doc(db, "regions", regionId), fields);
  }

  async function updateUpgrades(newUps, newDisabled) {
    await updateRegionFields({
      upgrades: newUps,
      disabledUpgrades: newDisabled ?? disabledUpgrades,
    });
  }

  // ---- Settlement control ----
  async function setSettlement(type) {
    if (!isOwner) return;

    const current = getSettlement();
    let newUps = upgrades.filter((u) => !SETTLEMENTS.includes(u));

    if (type === "None") {
      await updateUpgrades(newUps);
      return;
    }

    if (type === "Village") {
      if (current !== "None") {
        window.alert("Only one settlement per region.");
        return;
      }
    }

    if (type === "Town") {
      if (current === "City") {
        window.alert("Already a City.");
        return;
      }
      if (!eco || eco.farmEquivalent < 4 || eco.mineEquivalent < 1) {
        window.alert("Requires 4 Farms (eq) and 1 Mine to become a Town.");
        return;
      }
    }

    if (type === "City") {
      if (!eco || eco.farmEquivalent < 6 || eco.mineEquivalent < 2) {
        window.alert(
          "Requires 6 Farms (eq) and 1 Mine2 (2 mine equivalents) to become a City."
        );
        return;
      }
    }

    newUps.push(type);
    await updateUpgrades(newUps);
  }

  // Helper for normalizing disabled when removing upgrades
  function normalizeDisabledFor(names, newUps, disabled) {
    let result = [...disabled];
    names.forEach((name) => {
      const total = newUps.filter((u) => u === name).length;
      let dCount = result.filter((u) => u === name).length;
      while (dCount > total) {
        const idx = result.indexOf(name);
        if (idx === -1) break;
        result.splice(idx, 1);
        dCount--;
      }
    });
    return result;
  }

  // ---- Farms ----
  async function addFarm() {
    if (!isOwner) return;
    const farmGroup = countGroup(["Farm", "Farm2"]);
    if (farmGroup >= 3) {
      window.alert("Max 3 farms (including Farm2) per region.");
      return;
    }
    const newUps = [...upgrades, "Farm"];
    const newDisabled = normalizeDisabledFor(
      ["Farm", "Farm2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function removeFarm() {
    if (!isOwner) return;
    const idx = upgrades.indexOf("Farm");
    if (idx === -1) return;
    const newUps = [...upgrades];
    newUps.splice(idx, 1);
    const newDisabled = normalizeDisabledFor(
      ["Farm", "Farm2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function addFarm2() {
    if (!isOwner) return;
    const farmGroup = countGroup(["Farm", "Farm2"]);
    let newUps = [...upgrades];

    const farmIdx = newUps.indexOf("Farm");
    if (farmIdx !== -1) {
      newUps[farmIdx] = "Farm2";
    } else {
      if (farmGroup >= 3) {
        window.alert("Max 3 farms (including Farm2) per region.");
        return;
      }
      newUps.push("Farm2");
    }

    const newDisabled = normalizeDisabledFor(
      ["Farm", "Farm2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function removeFarm2() {
    if (!isOwner) return;
    const idx = upgrades.indexOf("Farm2");
    if (idx === -1) return;
    const newUps = [...upgrades];
    newUps.splice(idx, 1);
    const newDisabled = normalizeDisabledFor(
      ["Farm", "Farm2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  // ---- Mines ----
  async function addMine() {
    if (!isOwner) return;
    const mineGroup = countGroup(["Mine", "Mine2"]);
    if (mineGroup >= 3) {
      window.alert("Max 3 mines (including Mine2) per region.");
      return;
    }
    const newUps = [...upgrades, "Mine"];
    const newDisabled = normalizeDisabledFor(
      ["Mine", "Mine2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function removeMine() {
    if (!isOwner) return;
    const idx = upgrades.indexOf("Mine");
    if (idx === -1) return;
    const newUps = [...upgrades];
    newUps.splice(idx, 1);
    const newDisabled = normalizeDisabledFor(
      ["Mine", "Mine2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function addMine2() {
    if (!isOwner) return;
    const mineGroup = countGroup(["Mine", "Mine2"]);
    let newUps = [...upgrades];

    const mineIdx = newUps.indexOf("Mine");
    if (mineIdx !== -1) {
      newUps[mineIdx] = "Mine2";
    } else {
      if (mineGroup >= 3) {
        window.alert("Max 3 mines (including Mine2) per region.");
        return;
      }
      newUps.push("Mine2");
    }

    const newDisabled = normalizeDisabledFor(
      ["Mine", "Mine2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  async function removeMine2() {
    if (!isOwner) return;
    const idx = upgrades.indexOf("Mine2");
    if (idx === -1) return;
    const newUps = [...upgrades];
    newUps.splice(idx, 1);
    const newDisabled = normalizeDisabledFor(
      ["Mine", "Mine2"],
      newUps,
      disabledUpgrades
    );
    await updateUpgrades(newUps, newDisabled);
  }

  // ---- Fortifications ----
  async function toggleKeep() {
    if (!isOwner) return;
    let newUps = [...upgrades];
    let newDisabled = [...disabledUpgrades];

    if (upgrades.includes("Keep")) {
      newUps = newUps.filter((u) => u !== "Keep" && u !== "Castle");
      newDisabled = normalizeDisabledFor(
        ["Keep", "Castle"],
        newUps,
        newDisabled
      );
    } else {
      newUps.push("Keep");
    }

    await updateUpgrades(newUps, newDisabled);
  }

  async function toggleCastle() {
    if (!isOwner) return;
    let newUps = [...upgrades];
    let newDisabled = [...disabledUpgrades];

    if (!upgrades.includes("Keep")) {
      window.alert("You must have a Keep to upgrade to Castle.");
      return;
    }
    if (upgrades.includes("Castle")) {
      newUps = newUps.filter((u) => u !== "Castle");
      newDisabled = normalizeDisabledFor(
        ["Castle"],
        newUps,
        newDisabled
      );
    } else {
      newUps.push("Castle");
    }
    await updateUpgrades(newUps, newDisabled);
  }

  async function disableOne(name) {
    if (!isOwner) return;
    if (activeCount(name) <= 0) return;
    const newDisabled = [...disabledUpgrades, name];
    await updateRegionFields({ disabledUpgrades: newDisabled });
  }

  async function enableOne(name) {
    if (!isOwner) return;
    const idx = disabledUpgrades.indexOf(name);
    if (idx === -1) return;
    const newDisabled = [...disabledUpgrades];
    newDisabled.splice(idx, 1);
    await updateRegionFields({ disabledUpgrades: newDisabled });
  }

  async function saveNotes() {
    if (!isOwner) return;
    await updateRegionFields({ notes });
  }

  async function deleteRegion() {
    if (!isGM) return;
    if (!window.confirm("Delete this region permanently?")) return;
    await deleteDoc(doc(db, "regions", regionId));
    navigate("/gm");
  }

  async function changeOwner(newOwner) {
    if (!isGM) return;
    await updateRegionFields({ owner: Number(newOwner) });
  }

  const settlement = getSettlement();
  const farmCount = count("Farm");
  const farm2Count = count("Farm2");
  const mineCount = count("Mine");
  const mine2Count = count("Mine2");
  const hasKeep = upgrades.includes("Keep");
  const hasCastle = upgrades.includes("Castle");

  const farmActive = activeCount("Farm");
  const farm2Active = activeCount("Farm2");
  const mineActive = activeCount("Mine");
  const mine2Active = activeCount("Mine2");
  const keepActive = activeCount("Keep");
  const castleActive = activeCount("Castle");

  const farmDisabled = disabledCount("Farm");
  const farm2Disabled = disabledCount("Farm2");
  const mineDisabled = disabledCount("Mine");
  const mine2Disabled = disabledCount("Mine2");
  const keepDisabled = disabledCount("Keep");
  const castleDisabled = disabledCount("Castle");

  // ---- Faction econ + upkeep summary (same logic as Faction.jsx) ----
  const buildingsGold = eco?.goldPerTurn || 0;
  const manpowerNet = eco?.manpowerNet || 0;

  const totalHsgUnits =
    factionData && factionData.army
      ? HSG_UNITS.reduce(
          (sum, u) => sum + (factionData.army[u.key] || 0),
          0
        )
      : 0;

  const hsgCap = eco?.hsgCap || 0;
  const hsgCapUsed = totalHsgUnits * 10;
  const overHsgCap = hsgCapUsed > hsgCap;

  const hsgGoldUpkeep =
    factionData && factionData.army
      ? HSG_UNITS.reduce(
          (sum, u) =>
            sum +
            (factionData.army[u.key] || 0) * u.upkeep,
          0
        )
      : 0;

  const warships =
    factionData?.navy?.warships != null
      ? factionData.navy.warships
      : 0;
  const navyGoldUpkeep = warships * 3;

  const levyInfPotential = eco?.levyInfantry || 0;
  const levyArchPotential = eco?.levyArchers || 0;

  const levyInfRaised =
    factionData?.levies?.infantryRaised || 0;
  const levyArchRaised =
    factionData?.levies?.archersRaised || 0;

  const levyUpkeepRaw =
    (levyInfRaised + levyArchRaised) *
    LEVY_UPKEEP_PER_UNIT;
  const levyGoldUpkeep = Math.round(levyUpkeepRaw);

  const netGoldPerTurn =
    buildingsGold - hsgGoldUpkeep - levyGoldUpkeep - navyGoldUpkeep;

  const goldNegative = netGoldPerTurn < 0;
  const manpowerNegative = manpowerNet < 0;

  return (
    <div className="container">
      <button onClick={() => navigate(-1)} style={{ marginBottom: "10px" }}>
        ← Back
      </button>

      <h1 style={{ marginBottom: "10px" }}>{region.name}</h1>
      <p>
        <strong>Owner:</strong> Faction {region.owner}
      </p>

      {(isOwner || isGM) && (
        <p style={{ color: "#aaa" }}>
          You are:{" "}
          <strong>{isGM ? "GM" : `Faction ${myFactionId ?? "?"}`}</strong>
        </p>
      )}

      {/* Faction-wide econ & HSG summary at top */}
      {eco && factionData && (
        <div className="summary-row" style={{ marginTop: "16px" }}>
          <div className="summary-card">
            <h3>Buildings Economy</h3>
            <p>Gold/turn: <strong>{buildingsGold}</strong></p>
            <p
              title="If you end the turn with negative manpower, you must shut off manpower-consuming buildings until this is ≥ 0."
            >
              Manpower/turn:{" "}
              <strong
                style={{
                  color: manpowerNegative ? "#ff8080" : "#e5e7eb",
                }}
              >
                {manpowerNet}
              </strong>
            </p>
          </div>

          <div className="summary-card">
            <h3>HSG & Capacity</h3>
            <p>HSG cap: <strong>{hsgCap}</strong></p>
            <p>
              HSG used:{" "}
              <strong
                style={{
                  color: overHsgCap ? "#ff8080" : "#e5e7eb",
                }}
              >
                {hsgCapUsed} / {hsgCap}
              </strong>
            </p>
            <p style={{ fontSize: "12px", color: "#aaa" }}>
              Each HSG unit (Huscarls, Knights, etc.) represents 10 men.
            </p>
          </div>

          <div className="summary-card">
            <h3>Net Gold</h3>
            <p>HSG upkeep: <strong>{hsgGoldUpkeep}</strong></p>
            <p>Levy upkeep: <strong>{levyGoldUpkeep}</strong></p>
            <p>Warship upkeep: <strong>{navyGoldUpkeep}</strong></p>
            <p
              title="If you end the turn with negative gold, you must first disband units (HSG and levies) until gold/turn is positive. If still negative after all units are gone, you must shut off buildings that cost gold."
            >
              Net Gold/turn:{" "}
              <strong
                style={{
                  color: goldNegative ? "#ff8080" : "#e5e7eb",
                }}
              >
                {netGoldPerTurn}
              </strong>
            </p>
          </div>
        </div>
      )}

      {eco && (
        <div className="summary-row" style={{ marginTop: "10px" }}>
          <div className="summary-card">
            <h3>Prereq Counters</h3>
            <p>Farms (eq): <strong>{eco.farmEquivalent}</strong></p>
            <p>Mines (eq): <strong>{eco.mineEquivalent}</strong></p>
            <p>
              Levy Infantry Potential:{" "}
              <strong>{eco.levyInfantry}</strong>
            </p>
            <p>
              Levy Archers Potential:{" "}
              <strong>{eco.levyArchers}</strong>
            </p>
          </div>
        </div>
      )}

      {isGM && (
        <div
          className="card"
          style={{ marginBottom: "16px", padding: "12px 16px" }}
        >
          <h3>GM Controls</h3>
          <label>
            Transfer to faction:{" "}
            <select
              value={region.owner}
              onChange={(e) => changeOwner(e.target.value)}
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
                  Faction {f}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button
              onClick={deleteRegion}
              style={{
                marginTop: "10px",
                padding: "10px 16px",
                background: "#990000",
                borderRadius: "8px",
                border: "1px solid #660000",
                color: "white",
              }}
            >
              Delete Region
            </button>
          </div>
        </div>
      )}

      {/* Settlement */}
      <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
        <h2>Settlement</h2>
        <p>
          Current: <strong>{settlement}</strong>
        </p>
        {isOwner ? (
          <div
            style={{
              marginTop: "10px",
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <button onClick={() => setSettlement("None")}>None</button>
            <button onClick={() => setSettlement("Village")}>Village</button>
            <button onClick={() => setSettlement("Town")}>Town</button>
            <button onClick={() => setSettlement("City")}>City</button>
          </div>
        ) : (
          <p style={{ color: "#aaa" }}>
            Only the owning faction can change its settlement.
          </p>
        )}
      </div>

      {/* Resource Buildings */}
      <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
        <h2>Resource Buildings</h2>

        {/* Farms */}
        <div style={{ marginBottom: "14px" }}>
          <h3>Farms (max 3 per region including Farm2)</h3>
          <p>
            Farm:{" "}
            <strong>
              {farmActive} active / {farmDisabled} disabled (
              {farmCount} total)
            </strong>
          </p>
          <p>
            Farm2:{" "}
            <strong>
              {farm2Active} active / {farm2Disabled} disabled (
              {farm2Count} total)
            </strong>
          </p>
          {isOwner ? (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "6px",
                }}
              >
                <button onClick={addFarm}>+ Farm</button>
                <button onClick={removeFarm}>- Farm</button>
                <button onClick={addFarm2}>+ Farm2 (upgrade)</button>
                <button onClick={removeFarm2}>- Farm2</button>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "6px",
                }}
              >
                <button onClick={() => disableOne("Farm")}>
                  Disable Farm
                </button>
                <button onClick={() => enableOne("Farm")}>
                  Enable Farm
                </button>
                <button onClick={() => disableOne("Farm2")}>
                  Disable Farm2
                </button>
                <button onClick={() => enableOne("Farm2")}>
                  Enable Farm2
                </button>
              </div>
            </>
          ) : (
            <p style={{ color: "#aaa" }}>
              Only the owning faction can modify farms.
            </p>
          )}
        </div>

        {/* Mines */}
        <div>
          <h3>Mines (max 3 per region including Mine2)</h3>
          <p>
            Mine:{" "}
            <strong>
              {mineActive} active / {mineDisabled} disabled (
              {mineCount} total)
            </strong>
          </p>
          <p>
            Mine2:{" "}
            <strong>
              {mine2Active} active / {mine2Disabled} disabled (
              {mine2Count} total)
            </strong>
          </p>
          {isOwner ? (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "6px",
                }}
              >
                <button onClick={addMine}>+ Mine</button>
                <button onClick={removeMine}>- Mine</button>
                <button onClick={addMine2}>+ Mine2 (upgrade)</button>
                <button onClick={removeMine2}>- Mine2</button>
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "6px",
                }}
              >
                <button onClick={() => disableOne("Mine")}>
                  Disable Mine
                </button>
                <button onClick={() => enableOne("Mine")}>
                  Enable Mine
                </button>
                <button onClick={() => disableOne("Mine2")}>
                  Disable Mine2
                </button>
                <button onClick={() => enableOne("Mine2")}>
                  Enable Mine2
                </button>
              </div>
            </>
          ) : (
            <p style={{ color: "#aaa" }}>
              Only the owning faction can modify mines.
            </p>
          )}
        </div>
      </div>

      {/* Fortifications */}
      <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
        <h2>Fortifications</h2>
        <p>
          Keep:{" "}
          <strong>
            {keepActive} active / {keepDisabled} disabled
          </strong>
        </p>
        <p>
          Castle:{" "}
          <strong>
            {castleActive} active / {castleDisabled} disabled
          </strong>
        </p>
        {isOwner ? (
          <>
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                marginTop: "6px",
              }}
            >
              <button onClick={toggleKeep}>
                {hasKeep ? "Remove Keep" : "Add Keep"}
              </button>
              <button onClick={toggleCastle}>
                {hasCastle ? "Remove Castle" : "Upgrade to Castle"}
              </button>
            </div>
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                marginTop: "6px",
              }}
            >
              <button onClick={() => disableOne("Keep")}>
                Disable Keep
              </button>
              <button onClick={() => enableOne("Keep")}>
                Enable Keep
              </button>
              <button onClick={() => disableOne("Castle")}>
                Disable Castle
              </button>
              <button onClick={() => enableOne("Castle")}>
                Enable Castle
              </button>
            </div>
          </>
        ) : (
          <p style={{ color: "#aaa" }}>
            Only the owning faction can change fortifications.
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="card" style={{ padding: "20px", marginBottom: "20px" }}>
        <h2>Notes</h2>
        {isOwner ? (
          <>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: "100%",
                height: "120px",
                background: "#222",
                color: "white",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #444",
              }}
            />
            <button
              onClick={saveNotes}
              style={{
                marginTop: "10px",
                background: "#0066cc",
                borderColor: "#004d99",
              }}
            >
              Save Notes
            </button>
          </>
        ) : (
          <p>{notes || "No notes."}</p>
        )}
      </div>
    </div>
  );
}