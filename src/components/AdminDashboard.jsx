import React, { useState, useEffect } from 'react';
import { subscribeToLogs, transferStock } from '../services/db';
import { generateStockOutExplanation, generateRedistributionReasoning, generateUnderperformanceSummary } from '../services/ai';
import { SEEDED_PHCS } from '../services/seed';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  AlertTriangle, RefreshCw, ArrowRightLeft, UserX, TrendingUp, Bed, Users, ShieldAlert, CheckCircle, Info
} from 'lucide-react';

const MEDICINES = [
  { id: 'paracetamol', name: 'Paracetamol 500mg Tablets' },
  { id: 'amoxicillin', name: 'Amoxicillin 250mg Antibiotic' },
  { id: 'ibuprofen', name: 'Ibuprofen 400mg Pain Reliever' },
  { id: 'ors', name: 'Oral Rehydration Salts Packets' },
  { id: 'metformin', name: 'Metformin 500mg Diabetes Tablet' },
  { id: 'atorvastatin', name: 'Atorvastatin 10mg Cholesterol Tablet' },
  { id: 'cetirizine', name: 'Cetirizine 10mg Anti-allergy Tablet' },
  { id: 'albendazole', name: 'Albendazole 400mg Deworming Tablet' },
  { id: 'iron_folic', name: 'Iron & Folic Acid Tablets' },
  { id: 'azithromycin', name: 'Azithromycin 500mg Antibiotic' }
];

const TESTS = [
  { id: 'malaria', name: 'Malaria Rapid Test' },
  { id: 'pregnancy', name: 'Pregnancy Test' },
  { id: 'typhoid', name: 'Typhoid Test' },
  { id: 'glucose', name: 'Glucose Test' },
  { id: 'hiv', name: 'HIV Test' }
];

const STATES_AND_UTS = [
  "All States & UTs",
  "Uttar Pradesh",
  "Madhya Pradesh",
  "Andhra Pradesh",
  "West Bengal",
  "Gujarat",
  "Nagaland",
  "Jammu & Kashmir (UT)",
  "Puducherry (UT)"
];

const ZONES = [
  "All Zones",
  "North",
  "Central",
  "South",
  "East",
  "West",
  "Northeast",
  "North/UT",
  "South/UT"
];

