import React from "react";

const HSG_CONFIG = [
  { key: "huscarls", label: "Huscarls", upkeep: 2 },
  { key: "dismountedKnights", label: "Dismounted Knights", upkeep: 3 },
  { key: "mountedKnights", label: "Mounted Knights", upkeep: 4 },
  { key: "lightHorse", label: "Light Horse", upkeep: 2 },
];

export default function ArmyCard({
  army,
  isOwner,
  onChangeUnit,
  onChangeLevy,
  onChangeField,
  onDelete,
}) {
  const {
    id,
    name,
    location,
    huscarls = 0,
    dismountedKnights = 0,
    mountedKnights = 0,
    lightHorse = 0,
    levyInfantry = 0,
    levyArchers = 0,
  } = army;

  const hsgTotals =
    huscarls + dismountedKnights + mountedKnights + lightHorse;

  return (
    <div className="card">
      {/* Header: name + location + delete */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ flex: 1, marginRight: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="text"
              value={name || ""}
              disabled={!isOwner}
              onChange={(e) =>
                onChangeField(id, "name", e.target.value)
              }
              placeholder="Army name"
              style={{
                flex: 1,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid #5e4934",
                background: "#241b15",
                color: "#f4efe4",
                fontFamily: "Georgia, serif",
              }}
            />
          </div>
          <input
            type="text"
            value={location || ""}
            disabled={!isOwner}
            onChange={(e) =>
              onChangeField(id, "location", e.target.value)
            }
            placeholder="Location (optional)"
            style={{
              marginTop: 4,
              width: "100%",
              padding: "3px 8px",
              borderRadius: 6,
              border: "1px solid #4c3b2a",
              background: "#1b130d",
              color: "#e7dfd2",
              fontSize: 13,
              fontFamily: "Georgia, serif",
            }}
          />
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, marginBottom: 4 }}>
            <strong>Total HSG units:</strong> {hsgTotals}
          </div>
          {isOwner && (
            <button className="danger small" onClick={() => onDelete(id)}>
              Disband Army
            </button>
          )}
        </div>
      </div>

      {/* Household Guard grid */}
      <h3 style={{ fontSize: 14, marginTop: 4, marginBottom: 6 }}>
        Household Guard
      </h3>
      <div className="army-grid">
        {HSG_CONFIG.map((u) => {
          const count = army[u.key] || 0;
          return (
            <div key={u.key} className="army-item">
              <div className="army-item-header">
                <span>{u.label}</span>
                <span>{u.upkeep} gold/unit</span>
              </div>
              <div className="army-controls">
                <button
                  disabled={!isOwner}
                  onClick={() => onChangeUnit(id, u.key, -1)}
                >
                  -
                </button>
                <div className="army-count">{count}</div>
                <button
                  disabled={!isOwner}
                  onClick={() => onChangeUnit(id, u.key, 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Levies for this army */}
      <h3 style={{ fontSize: 14, marginTop: 10, marginBottom: 6 }}>
        Levies in this Army
      </h3>
      <div className="army-grid">
        <div className="army-item">
          <div className="army-item-header">
            <span>Levy Infantry (units of 10)</span>
          </div>
          <div className="army-controls">
            <button
              disabled={!isOwner}
              onClick={() => onChangeLevy(id, "levyInfantry", -1)}
            >
              -
            </button>
            <div className="army-count">{levyInfantry}</div>
            <button
              disabled={!isOwner}
              onClick={() => onChangeLevy(id, "levyInfantry", 1)}
            >
              +
            </button>
          </div>
        </div>

        <div className="army-item">
          <div className="army-item-header">
            <span>Levy Archers (units of 10)</span>
          </div>
          <div className="army-controls">
            <button
              disabled={!isOwner}
              onClick={() => onChangeLevy(id, "levyArchers", -1)}
            >
              -
            </button>
            <div className="army-count">{levyArchers}</div>
            <button
              disabled={!isOwner}
              onClick={() => onChangeLevy(id, "levyArchers", 1)}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
