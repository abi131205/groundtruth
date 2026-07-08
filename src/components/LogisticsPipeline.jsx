import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, Clock, CheckCircle, Package } from 'lucide-react';
import { SEEDED_PHCS } from '../services/seed';

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

function LogisticsPipeline() {
  const [transfers, setTransfers] = useState([]);

  // Load transfers from localStorage
  const loadTransfers = () => {
    try {
      const saved = localStorage.getItem('groundtruth_transfers');
      if (saved) {
        setTransfers(JSON.parse(saved));
      } else {
        // Seed a couple of default transfers to look populated
        const defaultTransfers = [
          {
            id: 't-1',
            fromPhcName: 'Madanapalle CHC (AP)',
            toPhcName: 'Bhadri PHC (UP)',
            medicineName: 'Paracetamol 500mg Tablets',
            quantity: 150,
            status: 'in_transit',
            timestamp: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
          },
          {
            id: 't-2',
            fromPhcName: 'Madanapalle CHC (AP)',
            toPhcName: 'Kohima CHC (Nagaland)',
            medicineName: 'Oral Rehydration Salts Packets',
            quantity: 100,
            status: 'delivered',
            timestamp: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
          }
        ];
        setTransfers(defaultTransfers);
        localStorage.setItem('groundtruth_transfers', JSON.stringify(defaultTransfers));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadTransfers();

    // Listen to localStorage changes (when redistribution is approved on Dashboard)
    const handleStorageChange = () => {
      loadTransfers();
    };

    window.addEventListener('storage', handleStorageChange);
    // Custom event dispatch when we do local transfers
    window.addEventListener('transfer-added', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('transfer-added', handleStorageChange);
    };
  }, []);

  // Simulate delivery process: Auto-advance "dispatched" to "in_transit" after 20 seconds for the demo
  useEffect(() => {
    const interval = setInterval(() => {
      let updated = false;
      const nextTransfers = transfers.map(t => {
        if (t.status === 'dispatched') {
          updated = true;
          return { ...t, status: 'in_transit' };
        }
        return t;
      });

      if (updated) {
        setTransfers(nextTransfers);
        localStorage.setItem('groundtruth_transfers', JSON.stringify(nextTransfers));
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [transfers]);

  const handleMarkReceived = (id) => {
    const nextTransfers = transfers.map(t => {
      if (t.id === id) {
        return { ...t, status: 'delivered' };
      }
      return t;
    });
    setTransfers(nextTransfers);
    localStorage.setItem('groundtruth_transfers', JSON.stringify(nextTransfers));
  };

  const handleClearHistory = () => {
    setTransfers([]);
    localStorage.removeItem('groundtruth_transfers');
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Header Info Panel */}
      <div className="card flex justify-between items-center flex-mobile-col gap-4">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={22} style={{ color: 'var(--color-primary)' }} />
            Medicine Supply Transit & Dispatch Pipeline
          </h2>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
            Tracks inter-facility medicine transfers approved by AI matching. Status auto-advances in real-time.
          </p>
        </div>

        {transfers.length > 0 && (
          <button 
            className="btn btn-outline" 
            onClick={handleClearHistory}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
          >
            Clear Pipeline History
          </button>
        )}
      </div>

      {/* Transit log cards list */}
      {transfers.length === 0 ? (
        <div className="card flex flex-col items-center justify-center" style={{ minHeight: '300px', textAlign: 'center' }}>
          <div style={{ backgroundColor: 'var(--color-bg)', padding: '1rem', borderRadius: '50%', color: 'var(--color-text-light)', marginBottom: '1rem' }}>
            <Package size={36} />
          </div>
          <h4 style={{ fontWeight: 600 }}>No Active Shipments</h4>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)', maxWidth: '360px', marginTop: '0.25rem' }}>
            When a stock redistribution is approved on the Admin Dashboard, it will instantly generate a transit entry here.
          </p>
        </div>
      ) : (
        <div className="logistics-grid">
          {transfers.map(trans => {
            const isDelivered = trans.status === 'delivered';
            const isTransit = trans.status === 'in_transit';
            const isDispatched = trans.status === 'dispatched';

            return (
              <div key={trans.id} className="logistics-card flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} />
                      {trans.timestamp ? new Date(trans.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                    </span>
                    <span className={`badge ${isDelivered ? 'badge-green' : isTransit ? 'badge-amber' : 'badge-red'}`}>
                      {isDelivered ? 'Delivered' : isTransit ? 'In Transit' : 'Dispatched'}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginTop: '0.75rem', color: 'var(--color-text)' }}>
                    {(trans.medicineName || 'Medicine').split(" ")[0]}
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Quantity: <strong>{trans.quantity || 0}</strong> units
                  </p>

                  <div className="flex justify-between items-center" style={{ backgroundColor: 'var(--color-bg)', padding: '0.75rem', borderRadius: 'var(--radius-md)', margin: '1rem 0' }}>
                    <div className="flex flex-col">
                      <span className="text-xs" style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>FROM</span>
                      <span className="text-sm font-semibold">{(trans.fromPhcName || trans.fromPhcId || 'Source').split(" ")[0]}</span>
                    </div>
                    <ArrowRightLeft size={16} style={{ color: 'var(--color-text-light)' }} />
                    <div className="flex flex-col text-right" style={{ textAlign: 'right' }}>
                      <span className="text-xs" style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>TO</span>
                      <span className="text-sm font-semibold">{(trans.toPhcName || trans.toPhcId || 'Destination').split(" ")[0]}</span>
                    </div>
                  </div>

                  {/* Steps Progress Visualizer */}
                  <div className="pipeline-steps">
                    <div className={`pipeline-step ${isDispatched || isTransit || isDelivered ? 'completed' : ''}`}>
                      <div className="step-dot">1</div>
                      <span className="step-label">Dispatched</span>
                    </div>
                    <div className={`pipeline-step ${isTransit || isDelivered ? (isDelivered ? 'completed' : 'active') : ''}`}>
                      <div className="step-dot">2</div>
                      <span className="step-label">In Transit</span>
                    </div>
                    <div className={`pipeline-step ${isDelivered ? 'completed' : ''}`}>
                      <div className="step-dot">3</div>
                      <span className="step-label">Delivered</span>
                    </div>
                  </div>
                </div>

                {!isDelivered && (
                  <button 
                    className="btn btn-primary flex items-center gap-1"
                    onClick={() => handleMarkReceived(trans.id)}
                    style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.85rem' }}
                  >
                    <CheckCircle size={15} /> Confirm Reception & Stock Update
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LogisticsPipeline;
