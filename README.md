# GroundTruth — AI-Driven Smart Health Center & Supply Chain Dashboard

GroundTruth is a hackathon prototype developed for the **"Build with AI: Code for Communities"** Google Cloud Hackathon. It is designed to bridge the operational visibility gaps in Indian Public Health Centers (PHCs) and Community Health Centers (CHCs) nationwide.

---

## Brand Identity & Design System
*   **Primary Color**: Slate Blue `#5B6D7D` (inspired by the Ashoka Chakra)
*   **Accent Color**: Burnt Orange `#B25A2B` (inspired by Saffron)
*   **Background**: Off-white `#FAF7F2` (inspired by the flag white)
*   **Success Status**: Muted Green `#3F7D4F` (inspired by the flag green)
*   **Style**: Clean, minimal, government-dashboard-appropriate. Modern flat design, generous whitespace, single-weight icons.

---

## Key Features

1.  **Low-Literacy Friendly PHC Input**:
    *   Allows staff to log daily patient counts, bed occupancy, doctor attendance, and inventory updates.
    *   **Multilingual voice dictation** (powered by GCP Speech-to-Text REST API).
    *   **AI Free-Text parsing** (powered by Gemini 1.5 Flash) that extracts structured JSON data from spoken transcripts or typed notes in English and all major Indian languages.

2.  **District/National Admin Dashboard**:
    *   **Live Status Grid**: Displays health indicators (Green/Amber/Red) for all facilities with geographic filters.
    *   **AI Stock-Out Predictor**: Evaluates 21-day historical stock depletion slopes and uses Gemini to write natural-language risk explanations.
    *   **AI Smart Redistribution Recommendations**: Recommends transferring stock from surplus facilities to deficit locations. Includes a **Confirm & Process Transfer** button that runs a real-time atomic Firestore transaction.
    *   **AI Underperformance Flagging**: Auto-flags facilities with chronic absenteeism or inventory issues and outputs audit summaries.
    *   **Trend Visuals**: High-fidelity line graphs (powered by Recharts) showing footfall and stock history.

---

## Technical Stack
*   **Frontend**: React (Vite)
*   **Database**: Google Cloud Firebase Firestore
*   **AI/LLM**: Gemini API (`gemini-1.5-flash`)
*   **Speech**: Google Cloud Speech-to-Text REST API (`v1/speech:recognize`)
*   **Visualization**: Recharts

---

## Setup & Running Instructions

### 1. Installation
In the project directory, run:
```bash
npm install
```

### 2. Configure Credentials
You can configure Google Cloud credentials in two ways:

#### Option A: Interactive UI (Recommended for Demos)
1.  Run the server: `npm run dev`
2.  Open the site in your browser.
3.  Click the **Settings Gear (top-right)** to open the Developer Config.
4.  Paste your API Keys and Firebase Web Config details.
5.  Click **Save & Apply Settings**. The app will reload and connect.

#### Option B: Environment Variables
Create a file named `.env.local` in the root directory (based on `.env.template`):
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GCP_API_KEY=your_gcp_api_key
```

### 3. Seed test database
1.  Open the **Settings Gear (top-right)**.
2.  Click **Run Seeder**.
3.  This programmatically generates 21 days of logs for 8 geographically diverse facilities representing different zones/UTs in India (UP, MP, AP, West Bengal, Gujarat, Nagaland, Jammu & Kashmir, Puducherry).

---

## Indian Languages Validation Status

The application is architected to support all major Indian languages for voice dictation and parsing. Due to constraints, the validation status is:

*   **Fully Tested & Verified (Demo Ready)**: English (`en-IN`), Hindi (`hi-IN`), Tamil (`ta-IN`).
*   **Architecturally Supported (Unverified)**: Telugu, Kannada, Malayalam, Marathi, Gujarati, Bengali, Punjabi, Urdu, Odia.
