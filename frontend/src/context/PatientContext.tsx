import React, { createContext, useContext, useState, useMemo } from 'react';

export interface TimelinePoint {
  id: number;
  time: string;
  hour: number;
  label: string;
  location: string;
  locationType: 'HOME' | 'TRANSIT' | 'WORK' | 'OUTDOOR';
  mapCoords: { x: number; y: number };
  pm25: number;
  aqi: number;
  tempC: number;
  humidity: number;
  spo2: number;
  hr: number;
  rr: number;
  risk: number;
  exposureLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH';
  state: 'STABLE' | 'MONITORING' | 'ELEVATED' | 'WORSENING';
  notes: string;
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  baseline: number;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  diagnosis: string;
  stage: string;
  baselineSpo2: number;
  baselineHr: number;
  baselineRr: number;
  baselineHrv: number;
  baselineSteps: number;
  baselineSleep: string;
  medicationStatus: 'ON TRACK' | 'MISSED DOSE' | 'REFILL NEEDED';
  activeAlert?: {
    type: 'HIGH' | 'MODERATE' | 'EXPOSURE';
    title: string;
    message: string;
  };
  timeline: TimelinePoint[];
}

export interface SimulationScenario {
  id: string;
  label: string;
  description: string;
  riskReduction: number;
  spo2Boost: number;
  exposureImpact: string;
}

export const SIMULATION_SCENARIOS: SimulationScenario[] = [
  {
    id: 'workplace',
    label: 'Reduce workplace exposure by 50%',
    description: 'Provide improved N95 filtration and local exhaust ventilation in workshop area.',
    riskReduction: 18,
    spo2Boost: 1.8,
    exposureImpact: 'MODERATE'
  },
  {
    id: 'pm25',
    label: 'Reduce PM2.5 exposure',
    description: 'Use HEPA air purifiers indoors and avoid outdoor exposure during peak pollution hours.',
    riskReduction: 22,
    spo2Boost: 2.4,
    exposureImpact: 'LOW'
  },
  {
    id: 'sleep',
    label: 'Improve sleep',
    description: 'Optimize sleep hygiene and nocturnal oxygen delivery to achieve >7.5 hours continuous rest.',
    riskReduction: 11,
    spo2Boost: 1.1,
    exposureImpact: 'MODERATE'
  },
  {
    id: 'outdoor',
    label: 'Reduce outdoor exposure',
    description: 'Reschedule afternoon outdoor activities when ambient AQI exceeds 120.',
    riskReduction: 15,
    spo2Boost: 1.6,
    exposureImpact: 'LOW'
  },
  {
    id: 'activity',
    label: 'Increase activity',
    description: 'Graduated pulmonary rehabilitation walking program (+1,500 daily steps indoors).',
    riskReduction: 9,
    spo2Boost: 1.0,
    exposureImpact: 'LOW'
  }
];

