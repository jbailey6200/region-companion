import { useState } from 'react';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function BackupData() {
  const [status, setStatus] = useState('');

  const handleBackup = async () => {
    setStatus('Backing up...');
    const collections = ['auth', 'factions', 'game', 'regions', 'agents', 'court', 'messages'];
    const backup = {};

    for (const col of collections) {
      try {
        const snapshot = await getDocs(collection(db, col));
        backup[col] = {};
        snapshot.forEach(docSnap => {
          backup[col][docSnap.id] = docSnap.data();
        });
        console.log('Backed up ' + snapshot.size + ' docs from ' + col);
      } catch (err) {
        console.log('Skipped ' + col + ': ' + err.message);
      }
    }

    for (let i = 1; i <= 8; i++) {
      const factionId = String(i);
      try {
        const armiesSnap = await getDocs(collection(db, 'factions', factionId, 'armies'));
        if (!backup.factionArmies) backup.factionArmies = {};
        backup.factionArmies[factionId] = {};
        armiesSnap.forEach(docSnap => {
          backup.factionArmies[factionId][docSnap.id] = docSnap.data();
        });
        console.log('Backed up ' + armiesSnap.size + ' armies from faction ' + factionId);
      } catch (err) {
        console.log('Skipped armies for faction ' + factionId);
      }

      try {
        const charsSnap = await getDocs(collection(db, 'factions', factionId, 'characters'));
        if (!backup.factionCharacters) backup.factionCharacters = {};
        backup.factionCharacters[factionId] = {};
        charsSnap.forEach(docSnap => {
          backup.factionCharacters[factionId][docSnap.id] = docSnap.data();
        });
        console.log('Backed up ' + charsSnap.size + ' characters from faction ' + factionId);
      } catch (err) {
        console.log('Skipped characters for faction ' + factionId);
      }
    }

    try {
      const neutralArmiesSnap = await getDocs(collection(db, 'factions', 'neutral', 'armies'));
      backup.neutralArmies = {};
      neutralArmiesSnap.forEach(docSnap => {
        backup.neutralArmies[docSnap.id] = docSnap.data();
      });
      console.log('Backed up ' + neutralArmiesSnap.size + ' neutral armies');
    } catch (err) {
      console.log('Skipped neutral armies');
    }

    try {
      const neutralCharsSnap = await getDocs(collection(db, 'factions', 'neutral', 'characters'));
      backup.neutralCharacters = {};
      neutralCharsSnap.forEach(docSnap => {
        backup.neutralCharacters[docSnap.id] = docSnap.data();
      });
      console.log('Backed up ' + neutralCharsSnap.size + ' neutral characters');
    } catch (err) {
      console.log('Skipped neutral characters');
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'firebase-backup-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);

    setStatus('Backup complete! File downloaded.');
  };

  const handleRestore = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      'WARNING: This will OVERWRITE all existing data with the backup. Are you sure?'
    );
    if (!confirmRestore) {
      event.target.value = '';
      return;
    }

    setStatus('Restoring...');

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const topLevelCols = ['auth', 'factions', 'game', 'regions', 'agents', 'court', 'messages'];
      for (const colName of topLevelCols) {
        if (backup[colName]) {
          for (const [docId, data] of Object.entries(backup[colName])) {
            await setDoc(doc(db, colName, docId), data);
            console.log('Restored ' + colName + '/' + docId);
          }
        }
      }

      if (backup.factionArmies) {
        for (const [factionId, armies] of Object.entries(backup.factionArmies)) {
          for (const [docId, data] of Object.entries(armies)) {
            await setDoc(doc(db, 'factions', factionId, 'armies', docId), data);
            console.log('Restored faction ' + factionId + ' army ' + docId);
          }
        }
      }

      if (backup.factionCharacters) {
        for (const [factionId, chars] of Object.entries(backup.factionCharacters)) {
          for (const [docId, data] of Object.entries(chars)) {
            await setDoc(doc(db, 'factions', factionId, 'characters', docId), data);
            console.log('Restored faction ' + factionId + ' character ' + docId);
          }
        }
      }

      if (backup.neutralArmies) {
        for (const [docId, data] of Object.entries(backup.neutralArmies)) {
          await setDoc(doc(db, 'factions', 'neutral', 'armies', docId), data);
          console.log('Restored neutral army ' + docId);
        }
      }

      if (backup.neutralCharacters) {
        for (const [docId, data] of Object.entries(backup.neutralCharacters)) {
          await setDoc(doc(db, 'factions', 'neutral', 'characters', docId), data);
          console.log('Restored neutral character ' + docId);
        }
      }

      setStatus('Restore complete! Refresh the page.');
    } catch (error) {
      console.error('Restore failed:', error);
      setStatus('Restore failed: ' + error.message);
    }

    event.target.value = '';
  };

  return (
    <div style={{ 
      padding: '16px', 
      background: '#1a1a2e', 
      borderRadius: '8px',
      marginBottom: '24px',
      border: '1px solid #4c3b2a'
    }}>
      <h3 style={{ color: '#d1b26b', marginTop: 0, marginBottom: '12px' }}>Database Backup/Restore</h3>
      
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
          onClick={handleBackup}
          style={{ 
            padding: '10px 20px', 
            background: '#4CAF50', 
            color: 'white', 
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Download Backup
        </button>

        <div>
          <label style={{ color: '#aaa', marginRight: '8px' }}>
            Restore:
          </label>
          <input 
            type="file" 
            accept=".json"
            onChange={handleRestore}
            style={{ color: 'white' }}
          />
        </div>
      </div>

      {status && (
        <p style={{ 
          color: status.includes('failed') ? '#ff6b6b' : '#4CAF50',
          marginTop: '12px',
          marginBottom: 0
        }}>
          {status}
        </p>
      )}
    </div>
  );
}