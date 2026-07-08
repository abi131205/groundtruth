import { GoogleGenerativeAI } from '@google/generative-ai';

// Retrieve keys from environment or localStorage
export const getSavedGeminiKey = () => localStorage.getItem('groundtruth_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || "";
export const getSavedGcpKey = () => localStorage.getItem('groundtruth_gcp_api_key') || import.meta.env.VITE_GCP_API_KEY || "";

export const saveApiKeys = (geminiKey, gcpKey) => {
  if (geminiKey) localStorage.setItem('groundtruth_gemini_api_key', geminiKey);
  else localStorage.removeItem('groundtruth_gemini_api_key');
  
  if (gcpKey) localStorage.setItem('groundtruth_gcp_api_key', gcpKey);
  else localStorage.removeItem('groundtruth_gcp_api_key');
};

// Helper to initialize the Gemini client (SDK fallback)
const getGeminiClient = () => {
  const apiKey = getSavedGeminiKey().trim();
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please open Developer Settings to set it.");
  }
  return new GoogleGenerativeAI(apiKey);
};

// ==========================================================================
// Robust Unified Gemini Caller (with API Key Trimming & Endpoint Failover)
// ==========================================================================
const callGemini = async (prompt, responseMimeType = null) => {
  const rawKey = getSavedGeminiKey();
  if (!rawKey) {
    throw new Error("Gemini API Key is missing. Please enter it in the Developer Settings.");
  }
  
  const geminiKey = rawKey.trim(); // Trim spaces/newlines to prevent 404s
  
  // List of endpoints to try in order of preference
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiKey}`
  ];

  let lastError = null;

  for (const url of endpoints) {
    try {
      const requestBody = {
        contents: [{ parts: [{ text: prompt }] }]
      };
      
      if (responseMimeType) {
        requestBody.generationConfig = { responseMimeType };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (resultText) {
          return resultText;
        }
      } else {
        const errText = await response.text();
        const endpointLabel = url.includes('/v1/') ? 'v1-flash' : url.includes('gemini-pro') ? 'v1beta-pro' : 'v1beta-flash';
        console.warn(`Gemini endpoint [${endpointLabel}] returned status ${response.status}: ${errText}`);
        lastError = new Error(`Gemini API error: ${response.status}`);
      }
    } catch (e) {
      console.warn(`Failed to connect to endpoint: ${url}`, e);
      lastError = e;
    }
  }

  throw lastError || new Error("Unable to reach Gemini API. Please check your internet connection and API key.");
};

// ==========================================================================
// 1. Google Cloud Speech-to-Text API call
// ==========================================================================
export const transcribeAudio = async (base64Audio, languageCode) => {
  const rawGcpKey = getSavedGcpKey();
  if (!rawGcpKey) {
    throw new Error("GCP API Key is not configured. Please open Developer Settings to set it.");
  }
  
  const gcpKey = rawGcpKey.trim();
  const endpoint = `https://speech.googleapis.com/v1/speech:recognize?key=${gcpKey}`;
  
  const payload = {
    config: {
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      languageCode: languageCode,
      enableAutomaticPunctuation: true
    },
    audio: {
      content: base64Audio
    }
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `HTTP error ${response.status}`);
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return data.results[0].alternatives[0].transcript;
    }
    
    return "";
  } catch (error) {
    console.error("GCP Speech-to-Text transcription failed:", error);
    throw error;
  }
};

