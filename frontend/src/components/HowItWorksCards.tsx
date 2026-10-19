import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Wind, TrendingUp, AlertTriangle, MapPin, Heart } from 'lucide-react';
import { usePatient } from '../context/PatientContext';

// ==========================================
// CARD 1: Connect the Patient Mini-Dashboard
// ==========================================
export const Card1ConnectPatient = () => {
  const { currentPoint, patient } = usePatient();

  return (
    <div className="absolute inset-0 bg-[#1e1a30] text-white p-5 flex flex-col justify-start select-none overflow-hidden">
      {/* Background ambient mesh */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#7C5CFF]/20 rounded-full blur-2xl pointer-events-none" />
      
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[10px] font-bold tracking-widest uppercase text-white/80">
            Live Stream · {patient.name.split(' ')[0]}
          </span>
        </div>
        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/10 text-[#A294F9]">
          BLE Connected
        </span>
      </div>

      {/* Vitals Grid */}
      <div className="grid grid-cols-3 gap-2 my-3 relative z-10">
        <div className="bg-white/5 border border-white/10 rounded-xl p-2 flex flex-col">
          <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Activity size={10} className="text-[#7C5CFF]" /> SpO₂
          </span>
          <span className="text-lg font-bold text-white mt-0.5">{currentPoint.spo2}%</span>
          <span className="text-[8px] text-white/40 font-mono">Base: {patient.baselineSpo2}%</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-2 flex flex-col">
          <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Heart size={10} className="text-red-400" /> HR
          </span>
          <span className="text-lg font-bold text-white mt-0.5">{currentPoint.hr}</span>
          <span className="text-[8px] text-white/40 font-mono">BPM (Norm 70)</span>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-2 flex flex-col">
          <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1">
            <Wind size={10} className="text-cyan-400" /> Resp
          </span>
          <span className="text-lg font-bold text-white mt-0.5">{currentPoint.rr}</span>
          <span className="text-[8px] text-white/40 font-mono">/min (Norm 16)</span>
        </div>
      </div>

      {/* Animated SVG Sparkline Waveform */}
      <div className="relative h-20 bg-black/20 rounded-xl border border-white/5 p-2 flex flex-col justify-between overflow-hidden z-10">
        <div className="flex justify-between items-center text-[8px] font-mono text-white/40">
          <span>REAL-TIME PLETHYSMOGRAPHY</span>
          <span className="text-emerald-400 font-bold">STABLE SYNC</span>
        </div>

        <svg viewBox="0 0 300 60" className="w-full h-12 overflow-visible">
          {/* Baseline reference */}
          <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(124, 92, 255, 0.3)" strokeDasharray="3 3" strokeWidth="1" />
          
          {/* Waveform line */}
          <motion.path
            d="M 0,35 Q 15,35 25,25 T 35,45 T 45,15 T 55,35 L 75,35 Q 90,35 100,25 T 110,45 T 120,15 T 130,35 L 155,35 Q 170,35 180,25 T 190,45 T 200,15 T 210,35 L 235,35 Q 250,35 260,25 T 270,45 T 280,15 T 290,35 L 300,35"
            fill="none"
            stroke="#7C5CFF"
            strokeWidth="2.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
          />
          
          {/* Glowing pulse head */}
          <motion.circle
            cx="290"
            cy="35"
            r="3.5"
            fill="#A294F9"
            animate={{ scale: [1, 1.4, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        </svg>

        <div className="flex justify-between text-[8px] text-white/40">
          <span>Continuous sampling @ 25Hz</span>
          <span className="text-[#A294F9]">Signal Quality 99.4%</span>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// CARD 2: Understand the Environment Interactive Map
// ==========================================
export const Card2UnderstandEnvironment = () => {
  const [selectedPin, setSelectedPin] = useState<'HOME' | 'WORK' | 'OUTDOOR'>('OUTDOOR');

  const locations = {
    HOME: { name: 'Residential District', pm25: 18, aqi: 45, temp: '19°C', time: '8:00 AM', status: 'Clean' },
    WORK: { name: 'Workshop Hangar', pm25: 68, aqi: 152, temp: '25°C', time: '12:00 PM', status: 'Elevated' },
    OUTDOOR: { name: 'Logistics Yard', pm25: 78, aqi: 164, temp: '27°C', time: '2:00 PM', status: 'High Risk' }
  };

  const handleStepClick = (pin: 'HOME' | 'WORK' | 'OUTDOOR') => {
    setSelectedPin(pin);
  };

  const currentInfo = locations[selectedPin];

  return (
    <div className="absolute inset-0 bg-[#181528] text-white p-5 flex flex-col justify-start select-none overflow-hidden">
      {/* Top Header */}
      <div className="flex justify-between items-center pb-2 border-b border-white/10 z-10">
        <span className="text-[10px] font-bold tracking-widest uppercase text-white/80 flex items-center gap-1.5">
          <MapPin size={12} className="text-[#7C5CFF]" /> Geo-Exposure Map
        </span>
        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
          {selectedPin}: AQI {currentInfo.aqi}
        </span>
      </div>

      {/* Stylized Interactive Vector Map */}
      <div className="relative h-32 my-2 bg-[#201c35] rounded-xl border border-white/10 overflow-hidden z-10">
        <svg viewBox="0 0 320 130" className="w-full h-full">
          {/* Map Grid Roads */}
          <line x1="0" y1="35" x2="320" y2="35" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <line x1="0" y1="85" x2="320" y2="85" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <line x1="70" y1="0" x2="70" y2="130" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <line x1="180" y1="0" x2="180" y2="130" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <line x1="270" y1="0" x2="270" y2="130" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
          
          {/* Park / Green zone */}
          <rect x="15" y="5" width="45" height="25" rx="4" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="1" />
          
          {/* Pollution heat plume overlay in outdoor industrial sector */}
          <circle cx="260" cy="50" r="38" fill="rgba(249, 115, 22, 0.18)" filter="blur(6px)" />

          {/* Route path connecting Home -> Work -> Outdoor */}
          <path
            d="M 40,85 C 100,85 140,35 180,35 C 220,35 240,60 260,60"
            fill="none"
            stroke="#7C5CFF"
            strokeWidth="3"
            strokeDasharray="4 2"
          />

          {/* Marker: Home */}
          <g 
            className="cursor-pointer transition-transform hover:scale-125" 
            onClick={() => handleStepClick('HOME')}
          >
            <circle cx="40" cy="85" r={selectedPin === 'HOME' ? "8" : "6"} fill="#10b981" />
            <circle cx="40" cy="85" r={selectedPin === 'HOME' ? "13" : "9"} fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.6" />
            <text x="40" y="105" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8" fontWeight="bold">HOME</text>
          </g>

          {/* Marker: Work */}
          <g 
            className="cursor-pointer transition-transform hover:scale-125" 
            onClick={() => handleStepClick('WORK')}
          >
            <circle cx="180" cy="35" r={selectedPin === 'WORK' ? "8" : "6"} fill="#eab308" />
            <circle cx="180" cy="35" r={selectedPin === 'WORK' ? "13" : "9"} fill="none" stroke="#eab308" strokeWidth="1.5" opacity="0.6" />
            <text x="180" y="24" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="8" fontWeight="bold">WORK</text>
          </g>

          {/* Marker: Outdoor */}
          <g 
            className="cursor-pointer transition-transform hover:scale-125" 
            onClick={() => handleStepClick('OUTDOOR')}
          >
            <circle cx="260" cy="60" r={selectedPin === 'OUTDOOR' ? "8" : "6"} fill="#f97316" />
            <circle cx="260" cy="60" r={selectedPin === 'OUTDOOR' ? "14" : "10"} fill="none" stroke="#f97316" strokeWidth="1.5" className="animate-pulse" />
            <text x="260" y="80" textAnchor="middle" fill="#f97316" fontSize="8" fontWeight="bold">OUTDOOR</text>
          </g>
        </svg>

        {/* Floating Tooltip inside map */}
        <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10 text-[9px] pointer-events-none">
          <div className="font-semibold text-white">{currentInfo.name}</div>
          <div className="flex gap-2 text-white/60">
            <span>PM2.5: <b className="text-orange-400">{currentInfo.pm25} μg</b></span>
            <span>AQI: <b className="text-orange-400">{currentInfo.aqi}</b></span>
          </div>
        </div>
      </div>

      {/* Mini Route Timeline Scrubber */}
      <div className="flex gap-1.5 z-10">
        {[
          { label: '8 AM', pin: 'HOME' as const, step: 0 },
          { label: '12 PM', pin: 'WORK' as const, step: 1 },
          { label: '2 PM', pin: 'OUTDOOR' as const, step: 2 }
        ].map((item) => (
          <button
            key={item.label}
            onClick={() => handleStepClick(item.pin)}
            className={`flex-1 py-1 px-2 rounded-lg text-[9px] font-bold tracking-wider transition-all border ${
              selectedPin === item.pin
                ? 'bg-[#7C5CFF] border-[#7C5CFF] text-white shadow-md'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            {item.label} · {item.pin}
          </button>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// CARD 3: Detect Changing Patterns Chart
// ==========================================
export const Card3DetectPatterns = () => {
  const [period, setPeriod] = useState<'24H' | '7D' | '30D'>('7D');

  const periodData = {
    '24H': {
      current: 92,
      baseline: 96,
      drop: '4.0%',
      path: 'M 0,20 Q 70,22 140,32 T 220,44 T 300,52',
      points: [
        { x: 0, y: 20 },
        { x: 100, y: 25 },
        { x: 200, y: 40 },
        { x: 300, y: 52 }
      ],
      labels: ['00:00', '08:00', '14:00', 'Now']
    },
    '7D': {
      current: 92,
      baseline: 96,
      drop: '4.2%',
      path: 'M 0,18 Q 75,20 150,30 T 225,48 T 300,55',
      points: [
        { x: 0, y: 18 },
        { x: 100, y: 22 },
        { x: 200, y: 42 },
        { x: 300, y: 55 }
      ],
      labels: ['Day 1', 'Day 3', 'Day 5', 'Today']
    },
    '30D': {
      current: 91,
      baseline: 96,
      drop: '5.2%',
      path: 'M 0,15 Q 80,18 160,26 T 240,46 T 300,58',
      points: [
        { x: 0, y: 15 },
        { x: 100, y: 20 },
        { x: 200, y: 38 },
        { x: 300, y: 58 }
      ],
      labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4']
    }
  };

  const current = periodData[period];

  return (
    <div className="absolute inset-0 bg-[#1c182e] text-white p-5 flex flex-col justify-start select-none overflow-hidden">
      {/* Header with 24H / 7D / 30D Controls */}
      <div className="flex justify-between items-center pb-2 border-b border-white/10 z-10">
        <div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-white/80 block">
            Baseline vs Actual
          </span>
          <span className="text-[9px] text-[#A294F9] font-medium">SpO₂ Desaturation Trend</span>
        </div>
        
        {/* Working Period Controls */}
        <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/10">
          {(['24H', '7D', '30D'] as const).map((p) => (
            <button
              key={p}
              onClick={(e) => {
                e.stopPropagation();
                setPeriod(p);
              }}
              className={`px-2 py-0.5 text-[9px] font-bold rounded transition-colors ${
                period === p ? 'bg-[#7C5CFF] text-white' : 'text-white/40 hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Comparison Numbers */}
      <div className="flex items-center justify-between my-2.5 px-1 z-10">
        <div>
          <span className="text-[9px] text-[#7C5CFF] font-bold tracking-widest block uppercase">Personal Baseline</span>
          <span className="text-xl font-bold text-white">{current.baseline}%</span>
        </div>
        <div className="text-right">
          <span className="text-[9px] text-orange-400 font-bold tracking-widest block uppercase">Current Recorded</span>
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-xl font-bold text-orange-400">{current.current}%</span>
            <span className="text-[10px] px-1 rounded bg-orange-500/20 text-orange-400 font-bold">↓ {current.drop}</span>
          </div>
        </div>
      </div>

      {/* Interactive SVG Chart */}
      <div className="relative h-24 bg-black/20 rounded-xl border border-white/5 p-2 flex flex-col justify-between overflow-hidden z-10">
        <svg viewBox="0 0 300 70" className="w-full h-16 overflow-visible">
          {/* Baseline dashed reference line */}
          <line x1="0" y1="18" x2="300" y2="18" stroke="#7C5CFF" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="290" y="14" textAnchor="end" fill="#7C5CFF" fontSize="7" fontWeight="bold">BASELINE (96%)</text>

          {/* Actual trend path */}
          <motion.path
            key={period}
            d={current.path}
            fill="none"
            stroke="#f97316"
            strokeWidth="3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />

          {/* Data point markers */}
          {current.points.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={i === current.points.length - 1 ? "4.5" : "3"}
              fill={i === current.points.length - 1 ? "#ef4444" : "#f97316"}
            />
          ))}
        </svg>

        {/* Axis Labels */}
        <div className="flex justify-between text-[8px] font-mono text-white/40 border-t border-white/5 pt-1">
          {current.labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// CARD 4: Predict Changing Risk Trajectory Chart
// ==========================================
export const Card4PredictRisk = () => {
  const { currentPoint } = usePatient();

  const factors = [
    { name: 'PM2.5 Exposure', val: '+54%', color: 'text-orange-400 bg-orange-500/10' },
    { name: 'Workplace Dust', val: 'High', color: 'text-amber-400 bg-amber-500/10' },
    { name: 'Sleep Quality', val: '↓ 18%', color: 'text-red-400 bg-red-500/10' }
  ];

  return (
    <div className="absolute inset-0 bg-[#1a172c] text-white p-5 flex flex-col justify-start select-none overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-white/10 z-10">
        <span className="text-[10px] font-bold tracking-widest uppercase text-white/80 flex items-center gap-1.5">
          <TrendingUp size={12} className="text-orange-400" /> Risk Trajectory Model
        </span>
        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
          <AlertTriangle size={9} /> High Trajectory
        </span>
      </div>

      {/* Big Risk Metric */}
      <div className="flex items-center justify-between my-2 z-10">
        <div>
          <span className="text-[9px] font-bold tracking-widest uppercase text-white/50 block">
            7-Day Exacerbation Risk
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">{currentPoint.risk}%</span>
            <span className="text-[11px] font-bold text-orange-400">↑ +24% this week</span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[8px] font-mono text-white/40 block">MODEL CONFIDENCE</span>
          <span className="text-xs font-mono font-bold text-emerald-400">94.8% AUC</span>
        </div>
      </div>

      {/* Animated Risk Trajectory Curve */}
      <div className="relative h-20 bg-black/20 rounded-xl border border-white/5 p-2 overflow-hidden z-10">
        <svg viewBox="0 0 300 55" className="w-full h-full overflow-visible">
          {/* Threshold alert band */}
          <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(239, 68, 68, 0.3)" strokeDasharray="4 3" strokeWidth="1" />
          <text x="290" y="16" textAnchor="end" fill="rgba(239, 68, 68, 0.7)" fontSize="7" fontWeight="bold">ALERT THRESHOLD (65%)</text>

          {/* Risk Line climbing upwards */}
          <motion.path
            d="M 0,48 Q 90,44 160,32 T 240,16 T 300,8"
            fill="none"
            stroke="url(#cardRiskGrad)"
            strokeWidth="3.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />

          <defs>
            <linearGradient id="cardRiskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7C5CFF" />
              <stop offset="60%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* Current apex dot */}
          <motion.circle
            cx="300"
            cy="8"
            r="4.5"
            fill="#ef4444"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </svg>
      </div>

      {/* Contributing Factor Pills */}
      <div className="flex gap-1.5 mt-2.5 z-10 overflow-x-auto pb-1">
        {factors.map((f) => (
          <div key={f.name} className={`px-2 py-1 rounded-md border border-white/5 text-[8px] font-semibold flex items-center gap-1 whitespace-nowrap ${f.color}`}>
            <span>{f.name}:</span>
            <span className="font-bold">{f.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
