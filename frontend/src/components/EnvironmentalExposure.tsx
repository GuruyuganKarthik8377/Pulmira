import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Info, MapPin, Wind, Thermometer, Clock, ShieldAlert } from 'lucide-react';
import { usePatient } from '../context/PatientContext';

export const EnvironmentalExposure = () => {
  const { currentPoint, timelineIndex, setTimelineIndex, patient } = usePatient();
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);

  const waypoints = [
    { id: 'HOME', name: 'Residential Quarter', coords: { x: 180, y: 160 }, type: 'HOME', pm25: 18, aqi: 45, label: 'Home' },
    { id: 'TRANSIT_AM', name: 'Metro Arterial Corridor', coords: { x: 340, y: 220 }, type: 'TRANSIT', pm25: 42, aqi: 108, label: 'Transit' },
    { id: 'WORK', name: 'Industrial Workshop Hangar', coords: { x: 520, y: 280 }, type: 'WORK', pm25: 68, aqi: 152, label: 'Work' },
    { id: 'OUTDOOR', name: 'Open Logistics Yard', coords: { x: 740, y: 210 }, type: 'OUTDOOR', pm25: 78, aqi: 164, label: 'Outdoor' },
    { id: 'TRANSIT_PM', name: 'Suburban Commute Route', coords: { x: 380, y: 340 }, type: 'TRANSIT', pm25: 46, aqi: 115, label: 'Commute' }
  ];

  const getExposureBadgeColor = (level: string) => {
    switch (level) {
      case 'LOW':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'MODERATE':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'HIGH':
      case 'VERY HIGH':
      default:
        return 'text-orange-600 bg-orange-50 border-orange-200';
    }
  };

  return (
    <section id="exposure" className="py-24 md:py-32 px-6 md:px-12 bg-white relative">
      <div className="max-w-[1400px] mx-auto flex flex-col items-center">
        
        {/* Section Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-8">
            Environmental Exposure
          </div>
          <h2 className="text-4xl md:text-6xl font-medium text-[#433B68] leading-[1.05] tracking-tight">
            Where the patient goes<br />
            changes what the twin sees.
          </h2>
        </motion.div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* Main Interactive Map & Timeline Control Area */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="w-full aspect-[4/3] md:aspect-[16/10] rounded-[40px] overflow-hidden shadow-2xl shadow-[#7C5CFF]/10 relative bg-[#181428] border border-[#3b3259]/30 flex flex-col justify-between p-6 md:p-8"
            >
              {/* Map Canvas SVG (Zero Screenshots) */}
              <div className="absolute inset-0 z-0">
                <svg viewBox="0 0 900 480" className="w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <radialGradient id="industrialSmoke" cx="80%" cy="40%" r="45%">
                      <stop offset="0%" stopColor="rgba(249, 115, 22, 0.35)" />
                      <stop offset="60%" stopColor="rgba(249, 115, 22, 0.12)" />
                      <stop offset="100%" stopColor="rgba(24, 20, 40, 0)" />
                    </radialGradient>
                    <radialGradient id="greenZone" cx="20%" cy="30%" r="35%">
                      <stop offset="0%" stopColor="rgba(16, 185, 129, 0.25)" />
                      <stop offset="70%" stopColor="rgba(16, 185, 129, 0.05)" />
                      <stop offset="100%" stopColor="rgba(24, 20, 40, 0)" />
                    </radialGradient>
                  </defs>

                  {/* Regional Environmental Atmospheric Overlays */}
                  <rect x="0" y="0" width="900" height="480" fill="#151224" />
                  <rect x="0" y="0" width="450" height="480" fill="url(#greenZone)" />
                  <rect x="450" y="0" width="450" height="480" fill="url(#industrialSmoke)" />

                  {/* Water / River Channel */}
                  <path
                    d="M 280,0 Q 320,160 310,260 T 360,480"
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.2)"
                    strokeWidth="32"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 280,0 Q 320,160 310,260 T 360,480"
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.35)"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />

                  {/* Street & Boulevard Grid */}
                  <line x1="0" y1="120" x2="900" y2="120" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                  <line x1="0" y1="240" x2="900" y2="240" stroke="rgba(255,255,255,0.07)" strokeWidth="16" />
                  <line x1="0" y1="380" x2="900" y2="380" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                  <line x1="160" y1="0" x2="160" y2="480" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
                  <line x1="450" y1="0" x2="450" y2="480" stroke="rgba(255,255,255,0.07)" strokeWidth="16" />
                  <line x1="720" y1="0" x2="720" y2="480" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />

                  {/* Urban Blocks / Buildings Geometry */}
                  {[
                    { x: 40, y: 30, w: 90, h: 60 },
                    { x: 190, y: 30, w: 70, h: 60 },
                    { x: 40, y: 150, w: 90, h: 70 },
                    { x: 190, y: 150, w: 70, h: 70 },
                    { x: 40, y: 270, w: 90, h: 80 },
                    { x: 190, y: 270, w: 70, h: 80 },
                    { x: 480, y: 30, w: 100, h: 70 },
                    { x: 610, y: 30, w: 80, h: 70 },
                    { x: 750, y: 30, w: 120, h: 70 },
                    { x: 480, y: 150, w: 100, h: 70 },
                    { x: 610, y: 150, w: 80, h: 70 },
                    { x: 480, y: 270, w: 100, h: 80 },
                    { x: 610, y: 270, w: 80, h: 80 },
                    { x: 750, y: 270, w: 120, h: 80 },
                  ].map((b, idx) => (
                    <rect
                      key={idx}
                      x={b.x}
                      y={b.y}
                      width={b.w}
                      height={b.h}
                      rx="6"
                      fill="rgba(255,255,255,0.025)"
                      stroke="rgba(255,255,255,0.04)"
                      strokeWidth="1"
                    />
                  ))}

                  {/* Route Trajectory Ribbon */}
                  <path
                    d="M 180,160 Q 260,190 340,220 T 520,280 Q 640,240 740,210 Q 560,320 380,340 T 180,160"
                    fill="none"
                    stroke="#7C5CFF"
                    strokeWidth="3.5"
                    strokeDasharray="6 4"
                    opacity="0.8"
                  />

                  {/* Waypoint Pins */}
                  {waypoints.map((wp) => {
                    const isSelected = currentPoint.locationType === wp.type || selectedWaypoint === wp.id;
                    const color = wp.type === 'HOME' ? '#10b981' : wp.type === 'OUTDOOR' ? '#f97316' : wp.type === 'WORK' ? '#eab308' : '#7C5CFF';

                    return (
                      <g
                        key={wp.id}
                        className="cursor-pointer transition-transform duration-300"
                        onClick={() => setSelectedWaypoint(wp.id)}
                      >
                        {/* Outer Glow Halo */}
                        {isSelected && (
                          <circle cx={wp.coords.x} cy={wp.coords.y} r="22" fill={color} opacity="0.25" className="animate-pulse" />
                        )}
                        <circle cx={wp.coords.x} cy={wp.coords.y} r={isSelected ? "11" : "8"} fill={color} stroke="#ffffff" strokeWidth="2.5" />
                        <rect
                          x={wp.coords.x - 36}
                          y={wp.coords.y + 14}
                          width="72"
                          height="18"
                          rx="4"
                          fill="rgba(0,0,0,0.75)"
                          stroke="rgba(255,255,255,0.15)"
                          strokeWidth="0.8"
                        />
                        <text
                          x={wp.coords.x}
                          y={wp.coords.y + 26}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize="9"
                          fontWeight="bold"
                          letterSpacing="0.04em"
                        >
                          {wp.label} ({wp.aqi})
                        </text>
                      </g>
                    );
                  })}

                  {/* Dynamic Moving Patient Position Beacon */}
                  <motion.g
                    animate={{
                      x: currentPoint.mapCoords.x,
                      y: currentPoint.mapCoords.y
                    }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  >
                    <circle cx="0" cy="0" r="28" fill="#7C5CFF" opacity="0.25" className="animate-ping" />
                    <circle cx="0" cy="0" r="14" fill="#ffffff" stroke="#7C5CFF" strokeWidth="4" />
                    <circle cx="0" cy="0" r="5" fill="#7C5CFF" />
                  </motion.g>
                </svg>
              </div>

              {/* Top Map HUD Bar */}
              <div className="relative z-10 flex items-center justify-between">
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    Live GPS & Environmental Sensor Telemetry
                  </span>
                </div>

                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                  <MapPin size={14} className="text-[#A294F9]" />
                  <span className="text-xs font-bold text-white/90">
                    {currentPoint.location}
                  </span>
                </div>
              </div>

              {/* Bottom Interactive Time Scrubber Card */}
              <div className="relative z-10 bg-black/70 backdrop-blur-xl rounded-3xl p-5 border border-white/15 flex flex-col gap-4 shadow-2xl">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold tracking-widest text-[#A294F9] uppercase flex items-center gap-2">
                    <Clock size={14} /> Patient Timeline Scrub · Tuesday
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-white/60">Selected Time:</span>
                    <span className="px-3 py-1 rounded-lg bg-[#7C5CFF] text-white font-mono font-bold text-sm shadow">
                      {currentPoint.time}
                    </span>
                  </div>
                </div>

                {/* Range Slider Track */}
                <div className="relative flex flex-col gap-2">
                  <input
                    type="range"
                    min="0"
                    max={patient.timeline.length - 1}
                    step="1"
                    value={timelineIndex}
                    onChange={(e) => setTimelineIndex(Number(e.target.value))}
                    className="w-full h-2.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#7C5CFF]"
                    aria-label="Historical time slider"
                  />

                  {/* Timeline Pills */}
                  <div className="flex justify-between mt-1 px-1">
                    {patient.timeline.map((tp, i) => (
                      <button
                        key={tp.id}
                        onClick={() => setTimelineIndex(i)}
                        className={`text-[10px] font-bold tracking-wider uppercase transition-all px-2 py-1 rounded-md ${
                          i === timelineIndex
                            ? 'bg-white text-[#433B68] shadow-md scale-105'
                            : 'text-white/50 hover:text-white'
                        }`}
                      >
                        {tp.time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Sidebar: Real-Time Synced State & Impact Metrics */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Patient Route Step Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-[#FAFAFC] border border-gray-100 rounded-3xl p-6 md:p-8"
            >
              <h3 className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-widest mb-4">Patient Movement Path</h3>
              <div className="flex items-center justify-between text-xs font-semibold text-[#433B68] uppercase tracking-wide">
                <span className={currentPoint.locationType === 'HOME' ? 'text-[#7C5CFF] font-bold scale-105' : 'text-[#433B68]/60'}>HOME</span>
                <ArrowRight size={13} className="text-[#7C5CFF]" />
                <span className={currentPoint.locationType === 'WORK' ? 'text-[#7C5CFF] font-bold scale-105' : 'text-[#433B68]/60'}>WORK</span>
                <ArrowRight size={13} className="text-[#7C5CFF]" />
                <span className={currentPoint.locationType === 'OUTDOOR' ? 'text-orange-600 font-bold scale-105' : 'text-[#433B68]/60'}>OUTDOOR</span>
                <ArrowRight size={13} className="text-[#7C5CFF]" />
                <span className={currentPoint.locationType === 'HOME' && timelineIndex >= 6 ? 'text-[#7C5CFF] font-bold scale-105' : 'text-[#433B68]/60'}>HOME</span>
              </div>
            </motion.div>

            {/* Environmental Synchronized State Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-xl shadow-[#7C5CFF]/5"
            >
              <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-5">
                <div>
                  <h3 className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-widest mb-1">Environmental State</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${getExposureBadgeColor(currentPoint.exposureLevel)}`}>
                      {currentPoint.exposureLevel} EXPOSURE
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-[#433B68]/40 uppercase tracking-widest block">Timestamp</span>
                  <span className="text-sm font-bold text-[#433B68] font-mono">{currentPoint.time}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6 mb-7">
                <div className="p-3 bg-gray-50/70 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-widest flex items-center gap-1">
                    <Wind size={12} className="text-[#7C5CFF]" /> PM2.5
                  </span>
                  <div className="text-3xl font-semibold text-[#433B68] mt-1">
                    {currentPoint.pm25} <span className="text-xs text-[#433B68]/50">μg/m³</span>
                  </div>
                </div>

                <div className="p-3 bg-gray-50/70 rounded-2xl border border-gray-100">
                  <span className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-widest flex items-center gap-1">
                    <Thermometer size={12} className="text-orange-500" /> AQI
                  </span>
                  <div className={`text-3xl font-semibold mt-1 ${currentPoint.aqi > 100 ? 'text-orange-600' : 'text-[#433B68]'}`}>
                    {currentPoint.aqi}
                  </div>
                </div>
              </div>
              
              {/* Co-Dependent Physiological Twin Response Card */}
              <div className="bg-[#EAE6FF]/40 rounded-2xl p-5 border border-[#7C5CFF]/15 relative">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold text-[#7C5CFF] uppercase tracking-widest">
                    Model-Associated Relationship
                  </span>
                  <Info size={13} className="text-[#7C5CFF]/60" />
                </div>
                
                <div className="flex flex-col gap-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-[#433B68]">SpO₂ Response</span>
                    <div className="flex items-center gap-2 font-bold text-[#433B68]">
                      <span>{patient.baselineSpo2}%</span>
                      <ArrowRight size={13} className="text-[#433B68]/40" />
                      <span className={currentPoint.spo2 < patient.baselineSpo2 ? 'text-orange-600' : 'text-emerald-600'}>
                        {currentPoint.spo2}%
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-[#433B68]">Heart Rate Impact</span>
                    <span className="font-bold text-[#433B68]">
                      {currentPoint.hr} BPM <span className="text-xs text-[#433B68]/50">(Base {patient.baselineHr})</span>
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-[#433B68]">Twin Risk Estimate</span>
                    <span className="font-bold text-orange-600 flex items-center gap-1">
                      {currentPoint.risk}% {currentPoint.risk > 50 && <ShieldAlert size={14} />}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#7C5CFF]/15 text-[11px] text-[#433B68]/70 leading-relaxed font-light">
                  {currentPoint.notes}
                </div>
              </div>
            </motion.div>

          </div>

        </div>
      </div>
    </section>
  );
};
