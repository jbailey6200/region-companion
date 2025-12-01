import { useState, useRef, useEffect, useCallback } from 'react';
import { collection, addDoc, updateDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TERRAIN_RULES } from '../config/terrainRules';

const HEX_SIZE = 32;
const HEX_H = HEX_SIZE;
const HEX_W = HEX_SIZE * Math.sqrt(3) / 2;
const ROW_HEIGHT = HEX_H * 1.5;
const PADDING = 50;

function hexToPixel(col, row, halfType, gridWidth) {
  const isOddRow = row % 2 === 1;
  const y = row * ROW_HEIGHT;
  
  let x;
  if (isOddRow) {
    if (halfType === 'left') {
      x = 0;
    } else {
      x = 2 * (col - 1) * HEX_W;
    }
  } else {
    // Even rows - same formula for all hexes including right half-hex
    x = (2 * col - 1) * HEX_W;
  }
  
  return { x: x + PADDING, y: y + PADDING + HEX_H };
}

function getFullHexCorners(cx, cy) {
  return [
    { x: cx, y: cy - HEX_H },
    { x: cx + HEX_W, y: cy - HEX_H * 0.5 },
    { x: cx + HEX_W, y: cy + HEX_H * 0.5 },
    { x: cx, y: cy + HEX_H },
    { x: cx - HEX_W, y: cy + HEX_H * 0.5 },
    { x: cx - HEX_W, y: cy - HEX_H * 0.5 },
  ];
}

// Left edge half-hex (flat left, pointy right) - for B1, D1, F1, H1
function getLeftHalfHexCorners(cx, cy) {
  return [
    { x: cx, y: cy - HEX_H },
    { x: cx + HEX_W, y: cy - HEX_H * 0.5 },
    { x: cx + HEX_W, y: cy + HEX_H * 0.5 },
    { x: cx, y: cy + HEX_H },
  ];
}

// Right edge half-hex (pointy left, flat right) - for A17, C17, E17, G17, I17
function getRightHalfHexCorners(cx, cy) {
  return [
    { x: cx, y: cy - HEX_H },
    { x: cx, y: cy + HEX_H },
    { x: cx - HEX_W, y: cy + HEX_H * 0.5 },
    { x: cx - HEX_W, y: cy - HEX_H * 0.5 },
  ];
}

function rowToLetter(row) {
  return String.fromCharCode(65 + row);
}