// ==========================================================================
// 2. Multilingual Voice & Free-Text Parsing using Gemini
// ==========================================================================
export const parseVoiceOrTextUpdate = async (inputText, phcMetadata) => {
  try {
    const doctorsList = phcMetadata.doctors.map(d => `- ${d.id}: ${d.name}`).join("\n");
    const prompt = `You are a medical record processing AI.
You receive a spoken transcription or written text from Indian PHC staff.
Parse this text and extract the daily operations log data. The text may be in English, Hindi, Tamil, Telugu, Marathi, Bengali, Gujarati, Kannada, Malayalam, or a mix (Hinglish/Tanglish).

Translate any local language terms for medicines, tests, or doctors.
- "Dava" or "Tablet" or "Maathirai" or "Goli" usually refers to medicines.
- "B बुखार" or "Flu" or "Cold" or "Pain" refers to standard symptoms, map to medicines (e.g. Paracetamol).
- "Malaria check", "Pregnancy test" refers to tests.

Here is the list of doctors at this PHC:
${doctorsList}

Here are the target keys for medicines:
- paracetamol (Paracetamol 500mg Tablets)
- amoxicillin (Amoxicillin 250mg Antibiotic)
- ibuprofen (Ibuprofen 400mg Pain Reliever)
- ors (Oral Rehydration Salts Packets)
- metformin (Metformin 500mg Diabetes Tablet)
- atorvastatin (Atorvastatin 10mg Cholesterol Tablet)
- cetirizine (Cetirizine 10mg Anti-allergy Tablet)
- albendazole (Albendazole 400mg Deworming Tablet)
- iron_folic (Iron & Folic Acid Tablets)
- azithromycin (Azithromycin 500mg Antibiotic)

Here are the target keys for test kit availability (Boolean: true/false):
- malaria (Malaria Rapid Test)
- pregnancy (Pregnancy Test)
- typhoid (Typhoid Test)
- glucose (Glucose Test)
- hiv (HIV Test)

Return a strict JSON object with the following fields. If a field is not mentioned, set it to null:
{
  "footfall": integer or null,
  "occupiedBeds": integer or null,
  "doctorAttendance": { "doctor_id": boolean or null, ... },
  "testAvailability": { "test_key": boolean or null, ... },
  "medicineStock": { "medicine_key": integer or null, ... }
}

Input Text: "${inputText}"
Strict JSON Output:`;

    const resultText = await callGemini(prompt, "application/json");
    
    if (resultText) {
      const cleanJson = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
      return JSON.parse(cleanJson);
    }
    return null;
  } catch (err) {
    console.error("Gemini parsing failed:", err);
    throw err;
  }
};

// ==========================================================================
// 3. AI Stock-Out Predictions Natural Language Explanation
// ==========================================================================
export const generateStockOutExplanation = async (phcName, medicineName, currentStock, trendData) => {
  try {
    const prompt = `You are a clinical resource auditor for Indian primary health centers.
We have flagged a stockout warning.
- PHC Facility: ${phcName}
- Medicine: ${medicineName}
- Current Stock: ${currentStock} units remaining
- Historical Stock Trend (recent 7 days, older to newer): ${JSON.stringify(trendData)}

Calculate and write a brief (max 20 words) natural-language explanation of why this medicine is running out (e.g. sudden surge in fever patients, high usage rate vs. zero replenishment) and the urgency. Keep it professional, objective, and clear.`;

    const resultText = await callGemini(prompt);
    return resultText ? resultText.trim() : "Stock declining steadily due to recent consumption patterns.";
  } catch (e) {
    console.error("Failed to generate stockout reasoning:", e);
    return "Stock declining steadily based on recent logging trends.";
  }
};

// ==========================================================================
// 4. AI Redistribution Reasoning
// ==========================================================================
export const generateRedistributionReasoning = async (fromPhcName, toPhcName, medicineName, amount) => {
  try {
    const prompt = `You are an AI medical supply chain planner.
We are suggesting a stock transfer:
- Transfer ${amount} units of ${medicineName}
- From: ${fromPhcName} (Surplus facility)
- To: ${toPhcName} (Deficit/low-stock facility)

Write a short, professional, 1-2 sentence clinical and operational explanation of why this transfer is recommended. Focus on resource efficiency, patient needs, and preventing stockout without endangering the source facility's reserves.`;

    const resultText = await callGemini(prompt);
    return resultText ? resultText.trim() : "Transfer recommended to optimize stock levels and prevent imminent stockout.";
  } catch (e) {
    console.error("Failed to generate redistribution reasoning:", e);
    return "Transfer recommended to balance district stocks.";
  }
};

// ==========================================================================
// 5. Underperformance summaries
// ==========================================================================
export const generateUnderperformanceSummary = async (phcName, metrics) => {
  try {
    const prompt = `You are a district health admin auditor.
The facility "${phcName}" has been auto-flagged for the following issues:
${metrics.map(m => `- ${m}`).join("\n")}

Write a concise, exactly 1-sentence explanation summing up this facility's performance constraints and what immediate administrative support is needed.`;

    const resultText = await callGemini(prompt);
    return resultText ? resultText.trim() : `Critical constraints: ${metrics.join("; ")}`;
  } catch (e) {
    console.error("Failed to generate underperformance summary:", e);
    return `Critical constraints: ${metrics.join("; ")}`;
  }
};
