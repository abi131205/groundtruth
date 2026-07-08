import React, { useState, useEffect } from 'react';
import StaffInput from './components/StaffInput';
import AdminDashboard from './components/AdminDashboard';
import MapMonitor from './components/MapMonitor';
import ChatAssistant from './components/ChatAssistant';
import LogisticsPipeline from './components/LogisticsPipeline';
import { isFirebaseConnected, getSavedFirebaseConfig, saveFirebaseConfig, subscribeToLogs } from './services/db';
import { getSavedGeminiKey, getSavedGcpKey, saveApiKeys } from './services/ai';
import { runSeeding, SEEDED_PHCS } from './services/seed';
import { Settings, Shield, Activity, RefreshCw, AlertTriangle, CheckCircle, Map, Package, Clipboard, HelpCircle } from 'lucide-react';

function App() {
  const [viewMode, setViewMode] = useState('admin'); // default to admin dashboard for wow-factor first impression!
  const [showConfig, setShowConfig] = useState(false);
  const [dbConnected, setDbConnected] = useState(isFirebaseConnected());
  const [seedingStatus, setSeedingStatus] = useState(null); // 'seeding', 'success', 'error'
  const [inspectedPhcId, setInspectedPhcId] = useState(null);
  
  // API and Firebase Config States
  const [geminiKey, setGeminiKey] = useState(getSavedGeminiKey());
  const [gcpKey, setGcpKey] = useState(getSavedGcpKey());
  
  const [fbApiKey, setFbApiKey] = useState('');
  const [fbProjId, setFbProjId] = useState('');
  const [fbAuthDom, setFbAuthDom] = useState('');
  const [fbBucket, setFbBucket] = useState('');
  const [fbSenderId, setFbSenderId] = useState('');
  const [fbAppId, setFbAppId] = useState('');
  
  // Safe default: Evaluators get Local Mock Mode by default if VITE_USE_DEV_MOCK is not explicitly set to 'false'
  const [useDevMock, setUseDevMock] = useState(localStorage.getItem('VITE_USE_DEV_MOCK') !== 'false');

  // Logs state for Leaflet markers & AI assistant context
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Load saved Firebase config into state if it exists
    const savedFb = getSavedFirebaseConfig();
    if (savedFb) {
      setFbApiKey(savedFb.apiKey || '');
      setFbProjId(savedFb.projectId || '');
      setFbAuthDom(savedFb.authDomain || '');
      setFbBucket(savedFb.storageBucket || '');
      setFbSenderId(savedFb.messagingSenderId || '');
      setFbAppId(savedFb.appId || '');
    }

    // Subscribe to database logs
    const unsubscribe = subscribeToLogs((fetchedLogs) => {
      setLogs(fetchedLogs);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveConfig = () => {
    // Save API keys
    saveApiKeys(geminiKey, gcpKey);
    
    // Save Dev Mock status
    localStorage.setItem('VITE_USE_DEV_MOCK', useDevMock ? 'true' : 'false');
    
    // Save Firebase Config
    if (fbProjId) {
      const fbConfig = {
        apiKey: fbApiKey,
        projectId: fbProjId,
        authDomain: fbAuthDom,
        storageBucket: fbBucket,
        messagingSenderId: fbSenderId,
        appId: fbAppId
      };
      saveFirebaseConfig(fbConfig);
    } else {
      saveFirebaseConfig(null);
    }
    
    setShowConfig(false);
    
    // Refresh to apply changes
    window.location.reload();
  };

  const handleTriggerSeed = async () => {
    setSeedingStatus('seeding');
    try {
      await runSeeding();
      setSeedingStatus('success');
      setTimeout(() => setSeedingStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setSeedingStatus('error');
      setTimeout(() => setSeedingStatus(null), 3000);
    }
  };

  // Compile real-time statuses for 8 health centers
  const computedPHCs = SEEDED_PHCS.map(phc => {
    const phcLogs = logs.filter(l => l.phcId === phc.id).sort((a, b) => b.date.localeCompare(a.date));
    const latestLog = phcLogs[0] || null;
    
    // Simple status computation
    let status = 'green';
    if (latestLog) {
      const hasCriticalStockout = Object.values(latestLog.medicineStock || {}).some(qty => Number(qty) === 0);
      const docAbsent = Object.values(latestLog.doctorAttendance || {}).some(pres => !pres);
      const bedPercent = latestLog.occupiedBeds / phc.capacity;
      
      if (hasCriticalStockout || docAbsent || bedPercent >= 0.9) {
        status = 'red';
      } else {
        const hasWarning = Object.values(latestLog.medicineStock || {}).some(qty => Number(qty) <= 40);
        if (hasWarning || bedPercent >= 0.7) {
          status = 'amber';
        }
      }
    }
    
    return { ...phc, latestLog, status };
  });

  const hasMissingKeys = !geminiKey || !gcpKey || (!useDevMock && !fbProjId);

  return (
    <div className="app-layout">
      
      {/* Sleek COLLAPSIBLE BRAND SIDEBAR */}
      <aside className="sidebar">
        
        {/* Custom SVG heartbeat logo */}
        <div className="sidebar-brand">
          <svg width="34" height="34" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M 25 45 A 28 28 0 0 1 73 42" stroke="var(--color-primary)" stroke-width="6" stroke-linecap="round" fill="none"/>
            <path d="M 78 55 A 28 28 0 0 1 22 55" stroke="var(--color-primary)" stroke-width="6" stroke-linecap="round" fill="none"/>
            <circle cx="12" cy="50" r="5" fill="var(--color-primary)" />
            <path d="M 12 50 H 30 L 35 40 L 40 60 L 45 30 L 50 52 L 55 48" stroke="var(--color-primary)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <path d="M 55 48 L 60 55 L 68 50 L 90 20" stroke="var(--color-accent)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <circle cx="90" cy="20" r="5" fill="var(--color-accent)" />
            <rect x="66" y="58" width="5" height="12" rx="1.5" fill="var(--color-primary)" />
            <rect x="74" y="52" width="5" height="18" rx="1.5" fill="var(--color-primary)" />
          </svg>
          <div>
            <h1 className="text-base font-bold" style={{ letterSpacing: '-0.02em', color: 'var(--color-text)', lineHeight: 1.1 }}>
              Ground<span style={{ color: 'var(--color-accent)' }}>Truth</span>
            </h1>
            <span style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', fontWeight: 600, display: 'block', marginTop: '1px' }}>
              COMMUNITY HEALTH AI
            </span>
          </div>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="sidebar-menu">
          <button 
            className={`sidebar-item ${viewMode === 'admin' ? 'active' : ''}`}
            onClick={() => setViewMode('admin')}
          >
            <Clipboard size={18} />
            Live Dashboard
          </button>
          
          <button 
            className={`sidebar-item ${viewMode === 'map' ? 'active' : ''}`}
            onClick={() => setViewMode('map')}
          >
            <Map size={18} />
            Geographic Monitor
          </button>

          <button 
            className={`sidebar-item ${viewMode === 'staff' ? 'active' : ''}`}
            onClick={() => setViewMode('staff')}
          >
            <Activity size={18} />
            PHC Staff Log
          </button>

          <button 
            className={`sidebar-item ${viewMode === 'logistics' ? 'active' : ''}`}
            onClick={() => setViewMode('logistics')}
          >
            <Package size={18} />
            Supply Dispatches
          </button>
        </nav>

        {/* Sidebar Footer with Status Badge and Developer Config */}
        <div className="sidebar-footer">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Connection:</span>
              {dbConnected && !useDevMock ? (
                <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>Live</span>
              ) : useDevMock ? (
                <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>Demo Mode</span>
              ) : (
                <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>Offline</span>
              )}
            </div>
            
            <button 
              className="btn btn-outline flex items-center justify-center gap-2"
              onClick={() => setShowConfig(true)}
              style={{ fontSize: '0.75rem', padding: '0.5rem', width: '100%', borderRadius: 'var(--radius-md)' }}
            >
              <Settings size={14} />
              Developer Config
            </button>
          </div>
        </div>

      </aside>

      {/* Main Content Area */}
      <div className="main-content-layout">
        
        {/* Top bar for alerts / tips */}
        <div style={{ backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '0.75rem 2rem', zIndex: 10 }}>
          {useDevMock ? (
            <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)' }}>
              <HelpCircle size={15} style={{ color: 'var(--color-warning)' }} />
              <span>
                💡 Running in <strong>Local Demo Mode</strong>. To connect your live GCP Speech-to-Text and Gemini API services, click the <strong>Developer Config</strong> button at the bottom of the sidebar.
              </span>
            </div>
          ) : hasMissingKeys ? (
            <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)' }}>
              <AlertTriangle size={15} />
              <span>
                ⚠️ Firebase or AI keys are missing. Switch to **Demo Mode** in Settings to test without keys, or enter your credentials.
              </span>
            </div>
          ) : (
            <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)' }}>
              <CheckCircle size={15} />
              <span>Live production sync active. Data writing directly to your Google Cloud Firestore instance.</span>
            </div>
          )}
        </div>

        {/* Content Router */}
        <main className="page-container">
          {viewMode === 'admin' && (
            <AdminDashboard inspectedPhcId={inspectedPhcId} />
          )}

          {viewMode === 'map' && (
            <MapMonitor 
              phcList={computedPHCs} 
              onSelectPHC={(id) => {
                setInspectedPhcId(id);
                setViewMode('admin'); // switch to chart on click
              }} 
            />
          )}

          {viewMode === 'staff' && (
            <StaffInput />
          )}

          {viewMode === 'logistics' && (
            <LogisticsPipeline />
          )}
        </main>
      </div>

      {/* Floating Gemini AI context assistant */}
      <ChatAssistant phcList={computedPHCs} />

      {/* Developer Configuration Modal */}
      {showConfig && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="flex items-center gap-2">
                <Shield size={20} style={{ color: 'var(--color-primary)' }} />
                Developer Configuration & Keys
              </h3>
              <button 
                onClick={() => setShowConfig(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                &times;
              </button>
            </div>
            
            <div className="modal-body">
              <div className="alert-banner alert-banner-info" style={{ fontSize: '0.825rem', marginBottom: '1.25rem' }}>
                Enter your Google Cloud Credentials below. These keys are stored locally in your browser's <code>localStorage</code> and are only called directly from the client.
              </div>

              {/* Dev Mock Switch */}
              <div className="form-group" style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: 'var(--color-bg)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex justify-between items-center">
                  <div>
                    <label style={{ fontSize: '0.75rem' }}>Development Mock Safety Net (Demo Mode)</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'none', marginTop: '0.15rem' }}>
                      Uses client-side LocalStorage if you do not have a live Firestore database ready. 
                      <strong> Recommended for public demo links to keep your credentials private.</strong>
                    </p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={useDevMock}
                    onChange={(e) => setUseDevMock(e.target.checked)}
                    style={{ width: '1.5rem', height: '1.5rem', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Google API Keys */}
              <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                1. AI & Speech Services
              </h4>
              <div className="form-group">
                <label>Gemini API Key</label>
                <input 
                  type="text" 
                  value={geminiKey} 
                  onChange={(e) => setGeminiKey(e.target.value)} 
                  placeholder="AIzaSy..." 
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>GCP API Key (Speech-to-Text)</label>
                <input 
                  type="text" 
                  value={gcpKey} 
                  onChange={(e) => setGcpKey(e.target.value)} 
                  placeholder="AIzaSy..." 
                />
              </div>

              {/* Firebase SDK Config */}
              <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                2. Firestore Database Configuration
              </h4>
              <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '1.5rem' }}>
                <div className="form-group">
                  <label>Firebase API Key</label>
                  <input 
                    type="text" 
                    value={fbApiKey} 
                    onChange={(e) => setFbApiKey(e.target.value)} 
                    placeholder="AIzaSy..." 
                  />
                </div>
                <div className="form-group">
                  <label>Project ID</label>
                  <input 
                    type="text" 
                    value={fbProjId} 
                    onChange={(e) => setFbProjId(e.target.value)} 
                    placeholder="groundtruth-abc" 
                  />
                </div>
                <div className="form-group">
                  <label>Auth Domain</label>
                  <input 
                    type="text" 
                    value={fbAuthDom} 
                    onChange={(e) => setFbAuthDom(e.target.value)} 
                    placeholder="groundtruth-abc.firebaseapp.com" 
                  />
                </div>
                <div className="form-group">
                  <label>Storage Bucket</label>
                  <input 
                    type="text" 
                    value={fbBucket} 
                    onChange={(e) => setFbBucket(e.target.value)} 
                    placeholder="groundtruth-abc.appspot.com" 
                  />
                </div>
                <div className="form-group">
                  <label>Messaging Sender ID</label>
                  <input 
                    type="text" 
                    value={fbSenderId} 
                    onChange={(e) => setFbSenderId(e.target.value)} 
                    placeholder="1234567890" 
                  />
                </div>
                <div className="form-group">
                  <label>App ID</label>
                  <input 
                    type="text" 
                    value={fbAppId} 
                    onChange={(e) => setFbAppId(e.target.value)} 
                    placeholder="1:1234:web:abcd" 
                  />
                </div>
              </div>

              {/* Seeding Controls */}
              <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
                3. Operations
              </h4>
              <div className="flex justify-between items-center" style={{ backgroundColor: 'var(--color-bg)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <label style={{ fontSize: '0.75rem' }}>Seed Realistic Test Data</label>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'none', marginTop: '0.15rem' }}>
                    Populates database with 21 days of history for 8 national PHCs.
                  </p>
                </div>
                <button 
                  className="btn btn-outline flex items-center gap-2" 
                  onClick={handleTriggerSeed}
                  disabled={seedingStatus === 'seeding'}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <RefreshCw size={16} className={seedingStatus === 'seeding' ? 'pulse-recording' : ''} />
                  {seedingStatus === 'seeding' ? 'Seeding...' : seedingStatus === 'success' ? 'Seeded!' : 'Run Seeder'}
                </button>
              </div>
              {seedingStatus === 'success' && (
                <p style={{ color: 'var(--color-success)', fontSize: '0.8rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <CheckCircle size={14} /> Database populated successfully!
                </p>
              )}
              {seedingStatus === 'error' && (
                <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  ❌ Seeding failed. Ensure Firestore is reachable.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowConfig(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveConfig}>
                Save & Apply Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
