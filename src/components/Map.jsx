import { useState, useEffect } from "react";
import { db } from "../firebase/config";
import { collection, onSnapshot } from "firebase/firestore";

// Faction colors
const FACTION_COLORS = {
  1: '#8B0000', // Dark Red
  2: '#00008B', // Dark Blue
  3: '#006400', // Dark Green
  4: '#4B0082', // Indigo
  5: '#FF8C00', // Dark Orange
  6: '#800080', // Purple
  7: '#000000', // Black
  8: '#708090', // Slate Gray
};

// Simple region list - just track what regions exist and who owns them
// You can add more regions as needed
const REGION_LIST = [
  // Row A
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16',
  // Row B  
  'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17',
  // Row C
  'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16',
  // Row D
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17',
  // Row E
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16',
  // Row F
  'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F17',
  // Row G
  'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12',
  // Row H (islands)
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  // Row I
  'I1'
];

export default function SimpleMap({ isGM = false, myFactionId = null }) {
  const [regions, setRegions] = useState([]);
  const [armies, setArmies] = useState([]);
  const [agents, setAgents] = useState([]);
  const [factionNames, setFactionNames] = useState({});
  const [selectedFaction, setSelectedFaction] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  // Load regions
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

  // Load faction names
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "factions"), (snap) => {
      const names = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        names[doc.id] = data.name || `Faction ${doc.id}`;
      });
      setFactionNames(names);
    });
    return () => unsub();
  }, []);

  // Load all armies
  useEffect(() => {
    const unsubscribers = [];
    
    for (let factionId = 1; factionId <= 8; factionId++) {
      const unsub = onSnapshot(
        collection(db, "factions", String(factionId), "armies"),
        (snap) => {
          const factionArmies = snap.docs.map((doc) => ({
            id: doc.id,
            factionId: factionId,
            ...doc.data(),
          }));
          
          setArmies((prev) => {
            const otherArmies = prev.filter((a) => a.factionId !== factionId);
            return [...otherArmies, ...factionArmies];
          });
        }
      );
      unsubscribers.push(unsub);
    }
    
    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  // Load agents
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "agents"), (snap) => {
      const list = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setAgents(list);
    });
    return () => unsub();
  }, []);

  function getRegionByCode(code) {
    return regions.find(r => r.code === code);
  }

  function getArmiesAt(location) {
    return armies.filter(a => a.location === location && !a.deleted);
  }

  function getAgentsAt(location) {
    return agents.filter(a => a.location === location);
  }

  // Group regions by row
  const regionsByRow = {};
  REGION_LIST.forEach(code => {
    const row = code[0];
    if (!regionsByRow[row]) regionsByRow[row] = [];
    regionsByRow[row].push(code);
  });

  // Filter regions by selected faction
  const visibleRegions = selectedFaction
    ? regions.filter(r => r.owner === selectedFaction)
    : regions;

  return (
    <div className="card" style={{ padding: "20px" }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        marginBottom: "16px"
      }}>
        <h2 style={{ margin: 0 }}>Strategic Overview</h2>
        
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="small"
          >
            View: {viewMode === 'grid' ? 'Grid' : 'List'}
          </button>
          
          {isGM && (
            <select
              value={selectedFaction || ''}
              onChange={(e) => setSelectedFaction(e.target.value ? Number(e.target.value) : null)}
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid #5e4934",
                background: "#241b15",
                color: "#f4efe4",
                fontFamily: "Georgia, serif",
              }}
            >
              <option value="">All Factions</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((f) => (
                <option key={f} value={f}>
                  {factionNames[f] || `Faction ${f}`}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        gap: "20px",
        marginBottom: "16px",
        flexWrap: "wrap",
        fontSize: "13px"
      }}>
        {Object.entries(FACTION_COLORS).map(([factionId, color]) => (
          <div key={factionId} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: "20px",
              height: "20px",
              backgroundColor: color,
              border: "1px solid #4c3b2a",
              borderRadius: "3px"
            }} />
            <span>{factionNames[factionId] || `Faction ${factionId}`}</span>
          </div>
        ))}
      </div>

      {viewMode === 'grid' ? (
        /* Grid View - Organized by rows */
        <div>
          <h3>Region Control by Row</h3>
          {Object.entries(regionsByRow).map(([row, codes]) => (
            <div key={row} style={{ marginBottom: "20px" }}>
              <h4 style={{ 
                marginBottom: "10px", 
                color: "#d1b26b",
                borderBottom: "1px solid #4c3b2a",
                paddingBottom: "4px"
              }}>
                Row {row}
              </h4>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                gap: "8px"
              }}>
                {codes.map(code => {
                  const region = getRegionByCode(code);
                  const armiesHere = getArmiesAt(code);
                  const agentsHere = getAgentsAt(code);
                  
                  if (!region) {
                    return (
                      <div key={code} style={{
                        padding: "8px",
                        background: "#1a1410",
                        border: "1px solid #3a2f24",
                        borderRadius: "6px",
                        textAlign: "center",
                        opacity: 0.5
                      }}>
                        <div style={{ fontSize: "12px", color: "#666" }}>{code}</div>
                        <div style={{ fontSize: "10px", color: "#555" }}>Unclaimed</div>
                      </div>
                    );
                  }
                  
                  const isVisible = !selectedFaction || region.owner === selectedFaction;
                  
                  return (
                    <div key={code} style={{
                      padding: "8px",
                      background: "#241b15",
                      border: `2px solid ${FACTION_COLORS[region.owner]}`,
                      borderRadius: "6px",
                      textAlign: "center",
                      opacity: isVisible ? 1 : 0.3,
                      position: "relative"
                    }}>
                      <div style={{ 
                        fontSize: "14px", 
                        fontWeight: "bold",
                        color: FACTION_COLORS[region.owner]
                      }}>
                        {code}
                      </div>
                      <div style={{ 
                        fontSize: "10px", 
                        color: "#c7bca5",
                        marginTop: "2px" 
                      }}>
                        {region.name || "Unnamed"}
                      </div>
                      
                      {/* Unit indicators */}
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "center", 
                        gap: "4px",
                        marginTop: "4px"
                      }}>
                        {armiesHere.length > 0 && (
                          <div style={{
                            background: "#8B0000",
                            color: "white",
                            padding: "2px 4px",
                            borderRadius: "3px",
                            fontSize: "10px"
                          }}>
                            ⚔{armiesHere.length}
                          </div>
                        )}
                        {agentsHere.length > 0 && (
                          <div style={{
                            background: "#00008B",
                            color: "white",
                            padding: "2px 4px",
                            borderRadius: "3px",
                            fontSize: "10px"
                          }}>
                            👁{agentsHere.length}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View - Detailed table */
        <div>
          <h3>Region Details</h3>
          <table style={{ 
            width: "100%", 
            borderCollapse: "collapse",
            fontSize: "14px"
          }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #4c3b2a" }}>
                <th style={{ padding: "8px", textAlign: "left" }}>Code</th>
                <th style={{ padding: "8px", textAlign: "left" }}>Name</th>
                <th style={{ padding: "8px", textAlign: "left" }}>Owner</th>
                <th style={{ padding: "8px", textAlign: "center" }}>Armies</th>
                <th style={{ padding: "8px", textAlign: "center" }}>Agents</th>
              </tr>
            </thead>
            <tbody>
              {visibleRegions
                .sort((a, b) => (a.code || '').localeCompare(b.code || ''))
                .map(region => {
                  const armiesHere = getArmiesAt(region.code);
                  const agentsHere = getAgentsAt(region.code);
                  
                  return (
                    <tr key={region.id} style={{ 
                      borderBottom: "1px solid #3a2f24",
                      opacity: (!selectedFaction || region.owner === selectedFaction) ? 1 : 0.3
                    }}>
                      <td style={{ 
                        padding: "8px",
                        color: FACTION_COLORS[region.owner],
                        fontWeight: "bold"
                      }}>
                        {region.code}
                      </td>
                      <td style={{ padding: "8px" }}>
                        {region.name || "Unnamed"}
                      </td>
                      <td style={{ 
                        padding: "8px",
                        color: FACTION_COLORS[region.owner]
                      }}>
                        {factionNames[region.owner] || `Faction ${region.owner}`}
                      </td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        {armiesHere.length > 0 ? (
                          <span style={{ color: "#f97373" }}>
                            {armiesHere.map(a => a.name || 'Army').join(', ')}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: "8px", textAlign: "center" }}>
                        {agentsHere.length > 0 ? (
                          <span style={{ color: "#7db5d1" }}>
                            {agentsHere.length}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Stats */}
      <div style={{ 
        marginTop: "20px", 
        padding: "16px",
        background: "#1a1410",
        borderRadius: "8px"
      }}>
        <h3 style={{ marginTop: 0 }}>Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map(factionId => {
            const factionRegions = regions.filter(r => r.owner === factionId);
            const factionArmies = armies.filter(a => a.factionId === factionId && !a.deleted);
            const factionAgents = agents.filter(a => a.factionId === factionId);
            
            if (selectedFaction && selectedFaction !== factionId) return null;
            
            return (
              <div key={factionId} style={{
                padding: "12px",
                background: "#241b15",
                borderRadius: "6px",
                border: `2px solid ${FACTION_COLORS[factionId]}`
              }}>
                <div style={{ 
                  fontWeight: "bold", 
                  marginBottom: "8px",
                  color: FACTION_COLORS[factionId]
                }}>
                  {factionNames[factionId] || `Faction ${factionId}`}
                </div>
                <div style={{ fontSize: "13px", color: "#c7bca5" }}>
                  <div>Regions: <strong>{factionRegions.length}</strong></div>
                  <div>Armies: <strong>{factionArmies.length}</strong></div>
                  <div>Agents: <strong>{factionAgents.length}</strong></div>
                </div>
              </div>
            );
          }).filter(Boolean)}
        </div>
      </div>
    </div>
  );
}