export default function MapEditor() {
  const [setupComplete, setSetupComplete] = useState(false);
  const [gridWidth, setGridWidth] = useState(17);
  const [gridHeight, setGridHeight] = useState(9);
  
  const canvasRef = useRef(null);
  const [hexes, setHexes] = useState({});
  const [selectedHex, setSelectedHex] = useState(null);
  const [selectedTerrain, setSelectedTerrain] = useState('plains');
  const [tool, setTool] = useState('terrain');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mapName, setMapName] = useState('New Map');
  const [savedMaps, setSavedMaps] = useState([]);
  const [currentMapId, setCurrentMapId] = useState(null);
  const [status, setStatus] = useState('');
  const [editingName, setEditingName] = useState('');

  useEffect(() => { loadMapsList(); }, []);

  async function loadMapsList() {
    try {
      const snapshot = await getDocs(collection(db, 'maps'));
      setSavedMaps(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.log('No maps yet'); }
  }

  function initializeGrid() {
    const newHexes = {};
    for (let row = 0; row < gridHeight; row++) {
      const isOddRow = row % 2 === 1;
      for (let col = 1; col <= gridWidth; col++) {
        const code = `${rowToLetter(row)}${col}`;
        const isLeftHalf = isOddRow && col === 1;
        const isRightHalf = !isOddRow && col === gridWidth;
        
        newHexes[code] = {
          code, row, col,
          terrain: 'plains',
          name: '',
          halfType: isLeftHalf ? 'left' : (isRightHalf ? 'right' : null)
        };
      }
    }
    setHexes(newHexes);
    setSetupComplete(true);
  }

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#1a3a4a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sortedHexes = Object.values(hexes).sort((a, b) => a.row !== b.row ? a.row - b.row : a.col - b.col);

    sortedHexes.forEach(hex => {
      const { x, y } = hexToPixel(hex.col, hex.row, hex.halfType, gridWidth);
      const screenX = x + offset.x;
      const screenY = y + offset.y;
      
      const terrainInfo = TERRAIN_RULES[hex.terrain] || { color: '#888' };
      const isSelected = selectedHex === hex.code;
      const isWater = hex.terrain === 'water';
      
      let corners;
      if (hex.halfType === 'left') {
        corners = getLeftHalfHexCorners(screenX, screenY);
      } else if (hex.halfType === 'right') {
        corners = getRightHalfHexCorners(screenX, screenY);
      } else {
        corners = getFullHexCorners(screenX, screenY);
      }
      
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
      ctx.closePath();
      
      ctx.fillStyle = terrainInfo.color;
      ctx.fill();
      ctx.strokeStyle = isSelected ? '#fff' : (isWater ? '#3a5a6a' : '#2a2a2a');
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.stroke();

      let labelX = screenX;
      if (hex.halfType === 'left') labelX = screenX + HEX_W * 0.5;
      if (hex.halfType === 'right') labelX = screenX - HEX_W * 0.5;
      
      ctx.fillStyle = isWater ? '#5a7a8a' : '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hex.code, labelX, screenY - 5);
      
      if (hex.name && terrainInfo.isPlayable !== false) {
        ctx.font = '8px sans-serif';
        ctx.fillText(hex.name.substring(0, 6), labelX, screenY + 8);
      }
    });
  }, [hexes, selectedHex, offset, gridWidth]);

  useEffect(() => { if (setupComplete) draw(); }, [draw, setupComplete]);

  useEffect(() => {
    if (!setupComplete) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = canvas.parentElement.clientWidth; canvas.height = 600; draw(); };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draw, setupComplete]);

  function handleCanvasClick(e) {
    if (isDragging) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left - offset.x;
    const clickY = e.clientY - rect.top - offset.y;

    let clickedHex = null;
    let minDist = Infinity;
    
    for (const hex of Object.values(hexes)) {
      const { x, y } = hexToPixel(hex.col, hex.row, hex.halfType, gridWidth);
      let centerX = x;
      if (hex.halfType === 'left') centerX = x + HEX_W * 0.5;
      if (hex.halfType === 'right') centerX = x - HEX_W * 0.5;
      
      const dx = clickX - centerX;
      const dy = clickY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = hex.halfType ? HEX_SIZE * 0.6 : HEX_SIZE * 0.9;
      
      if (distance < hitRadius && distance < minDist) {
        minDist = distance;
        clickedHex = hex.code;
      }
    }

    if (clickedHex) {
      if (tool === 'delete') {
        setHexes(prev => { const next = { ...prev }; delete next[clickedHex]; return next; });
        if (selectedHex === clickedHex) setSelectedHex(null);
      } else {
        setSelectedHex(clickedHex);
        setEditingName(hexes[clickedHex]?.name || '');
      }
    }
  }

  function handleMouseDown(e) {
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  }
  function handleMouseMove(e) { if (isDragging) setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }
  function handleMouseUp() { setIsDragging(false); }

  function setHexTerrain(terrain) {
    if (!selectedHex) return;
    setHexes(prev => ({ ...prev, [selectedHex]: { ...prev[selectedHex], terrain, name: terrain === 'water' ? '' : prev[selectedHex].name } }));
  }
  function setHexName(name) {
    if (!selectedHex) return;
    setHexes(prev => ({ ...prev, [selectedHex]: { ...prev[selectedHex], name } }));
  }
  function deleteSelectedHex() {
    if (!selectedHex) return;
    setHexes(prev => { const next = { ...prev }; delete next[selectedHex]; return next; });
    setSelectedHex(null);
  }

  async function saveMap() {
    const mapData = { name: mapName, gridWidth, gridHeight, hexes, updatedAt: new Date() };
    try {
      if (currentMapId) { await updateDoc(doc(db, 'maps', currentMapId), mapData); setStatus('Updated!'); }
      else { const docRef = await addDoc(collection(db, 'maps'), { ...mapData, createdAt: new Date() }); setCurrentMapId(docRef.id); setStatus('Saved!'); }
      loadMapsList();
    } catch (err) { setStatus('Failed: ' + err.message); }
    setTimeout(() => setStatus(''), 3000);
  }

  function loadMap(map) {
    setCurrentMapId(map.id); setMapName(map.name); setGridWidth(map.gridWidth || 17);
    setGridHeight(map.gridHeight || 9); setHexes(map.hexes || {}); setSelectedHex(null); setSetupComplete(true);
  }
  function newMap() { setCurrentMapId(null); setMapName('New Map'); setHexes({}); setSelectedHex(null); setSetupComplete(false); }
  async function deleteMap(mapId) {
    if (!window.confirm('Delete?')) return;
    try { await deleteDoc(doc(db, 'maps', mapId)); if (currentMapId === mapId) newMap(); loadMapsList(); } catch (err) {}
  }

  const playableCount = Object.values(hexes).filter(h => TERRAIN_RULES[h.terrain]?.isPlayable !== false).length;

  if (!setupComplete) {
    return (
      <div style={{ padding: '40px', background: '#0a0a08', minHeight: '100vh' }}>
        <h1 style={{ color: '#d1b26b', marginBottom: '32px' }}>Map Editor</h1>
        <div style={{ display: 'flex', gap: '40px' }}>
          <div style={{ background: '#1a1410', padding: '24px', borderRadius: '8px', border: '1px solid #4c3b2a', width: '350px' }}>
            <h2 style={{ color: '#d1b26b', marginTop: 0 }}>Create New Map</h2>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#a89a7a', marginBottom: '4px' }}>Map Name</label>
              <input type="text" value={mapName} onChange={(e) => setMapName(e.target.value)} style={{ width: '100%', padding: '8px', background: '#0a0a08', border: '1px solid #4c3b2a', color: '#fff' }} />
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#a89a7a', marginBottom: '4px' }}>Width</label>
              <input type="range" min="5" max="30" value={gridWidth} onChange={(e) => setGridWidth(Number(e.target.value))} style={{ width: '100%' }} />
              <span style={{ color: '#fff' }}>{gridWidth} hexes</span>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#a89a7a', marginBottom: '4px' }}>Height</label>
              <input type="range" min="3" max="20" value={gridHeight} onChange={(e) => setGridHeight(Number(e.target.value))} style={{ width: '100%' }} />
              <span style={{ color: '#fff' }}>{gridHeight} rows (A-{rowToLetter(gridHeight - 1)})</span>
            </div>
            <button onClick={initializeGrid} style={{ width: '100%', padding: '12px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Create Map</button>
          </div>
          <div style={{ background: '#1a1410', padding: '24px', borderRadius: '8px', border: '1px solid #4c3b2a', width: '300px' }}>
            <h2 style={{ color: '#d1b26b', marginTop: 0 }}>Load Existing</h2>
            {savedMaps.length === 0 ? <p style={{ color: '#888' }}>No saved maps</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {savedMaps.map(map => (
                  <div key={map.id} style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => loadMap(map)} style={{ flex: 1, padding: '12px', background: '#241b15', border: '1px solid #4c3b2a', color: '#fff', textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ fontWeight: 'bold' }}>{map.name}</div>
                    </button>
                    <button onClick={() => deleteMap(map.id)} style={{ padding: '12px', background: '#5a2a2a', border: 'none', color: '#fff', cursor: 'pointer' }}>X</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const selectedHexData = selectedHex ? hexes[selectedHex] : null;

  return (
    <div style={{ padding: '20px', background: '#0a0a08', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ margin: 0, color: '#d1b26b' }}>{mapName} - {playableCount} regions</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="text" value={mapName} onChange={(e) => setMapName(e.target.value)} style={{ padding: '8px', background: '#1a1410', border: '1px solid #4c3b2a', color: '#fff', width: '180px' }} />
          <button onClick={saveMap} style={{ padding: '8px 16px', background: '#4CAF50', color: '#fff', border: 'none', borderRadius: '4px' }}>Save</button>
          <button onClick={newMap} style={{ padding: '8px 16px', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px' }}>New</button>
        </div>
      </div>
      {status && <div style={{ padding: '8px 16px', background: '#2a4a2a', color: '#b5e8a1', marginBottom: '16px', borderRadius: '4px' }}>{status}</div>}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ width: '200px', flexShrink: 0 }}>
          <div style={{ background: '#1a1410', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={() => setTool('terrain')} style={{ flex: 1, padding: '8px', background: tool === 'terrain' ? '#3a3020' : '#241b15', border: tool === 'terrain' ? '2px solid #d1b26b' : '1px solid #4c3b2a', color: '#fff', cursor: 'pointer' }}>Paint</button>
              <button onClick={() => setTool('delete')} style={{ flex: 1, padding: '8px', background: tool === 'delete' ? '#5a2a2a' : '#241b15', border: tool === 'delete' ? '2px solid #ff6b6b' : '1px solid #4c3b2a', color: '#fff', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
          <div style={{ background: '#1a1410', padding: '12px', borderRadius: '4px', marginBottom: '12px' }}>
            <h3 style={{ margin: '0 0 8px 0', color: '#d1b26b', fontSize: '14px' }}>{selectedHex || 'Click hex'}</h3>
            {selectedHexData && (
              <>
                <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} onBlur={() => setHexName(editingName)} placeholder="Name" style={{ width: '100%', padding: '6px', background: '#0a0a08', border: '1px solid #4c3b2a', color: '#fff', marginBottom: '8px' }} />
                <button onClick={deleteSelectedHex} style={{ width: '100%', padding: '6px', background: '#5a2a2a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
              </>
            )}
          </div>
          <div style={{ background: '#1a1410', padding: '12px', borderRadius: '4px' }}>
            {Object.entries(TERRAIN_RULES).map(([key, t]) => (
              <button key={key} onClick={() => { setSelectedTerrain(key); setTool('terrain'); if (selectedHex) setHexTerrain(key); }}
                style={{ display: 'block', width: '100%', padding: '6px', marginBottom: '4px', background: t.color, border: selectedTerrain === key ? '2px solid #fff' : '1px solid #000', color: '#fff', cursor: 'pointer', fontSize: '12px', textAlign: 'left' }}>
                {t.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, background: '#1a3a4a', borderRadius: '4px', overflow: 'hidden' }}>
          <canvas ref={canvasRef} onClick={handleCanvasClick} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onContextMenu={(e) => e.preventDefault()} style={{ cursor: isDragging ? 'grabbing' : 'pointer', display: 'block' }} />
          <div style={{ padding: '8px', background: '#0a0a08', color: '#888', fontSize: '12px' }}>Shift+drag to pan</div>
        </div>
      </div>
    </div>
  );
}