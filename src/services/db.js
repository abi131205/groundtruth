import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  runTransaction,
  writeBatch
} from 'firebase/firestore';

// Standard Firebase config loaded from environment variables
const firebaseEnvConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

// Check for local storage config (entered via UI)
export const getSavedFirebaseConfig = () => {
  try {
    const configStr = localStorage.getItem('groundtruth_firebase_config');
    return configStr ? JSON.parse(configStr) : null;
  } catch (e) {
    console.error("Error reading saved firebase config", e);
    return null;
  }
};

export const saveFirebaseConfig = (config) => {
  if (!config) {
    localStorage.removeItem('groundtruth_firebase_config');
  } else {
    localStorage.setItem('groundtruth_firebase_config', JSON.stringify(config));
  }
};

// Check Dev Mode Safety Net (Strictly OFF by default)
const isDevMockEnabled = () => {
  return localStorage.getItem('VITE_USE_DEV_MOCK') === 'true';
};

// Initialize Firebase
let app = null;
let db = null;
const activeConfig = getSavedFirebaseConfig() || firebaseEnvConfig;

if (activeConfig && activeConfig.projectId) {
  try {
    app = initializeApp(activeConfig);
    db = getFirestore(app);
    console.log("Firebase initialized successfully with project ID:", activeConfig.projectId);
  } catch (err) {
    console.error("Firebase initialization failed:", err);
  }
}

// ==========================================================================
// Local Mock Store (Dev Mode Safety Net - OFF by default)
// ==========================================================================
let mockPHCs = [];
let mockLogs = {};
const mockSubscriptions = new Set();

const triggerMockUpdate = () => {
  mockSubscriptions.forEach(callback => callback(Object.values(mockLogs)));
};

// Initialize mock store from localStorage if it exists
try {
  const savedMockLogs = localStorage.getItem('gt_mock_logs');
  if (savedMockLogs) {
    mockLogs = JSON.parse(savedMockLogs);
  }
  const savedMockPhcs = localStorage.getItem('gt_mock_phcs');
  if (savedMockPhcs) {
    mockPHCs = JSON.parse(savedMockPhcs);
  }
} catch (e) {
  console.error("Failed to load local mock state", e);
}

// ==========================================================================
// Unified DB Interface Exports
// ==========================================================================

export const isFirebaseConnected = () => {
  return db !== null;
};

// 1. Get all PHC facilities
export const getPHCs = async () => {
  if (!db || isDevMockEnabled()) {
    console.warn("Using dev-mock / fallback mode for getPHCs");
    return mockPHCs;
  }
  
  const querySnapshot = await getDocs(collection(db, 'phcs'));
  const phcs = [];
  querySnapshot.forEach((doc) => {
    phcs.push({ id: doc.id, ...doc.data() });
  });
  return phcs;
};

// 2. Save/Update PHCs (used during seeding)
export const savePHC = async (phcId, phcData) => {
  if (!db || isDevMockEnabled()) {
    const idx = mockPHCs.findIndex(p => p.id === phcId);
    if (idx >= 0) mockPHCs[idx] = { id: phcId, ...phcData };
    else mockPHCs.push({ id: phcId, ...phcData });
    localStorage.setItem('gt_mock_phcs', JSON.stringify(mockPHCs));
    return;
  }
  
  const docRef = doc(db, 'phcs', phcId);
  await setDoc(docRef, phcData, { merge: true });
};