function AdminDashboard({ inspectedPhcId }) {
  const [phcs, setPhcs] = useState(SEEDED_PHCS);
  const [logs, setLogs] = useState([]);
  
  // Filtering States
  const [selectedState, setSelectedState] = useState("All States & UTs");
  const [selectedZone, setSelectedZone] = useState("All Zones");
  
  // Selected PHC for chart view
  const [activePhcId, setActivePhcId] = useState(SEEDED_PHCS[0].id);

  // Sync with map inspection trigger
  useEffect(() => {
    if (inspectedPhcId) {
      setActivePhcId(inspectedPhcId);
    }
  }, [inspectedPhcId]);
  const [activeMedicineId, setActiveMedicineId] = useState('paracetamol');
  
  // AI Caching states (to prevent duplicate API requests)
  const [aiExplanations, setAiExplanations] = useState({}); // { phcId_medId: text }
  const [aiRedistributions, setAiRedistributions] = useState({}); // { from_to_medId: text }
  const [aiUnderperformances, setAiUnderperformances] = useState({}); // { phcId: text }

  const [loadingAi, setLoadingAi] = useState({});
  const [successTransfer, setSuccessTransfer] = useState('');
  const [errorTransfer, setErrorTransfer] = useState('');

  // 1. Subscribe to real-time database logs
  useEffect(() => {
    const unsubscribe = subscribeToLogs((fetchedLogs) => {
      setLogs(fetchedLogs);
    });
    return () => unsubscribe();
  }, []);

  // 2. Compute dynamic stats for each PHC from latest log
  const getPHCLatestData = (phcId) => {
    const phcLogs = logs.filter(l => l.phcId === phcId).sort((a, b) => b.date.localeCompare(a.date));
    return phcLogs[0] || null;
  };

  // Status computation for each facility
  const getPHCStatus = (phc, latestLog, recentLogs) => {
    if (!latestLog) return 'green';
    
    // Crit 1: Complete Stockouts
    const hasCriticalStockout = Object.entries(latestLog.medicineStock || {}).some(
      ([medId, qty]) => Number(qty) === 0
    );

    // Crit 2: Bed Occupancy
    const bedPercent = latestLog.occupiedBeds / phc.capacity;
    
    // Crit 3: Doctors Absence
    const doctorAbsent = Object.values(latestLog.doctorAttendance || {}).some(present => !present);
    
    if (hasCriticalStockout || bedPercent >= 0.9 || doctorAbsent) {
      return 'red';
    }

    // Crit 4: Stock alerts (Predicted running out <= 3 days)
    const hasStockWarning = MEDICINES.some(med => {
      const stockVal = latestLog.medicineStock?.[med.id] || 0;
      const trend = recentLogs.map(l => l.medicineStock?.[med.id] || 0);
      if (trend.length < 2) return false;
      const recent = recentLogs.slice(-7);
      const startVal = recent[0]?.medicineStock?.[med.id] || 0;
      const endVal = recent[recent.length - 1]?.medicineStock?.[med.id] || 0;
      const diff = startVal - endVal;
      if (diff > 0) {
        const consumption = diff / (recent.length - 1);
        const daysLeft = stockVal / consumption;
        return daysLeft <= 3;
      }
      return false;
    });

    if (hasStockWarning || bedPercent >= 0.7) {
      return 'amber';
    }

    return 'green';
  };

  // Extract recent logs helper (max 14 logs, sorted asc by date)
  const getRecentLogs = (phcId) => {
    return logs
      .filter(l => l.phcId === phcId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);
  };

  // Run dynamic analysis to compile alerts
  const computedPHCs = phcs.map(phc => {
    const latestLog = getPHCLatestData(phc.id);
    const recentLogs = getRecentLogs(phc.id);
    const status = getPHCStatus(phc, latestLog, recentLogs);
    
    return {
      ...phc,
      latestLog,
      status
    };
  });

  // Filter PHCs
  const filteredPHCs = computedPHCs.filter(phc => {
    const matchState = selectedState === "All States & UTs" || phc.stateOrUT === selectedState;
    const matchZone = selectedZone === "All Zones" || phc.zone === selectedZone;
    return matchState && matchZone;
  });

  // 3. AI Predictive Stock-out Warnings Engine
  const stockAlerts = [];
  computedPHCs.forEach(phc => {
    const latestLog = phc.latestLog;
    const recentLogs = getRecentLogs(phc.id);
    if (!latestLog || recentLogs.length < 2) return;

    MEDICINES.forEach(med => {
      const currentStock = Number(latestLog.medicineStock?.[med.id] || 0);
      const trend = recentLogs.map(l => l.medicineStock?.[med.id] || 0);
      
      // Calculate trend slope (consumption rate) over last 7 logs
      const recent = recentLogs.slice(-7);
      const startStock = Number(recent[0]?.medicineStock?.[med.id] || 0);
      const endStock = Number(recent[recent.length - 1]?.medicineStock?.[med.id] || 0);
      const diff = startStock - endStock;

      if (diff > 0) {
        const consumption = diff / (recent.length - 1);
        const daysRemaining = currentStock / consumption;
        
        if (daysRemaining <= 5) {
          stockAlerts.push({
            id: `${phc.id}_${med.id}`,
            phcId: phc.id,
            phcName: phc.name,
            medicineId: med.id,
            medicineName: med.name,
            currentStock,
            daysRemaining: Math.round(daysRemaining * 10) / 10,
            trend
          });
        }
      } else if (currentStock === 0) {
        stockAlerts.push({
          id: `${phc.id}_${med.id}`,
          phcId: phc.id,
          phcName: phc.name,
          medicineId: med.id,
          medicineName: med.name,
          currentStock: 0,
          daysRemaining: 0,
          trend
        });
      }
    });
  });

  // 4. AI Redistribution Suggestion Engine
  const redistributionSuggestions = [];
  stockAlerts.filter(alert => alert.daysRemaining <= 3).forEach(deficit => {
    // Find a surplus candidate for this medicine
    computedPHCs.forEach(source => {
      if (source.id === deficit.phcId) return; // cannot transfer to itself
      
      const sourceLatest = source.latestLog;
      const sourceRecent = getRecentLogs(source.id);
      if (!sourceLatest || sourceRecent.length < 2) return;
      
      const sourceStock = Number(sourceLatest.medicineStock?.[deficit.medicineId] || 0);
      const sourceTrend = sourceRecent.map(l => l.medicineStock?.[deficit.medicineId] || 0);
      
      // Check if source has safe surplus (Stock > 100 AND either flat trend or predicted days remaining > 15 days)
      const recent = sourceRecent.slice(-7);
      const startStock = Number(recent[0]?.medicineStock?.[deficit.medicineId] || 0);
      const endStock = Number(recent[recent.length - 1]?.medicineStock?.[deficit.medicineId] || 0);
      const diff = startStock - endStock;
      
      let isSurplus = false;
      let daysRemaining = Infinity;
      
      if (diff <= 0 && sourceStock > 150) {
        isSurplus = true;
      } else if (diff > 0) {
        const consumption = diff / (recent.length - 1);
        daysRemaining = sourceStock / consumption;
        if (daysRemaining > 15 && sourceStock > 150) {
          isSurplus = true;
        }
      }
      
      if (isSurplus) {
        // Suggest a quantity that helps deficit hit ~7 days of average usage, without dropping source below 100
        const deficitRecent = getRecentLogs(deficit.phcId).slice(-7);
        const defDiff = Number(deficitRecent[0]?.medicineStock?.[deficit.medicineId] || 0) - Number(deficitRecent[deficitRecent.length - 1]?.medicineStock?.[deficit.medicineId] || 0);
        const defUsage = defDiff > 0 ? (defDiff / (deficitRecent.length - 1)) : 8; // fallback to 8 tablets/day usage
        const neededQty = Math.round(defUsage * 7) - deficit.currentStock;
        const transferQty = Math.min(neededQty > 0 ? neededQty : 50, Math.floor(sourceStock - 100));

        if (transferQty >= 20) {
          redistributionSuggestions.push({
            id: `${source.id}_to_${deficit.phcId}_${deficit.medicineId}`,
            fromPhcId: source.id,
            fromPhcName: source.name,
            toPhcId: deficit.phcId,
            toPhcName: deficit.name,
            medicineId: deficit.medicineId,
            medicineName: deficit.medicineName,
            quantity: transferQty,
            sourceStock,
            destStock: deficit.currentStock
          });
        }
      }
    });
  });

  // Limit suggestions to unique destinations to avoid confusing recommendations
  const uniqueSuggestions = [];
  const seenDestinations = new Set();
  redistributionSuggestions.forEach(sug => {
    const key = `${sug.toPhcId}_${sug.medicineId}`;
    if (!seenDestinations.has(key)) {
      seenDestinations.add(key);
      uniqueSuggestions.push(sug);
    }
  });

  // 5. AI Underperformance Flagging Engine
  const flaggedFacilities = [];
  computedPHCs.forEach(phc => {
    const recentLogs = getRecentLogs(phc.id);
    if (recentLogs.length < 5) return; // need sufficient logs to judge performance

    const flags = [];
    
    // Metric A: Doctor absenteeism rate > 30%
    phc.doctors.forEach(doc => {
      const logsWithDoc = recentLogs.filter(l => l.doctorAttendance && l.doctorAttendance[doc.id] !== undefined);
      if (logsWithDoc.length > 0) {
        const daysAbsent = logsWithDoc.filter(l => !l.doctorAttendance[doc.id]).length;
        const absentRate = daysAbsent / logsWithDoc.length;
        if (absentRate >= 0.3) {
          flags.push(`Doctor Absenteeism: ${doc.name.split(" ")[0]} was absent for ${Math.round(absentRate * 100)}% of reported shifts.`);
        }
      }
    });

    // Metric B: Severe bed strain (Occupancy > 90% for more than 4 days in last 14 logs)
    const strainedDays = recentLogs.filter(l => l.occupiedBeds / phc.capacity >= 0.9).length;
    if (strainedDays >= 4) {
      flags.push(`Capacity Strain: Bed occupancy was at critical capacity (>= 90%) on ${strainedDays} days.`);
    }

    // Metric C: Essential Stockouts (Any medicine was 0 for 3+ days in last 14 logs)
    const stockoutDays = {};
    recentLogs.forEach(log => {
      Object.entries(log.medicineStock || {}).forEach(([medId, qty]) => {
        if (Number(qty) === 0) {
          stockoutDays[medId] = (stockoutDays[medId] || 0) + 1;
        }
      });
    });

    Object.entries(stockoutDays).forEach(([medId, days]) => {
      if (days >= 3) {
        const medName = MEDICINES.find(m => m.id === medId)?.name.split(" ")[0] || medId;
        flags.push(`Chronic Inventory Outage: ${medName} has been completely out of stock for ${days} days.`);
      }
    });

    if (flags.length > 0) {
      flaggedFacilities.push({
        phcId: phc.id,
        phcName: phc.name,
        flags
      });
    }
  });

  // ==========================================================================
  // Trigger AI Text Requests (On-Demand and Cached)
  // ==========================================================================
  
  // Stockout reason generator trigger
  const triggerStockoutReason = async (alert) => {
    const cacheKey = `${alert.phcId}_${alert.medicineId}`;
    if (aiExplanations[cacheKey] || loadingAi[cacheKey]) return;

    setLoadingAi(prev => ({ ...prev, [cacheKey]: true }));
    try {
      const reasoning = await generateStockOutExplanation(alert.phcName, alert.medicineName, alert.currentStock, alert.trend);
      setAiExplanations(prev => ({ ...prev, [cacheKey]: reasoning }));
    } catch (e) {
      setAiExplanations(prev => ({ ...prev, [cacheKey]: "Decline due to local patient footfall increase." }));
    } finally {
      setLoadingAi(prev => ({ ...prev, [cacheKey]: false }));
    }
  };

  // Redistribution reason generator trigger
  const triggerRedistributionReason = async (sug) => {
    const cacheKey = sug.id;
    if (aiRedistributions[cacheKey] || loadingAi[cacheKey]) return;

    setLoadingAi(prev => ({ ...prev, [cacheKey]: true }));
    try {
      const reasoning = await generateRedistributionReasoning(sug.fromPhcName, sug.toPhcName, sug.medicineName, sug.quantity);
      setAiRedistributions(prev => ({ ...prev, [cacheKey]: reasoning }));
    } catch (e) {
      setAiRedistributions(prev => ({ ...prev, [cacheKey]: "Optimizes district logistics to cover immediate gaps." }));
    } finally {
      setLoadingAi(prev => ({ ...prev, [cacheKey]: false }));
    }
  };

  // Underperformance reason generator trigger
  const triggerUnderperformanceReason = async (facility) => {
    const cacheKey = facility.phcId;
    if (aiUnderperformances[cacheKey] || loadingAi[cacheKey]) return;

    setLoadingAi(prev => ({ ...prev, [cacheKey]: true }));
    try {
      const summary = await generateUnderperformanceSummary(facility.phcName, facility.flags);
      setAiUnderperformances(prev => ({ ...prev, [cacheKey]: summary }));
    } catch (e) {
      setAiUnderperformances(prev => ({ ...prev, [cacheKey]: "Requires staff allocation support and supply restocking." }));
    } finally {
      setLoadingAi(prev => ({ ...prev, [cacheKey]: false }));
    }
  };

  // Trigger calls automatically for lists when mounted or updated
  useEffect(() => {
    // Stockout explanations trigger
    stockAlerts.slice(0, 3).forEach(alert => {
      triggerStockoutReason(alert);
    });
  }, [logs]);

  useEffect(() => {
    // Redistribution explanations trigger
    uniqueSuggestions.slice(0, 2).forEach(sug => {
      triggerRedistributionReason(sug);
    });
  }, [logs]);

  useEffect(() => {
    // Performance explanations trigger
    flaggedFacilities.slice(0, 2).forEach(fac => {
      triggerUnderperformanceReason(fac);
    });
  }, [logs]);

  // Execute Stock Transfer Transaction
  const handleExecuteTransfer = async (sug) => {
    setErrorTransfer('');
    setSuccessTransfer('');
    try {
      await transferStock(sug.fromPhcId, sug.toPhcId, sug.medicineId, sug.quantity);
      setSuccessTransfer(`Successfully processed transfer of ${sug.quantity} units of ${sug.medicineName} to ${sug.toPhcName}!`);
      
      // Dispatch logistics shipment entry
      try {
        const currentTransfers = JSON.parse(localStorage.getItem('groundtruth_transfers') || '[]');
        const newTransfer = {
          id: `t-${Date.now()}`,
          fromPhcName: sug.fromPhcName,
          toPhcName: sug.toPhcName,
          medicineName: sug.medicineName,
          quantity: sug.quantity,
          status: 'dispatched',
          timestamp: new Date().toISOString()
        };
        currentTransfers.unshift(newTransfer);
        localStorage.setItem('groundtruth_transfers', JSON.stringify(currentTransfers));
        window.dispatchEvent(new Event('transfer-added'));
      } catch (err) {
        console.error("Failed to update logistics pipeline:", err);
      }

      setTimeout(() => setSuccessTransfer(''), 4000);
    } catch (err) {
      setErrorTransfer(`Transfer failed: ${err.message}`);
      setTimeout(() => setErrorTransfer(''), 4000);
    }
  };

  // ==========================================================================
  // Recharts Chart Formatting
  // ==========================================================================
  const activePHC = phcs.find(p => p.id === activePhcId) || phcs[0];
  const activePHCLogs = logs
    .filter(l => l.phcId === activePhcId)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Transform logs for recharts
  const chartData = activePHCLogs.map(log => ({
    date: log.date.substring(5), // YYYY-MM-DD -> MM-DD
    footfall: log.footfall || 0,
    stock: log.medicineStock?.[activeMedicineId] || 0,
    beds: Math.round(((log.occupiedBeds || 0) / activePHC.capacity) * 100)
  }));

  // General Dashboard Stats Calculation
  const todayTotalFootfall = computedPHCs.reduce((acc, p) => acc + (p.latestLog?.footfall || 0), 0);
  
  const totalBeds = computedPHCs.reduce((acc, p) => acc + p.capacity, 0);
  const occupiedBedsSum = computedPHCs.reduce((acc, p) => acc + (p.latestLog?.occupiedBeds || 0), 0);
  const avgOccupancy = totalBeds > 0 ? Math.round((occupiedBedsSum / totalBeds) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. Global KPI Metrics Row */}
      <div className="grid grid-cols-4 gap-4">
        
        <div className="card flex items-center gap-4">
          <div style={{ backgroundColor: '#EFF6FF', color: 'var(--color-primary)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <Users size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Footfall Today
            </span>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {todayTotalFootfall} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-success)' }}>↑ Patients</span>
            </h2>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div style={{ backgroundColor: '#FFF7ED', color: 'var(--color-accent)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <Bed size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Average Bed Occupancy
            </span>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
              {avgOccupancy}% <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>Occupied</span>
            </h2>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div style={{ backgroundColor: '#FEF2F2', color: 'var(--color-danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Urgent Stock Warnings
            </span>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: stockAlerts.length > 0 ? 'var(--color-danger)' : 'inherit' }}>
              {stockAlerts.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>Alerts</span>
            </h2>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div style={{ backgroundColor: '#FFFBEB', color: 'var(--color-warning)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
            <ShieldAlert size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Flagged Facilities
            </span>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: flaggedFacilities.length > 0 ? 'var(--color-warning)' : 'inherit' }}>
              {flaggedFacilities.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>Centers</span>
            </h2>
          </div>
        </div>

      </div>

      {/* 2. Interactive Filtering Controls */}
      <div className="card flex gap-4 flex-wrap items-center">
        <span className="font-semibold text-sm" style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', marginRight: '0.5rem' }}>
          Filters
        </span>
        <div className="form-group" style={{ marginBottom: 0, minWidth: '220px' }}>
          <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)}>
            {STATES_AND_UTS.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
          <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
            {ZONES.map(zone => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </select>
        </div>
        
        {filteredPHCs.length === 0 && (
          <span className="text-sm" style={{ color: 'var(--color-danger)' }}>
            No facilities matching current filters.
          </span>
        )}
      </div>

      {/* Two pane Admin Area layout */}
      <div className="admin-layout">
        
        {/* Left Area: Grid list and detailed view charts */}
        <div className="flex flex-col gap-6">
          
          {/* Live grid status list */}
          <div className="card">
            <h3 className="card-title">
              <span className="badge badge-green" style={{ width: '8px', height: '8px', padding: 0, borderRadius: '50%' }}></span>
              National Live Status Grid
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Color indicates operational health. Click any center card to inspect historical charts below.
            </p>
            
            <div className="phc-status-grid">
              {filteredPHCs.map(phc => {
                const latestLog = phc.latestLog;
                const statusColor = phc.status; // red, amber, green
                const isActive = phc.id === activePhcId;
                
                const docsCount = phc.doctors.length;
                let docsPresent = 0;
                if (latestLog?.doctorAttendance) {
                  docsPresent = Object.values(latestLog.doctorAttendance).filter(Boolean).length;
                }

                return (
                  <div 
                    key={phc.id} 
                    onClick={() => setActivePhcId(phc.id)}
                    className={`card phc-status-card ${statusColor} ${isActive ? 'active-inspected' : ''}`}
                    style={{
                      borderWidth: '1px',
                      borderLeftWidth: '5px',
                      backgroundColor: isActive ? 'var(--color-bg)' : '',
                      borderColor: isActive ? 'var(--color-primary)' : ''
                    }}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 style={{ fontSize: '0.975rem', fontWeight: 700 }}>{phc.name}</h4>
                        <span className={`badge badge-${statusColor === 'red' ? 'red' : statusColor === 'amber' ? 'amber' : 'green'}`}>
                          {statusColor === 'red' ? 'Critical' : statusColor === 'amber' ? 'Warning' : 'Healthy'}
                        </span>
                      </div>
                      
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)', margin: '0.15rem 0 0.5rem 0' }}>
                        {phc.district}, {phc.stateOrUT}
                      </p>
                    </div>

                    <div className="quick-status-list">
                      <div className="quick-status-item">
                        <span>Footfall Today</span>
                        <span className="quick-status-val">{latestLog?.footfall || 0}</span>
                      </div>
                      <div className="quick-status-item">
                        <span>Beds Occupancy</span>
                        <span className="quick-status-val">
                          {latestLog?.occupiedBeds || 0}/{phc.capacity} ({Math.round(((latestLog?.occupiedBeds || 0)/phc.capacity)*100)}%)
                        </span>
                      </div>
                      <div className="quick-status-item">
                        <span>Doctors Present</span>
                        <span className="quick-status-val">{docsPresent}/{docsCount}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trend Chart View using Recharts */}
          <div className="card trend-section">
            <div className="flex justify-between items-center flex-mobile-col gap-3" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 className="flex items-center gap-2" style={{ borderBottom: 'none', paddingBottom: 0, margin: 0 }}>
                  <TrendingUp size={18} style={{ color: 'var(--color-primary)' }} />
                  Historical Trend Analytics: {activePHC.name}
                </h3>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Visualizing last 21 days of operational metrics
                </span>
              </div>
              
              <div className="flex gap-2 items-center">
                <label style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>Inspect Medicine:</label>
                <select 
                  value={activeMedicineId} 
                  onChange={(e) => setActiveMedicineId(e.target.value)}
                  style={{ padding: '0.35rem', fontSize: '0.825rem' }}
                >
                  {MEDICINES.map(med => (
                    <option key={med.id} value={med.id}>{med.name.split(" ")[0]}</option>
                  ))}
                </select>
              </div>
            </div>

            {chartData.length < 2 ? (
              <div className="flex justify-center items-center" style={{ height: '280px', color: 'var(--color-text-muted)' }}>
                No trend data loaded. Use Developer Settings to seed logs.
              </div>
            ) : (
              <div style={{ width: '100%', height: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#FFFFFF', 
                        border: '1px solid var(--color-border)', 
                        borderRadius: 'var(--radius-md)' 
                      }} 
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Line 
                      type="monotone" 
                      name="Patient Footfall" 
                      dataKey="footfall" 
                      stroke="var(--color-primary)" 
                      strokeWidth={2}
                      activeDot={{ r: 6 }} 
                    />
                    <Line 
                      type="monotone" 
                      name={`${activeMedicineId.charAt(0).toUpperCase() + activeMedicineId.slice(1)} Stock`} 
                      dataKey="stock" 
                      stroke="var(--color-accent)" 
                      strokeWidth={2} 
                    />
                    <Line 
                      type="monotone" 
                      name="Bed Occupancy %" 
                      dataKey="beds" 
                      stroke="var(--color-success)" 
                      strokeWidth={2} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

        </div>

        {/* Right Area: AI intelligence panels */}
        <div className="admin-sidebar">
          
          {/* A. AI Stock-out Forecast alerts */}
          <div className="card">
            <h3 className="card-title">
              <AlertTriangle size={18} style={{ color: 'var(--color-danger)' }} />
              AI Stock-Out Predictions
            </h3>
            
            <div className="flex flex-col gap-3" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {stockAlerts.length === 0 ? (
                <div className="text-sm flex items-center gap-2" style={{ color: 'var(--color-success)', padding: '0.5rem' }}>
                  <CheckCircle size={16} /> All essential medicine stocks are healthy.
                </div>
              ) : (
                stockAlerts.map(alert => {
                  const cacheKey = `${alert.phcId}_${alert.medicineId}`;
                  const aiReason = aiExplanations[cacheKey];
                  const isLoading = loadingAi[cacheKey];
                  
                  return (
                    <div 
                      key={alert.id} 
                      className="flex flex-col gap-1"
                      style={{ 
                        padding: '0.75rem', 
                        border: '1px solid var(--color-border)', 
                        backgroundColor: alert.daysRemaining === 0 ? '#FEF2F2' : 'var(--color-surface)',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <strong style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>
                          {alert.medicineName.split(" ")[0]} — {alert.phcName}
                        </strong>
                        <span className={`badge ${alert.daysRemaining === 0 ? 'badge-red' : 'badge-amber'}`}>
                          {alert.daysRemaining === 0 ? 'Out of Stock' : `${alert.daysRemaining} days left`}
                        </span>
                      </div>
                      
                      <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)', margin: '0.1rem 0' }}>
                        <span>Current Stock: {alert.currentStock} units</span>
                      </div>
                      
                      {/* AI-Generated Reason */}
                      <div style={{ marginTop: '0.35rem', padding: '0.5rem', backgroundColor: '#FAF7F2', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--color-accent)' }}>
                        <span className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          <Info size={12} /> AI Reason:
                        </span>
                        <p className="text-xs" style={{ fontStyle: 'italic', marginTop: '0.15rem' }}>
                          {isLoading ? 'Generating prediction summary...' : aiReason || 'Analysing historical consumptions...'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* B. AI Smart Redistribution Recommendations */}
          <div className="card">
            <h3 className="card-title">
              <ArrowRightLeft size={18} style={{ color: 'var(--color-accent)' }} />
              AI Stock Redistribution Recommendations
            </h3>

            {successTransfer && (
              <div className="alert-banner text-xs flex items-center gap-1" style={{ backgroundColor: '#ECFDF5', color: '#065F46', padding: '0.5rem', marginBottom: '0.75rem' }}>
                <CheckCircle size={14} /> {successTransfer}
              </div>
            )}
            
            {errorTransfer && (
              <div className="alert-banner text-xs flex items-center gap-1" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', padding: '0.5rem', marginBottom: '0.75rem' }}>
                <AlertTriangle size={14} /> {errorTransfer}
              </div>
            )}

            <div className="ai-recom-list">
              {uniqueSuggestions.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)', padding: '0.5rem' }}>
                  No urgent stock redistribution matches found.
                </p>
              ) : (
                uniqueSuggestions.slice(0, 3).map(sug => {
                  const cacheKey = sug.id;
                  const aiReason = aiRedistributions[cacheKey];
                  const isLoading = loadingAi[cacheKey];

                  return (
                    <div key={sug.id} className="ai-recom-card">
                      <div className="ai-recom-header">
                        Transfer {sug.quantity} {sug.medicineName.split(" ")[0]}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>
                        From <strong>{sug.fromPhcName}</strong> (Stock: {sug.sourceStock})<br />
                        To <strong>{sug.toPhcName}</strong> (Stock: {sug.destStock})
                      </div>
                      
                      {/* AI-Generated Reason */}
                      <div style={{ padding: '0.4rem', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--color-primary)', marginBottom: '0.625rem' }}>
                        <p className="text-xs" style={{ fontStyle: 'italic', fontSize: '0.775rem' }}>
                          {isLoading ? 'AI calculating logistic reasoning...' : aiReason || 'Verifying regional supply balances...'}
                        </p>
                      </div>

                      <div className="ai-recom-actions">
                        <button 
                          className="btn btn-accent text-xs" 
                          onClick={() => handleExecuteTransfer(sug)}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-sm)' }}
                        >
                          Confirm & Process Transfer
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* C. Flagged facilities & AI explanation */}
          <div className="card">
            <h3 className="card-title">
              <ShieldAlert size={18} style={{ color: 'var(--color-warning)' }} />
              Underperforming & Under-Resourced Centers
            </h3>

            <div className="flex flex-col gap-3">
              {flaggedFacilities.length === 0 ? (
                <div className="text-sm flex items-center gap-2" style={{ color: 'var(--color-success)', padding: '0.5rem' }}>
                  <CheckCircle size={16} /> All facilities operating within normal thresholds.
                </div>
              ) : (
                flaggedFacilities.map(fac => {
                  const cacheKey = fac.phcId;
                  const aiSummary = aiUnderperformances[cacheKey];
                  const isLoading = loadingAi[cacheKey];

                  return (
                    <div 
                      key={fac.phcId} 
                      className="flex flex-col gap-1"
                      style={{ 
                        padding: '0.75rem', 
                        border: '1px solid var(--color-border)', 
                        backgroundColor: '#FFFBEB',
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <UserX size={15} style={{ color: 'var(--color-danger)', flexShrink: 0 }} />
                        <strong style={{ fontSize: '0.85rem' }}>{fac.phcName}</strong>
                      </div>
                      
                      <ul style={{ paddingLeft: '1rem', margin: '0.25rem 0', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        {fac.flags.map((flag, idx) => (
                          <li key={idx} className="text-xs" style={{ color: 'var(--color-danger)' }}>{flag}</li>
                        ))}
                      </ul>

                      {/* AI-Generated Summary */}
                      <div style={{ marginTop: '0.35rem', padding: '0.4rem', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-sm)', borderLeft: '2px solid var(--color-warning)' }}>
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)', display: 'block' }}>
                          District Audit Summary:
                        </span>
                        <p className="text-xs" style={{ fontStyle: 'italic', marginTop: '0.15rem', lineHeight: '1.3' }}>
                          {isLoading ? 'Synthesizing admin audit logs...' : aiSummary || 'Aggregating metric indicators...'}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default AdminDashboard;
