import { batchSeedLogs } from './db';

// The 8 Geographically Diverse Health Centers of India (States & UTs)
export const SEEDED_PHCS = [
  {
    id: "phc-bhadri",
    name: "Bhadri PHC",
    district: "Pratapgarh District",
    stateOrUT: "Uttar Pradesh",
    zone: "North",
    capacity: 10,
    doctors: [
      { id: "dr-sharma", name: "Dr. Devendra Sharma (General Medicine)" },
      { id: "dr-verma", name: "Dr. Anita Verma (Pediatrician)" }
    ]
  },
  {
    id: "phc-katni",
    name: "Katni PHC",
    district: "Katni District",
    stateOrUT: "Madhya Pradesh",
    zone: "Central",
    capacity: 8,
    doctors: [
      { id: "dr-patel", name: "Dr. Rajesh Patel (General Physician)" },
      { id: "dr-singh", name: "Dr. Seema Singh (Gynaecologist)" }
    ]
  },
  {
    id: "phc-madanapalle",
    name: "Madanapalle CHC",
    district: "Chittoor District",
    stateOrUT: "Andhra Pradesh",
    zone: "South",
    capacity: 25,
    doctors: [
      { id: "dr-reddy", name: "Dr. G. Srinivas Reddy (Surgeon)" },
      { id: "dr-naidu", name: "Dr. Lakshmi Naidu (OB-GYN)" },
      { id: "dr-krishna", name: "Dr. Hari Krishna (Pediatrician)" }
    ]
  },
  {
    id: "phc-bishnupur",
    name: "Bishnupur CHC",
    district: "Bankura District",
    stateOrUT: "West Bengal",
    zone: "East",
    capacity: 20,
    doctors: [
      { id: "dr-das", name: "Dr. Sourav Das (General Medicine)" },
      { id: "dr-roy", name: "Dr. Indrani Roy (Paediatrician)" }
    ]
  },
  {
    id: "phc-dharampur",
    name: "Dharampur PHC",
    district: "Valsad District",
    stateOrUT: "Gujarat",
    zone: "West",
    capacity: 12,
    doctors: [
      { id: "dr-solanki", name: "Dr. Amit Solanki (General Physician)" },
      { id: "dr-mehta", name: "Dr. Hina Mehta (Pediatrician)" }
    ]
  },
  {
    id: "phc-kohima",
    name: "Kohima CHC",
    district: "Kohima District",
    stateOrUT: "Nagaland",
    zone: "Northeast",
    capacity: 15,
    doctors: [
      { id: "dr-angami", name: "Dr. Kevisenuo Angami (General Physician)" },
      { id: "dr-soma", name: "Dr. Renbomo Soma (Medical Officer)" }
    ]
  },
  {
    id: "phc-sopore",
    name: "Sopore CHC",
    district: "Baramulla District",
    stateOrUT: "Jammu & Kashmir (UT)",
    zone: "North/UT",
    capacity: 20,
    doctors: [
      { id: "dr-dar", name: "Dr. Tariq Dar (General Physician)" },
      { id: "dr-bano", name: "Dr. Farida Bano (Pediatrician)" }
    ]
  },
  {
    id: "phc-karaikal",
    name: "Karaikal PHC",
    district: "Karaikal District",
    stateOrUT: "Puducherry (UT)",
    zone: "South/UT",
    capacity: 15,
    doctors: [
      { id: "dr-selvam", name: "Dr. K. Selvam (General Physician)" },
      { id: "dr-subra", name: "Dr. J. Subramanian (Pediatrician)" }
    ]
  }
];

