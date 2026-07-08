import React, { useEffect, useRef } from 'react';
import { MapPin, Info, Users, Bed, CheckCircle, AlertTriangle } from 'lucide-react';

const COORDS = {
  "phc-bhadri": [25.92, 81.86],       // UP (North)
  "phc-katni": [23.83, 80.40],        // MP (Central)
  "phc-madanapalle": [13.55, 78.50],  // AP (South)
  "phc-bishnupur": [23.07, 87.31],    // WB (East)
  "phc-dharampur": [20.54, 73.18],    // GJ (West)
  "phc-kohima": [25.67, 94.12],       // Nagaland (Northeast)
  "phc-sopore": [34.30, 74.47],       // J&K (North/UT)
  "phc-karaikal": [10.92, 79.83]      // Puducherry (South/UT)
};

const COLOR_MAP = {
  green: '#3F7D4F',
  amber: '#D97706',
  red: '#B91C1C'
};

function MapMonitor({ phcList, onSelectPHC }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    // Check if Leaflet L is loaded on window
    if (!window.L) {
      console.error("Leaflet library not found on window. Ensure CDN links are set in index.html.");
      return;
    }

    // Initialize map
    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = window.L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true
      }).setView([21.7679, 78.8718], 5); // Centered on India

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapRef.current);
    }

    const mapInstance = mapRef.current;

    // Clear previous markers (if any mapInstance layer is a marker)
    mapInstance.eachLayer((layer) => {
      if (layer instanceof window.L.Marker) {
        mapInstance.removeLayer(layer);
      }
    });

    // Plot markers
    phcList.forEach((phc) => {
      const coords = COORDS[phc.id] || [20.0, 78.0];
      const color = COLOR_MAP[phc.status] || COLOR_MAP.green;
      
      // Calculate doctor count
      const docsCount = phc.doctors?.length || 0;
      const docsPresent = phc.latestLog?.doctorAttendance 
        ? Object.values(phc.latestLog.doctorAttendance).filter(Boolean).length
        : docsCount;

      // Custom colored glowing HTML marker
      const customIcon = window.L.divIcon({
        className: 'custom-map-icon',
        html: `
          <div style="
            background-color: ${color}; 
            width: 18px; 
            height: 18px; 
            border-radius: 50%; 
            border: 2px solid #FFFFFF; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
          " class="glow-ring-${phc.status}">
            <div style="background-color: #FFFFFF; width: 4px; height: 4px; border-radius: 50%;"></div>
          </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      // HTML template for marker popup card
      const popupHtml = `
        <div style="font-family: var(--font-body); width: 230px;">
          <h4 style="margin: 0 0 2px 0; font-family: var(--font-heading); font-size: 0.95rem; font-weight: 700; color: var(--color-text);">
            ${phc.name}
          </h4>
          <span style="font-size: 0.75rem; color: var(--color-text-muted); text-transform: uppercase; font-weight: 600; display: block; margin-bottom: 8px;">
            ${phc.district}, ${phc.stateOrUT}
          </span>
          
          <div style="display: flex; flex-direction: column; gap: 4px; font-size: 0.8rem; margin-bottom: 10px; border-top: 1px solid var(--color-border); padding-top: 6px;">
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Status:</span>
              <strong style="color: ${color}; text-transform: uppercase; font-size: 0.75rem;">
                ${phc.status === 'red' ? 'Critical' : phc.status === 'amber' ? 'Warning' : 'Healthy'}
              </strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Patients Today:</span>
              <strong>${phc.latestLog?.footfall || 0}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Bed Occupancy:</span>
              <strong>${phc.latestLog?.occupiedBeds || 0} / ${phc.capacity}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--color-text-muted);">Staff Attendance:</span>
              <strong>${docsPresent} / ${docsCount} Doctors</strong>
            </div>
          </div>
          
          <button 
            id="btn-inspect-${phc.id}" 
            style="
              width: 100%;
              background-color: var(--color-primary);
              color: white;
              border: none;
              padding: 6px;
              border-radius: var(--radius-sm);
              font-size: 0.75rem;
              font-weight: 600;
              cursor: pointer;
              transition: filter var(--transition-fast);
            "
          >
            Inspect Analytics Chart
          </button>
        </div>
      `;

      const marker = window.L.marker(coords, { icon: customIcon }).addTo(mapInstance);
      
      marker.bindPopup(popupHtml);

      // Bind button click inside popup when open
      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-inspect-${phc.id}`);
        if (btn) {
          btn.addEventListener('click', () => {
            onSelectPHC(phc.id);
            mapInstance.closePopup();
            // Scroll to the chart area
            const chartSection = document.querySelector('.trend-section');
            if (chartSection) {
              chartSection.scrollIntoView({ behavior: 'smooth' });
            }
          });
        }
      });
    });

    // Cleanup map on unmount
    return () => {
      // We don't remove the map instance here so it caches across mounts, or we remove to prevent container re-init errors
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [phcList, onSelectPHC]);

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <h3 className="card-title" style={{ borderBottom: 'none', marginBottom: '0.5rem', paddingBottom: 0 }}>
        <MapPin size={18} style={{ color: 'var(--color-accent)' }} />
        Geographic Health Monitor (Leaflet Map)
      </h3>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
        Interactive map plotting national health centers. Glowing rings represent live facility conditions. Click any marker to view metrics or inspect charts.
      </p>

      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="map-view-container" style={{ zIndex: 5 }} />
    </div>
  );
}

export default MapMonitor;