const PATIENT_042_TIMELINE: TimelinePoint[] = [
  {
    id: 0,
    time: '8:00 AM',
    hour: 8,
    label: 'Morning Rest',
    location: 'Home - Residential Quarter',
    locationType: 'HOME',
    mapCoords: { x: 180, y: 160 },
    pm25: 18,
    aqi: 45,
    tempC: 19,
    humidity: 52,
    spo2: 96,
    hr: 68,
    rr: 15,
    risk: 32,
    exposureLevel: 'LOW',
    state: 'STABLE',
    notes: 'Awakening with clean indoor air filtration active.'
  },
  {
    id: 1,
    time: '10:00 AM',
    hour: 10,
    label: 'Morning Transit',
    location: 'Metro & Urban Corridor',
    locationType: 'TRANSIT',
    mapCoords: { x: 340, y: 220 },
    pm25: 42,
    aqi: 108,
    tempC: 22,
    humidity: 48,
    spo2: 95,
    hr: 74,
    rr: 16,
    risk: 44,
    exposureLevel: 'MODERATE',
    state: 'MONITORING',
    notes: 'Urban traffic intersection; slight particulate elevation.'
  },
  {
    id: 2,
    time: '12:00 PM',
    hour: 12,
    label: 'Workplace Shift',
    location: 'Industrial Construction Site',
    locationType: 'WORK',
    mapCoords: { x: 520, y: 280 },
    pm25: 68,
    aqi: 152,
    tempC: 25,
    humidity: 44,
    spo2: 93,
    hr: 76,
    rr: 18,
    risk: 65,
    exposureLevel: 'HIGH',
    state: 'ELEVATED',
    notes: 'Ambient concrete dust and machine exhaust in enclosed hangar.'
  },
  {
    id: 3,
    time: '2:00 PM',
    hour: 14,
    label: 'Peak Exposure Shift',
    location: 'Open Outdoor Loading Yard',
    locationType: 'OUTDOOR',
    mapCoords: { x: 740, y: 210 },
    pm25: 78,
    aqi: 164,
    tempC: 27,
    humidity: 40,
    spo2: 92,
    hr: 78,
    rr: 19,
    risk: 78,
    exposureLevel: 'HIGH',
    state: 'WORSENING',
    notes: 'Combined diesel soot and wind-blown particulates; SpO₂ dropped to 92%.'
  },
  {
    id: 4,
    time: '4:00 PM',
    hour: 16,
    label: 'Afternoon Indoor Shift',
    location: 'Site Management Office',
    locationType: 'WORK',
    mapCoords: { x: 620, y: 350 },
    pm25: 58,
    aqi: 138,
    tempC: 24,
    humidity: 46,
    spo2: 92,
    hr: 75,
    rr: 18,
    risk: 72,
    exposureLevel: 'HIGH',
    state: 'ELEVATED',
    notes: 'Persistent respiratory effort; residual exposure.'
  },
  {
    id: 5,
    time: '6:00 PM',
    hour: 18,
    label: 'Evening Commute',
    location: 'Suburban Transit Route',
    locationType: 'TRANSIT',
    mapCoords: { x: 380, y: 340 },
    pm25: 46,
    aqi: 115,
    tempC: 21,
    humidity: 55,
    spo2: 93,
    hr: 72,
    rr: 17,
    risk: 60,
    exposureLevel: 'MODERATE',
    state: 'MONITORING',
    notes: 'Heading away from industrial core toward residential zone.'
  },
  {
    id: 6,
    time: '8:00 PM',
    hour: 20,
    label: 'Home Recovery',
    location: 'Home - Residential Quarter',
    locationType: 'HOME',
    mapCoords: { x: 180, y: 160 },
    pm25: 20,
    aqi: 52,
    tempC: 20,
    humidity: 58,
    spo2: 94,
    hr: 70,
    rr: 16,
    risk: 52,
    exposureLevel: 'LOW',
    state: 'MONITORING',
    notes: 'Inhaled maintenance bronchodilator administered; recovery trajectory initiated.'
  }
];

const PATIENTS: Patient[] = [
  {
    id: '042',
    name: 'Sarah Jenkins',
    age: 64,
    diagnosis: 'Chronic Obstructive Pulmonary Disease',
    stage: 'GOLD Stage II (Moderate)',
    baselineSpo2: 96,
    baselineHr: 70,
    baselineRr: 16,
    baselineHrv: 45,
    baselineSteps: 6000,
    baselineSleep: '7h 30m',
    medicationStatus: 'ON TRACK',
    activeAlert: {
      type: 'HIGH',
      title: 'Risk increased 24% in 48h',
      message: 'Coincident high PM2.5 exposure and SpO₂ desaturation under exertion.'
    },
    timeline: PATIENT_042_TIMELINE
  },
  {
    id: '018',
    name: 'Robert Chen',
    age: 58,
    diagnosis: 'COPD with Chronic Bronchitis Phenotype',
    stage: 'GOLD Stage III (Severe)',
    baselineSpo2: 95,
    baselineHr: 72,
    baselineRr: 17,
    baselineHrv: 38,
    baselineSteps: 4500,
    baselineSleep: '6h 45m',
    medicationStatus: 'ON TRACK',
    activeAlert: {
      type: 'MODERATE',
      title: 'SpO₂ declining from personal baseline',
      message: 'Resting SpO₂ consistently 3.5% below 30-day baseline over last 72 hours.'
    },
    timeline: PATIENT_042_TIMELINE.map(t => ({
      ...t,
      spo2: Math.max(89, t.spo2 - 2),
      hr: t.hr + 4,
      risk: Math.min(95, t.risk + 10)
    }))
  },
  {
    id: '073',
    name: 'Marcus Vance',
    age: 71,
    diagnosis: 'COPD / Emphysema Phenotype',
    stage: 'GOLD Stage II (Moderate)',
    baselineSpo2: 96,
    baselineHr: 68,
    baselineRr: 15,
    baselineHrv: 48,
    baselineSteps: 5200,
    baselineSleep: '7h 10m',
    medicationStatus: 'REFILL NEEDED',
    activeAlert: {
      type: 'EXPOSURE',
      title: 'High PM2.5 exposure detected',
      message: 'Continuous outdoor exposure exceeding 80 μg/m³ during regional wildfire inversion.'
    },
    timeline: PATIENT_042_TIMELINE.map(t => ({
      ...t,
      pm25: Math.round(t.pm25 * 1.25),
      aqi: Math.min(220, Math.round(t.aqi * 1.2)),
      risk: Math.min(90, t.risk + 8)
    }))
  }
];

