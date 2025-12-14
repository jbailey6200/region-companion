// components/ArmyForm.jsx - Shared army creation form

import { useState } from "react";

export default function ArmyForm({ regions, onSubmit, onCancel }) {
  const [armyData, setArmyData] = useState({
    name: "",
    location: "",
    huscarls: 0,
    dismountedKnights: 0,
    mountedKnights: 0,
    lightHorse: 0,
    menAtArms: 0,
    crossbowmen: 0,
    pikemen: 0,
    levyInfantry: 0,
    levyArchers: 0,
  });

  function handleSubmit(e) {
    e?.preventDefault?.();
    onSubmit(armyData);
    setArmyData({
      name: "",
      location: "",
      huscarls: 0,
      dismountedKnights: 0,
      mountedKnights: 0,
      lightHorse: 0,
      menAtArms: 0,
      crossbowmen: 0,
      pikemen: 0,
      levyInfantry: 0,
      levyArchers: 0,
    });
  }

  function handleCancel() {
    setArmyData({
      name: "",
      location: "",
      huscarls: 0,
      dismountedKnights: 0,
      mountedKnights: 0,
      lightHorse: 0,
      menAtArms: 0,
      crossbowmen: 0,
      pikemen: 0,
      levyInfantry: 0,
      levyArchers: 0,
    });
    onCancel();
  }

  const sortedRegions = [...regions].sort((a, b) =>
    (a.code || "").localeCompare(b.code || "")
  );

  return (
    <div className="card" style={{ marginBottom: "16px", padding: "16px" }}>
      <h3 style={{ marginTop: 0 }}>New Army</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>
            Army Name
          </label>
          <input
            type="text"
            value={armyData.name}
            onChange={(e) => setArmyData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Army name"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label style={{ fontSize: "12px", display: "block", marginBottom: "4px" }}>
            Location
          </label>
          <select
            value={armyData.location}
            onChange={(e) => setArmyData((prev) => ({ ...prev, location: e.target.value }))}
            style={{ width: "100%" }}
          >
            <option value="">-- Select Location --</option>
            {sortedRegions.map((r) => (
              <option key={r.id} value={r.code || r.name}>
                [{r.code}] {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
        <button onClick={handleSubmit} className="green">
          Create
        </button>
        <button onClick={handleCancel}>Cancel</button>
      </div>
    </div>
  );
}