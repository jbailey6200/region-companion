import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [role, setRole] = useState(null); // "gm" | "faction" | null
  const [factionId, setFactionId] = useState(null); // number or null
  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    const storedFaction = localStorage.getItem("factionId");
    if (storedRole) setRole(storedRole);
    if (storedFaction) setFactionId(Number(storedFaction));
  }, []);

  function chooseGM() {
    setRole("gm");
    setFactionId(null);
    localStorage.setItem("role", "gm");
    localStorage.removeItem("factionId");
  }

  function chooseFaction(id) {
    setRole("faction");
    setFactionId(id);
    localStorage.setItem("role", "faction");
    localStorage.setItem("factionId", String(id));
    navigate(`/faction/${id}`);
  }

  function resetRole() {
    setRole(null);
    setFactionId(null);
    localStorage.removeItem("role");
    localStorage.removeItem("factionId");
  }

  return (
    <div className="container">
      <h1>Realm Companion</h1>

      {role ? (
        <div className="card" style={{ marginBottom: "20px" }}>
          <p>
            You are currently:{" "}
            <strong>
              {role === "gm"
                ? "GM"
                : `Faction ${factionId ?? "?"}`}
            </strong>
          </p>
          <button onClick={resetRole}>Change Role</button>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: "20px" }}>
          <h2>Who are you?</h2>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={chooseGM}>I'm the GM</button>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
              <button key={f} onClick={() => chooseFaction(f)}>
                I am Faction {f}
              </button>
            ))}
          </div>
        </div>
      )}

      <h2>Factions</h2>
      <div className="summary-row">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
          <div key={f} className="summary-card">
            <h3>Faction {f}</h3>
            <button onClick={() => navigate(`/faction/${f}`)}>
              Open Faction {f}
            </button>
          </div>
        ))}
      </div>

      <h2>GM Tools</h2>
      <div className="card">
        {role === "gm" ? (
          <button
            onClick={() => navigate("/gm")}
            style={{ background: "#0066cc", borderColor: "#004d99" }}
          >
            Open GM Panel
          </button>
        ) : (
          <p style={{ color: "#aaa" }}>
            Only the GM can access the GM Panel. Switch to GM role above if
            you're the GM.
          </p>
        )}
      </div>
    </div>
  );
}