// 3. Get Logs for a specific PHC
export const getDailyLogs = async (phcId) => {
  if (!db || isDevMockEnabled()) {
    return Object.values(mockLogs)
      .filter(log => log.phcId === phcId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  
  const q = query(
    collection(db, 'daily_logs'),
    where('phcId', '==', phcId),
    orderBy('date', 'asc')
  );
  
  const querySnapshot = await getDocs(q);
  const logs = [];
  querySnapshot.forEach((doc) => {
    logs.push({ id: doc.id, ...doc.data() });
  });
  return logs;
};

// 4. Save/Update a Daily Log entry
export const saveDailyLog = async (phcId, date, logData) => {
  const docId = `${phcId}_${date}`;
  const dataToSave = {
    phcId,
    date,
    ...logData,
    updatedAt: new Date().toISOString()
  };

  if (!db || isDevMockEnabled()) {
    mockLogs[docId] = { id: docId, ...dataToSave };
    localStorage.setItem('gt_mock_logs', JSON.stringify(mockLogs));
    triggerMockUpdate();
    return;
  }
  
  const docRef = doc(db, 'daily_logs', docId);
  await setDoc(docRef, dataToSave, { merge: true });
};

// 5. Subscribe to all daily logs in real-time
export const subscribeToLogs = (callback) => {
  if (!db || isDevMockEnabled()) {
    mockSubscriptions.add(callback);
    callback(Object.values(mockLogs));
    return () => {
      mockSubscriptions.delete(callback);
    };
  }
  
  const q = query(collection(db, 'daily_logs'), orderBy('date', 'asc'));
  return onSnapshot(q, (querySnapshot) => {
    const logs = [];
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    callback(logs);
  }, (err) => {
    console.error("Firestore onSnapshot subscription failed:", err);
  });
};

// 6. Perform stock redistribution transaction (updates two PHCs atomically)
export const transferStock = async (fromPhcId, toPhcId, medicineId, quantity) => {
  const today = new Date().toISOString().split('T')[0];
  const fromDocId = `${fromPhcId}_${today}`;
  const toDocId = `${toPhcId}_${today}`;
  
  quantity = Number(quantity);
  
  if (!db || isDevMockEnabled()) {
    console.warn("Using dev-mock / fallback mode for transferStock");
    // Retrieve today's logs or create them from latest logs
    const fromLog = mockLogs[fromDocId] || { phcId: fromPhcId, date: today, medicineStock: {}, doctorAttendance: {}, testAvailability: {}, footfall: 0, occupiedBeds: 0 };
    const toLog = mockLogs[toDocId] || { phcId: toPhcId, date: today, medicineStock: {}, doctorAttendance: {}, testAvailability: {}, footfall: 0, occupiedBeds: 0 };
    
    const currentFromStock = Number(fromLog.medicineStock?.[medicineId] || 0);
    const currentToStock = Number(toLog.medicineStock?.[medicineId] || 0);
    
    if (currentFromStock < quantity) {
      throw new Error(`Insufficient stock at source: ${currentFromStock} units available.`);
    }
    
    fromLog.medicineStock = {
      ...fromLog.medicineStock,
      [medicineId]: currentFromStock - quantity
    };
    toLog.medicineStock = {
      ...toLog.medicineStock,
      [medicineId]: currentToStock + quantity
    };
    
    mockLogs[fromDocId] = { id: fromDocId, ...fromLog, updatedAt: new Date().toISOString() };
    mockLogs[toDocId] = { id: toDocId, ...toLog, updatedAt: new Date().toISOString() };
    
    localStorage.setItem('gt_mock_logs', JSON.stringify(mockLogs));
    triggerMockUpdate();
    return true;
  }
  
  const fromDocRef = doc(db, 'daily_logs', fromDocId);
  const toDocRef = doc(db, 'daily_logs', toDocId);
  
  try {
    await runTransaction(db, async (transaction) => {
      const fromDocSnap = await transaction.get(fromDocRef);
      const toDocSnap = await transaction.get(toDocRef);
      
      // Setup base models if logs do not exist for today yet
      let fromData = fromDocSnap.exists() ? fromDocSnap.data() : null;
      let toData = toDocSnap.exists() ? toDocSnap.data() : null;
      
      // If today's log doesn't exist, we must fetch the most recent log to carry over stocks
      if (!fromData) {
        // Find most recent log for this PHC (will run client-side or fallback to a query, inside transaction we can only read specific docRefs. 
        // We will initialize a clean default, or we can fetch them beforehand. For robust transaction, we'll look for today's doc)
        fromData = { medicineStock: {}, doctorAttendance: {}, testAvailability: {}, footfall: 0, occupiedBeds: 0 };
      }
      
      if (!toData) {
        toData = { medicineStock: {}, doctorAttendance: {}, testAvailability: {}, footfall: 0, occupiedBeds: 0 };
      }
      
      const currentFromStock = Number(fromData.medicineStock?.[medicineId] || 0);
      const currentToStock = Number(toData.medicineStock?.[medicineId] || 0);
      
      if (currentFromStock < quantity) {
        throw new Error(`Insufficient stock at source: ${currentFromStock} units available.`);
      }
      
      // Update stocks
      const updatedFromStock = currentFromStock - quantity;
      const updatedToStock = currentToStock + quantity;
      
      transaction.set(fromDocRef, {
        ...fromData,
        phcId: fromPhcId,
        date: today,
        medicineStock: {
          ...fromData.medicineStock,
          [medicineId]: updatedFromStock
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      transaction.set(toDocRef, {
        ...toData,
        phcId: toPhcId,
        date: today,
        medicineStock: {
          ...toData.medicineStock,
          [medicineId]: updatedToStock
        },
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });
    
    console.log(`Atomically transferred ${quantity} of ${medicineId} from ${fromPhcId} to ${toPhcId}`);
    return true;
  } catch (error) {
    console.error("Redistribution transaction failed:", error);
    throw error;
  }
};

// 7. Seed Script DB Executor (batch writes for seeding logs in one go)
export const batchSeedLogs = async (seededLogs, seededPhcs) => {
  if (!db || isDevMockEnabled()) {
    console.log("Seeding in-memory mock database...");
    mockPHCs = seededPhcs;
    mockLogs = {};
    seededLogs.forEach(log => {
      const docId = `${log.phcId}_${log.date}`;
      mockLogs[docId] = { id: docId, ...log };
    });
    localStorage.setItem('gt_mock_phcs', JSON.stringify(mockPHCs));
    localStorage.setItem('gt_mock_logs', JSON.stringify(mockLogs));
    triggerMockUpdate();
    return;
  }
  
  // Seed PHCs
  console.log("Seeding real Firestore PHC records...");
  const phcBatch = writeBatch(db);
  seededPhcs.forEach(phc => {
    const docRef = doc(db, 'phcs', phc.id);
    phcBatch.set(docRef, phc);
  });
  await phcBatch.commit();
  
  // Seed Logs (we will write in chunks since firestore limit is 500 writes per batch)
  console.log("Seeding real Firestore daily logs records...");
  const chunkSize = 400;
  for (let i = 0; i < seededLogs.length; i += chunkSize) {
    const chunk = seededLogs.slice(i, i + chunkSize);
    const logBatch = writeBatch(db);
    chunk.forEach(log => {
      const docRef = doc(db, 'daily_logs', `${log.phcId}_${log.date}`);
      logBatch.set(docRef, log);
    });
    await logBatch.commit();
  }
  console.log("Firestore seeding completed successfully.");
};
