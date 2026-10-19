import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { usePatient } from '../context/PatientContext';
import { Activity, Heart, Wind, Moon, Footprints, CloudFog, Pill, Info } from 'lucide-react';

interface MetricCard {
  id: string;
  label: string;
  value: string;
  sub: string;
  icon: typeof Activity;
  focalZone: string;
  detail: string;
  pos: string;
  targetCoords: { x: number; y: number };
}

export const DigitalTwinHero = () => {
  const { currentPoint, patient } = usePatient();
  const [selectedMetric, setSelectedMetric] = useState<string>('spo2');

  const metricCards: MetricCard[] = [
    {
      id: 'spo2',
      label: 'SpO₂',
      value: `${currentPoint.spo2}%`,
      sub: `Baseline ${patient.baselineSpo2}%`,
      icon: Activity,
      focalZone: 'Alveolar Gas Exchange Zone',
      detail: 'Peripheral capillary oxygenation 4.2% below 30-day baseline during afternoon particulate peaks.',
      pos: 'top-6 -left-[2%] md:left-[6%]',
      targetCoords: { x: 140, y: 120 }
    },
    {
      id: 'hr',
      label: 'Heart Rate',
      value: `${currentPoint.hr} BPM`,
      sub: `Baseline ${patient.baselineHr} BPM`,
      icon: Heart,
      focalZone: 'Pulmonary Vascular Circuit',
      detail: 'Compensatory sinus tachycardia coinciding with drop in arterial partial pressure.',
      pos: 'top-2 -right-[2%] md:right-[6%]',
      targetCoords: { x: 860, y: 110 }
    },
    {
      id: 'rr',
      label: 'Respiratory Rate',
      value: `${currentPoint.rr} / min`,
      sub: `Baseline ${patient.baselineRr} / min`,
      icon: Wind,
      focalZone: 'Primary Bronchial Tree',
      detail: 'Tachypneic shift with increased shallow thoracic breathing during industrial shifts.',
      pos: 'top-[30%] -right-[5%] md:right-[2%]',
      targetCoords: { x: 890, y: 260 }
    },
    {
      id: 'sleep',
      label: 'Sleep',
      value: '6h 12m',
      sub: '↓ 18% Nocturnal',
      icon: Moon,
      focalZone: 'Nocturnal Hypoventilation State',
      detail: 'Frequent micro-arousals detected with 3 desaturation clusters below 90% SpO₂.',
      pos: 'bottom-[28%] -right-[3%] md:right-[4%]',
      targetCoords: { x: 870, y: 430 }
    },
    {
      id: 'activity',
      label: 'Activity',
      value: '4,120 steps',
      sub: '↓ 31% vs Target',
      icon: Footprints,
      focalZone: 'Functional Exertion Tolerance',
      detail: 'Reduced daily step count reflecting exertional dyspnea avoidance during midday hours.',
      pos: 'bottom-[8%] left-[2%] md:left-[8%]',
      targetCoords: { x: 180, y: 520 }
    },
    {
      id: 'pm25',
      label: 'PM2.5',
      value: 'High exposure',
      sub: `${currentPoint.pm25} μg/m³ (AQI ${currentPoint.aqi})`,
      icon: CloudFog,
      focalZone: 'Upper Airway Deposition Area',
      detail: 'Elevated respirable fine particulate matter exceeding WHO 24-hour guideline by 4.8x.',
      pos: 'top-[36%] -left-[5%] md:left-[2%]',
      targetCoords: { x: 110, y: 280 }
    },
    {
      id: 'medication',
      label: 'Medication',
      value: 'On track',
      sub: 'LABA/LAMA Adherent',
      icon: Pill,
      focalZone: 'Pharmacological Receptivity',
      detail: 'Scheduled inhaled maintenance dose recorded on schedule; rescue inhaler logged 2 puffs.',
      pos: 'bottom-[34%] -left-[4%] md:left-[4%]',
      targetCoords: { x: 140, y: 400 }
    }
  ];

  const activeCard = metricCards.find(m => m.id === selectedMetric) || metricCards[0];

  return (
    <section id="digital-twin" className="py-24 md:py-32 px-6 md:px-12 bg-[#FAFAFC] relative overflow-hidden group/section">
      
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-[#EAE6FF]/70 blur-[150px] rounded-full z-0 pointer-events-none" />

      <div className="max-w-[1400px] mx-auto flex flex-col items-center relative z-10">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-8">
            <span>Patient Digital Twin</span>
            <span className="w-1 h-1 rounded-full bg-[#7C5CFF]" />
            <span className="text-[10px] text-[#433B68]/60 font-medium">Demonstration Data</span>
          </div>
          
          <h2 className="text-5xl md:text-7xl font-medium text-[#433B68] leading-[1.05] tracking-tight mb-4">
            See the patient<br />
            as a living system.
          </h2>
          <div className="flex items-center justify-center gap-3 text-sm text-[#433B68]/70">
            <span className="font-semibold tracking-wider uppercase text-[#7C5CFF]">{patient.name}</span>
            <span>·</span>
            <span>Patient #{patient.id}</span>
            <span>·</span>
            <span>{patient.stage}</span>
          </div>
        </motion.div>

        {/* Central Interactive Twin Stage */}
        <div className="w-full max-w-[1100px] relative flex justify-center items-center min-h-[640px]">
          
          {/* Animated Connecting Lines (Desktop only) */}
          <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none hidden md:block" viewBox="0 0 1000 640" preserveAspectRatio="none">
            {metricCards.map((f) => {
              const isSelected = selectedMetric === f.id;
              return (
                <g key={f.id}>
                  {/* Base trace line */}
                  <path
                    d={`M 500 320 Q ${(500 + f.targetCoords.x)/2} ${(320 + f.targetCoords.y)/2 - 30} ${f.targetCoords.x} ${f.targetCoords.y}`}
                    fill="none"
                    stroke={isSelected ? "#7C5CFF" : "rgba(124, 92, 255, 0.12)"}
                    strokeWidth={isSelected ? 2.5 : 1}
                    className="transition-all duration-500"
                  />
                  {/* Moving pulse light along selected line */}
                  {isSelected && (
                    <motion.circle
                      r="4"
                      fill="#7C5CFF"
                      animate={{
                        cx: [500, f.targetCoords.x],
                        cy: [320, f.targetCoords.y]
                      }}
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Main Anatomical Lung Visual with Subtle Breathing Simulation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="w-[380px] md:w-[480px] h-[480px] md:h-[580px] relative z-20 flex items-center justify-center"
          >
            {/* Subtle Breathing Expansion */}
            <motion.div
              animate={{ scale: [1, 1.035, 1], filter: ['brightness(1)', 'brightness(1.05)', 'brightness(1)'] }}
              transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-full h-full relative flex items-center justify-center"
            >
              <img 
                src="/assets/digital_twin_center_1791216452426.jpg" 
                alt="Central Digital Twin Anatomical Model" 
                className="w-full h-full object-cover mix-blend-multiply opacity-95 drop-shadow-2xl will-change-transform rounded-full"
                style={{ clipPath: 'circle(48% at 50% 50%)' }}
              />

              {/* Glowing Alveolar/Focal Zone Halo based on selected metric */}
              <motion.div 
                key={selectedMetric}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.7, scale: 1 }}
                className="absolute inset-12 rounded-full border-2 border-[#7C5CFF] shadow-[0_0_40px_rgba(124,92,255,0.4)] pointer-events-none"
              />
            </motion.div>
            
            {/* Center Dynamic HUD Panel */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white/90 backdrop-blur-md border border-white/70 p-6 rounded-3xl shadow-2xl flex flex-col items-center min-w-[240px] max-w-[280px] cursor-default transition-all duration-300 z-30"
            >
              <span className="text-[10px] font-bold text-[#433B68]/60 uppercase tracking-widest mb-1 text-center">
                Pulmonary Twin State
              </span>
              
              <div className="w-full h-[1px] bg-[#433B68]/10 my-2" />
              
              <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-0.5">
                Current Status
              </span>
              <span className="text-lg font-bold text-orange-600 uppercase tracking-wide mb-2">
                {currentPoint.state}
              </span>

              {/* Selected Zone Focal Display */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCard.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="bg-[#FAFAFC] w-full p-2.5 rounded-xl border border-gray-100 flex flex-col items-center text-center mb-2"
                >
                  <span className="text-[9px] font-bold text-[#7C5CFF] uppercase tracking-wider mb-1">
                    {activeCard.focalZone}
                  </span>
                  <div className="text-xs font-semibold text-[#433B68]">
                    {activeCard.label}: {activeCard.value}
                  </div>
                  <p className="text-[9px] text-[#433B68]/60 font-light mt-1 line-clamp-2">
                    {activeCard.detail}
                  </p>
                </motion.div>
              </AnimatePresence>

              <div className="bg-orange-50/80 w-full p-2 rounded-xl border border-orange-100 flex items-center justify-between px-3">
                <span className="text-[10px] font-bold text-orange-600/80 uppercase tracking-widest">Risk Index</span>
                <span className="text-base font-bold text-orange-600 flex items-center gap-1">
                  {currentPoint.risk}% <span className="text-xs">↑</span>
                </span>
              </div>
            </motion.div>
          </motion.div>

          {/* Interactive Metric Cards surrounding the twin */}
          {metricCards.map((card, idx) => {
            const isSelected = selectedMetric === card.id;
            const Icon = card.icon;

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.15 + (idx * 0.08) }}
                onClick={() => setSelectedMetric(card.id)}
                onMouseEnter={() => setSelectedMetric(card.id)}
                className={`absolute z-30 ${card.pos} cursor-pointer`}
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3.5 + (idx * 0.4), repeat: Infinity, ease: 'easeInOut' }}
                  className={`bg-white/95 backdrop-blur-md border ${
                    isSelected 
                      ? 'border-[#7C5CFF] shadow-2xl shadow-[#7C5CFF]/25 -translate-y-1.5 ring-2 ring-[#7C5CFF]/20' 
                      : 'border-gray-100 shadow-xl shadow-[#433B68]/5 hover:border-[#7C5CFF]/40'
                  } p-3.5 md:p-4 rounded-2xl min-w-[150px] md:min-w-[160px] flex flex-col gap-1 transition-all duration-300`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${
                      isSelected ? 'text-[#7C5CFF]' : 'text-[#433B68]/40'
                    }`}>
                      {card.label}
                    </span>
                    <Icon size={13} className={isSelected ? 'text-[#7C5CFF]' : 'text-[#433B68]/30'} />
                  </div>

                  <span className={`text-base md:text-lg font-semibold tracking-tight transition-colors ${
                    isSelected ? 'text-[#7C5CFF]' : 'text-[#433B68]'
                  }`}>
                    {card.value}
                  </span>

                  <span className={`text-[10px] font-medium ${
                    card.sub.includes('Baseline') || card.sub.includes('Adherent')
                      ? 'text-[#7C5CFF]/80'
                      : card.sub.includes('↓') || card.sub.includes('High') || card.sub.includes('AQI')
                      ? 'text-orange-500 font-semibold'
                      : 'text-[#433B68]/50'
                  }`}>
                    {card.sub}
                  </span>
                </motion.div>
              </motion.div>
            );
          })}
          
        </div>

        {/* Informational Disclosure */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 flex items-center gap-2 bg-[#EAE6FF]/40 border border-[#7C5CFF]/15 px-4 py-2 rounded-full text-xs text-[#433B68]/70"
        >
          <Info size={14} className="text-[#7C5CFF]" />
          <span>Interactive Model Demonstration · Hover or tap any metric card to inspect physiological focal point</span>
        </motion.div>
      </div>
    </section>
  );
};

