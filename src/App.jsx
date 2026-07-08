import React, { useState, useEffect } from 'react';
import StaffInput from './components/StaffInput';
import AdminDashboard from './components/AdminDashboard';
import { isFirebaseConnected, getSavedFirebaseConfig, saveFirebaseConfig } from './services/db';
import { getSavedGeminiKey, getSavedGcpKey, saveApiKeys } from './services/ai';
import { runSeeding } from './services/seed';
import { Settings, Shield, Activity, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';

function App() {
  const [viewMode, setViewMode] = useState('staff'); // 'staff' or 'admin'
  const [showConfig, setShowConfig] = useState(false);
  const [dbConnected, setDbConnected] = useState(isFirebaseConnected());
  const [seedingStatus, setSeedingStatus] = useState(null); // 'seeding', 'success', 'error'
  
  // API and Firebase Config States
  const [geminiKey, setGeminiKey] = useState(getSavedGeminiKey());
  const [gcpKey, setGcpKey] = useState(getSavedGcpKey());
  
  const [fbApiKey, setFbApiKey] = useState('');
  const [fbProjId, setFbProjId] = useState('');
  const [fbAuthDom, setFbAuthDom] = useState('');
  const [fbBucket, setFbBucket] = useState('');
  const [fbSenderId, setFbSenderId] = useState('');
  const [fbAppId, setFbAppId] = useState('');
  
  const [useDevMock, setUseDevMock] = useState(localStorage.getItem('VITE_USE_DEV_MOCK') === 'true');

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
    
    // Refresh to apply new Firebase config
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

  const hasMissingKeys = !geminiKey || !gcpKey || (!useDevMock && !fbProjId);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header flex justify-between items-center flex-mobile-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex justify-center items-center" style={{ 
            backgroundColor: 'var(--color-primary)', 
            width: '40px', 
            height: '40px', 
            borderRadius: 'var(--radius-md)', 
            color: 'white' 
          }}>
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ letterSpacing: '-0.02em', color: 'var(--color-text)' }}>
              Ground<span style={{ color: 'var(--color-accent)' }}>Truth</span>
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
              AI-Driven Health Center & Supply Chain Management
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="mode-tabs">
          <button 
            className={`mode-tab ${viewMode === 'staff' ? 'active' : ''}`}
            onClick={() => setViewMode('staff')}
          >
            PHC Staff Log
          </button>
          <button 
            className={`mode-tab ${viewMode === 'admin' ? 'active' : ''}`}
            onClick={() => setViewMode('admin')}
          >
            District Admin Dashboard
          </button>
        </div>

        {/* System Settings & Connection Details */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {dbConnected && !useDevMock ? (
              <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                Firestore Live
              </span>
            ) : useDevMock ? (
              <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
                Local Dev Mode
              </span>
            ) : (
              <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>
                Offline/No Config
              </span>
            )}
          </div>
          <button 
            className="btn btn-outline flex items-center justify-center btn-icon-only" 
            onClick={() => setShowConfig(true)}
            title="Developer Configuration"
            style={{ borderRadius: 'var(--radius-md)', padding: '0.5rem' }}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Warning banner for missing credentials */}
        {hasMissingKeys && (
          <div className="alert-banner alert-banner-warning flex justify-between items-center">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Developer Credentials Needed:</strong> Some Google Cloud settings are missing. Please configure your Firebase credentials, Google Cloud API Key (for Speech-to-Text), and Gemini API Key to enable live sync and voice features.
              </div>
            </div>
            <button className="btn btn-accent btn-sm" onClick={() => setShowConfig(true)} style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
              Configure Now
            </button>
          </div>
        )}

        {viewMode === 'staff' ? (
          <StaffInput />
        ) : (
          <AdminDashboard />
        )}
      </main>

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
                    <label style={{ fontSize: '0.75rem' }}>Development Mock Safety Net</label>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'none', marginTop: '0.15rem' }}>
                      Uses client-side LocalStorage if you do not have a live Firestore database ready. 
                      <strong style={{ color: 'var(--color-danger)' }}> Note: Turn OFF for final evaluation.</strong>
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
