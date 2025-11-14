import { useState } from "react";
import { db } from "../firebase/config";
import { collection, addDoc } from "firebase/firestore";
import { getTerrainFromMapPosition } from "../config/terrainRules";

/**
 * Bulk Region Importer Component
 * 
 * INSTRUCTIONS:
 * 1. Add this to your src/pages/ folder as BulkAddRegions.jsx
 * 2. Add a route in your App.jsx:
 *    import BulkAddRegions from './pages/BulkAddRegions';
 *    <Route path="/bulk-add-regions" element={<BulkAddRegions />} />
 * 3. Navigate to /bulk-add-regions
 * 4. Click "Add All 118 Regions"
 * 5. Wait for completion
 * 6. DELETE this file and route after use (for security!)
 */

export default function BulkAddRegions() {
  const [status, setStatus] = useState("ready");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [log, setLog] = useState([]);

  const regions = [
    // Row A (A1-A16)
    'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13', 'A14', 'A15', 'A16',
    
    // Row B (B1-B17)
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17',
    
    // Row C (C1-C16)
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16',
    
    // Row D (D1-D17)
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17',
    
    // Row E (E1-E16)
    'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16',
    
    // Row F (F1-F17)
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16', 'F17',
    
    // Row G (G1-G12)
    'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12',
    
    // Row H (H1-H6)
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    
    // Row I (I1)
    'I1'
  ];

  const addLog = (message) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  async function handleAddAllRegions() {
    if (status === "running") return;
    if (!window.confirm(`This will add ${regions.length} regions to Firestore. Continue?`)) {
      return;
    }

    setStatus("running");
    setProgress({ current: 0, total: regions.length });
    setLog([]);
    
    addLog(`Starting bulk import of ${regions.length} regions...`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < regions.length; i++) {
      const regionCode = regions[i];
      
      try {
        const terrain = getTerrainFromMapPosition(regionCode);
        
        await addDoc(collection(db, "regions"), {
          name: regionCode,
          code: regionCode,
          owner: 9, // Neutral faction
          terrain: terrain, // Auto-assigned terrain based on map position
          upgrades: [],
          disabledUpgrades: [],
          unrest: 0,
          notes: "",
        });

        successCount++;
        setProgress({ current: i + 1, total: regions.length });
        
        if ((i + 1) % 10 === 0) {
          addLog(`Added ${i + 1}/${regions.length} regions...`);
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        addLog(`❌ Failed to add ${regionCode}: ${error.message}`);
      }
    }

    setStatus("complete");
    addLog(`\n✅ Complete! Successfully added ${successCount}/${regions.length} regions.`);
    
    if (errorCount > 0) {
      addLog(`⚠️ ${errorCount} regions failed to add.`);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 800, margin: "20px auto", padding: 20 }}>
      <h1>Bulk Region Importer</h1>
      
      <div className="card" style={{ marginBottom: 20 }}>
        <h3>⚠️ Important</h3>
        <p>This tool will add <strong>118 regions</strong> to Firestore, all assigned to Faction 9 (Neutral).</p>
        <p style={{ color: "#f97373" }}>
          <strong>Delete this page after use!</strong> This should only be run once during initial setup.
        </p>
      </div>

      {status === "ready" && (
        <button
          onClick={handleAddAllRegions}
          style={{
            padding: "15px 30px",
            fontSize: 18,
            background: "#30425d",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          Add All 118 Regions
        </button>
      )}

      {status === "running" && (
        <div>
          <h3>Adding Regions...</h3>
          <div style={{ 
            background: "#2a2218", 
            borderRadius: 8, 
            padding: 10,
            marginBottom: 20
          }}>
            <div style={{
              background: "#30425d",
              height: 30,
              borderRadius: 4,
              width: `${(progress.current / progress.total) * 100}%`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: "bold",
              transition: "width 0.3s ease",
            }}>
              {progress.current} / {progress.total}
            </div>
          </div>
        </div>
      )}

      {status === "complete" && (
        <div className="card" style={{ background: "#2d5428", borderColor: "#4a8b3a" }}>
          <h3>✅ Complete!</h3>
          <p>All regions have been added. You can now:</p>
          <ul>
            <li>Navigate to faction pages to see the regions</li>
            <li>Use GM tools to assign territories</li>
            <li>Delete this component and route</li>
          </ul>
        </div>
      )}

      {log.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3>Log</h3>
          <div style={{
            background: "#1d1610",
            padding: 15,
            borderRadius: 8,
            maxHeight: 400,
            overflow: "auto",
            fontFamily: "monospace",
            fontSize: 12,
          }}>
            {log.map((entry, idx) => (
              <div key={idx} style={{ marginBottom: 4 }}>
                {entry}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}