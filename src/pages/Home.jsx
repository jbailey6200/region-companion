import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { verifyPin, getAuthState, setAuthState, clearAuthState } from "../utils/auth";

export default function Home() {
  const [authState, setAuthStateLocal] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null); // "gm" | faction number
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const auth = getAuthState();
    if (auth) {
      setAuthStateLocal(auth);
    }
  }, []);

  async function handlePinSubmit(e) {
    e.preventDefault();
    setError("");
    
    if (pin.length !== 4) {
      setError("PIN must be 4 digits");
      return;
    }

    setIsVerifying(true);

    try {
      const roleKey = selectedRole === "gm" ? "gm" : `faction${selectedRole}`;
      const isValid = await verifyPin(roleKey, pin);

      if (isValid) {
        if (selectedRole === "gm") {
          setAuthState("gm", null);
          setAuthStateLocal({ role: "gm", factionId: null });
          navigate("/gm");
        } else {
          setAuthState("faction", selectedRole);
          setAuthStateLocal({ role: "faction", factionId: selectedRole });
          navigate(`/faction/${selectedRole}`);
        }
      } else {
        setError("Incorrect PIN. Please try again.");
        setPin("");
      }
    } catch (err) {
      setError("Error verifying PIN. Please try again.");
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  }

  function handleRoleSelection(role) {
    setSelectedRole(role);
    setPin("");
    setError("");
  }

  function handleBackToSelection() {
    setSelectedRole(null);
    setPin("");
    setError("");
  }

  function handleLogout() {
    clearAuthState();
    setAuthStateLocal(null);
    setSelectedRole(null);
    setPin("");
    setError("");
  }

  // If authenticated, show logged-in view
  if (authState) {
    return (
      <div className="container">
        <h1>Realm Companion</h1>

        <div className="card" style={{ marginBottom: "20px" }}>
          <p>
            You are logged in as:{" "}
            <strong>
              {authState.role === "gm"
                ? "Game Master"
                : `Faction ${authState.factionId}`}
            </strong>
          </p>
          <button onClick={handleLogout}>Logout</button>
        </div>

        <h2>Quick Navigation</h2>
        
        {authState.role === "gm" ? (
          <>
            <div className="card" style={{ marginBottom: "16px" }}>
              <button
                onClick={() => navigate("/gm")}
                style={{ background: "#0066cc", borderColor: "#004d99", width: "100%" }}
              >
                Open GM Panel
              </button>
            </div>
            
            <h3>Factions</h3>
            <div className="summary-row">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
                <div key={f} className="summary-card">
                  <h3>Faction {f}</h3>
                  <button onClick={() => navigate(`/faction/${f}`)}>
                    View Faction {f}
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="card">
            <button
              onClick={() => navigate(`/faction/${authState.factionId}`)}
              style={{ background: "#0066cc", borderColor: "#004d99", width: "100%" }}
            >
              View Your Faction
            </button>
          </div>
        )}
      </div>
    );
  }

  // If role is selected, show PIN entry
  if (selectedRole) {
    return (
      <div className="container">
        <h1>Realm Companion</h1>

        <div className="card" style={{ maxWidth: "400px", margin: "0 auto" }}>
          <button 
            onClick={handleBackToSelection}
            style={{ marginBottom: "16px" }}
          >
            ← Back to Selection
          </button>

          <h2 style={{ marginTop: 0 }}>
            {selectedRole === "gm" ? "Game Master" : `Faction ${selectedRole}`}
          </h2>
          
          <p style={{ color: "#c7bca5", fontSize: "14px" }}>
            Enter your 4-digit PIN to continue
          </p>

          <form onSubmit={handlePinSubmit}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="4"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Enter PIN"
              autoFocus
              style={{
                width: "100%",
                padding: "16px",
                fontSize: "24px",
                textAlign: "center",
                letterSpacing: "8px",
                borderRadius: "8px",
                border: "1px solid #5e4934",
                background: "#1d1610",
                color: "#f4efe4",
                marginBottom: "12px",
                boxSizing: "border-box",
              }}
            />

            {error && (
              <p style={{ color: "#f97373", fontSize: "14px", marginBottom: "12px" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pin.length !== 4 || isVerifying}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "16px",
                background: "linear-gradient(180deg, #3b342d 0%, #29221c 85%)",
                borderColor: "#6b5a3a",
              }}
            >
              {isVerifying ? "Verifying..." : "Enter"}
            </button>
          </form>

          <p style={{ fontSize: "12px", color: "#888", marginTop: "16px" }}>
            {selectedRole === "gm" 
              ? "First-time login will set your PIN"
              : "If this is your first login, the PIN you enter will be saved for future use"}
          </p>
        </div>
      </div>
    );
  }

  // Default: show role selection
  return (
    <div className="container">
      <h1>Realm Companion</h1>

      <div className="card" style={{ marginBottom: "20px" }}>
        <h2>Select Your Role</h2>
        <p style={{ color: "#c7bca5", fontSize: "14px" }}>
          Choose your faction or Game Master to begin
        </p>
        
        <div style={{ marginTop: "16px", marginBottom: "12px" }}>
          <button 
            onClick={() => handleRoleSelection("gm")}
            style={{ 
              width: "100%", 
              padding: "14px",
              background: "#30425d",
              borderColor: "#4a5d7a",
              fontSize: "16px",
            }}
          >
            Game Master
          </button>
        </div>

        <h3 style={{ fontSize: "16px", marginBottom: "12px" }}>Factions</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
            <button 
              key={f} 
              onClick={() => handleRoleSelection(f)}
              style={{ padding: "12px" }}
            >
              Faction {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}