// Medicines default start values & daily average usage
const MEDICINE_DEFAULTS = {
  paracetamol: { name: "Paracetamol 500mg Tablets", unit: "Tablets" },
  amoxicillin: { name: "Amoxicillin 250mg Antibiotic", unit: "Tablets" },
  ibuprofen: { name: "Ibuprofen 400mg Pain Reliever", unit: "Tablets" },
  ors: { name: "Oral Rehydration Salts Packets", unit: "Packets" },
  metformin: { name: "Metformin 500mg Diabetes Tablet", unit: "Tablets" },
  atorvastatin: { name: "Atorvastatin 10mg Cholesterol Tablet", unit: "Tablets" },
  cetirizine: { name: "Cetirizine 10mg Anti-allergy Tablet", unit: "Tablets" },
  albendazole: { name: "Albendazole 400mg Deworming Tablet", unit: "Tablets" },
  iron_folic: { name: "Iron & Folic Acid Tablets", unit: "Tablets" },
  azithromycin: { name: "Azithromycin 500mg Antibiotic", unit: "Tablets" }
};

// Generates 21 days of logs for all seeded PHCs
export const generateSeededLogs = () => {
  const logs = [];
  const today = new Date();
  
  // Build a timeline of 21 days (from 20 days ago to today)
  for (let d = 20; d >= 0; d--) {
    const logDate = new Date(today);
    logDate.setDate(today.getDate() - d);
    const dateStr = logDate.toISOString().split('T')[0];
    
    SEEDED_PHCS.forEach(phc => {
      // Setup default structures
      const footfall = getSeededFootfall(phc.id, d);
      const occupiedBeds = getSeededBeds(phc.id, phc.capacity, d);
      const doctorAttendance = getSeededDoctorAttendance(phc.id, phc.doctors, d);
      const testAvailability = getSeededTestAvailability(phc.id, d);
      const medicineStock = getSeededMedicineStock(phc.id, d);
      
      logs.push({
        phcId: phc.id,
        date: dateStr,
        footfall,
        occupiedBeds,
        doctorAttendance,
        testAvailability,
        medicineStock
      });
    });
  }
  
  return logs;
};

// Helpers to generate realistic patterns over the 21-day timeline (where `d` is days remaining to today, d = 0 is today)
const getSeededFootfall = (phcId, d) => {
  // Kohima CHC: Outbreak footfall surge (rising footfall)
  if (phcId === "phc-kohima") {
    return Math.round(20 + (20 - d) * 3 + Math.sin(d) * 4); // Rising from 20 up to 80+
  }
  // Karaikal PHC: High workload, consistent high volume
  if (phcId === "phc-karaikal") {
    return Math.round(75 + Math.sin(d) * 8 + (d % 2 === 0 ? 3 : -3));
  }
  // Dharampur PHC: Remote, low footfall
  if (phcId === "phc-dharampur") {
    return Math.round(12 + Math.cos(d) * 2);
  }
  // Default general random walk around a baseline
  const base = phcId.includes("chc") ? 45 : 25;
  return Math.round(base + Math.sin(d * 0.5) * 6 + (d % 3 === 0 ? 4 : -2));
};

const getSeededBeds = (phcId, capacity, d) => {
  // Karaikal PHC: High bed occupancy (90%+)
  if (phcId === "phc-karaikal") {
    return Math.max(Math.round(capacity * 0.9 - Math.sin(d) * 1), capacity - 2);
  }
  // Kohima CHC: Bed occupancy increases as footfall rises
  if (phcId === "phc-kohima") {
    const fraction = Math.min(0.2 + (20 - d) * 0.035, 0.95);
    return Math.round(capacity * fraction);
  }
  // Default moderate occupancy
  const fraction = 0.4 + Math.sin(d * 0.8) * 0.15;
  return Math.round(capacity * fraction);
};

const getSeededDoctorAttendance = (phcId, doctors, d) => {
  const attendance = {};
  doctors.forEach((doc, idx) => {
    // Sopore CHC: Dr. Farida Bano is absent 60% of the time (e.g. absent on index-based pattern)
    if (phcId === "phc-sopore" && doc.id === "dr-bano") {
      // Absent on most days, present only every 3rd day
      attendance[doc.id] = (d % 3 === 0);
    } else {
      // Default: 90% attendance, occasionally absent
      const isAbsent = (d % 10 === 0 && idx === 0) || (d % 12 === 0 && idx === 1);
      attendance[doc.id] = !isAbsent;
    }
  });
  return attendance;
};