interface PatientContextType {
  selectedPatientId: string;
  setSelectedPatientId: (id: string) => void;
  patient: Patient;
  allPatients: Patient[];
  timelineIndex: number;
  setTimelineIndex: (idx: number) => void;
  currentPoint: TimelinePoint;
  
  // What-If Simulator
  activeScenarioIds: string[];
  toggleScenario: (id: string) => void;
  selectSingleScenario: (id: string) => void;
  clearScenarios: () => void;
  simulatedRisk: number;
  simulatedSpo2: number;
  simulatedExposureLevel: 'LOW' | 'MODERATE' | 'HIGH';
  
  // Navigation helper
  scrollToSection: (sectionId: string) => void;
}

const PatientContext = createContext<PatientContextType | null>(null);

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('042');
  const [timelineIndex, setTimelineIndex] = useState<number>(3); // Default to 2:00 PM (peak)
  const [activeScenarioIds, setActiveScenarioIds] = useState<string[]>(['workplace']);

  const patient = useMemo(() => {
    return PATIENTS.find(p => p.id === selectedPatientId) || PATIENTS[0];
  }, [selectedPatientId]);

  const currentPoint = useMemo(() => {
    const tl = patient.timeline;
    const safeIdx = Math.min(Math.max(0, timelineIndex), tl.length - 1);
    return tl[safeIdx];
  }, [patient, timelineIndex]);

  // Toggle scenario in multi-select or single
  const toggleScenario = (id: string) => {
    setActiveScenarioIds(prev => 
      prev.includes(id) ? (prev.length === 1 ? prev : prev.filter(x => x !== id)) : [...prev, id]
    );
  };

  const selectSingleScenario = (id: string) => {
    setActiveScenarioIds([id]);
  };

  const clearScenarios = () => {
    setActiveScenarioIds([]);
  };

  // Deterministic simulation calculations
  const { simulatedRisk, simulatedSpo2, simulatedExposureLevel } = useMemo(() => {
    const baseRisk = currentPoint.risk;
    const baseSpo2 = currentPoint.spo2;

    if (activeScenarioIds.length === 0) {
      return {
        simulatedRisk: baseRisk,
        simulatedSpo2: baseSpo2,
        simulatedExposureLevel: currentPoint.exposureLevel === 'VERY HIGH' || currentPoint.exposureLevel === 'HIGH' ? 'HIGH' : currentPoint.exposureLevel as 'LOW' | 'MODERATE' | 'HIGH'
      };
    }

    let totalRiskReduction = 0;
    let totalSpo2Boost = 0;

    activeScenarioIds.forEach(id => {
      const scen = SIMULATION_SCENARIOS.find(s => s.id === id);
      if (scen) {
        totalRiskReduction += scen.riskReduction;
        totalSpo2Boost += scen.spo2Boost;
      }
    });

    // Diminishing returns curve for combined scenarios
    const factor = activeScenarioIds.length > 1 ? 0.85 : 1.0;
    const netRiskReduction = Math.min(52, Math.round(totalRiskReduction * factor));
    const netSpo2Boost = Math.min(4.5, Number((totalSpo2Boost * factor).toFixed(1)));

    const simRisk = Math.max(26, baseRisk - netRiskReduction);
    const simSpo2 = Math.min(patient.baselineSpo2, Number((baseSpo2 + netSpo2Boost).toFixed(1)));
    
    let simExposure: 'LOW' | 'MODERATE' | 'HIGH' = 'MODERATE';
    if (simRisk < 48) simExposure = 'LOW';
    else if (simRisk < 68) simExposure = 'MODERATE';
    else simExposure = 'HIGH';

    return {
      simulatedRisk: simRisk,
      simulatedSpo2: simSpo2,
      simulatedExposureLevel: simExposure
    };
  }, [currentPoint, activeScenarioIds, patient.baselineSpo2]);

  const scrollToSection = (sectionId: string) => {
    const elem = document.getElementById(sectionId);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <PatientContext.Provider
      value={{
        selectedPatientId,
        setSelectedPatientId,
        patient,
        allPatients: PATIENTS,
        timelineIndex,
        setTimelineIndex,
        currentPoint,
        activeScenarioIds,
        toggleScenario,
        selectSingleScenario,
        clearScenarios,
        simulatedRisk,
        simulatedSpo2,
        simulatedExposureLevel,
        scrollToSection
      }}
    >
      {children}
    </PatientContext.Provider>
  );
};

export const usePatient = () => {
  const ctx = useContext(PatientContext);
  if (!ctx) {
    throw new Error('usePatient must be used within a PatientProvider');
  }
  return ctx;
};
