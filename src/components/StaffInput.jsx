import React, { useState, useEffect, useRef } from 'react';
import { getPHCs, saveDailyLog } from '../services/db';
import { transcribeAudio, parseVoiceOrTextUpdate, getSavedGcpKey } from '../services/ai';
import { Mic, Square, Sparkles, Plus, Minus, Send, Check, AlertCircle, FileText, ClipboardList } from 'lucide-react';
import { SEEDED_PHCS } from '../services/seed';

const LANGUAGES = [
  { code: 'en-IN', name: 'English (India)' },
  { code: 'hi-IN', name: 'Hindi (हिन्दी)' },
  { code: 'ta-IN', name: 'Tamil (தமிழ்)' },
  { code: 'te-IN', name: 'Telugu (తెలుగు)' },
  { code: 'kn-IN', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml-IN', name: 'Malayalam (മലയാളം)' },
  { code: 'mr-IN', name: 'Marathi (मराठी)' },
  { code: 'gu-IN', name: 'Gujarati (ગુજરાતી)' },
  { code: 'bn-IN', name: 'Bengali (বাংলা)' },
  { code: 'pa-IN', name: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'ur-IN', name: 'Urdu (اردو)' }
];

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

function StaffInput() {
  const [phcs, setPhcs] = useState(SEEDED_PHCS);
  const [selectedPhcId, setSelectedPhcId] = useState(SEEDED_PHCS[0].id);
  const [selectedPhc, setSelectedPhc] = useState(SEEDED_PHCS[0]);
  
  // Voice & Text entry states
  const [selectedLang, setSelectedLang] = useState('en-IN');
  const [rawReport, setRawReport] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [aiHighlightedFields, setAiHighlightedFields] = useState(new Set());

  // Form States
  const [footfall, setFootfall] = useState(30);
  const [occupiedBeds, setOccupiedBeds] = useState(4);
  const [doctorAttendance, setDoctorAttendance] = useState({});
  const [testAvailability, setTestAvailability] = useState({
    malaria: true,
    pregnancy: true,
    typhoid: true,
    glucose: true,
    hiv: true
  });
  const [medicineStock, setMedicineStock] = useState({
    paracetamol: 100,
    amoxicillin: 80,
    ibuprofen: 90,
    ors: 150,
    metformin: 120,
    atorvastatin: 75,
    cetirizine: 60,
    albendazole: 50,
    iron_folic: 200,
    azithromycin: 40
  });

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);

  // Sync selected PHC object and initialize doctor attendance
  useEffect(() => {
    const phc = phcs.find(p => p.id === selectedPhcId) || phcs[0];
    setSelectedPhc(phc);
    
    // Initialize doctor attendance to true (present)
    const initialAttendance = {};
    phc.doctors.forEach(doc => {
      initialAttendance[doc.id] = true;
    });
    setDoctorAttendance(initialAttendance);
  }, [selectedPhcId, phcs]);

  // Load actual PHC list from Firestore if connected
  useEffect(() => {
    const loadPHCs = async () => {
      try {
        const data = await getPHCs();
        if (data && data.length > 0) {
          setPhcs(data);
          setSelectedPhcId(data[0].id);
        }
      } catch (err) {
        console.warn("Could not load PHCs from database, using seed defaults:", err);
      }
    };
    loadPHCs();
  }, []);

  // Voice Recording Functions
  const startRecording = async () => {
    setError('');
    
    const gcpKey = getSavedGcpKey();
    
    // Web Speech API browser fallback if GCP key is not available
    if (!gcpKey) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError("Browser speech recognition is not supported in this browser. Please use Chrome or Edge, or enter a GCP API Key.");
        return;
      }
      
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = selectedLang;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        recognition.onstart = () => {
          setIsRecording(true);
          console.log("Browser SpeechRecognition fallback engine started.");
        };
        
        recognition.onerror = (e) => {
          setError(`Microphone Error: ${e.error}. Try checking browser mic permissions.`);
          setIsRecording(false);
        };
        
        recognition.onend = () => {
          setIsRecording(false);
        };
        
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setRawReport(prev => prev ? prev + " " + transcript : transcript);
          }
        };
        
        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        setError(`Speech fallback startup failed: ${err.message}`);
      }
      return;
    }

    // Google Cloud Speech-to-Text Path
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = reader.result.split(',')[1];
          setIsTranscribing(true);
          try {
            const transcript = await transcribeAudio(base64Data, selectedLang);
            if (transcript) {
              setRawReport(prev => prev ? prev + " " + transcript : transcript);
            } else {
              setError("No speech detected. Please speak closer to the microphone.");
            }
          } catch (err) {
            setError(`STT Error: ${err.message}. Ensure GCP API Key is correct.`);
          } finally {
            setIsTranscribing(false);
          }
        };
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      setError(`Microphone access failed: ${err.message}`);
    }
  };

  const stopRecording = () => {
    // Stop Browser Recognition Fallback
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsRecording(false);
      return;
    }

    // Stop GCP MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  // AI Parser Trigger
  const handleParseReport = async () => {
    if (!rawReport.trim()) {
      setError("Please type or record a report first.");
      return;
    }
    
    setIsParsing(true);
    setError('');
    setAiHighlightedFields(new Set());
    
    try {
      const parsedData = await parseVoiceOrTextUpdate(rawReport, selectedPhc);
      
      if (parsedData) {
        const highlights = new Set();
        
        if (parsedData.footfall !== null && parsedData.footfall !== undefined) {
          setFootfall(Number(parsedData.footfall));
          highlights.add('footfall');
        }
        
        if (parsedData.occupiedBeds !== null && parsedData.occupiedBeds !== undefined) {
          setOccupiedBeds(Math.min(Number(parsedData.occupiedBeds), selectedPhc.capacity));
          highlights.add('occupiedBeds');
        }
        
        if (parsedData.doctorAttendance) {
          setDoctorAttendance(prev => {
            const updated = { ...prev };
            Object.entries(parsedData.doctorAttendance).forEach(([docKey, present]) => {
              // Map by partial matching if name is returned instead of ID
              const matchingDoc = selectedPhc.doctors.find(d => 
                d.id === docKey || d.name.toLowerCase().includes(docKey.toLowerCase())
              );
              if (matchingDoc && present !== null) {
                updated[matchingDoc.id] = present;
                highlights.add(`doc-${matchingDoc.id}`);
              }
            });
            return updated;
          });
        }
        
        if (parsedData.testAvailability) {
          setTestAvailability(prev => {
            const updated = { ...prev };
            Object.entries(parsedData.testAvailability).forEach(([testKey, available]) => {
              if (updated.hasOwnProperty(testKey) && available !== null) {
                updated[testKey] = available;
                highlights.add(`test-${testKey}`);
              }
            });
            return updated;
          });
        }
        
        if (parsedData.medicineStock) {
          setMedicineStock(prev => {
            const updated = { ...prev };
            Object.entries(parsedData.medicineStock).forEach(([medKey, qty]) => {
              if (updated.hasOwnProperty(medKey) && qty !== null) {
                updated[medKey] = Number(qty);
                highlights.add(`med-${medKey}`);
              }
            });
            return updated;
          });
        }

        setAiHighlightedFields(highlights);
        
        // Remove highlights after 5 seconds
        setTimeout(() => {
          setAiHighlightedFields(new Set());
        }, 5000);

      } else {
        setError("Gemini failed to extract structured fields. Please review the raw input or fill manually.");
      }
    } catch (err) {
      setError(`Gemini Parsing Error: ${err.message}. Please verify Gemini API Key.`);
    } finally {
      setIsParsing(false);
    }
  };

  // Submit Daily Form to Firestore
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    const payload = {
      footfall: Number(footfall),
      occupiedBeds: Number(occupiedBeds),
      doctorAttendance,
      testAvailability,
      medicineStock
    };

    try {
      await saveDailyLog(selectedPhcId, todayStr, payload);
      setSuccessMsg(`Daily log for ${selectedPhc.name} saved successfully!`);
      // Scroll to top to see success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(`Database save failed: ${err.message}`);
    }
  };

  // Spinner change helper
  const handleMedChange = (medId, delta) => {
    setMedicineStock(prev => ({
      ...prev,
      [medId]: Math.max(0, Number(prev[medId] || 0) + delta)
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      
      {/* Upper Info Row */}
      <div className="card flex justify-between items-center flex-mobile-col gap-4">
        <div className="form-group" style={{ marginBottom: 0, minWidth: '280px' }}>
          <label>Selected Health Facility</label>
          <select 
            value={selectedPhcId} 
            onChange={(e) => setSelectedPhcId(e.target.value)}
          >
            {phcs.map(phc => (
              <option key={phc.id} value={phc.id}>
                {phc.name} ({phc.stateOrUT} — {phc.zone} Zone)
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col text-right" style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
            Reporting Date
          </span>
          <span className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Voice & Multilingual Input Box */}
      <div className="card">
        <h3 className="card-title">
          <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
          AI Speech & Free-Text Logger (Low-Literacy Friendly)
        </h3>
        
        <p className="text-sm" style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
          Speak or write daily logs naturally in any major Indian language. Gemini AI will automatically translate and fill in the structured logs below.
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="form-group" style={{ marginBottom: 0, minWidth: '200px' }}>
              <select 
                value={selectedLang} 
                onChange={(e) => setSelectedLang(e.target.value)}
                style={{ padding: '0.5rem' }}
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {isRecording ? (
              <button 
                type="button" 
                className="btn btn-danger pulse-recording" 
                onClick={stopRecording}
              >
                <Square size={16} /> Stop Recording
              </button>
            ) : (
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={startRecording}
                disabled={isTranscribing || isParsing}
              >
                <Mic size={16} /> Record Voice Report
              </button>
            )}

            {isTranscribing && (
              <span className="text-sm" style={{ color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="pulse-recording" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-accent)' }}></span>
                Transcribing audio using Google Cloud Speech-to-Text...
              </span>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <textarea 
              value={rawReport}
              onChange={(e) => setRawReport(e.target.value)}
              placeholder="e.g. Aaj humare paas 45 patient aaye. Dr. Sharma present hain aur Dr. Verma absent hain. 4 beds occupied hain. Paracetamol 120 hain."
              style={{ minHeight: '120px' }}
            />
          </div>

          <div className="flex justify-between items-center">
            <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Example Languages: English, Hindi, Tamil, Telugu, Marathi, Gujarati, etc.
            </span>
            <button 
              type="button" 
              className="btn btn-accent" 
              onClick={handleParseReport}
              disabled={isParsing || !rawReport.trim()}
            >
              <Sparkles size={16} /> 
              {isParsing ? 'Gemini Parsing...' : 'Parse Report with AI'}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="alert-banner alert-banner-warning flex items-center gap-2">
          <AlertCircle size={18} />
          <strong>Error:</strong> {error}
        </div>
      )}

      {successMsg && (
        <div className="alert-banner alert-banner-info flex items-center gap-2" style={{ backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46' }}>
          <Check size={18} />
          <strong>Success:</strong> {successMsg}
        </div>
      )}

      {/* Structured Validation Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        
        <div className="form-categories">
          
          {/* Left Column Forms */}
          <div className="flex flex-col gap-6">
            
            {/* 1. Footfall & Beds Card */}
            <div className={`card form-category-card ${aiHighlightedFields.has('footfall') || aiHighlightedFields.has('occupiedBeds') ? 'glow-update' : ''}`}
                 style={{ border: aiHighlightedFields.has('footfall') || aiHighlightedFields.has('occupiedBeds') ? '1px solid var(--color-success)' : '' }}>
              <h3 className="card-title">
                <ClipboardList size={18} style={{ color: 'var(--color-primary)' }} />
                Patient Footfall & Bed Occupancy
              </h3>
              
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Daily Patient Footfall</label>
                <input 
                  type="number" 
                  value={footfall} 
                  onChange={(e) => setFootfall(Math.max(0, Number(e.target.value)))}
                  style={{ 
                    border: aiHighlightedFields.has('footfall') ? '2px solid var(--color-success)' : '',
                    transition: 'border var(--transition-fast)'
                  }}
                />
              </div>

              <div className="form-group">
                <div className="flex justify-between items-center" style={{ marginBottom: '0.25rem' }}>
                  <label>Bed Occupancy</label>
                  <span className="font-semibold text-sm">
                    {occupiedBeds} / {selectedPhc.capacity} Beds
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max={selectedPhc.capacity} 
                  value={occupiedBeds}
                  onChange={(e) => setOccupiedBeds(Number(e.target.value))}
                  style={{ 
                    width: '100%', 
                    accentColor: 'var(--color-primary)',
                    outline: 'none',
                    border: aiHighlightedFields.has('occupiedBeds') ? '2px solid var(--color-success)' : ''
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  Capacity: {selectedPhc.capacity} total beds for this facility
                </span>
              </div>
            </div>

            {/* 2. Doctor Attendance Card */}
            <div className="card form-category-card">
              <h3 className="card-title">
                <ClipboardList size={18} style={{ color: 'var(--color-primary)' }} />
                Doctor Attendance
              </h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                Check box to mark a doctor as Present for today's shift.
              </p>

              <div className="checklist-grid">
                {selectedPhc.doctors.map(doc => {
                  const isPresent = !!doctorAttendance[doc.id];
                  const isAiField = aiHighlightedFields.has(`doc-${doc.id}`);
                  return (
                    <label 
                      key={doc.id} 
                      className="checklist-item" 
                      style={{ 
                        padding: '0.5rem', 
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isAiField ? '#ECFDF5' : 'transparent',
                        border: isAiField ? '1px solid var(--color-success)' : 'none'
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={isPresent}
                        onChange={(e) => setDoctorAttendance(prev => ({
                          ...prev,
                          [doc.id]: e.target.checked
                        }))}
                      />
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{doc.name.split(" ")[0] + " " + doc.name.split(" ")[1]}</span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {doc.name.split("(")[1]?.replace(")", "") || 'Physician'}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3. Diagnostic Tests Availability */}
            <div className="card form-category-card">
              <h3 className="card-title">
                <ClipboardList size={18} style={{ color: 'var(--color-primary)' }} />
                Diagnostic Test Kit Availability
              </h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                Indicate if test kits are currently in stock and available for patients.
              </p>
              
              <div className="checklist-grid">
                {TESTS.map(test => {
                  const isAvailable = !!testAvailability[test.id];
                  const isAiField = aiHighlightedFields.has(`test-${test.id}`);
                  return (
                    <div 
                      key={test.id} 
                      className="flex flex-col gap-2"
                      style={{ 
                        padding: '0.5rem', 
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isAiField ? '#ECFDF5' : 'transparent',
                        border: isAiField ? '1px solid var(--color-success)' : 'none'
                      }}
                    >
                      <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                        {test.name}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className={`btn text-xs ${isAvailable ? 'btn-success' : 'btn-outline'}`}
                          style={{ padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-sm)' }}
                          onClick={() => setTestAvailability(prev => ({ ...prev, [test.id]: true }))}
                        >
                          Available
                        </button>
                        <button
                          type="button"
                          className={`btn text-xs ${!isAvailable ? 'btn-danger' : 'btn-outline'}`}
                          style={{ padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-sm)' }}
                          onClick={() => setTestAvailability(prev => ({ ...prev, [test.id]: false }))}
                        >
                          Stock Out
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column Form: Medicine Stock levels */}
          <div className="card form-category-card">
            <h3 className="card-title">
              <FileText size={18} style={{ color: 'var(--color-primary)' }} />
              Essential Medicine Stocks
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
              Confirm current physical stock counts (in tablets/packets) for the 10 essential medicines.
            </p>

            <div className="flex flex-col gap-3">
              {MEDICINES.map(med => {
                const stockQty = medicineStock[med.id] || 0;
                const isAiField = aiHighlightedFields.has(`med-${med.id}`);
                return (
                  <div 
                    key={med.id} 
                    className="flex justify-between items-center gap-3"
                    style={{ 
                      padding: '0.4rem 0.5rem', 
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isAiField ? '#ECFDF5' : 'transparent',
                      borderBottom: '1px solid var(--color-border)'
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                        {med.name.split(" ")[0]}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {med.name.substring(med.name.indexOf(" ") + 1)}
                      </span>
                    </div>

                    <div className="number-input-spinner" style={{ 
                      border: isAiField ? '2px solid var(--color-success)' : ''
                    }}>
                      <button 
                        type="button" 
                        className="spinner-btn"
                        onClick={() => handleMedChange(med.id, -10)}
                      >
                        <Minus size={12} />
                      </button>
                      <input 
                        type="number" 
                        value={stockQty} 
                        onChange={(e) => setMedicineStock(prev => ({
                          ...prev,
                          [med.id]: Math.max(0, Number(e.target.value))
                        }))}
                        style={{
                          width: '50px',
                          border: 'none',
                          textAlign: 'center',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          padding: '0.25rem 0'
                        }}
                      />
                      <button 
                        type="button" 
                        className="spinner-btn"
                        onClick={() => handleMedChange(med.id, 10)}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Submit Bar */}
        <div className="card flex justify-between items-center flex-mobile-col gap-4" style={{ backgroundColor: 'var(--color-surface)' }}>
          <div className="flex flex-col">
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Save Log Verification
            </span>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              By submitting, you confirm that physical inventory has been matched with values entered.
            </span>
          </div>
          <button type="submit" className="btn btn-accent flex items-center gap-2">
            <Send size={16} /> Submit Daily Logs
          </button>
        </div>

      </form>

    </div>
  );
}

export default StaffInput;