const getSeededTestAvailability = (phcId, d) => {
  // By default, most tests are available, but malaria or typhoid kits might run out temporarily
  return {
    malaria: !(phcId === "phc-bhadri" && d < 4), // ran out of malaria kits in bhadri recently
    pregnancy: true,
    typhoid: !(phcId === "phc-bishnupur" && d < 7),
    glucose: true,
    hiv: true
  };
};

const getSeededMedicineStock = (phcId, d) => {
  const stocks = {};
  
  // Baseline stock level helper
  const getStockVal = (base, dailyDec, daysLeft, refillEvery, refillVal) => {
    // Current day is (20 - daysLeft) in historical sequence
    const elapsedDays = 20 - daysLeft;
    let stock = base - (elapsedDays * dailyDec);
    
    // Add refills if applicable
    if (refillEvery > 0 && refillVal > 0) {
      const refills = Math.floor(elapsedDays / refillEvery);
      stock += refills * refillVal;
    }
    
    return Math.max(Math.round(stock), 0);
  };

  // 1. Bhadri PHC: Paracetamol stock crisis (depleting to critical level)
  if (phcId === "phc-bhadri") {
    // Start at 260, consumption is 12/day, no refill. Today (d=0) is 260 - 20*12 = 20 units (nearly empty!)
    stocks.paracetamol = getStockVal(260, 12, d, 0, 0);
  } else if (phcId === "phc-madanapalle") {
    // 2. Madanapalle CHC: Paracetamol massive surplus
    // Start at 550, consumption is 3/day. Today (d=0) is 550 - 20*3 = 490 units.
    stocks.paracetamol = getStockVal(550, 3, d, 0, 0);
  } else {
    // General default Paracetamol stock
    stocks.paracetamol = getStockVal(200, 7, d, 15, 150);
  }

  // 3. Bishnupur CHC: Azithromycin stock-out (starts at 100, drops by 8/day, hits zero at day 12 and stays zero)
  if (phcId === "phc-bishnupur") {
    stocks.azithromycin = getStockVal(100, 8, d, 0, 0);
  } else {
    stocks.azithromycin = getStockVal(120, 4, d, 14, 100);
  }

  // 4. Kohima CHC: ORS shortage due to footfall surge
  if (phcId === "phc-kohima") {
    // Consumption increases over time as footfall increases
    // Elapsed days: 20 - d. Stock starts at 180.
    const elapsed = 20 - d;
    let currentStock = 180;
    for (let i = 0; i < elapsed; i++) {
      // Daily consumption grows from 5 to 15
      const consumption = 5 + Math.round(i * 0.5);
      currentStock -= consumption;
    }
    stocks.ors = Math.max(Math.round(currentStock), 15); // Hit low level
  } else {
    stocks.ors = getStockVal(300, 8, d, 10, 150);
  }

  // General defaults for all other medicines to keep them realistic and within normal limits
  stocks.amoxicillin = getStockVal(150, 5, d, 12, 100);
  stocks.ibuprofen = getStockVal(180, 6, d, 15, 120);
  stocks.metformin = getStockVal(250, 7, d, 20, 200);
  stocks.atorvastatin = getStockVal(160, 4, d, 20, 100);
  stocks.cetirizine = getStockVal(140, 5, d, 15, 80);
  stocks.albendazole = getStockVal(100, 2, d, 30, 50);
  stocks.iron_folic = getStockVal(400, 12, d, 10, 250);

  return stocks;
};

// Seeding trigger function
export const runSeeding = async () => {
  const logs = generateSeededLogs();
  await batchSeedLogs(logs, SEEDED_PHCS);
  console.log(`Successfully seeded database with ${SEEDED_PHCS.length} PHCs and ${logs.length} daily logs.`);
};
