import React, { useState, useRef, useEffect } from 'react';
import { getSavedGeminiKey } from '../services/ai';
import { MessageSquare, Sparkles, Send, X, Clipboard } from 'lucide-react';

function ChatAssistant({ phcList }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      sender: 'assistant', 
      text: "Namaste! I am your GroundTruth AI Assistant. Ask me anything about the live status of the district health centers, doctor attendance, bed capacities, or medicine stocks." 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Compile real-time data context to feed into Gemini prompt
  const getLiveContextString = () => {
    return phcList.map(phc => {
      const docsCount = phc.doctors?.length || 0;
      const docsPresent = phc.latestLog?.doctorAttendance 
        ? Object.values(phc.latestLog.doctorAttendance).filter(Boolean).length
        : docsCount;
      const absentDocsList = phc.latestLog?.doctorAttendance
        ? Object.entries(phc.latestLog.doctorAttendance)
            .filter(([_, present]) => !present)
            .map(([id]) => phc.doctors.find(d => d.id === id)?.name || id)
            .join(', ')
        : 'None';
      
      const lowStockList = [];
      if (phc.latestLog?.medicineStock) {
        Object.entries(phc.latestLog.medicineStock).forEach(([medId, qty]) => {
          if (Number(qty) <= 40) {
            lowStockList.push(`${medId}: ${qty} units`);
          }
        });
      }
      
      return `
- Clinic: ${phc.name}
  * Location: ${phc.stateOrUT} (${phc.zone} Zone)
  * Status Badge: ${phc.status.toUpperCase()}
  * Patient Footfall Today: ${phc.latestLog?.footfall || 0}
  * Bed Occupancy: ${phc.latestLog?.occupiedBeds || 0} / ${phc.capacity} beds occupied
  * Doctors: ${docsPresent} present, ${docsCount - docsPresent} absent. (Absent Names: ${absentDocsList || 'None'})
  * Critical/Low Stocks: ${lowStockList.length > 0 ? lowStockList.join(', ') : 'None'}
  * Diagnostic Tests Available: ${phc.latestLog?.testAvailability ? Object.entries(phc.latestLog.testAvailability).filter(([_, av]) => av).map(([id]) => id).join(', ') : 'All'}`;
    }).join('\n');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    const geminiKey = getSavedGeminiKey().trim();
    if (!geminiKey) {
      setMessages(prev => [...prev, { 
        sender: 'assistant', 
        text: "⚠️ Gemini API key is missing. Please open the Developer Settings (gear icon) and configure your API key to chat with the assistant." 
      }]);
      setLoading(false);
      return;
    }

    // Compile dynamic context
    const dbContext = getLiveContextString();
    
    const prompt = `You are the GroundTruth AI Assistant, a clinical resource supply chain auditor and district health administrator helper for Indian PHCs/CHCs.
You have direct, real-time access to the live Firestore database. Here is the current status of all facilities in the district:
${dbContext}

User Question: "${userMessage}"

Answer the user's question accurately and concisely using ONLY the real-time data provided above.
Provide clear recommendations if they ask about stock-outs, attendance, or occupancy (e.g. transfer paracetamol from Madanapalle to Bhadri).
Keep your answer professional, supportive, and under 3 sentences.`;

    // Fetch endpoints try/failover loop
    const endpoints = [
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`
    ];

    let success = false;
    let reply = "I was unable to process your request at the moment. Please verify your Gemini API key.";

    for (const url of endpoints) {
      if (success) break;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (response.ok) {
          const data = await response.json();
          const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textResult) {
            reply = textResult.trim();
            success = true;
          }
        }
      } catch (err) {
        console.warn(`Chat endpoint failover:`, err);
      }
    }

    setMessages(prev => [...prev, { sender: 'assistant', text: reply }]);
    setLoading(false);
  };

  return (
    <>
      {/* Floating Toggle Bubble */}
      <button 
        className="chat-bubble"
        onClick={() => setIsOpen(!isOpen)}
        title="Ask GroundTruth AI"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* Expanded Chat Overlay */}
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <h3 className="flex items-center gap-2 text-sm font-bold" style={{ color: 'white' }}>
              <Sparkles size={16} />
              GroundTruth AI Assistant
            </h3>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'white', fontSize: '1rem', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-msg ${msg.sender}`}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="chat-msg assistant" style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
                Thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="chat-input-area">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about stock, doctors, occupancy..."
              disabled={loading}
              style={{ fontSize: '0.875rem', padding: '0.5rem 0.75rem' }}
            />
            <button 
              type="submit" 
              className="btn btn-accent btn-icon-only"
              disabled={loading || !input.trim()}
              style={{ padding: '0.5rem' }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export default ChatAssistant;
