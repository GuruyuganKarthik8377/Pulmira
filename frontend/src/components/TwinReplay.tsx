import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePatient } from '../context/PatientContext';
import { Play, RotateCcw, Activity } from 'lucide-react';

export const TwinReplay = () => {
  const { currentPoint, patient } = usePatient();
  const [sliderIndex, setSliderIndex] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);

  const replayData = useMemo(() => [
    { day: 'DAY 1', spo2: patient.baselineSpo2, risk: 24, env: 'LOW', state: 'STABLE', color: 'text-emerald-500', halo: 'rgba(16, 185, 129, 0.2)' },
    { day: 'DAY 5', spo2: patient.baselineSpo2, risk: 32, env: 'MODERATE', state: 'STABLE', color: 'text-emerald-500', halo: 'rgba(16, 185, 129, 0.25)' },
    { day: 'DAY 10', spo2: patient.baselineSpo2 - 2, risk: 51, env: 'MODERATE', state: 'MONITORING', color: 'text-yellow-500', halo: 'rgba(234, 179, 8, 0.3)' },
    { day: 'DAY 15', spo2: patient.baselineSpo2 - 3, risk: 65, env: 'HIGH', state: 'MONITORING', color: 'text-yellow-500', halo: 'rgba(245, 158, 11, 0.35)' },
    { day: 'TODAY', spo2: currentPoint.spo2, risk: currentPoint.risk, env: currentPoint.exposureLevel, state: currentPoint.state, color: currentPoint.state === 'WORSENING' ? 'text-orange-500' : 'text-emerald-500', halo: 'rgba(249, 115, 22, 0.45)' },
  ], [patient, currentPoint]);

  const currentData = replayData[sliderIndex];

  const handlePlayToggle = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    let step = 0;
    const interval = setInterval(() => {
      setSliderIndex((prev) => {
        if (prev >= 4) {
          clearInterval(interval);
          setIsPlaying(false);
          return 4;
        }
        return prev + 1;
      });
      step++;
      if (step >= 5) {
        clearInterval(interval);
        setIsPlaying(false);
      }
    }, 900);
  };

  return (
    <section id="twin-replay" className="py-24 px-6 md:px-12 bg-[#FAFAFC] relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto flex flex-col items-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-8">
            <Activity size={12} />
            <span>Temporal Digital Twin Replay</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-medium text-[#433B68] leading-[1.1] tracking-tight">
            Replay the patient's<br />
            changing state.
          </h2>
        </motion.div>

        {/* Digital Twin Replay Visual Area */}
        <div className="w-full max-w-[1000px] bg-white rounded-[40px] shadow-2xl shadow-[#7C5CFF]/5 border border-[#433B68]/5 p-8 md:p-12 relative">
          
          <div className="flex flex-col md:flex-row gap-12 items-center">
            
            {/* Visual with Dynamic Pulmonary State Glow */}
            <div className="flex-1 relative flex justify-center items-center h-[300px] md:h-[400px] rounded-3xl overflow-hidden bg-[#EAE6FF]/30 w-full">
              <img 
                src="/assets/digital_lung_1791213475161.jpg" 
                alt="Twin Replay Anatomical Lung Asset" 
                className="w-full h-full object-cover mix-blend-multiply opacity-80"
              />
              
              {/* Dynamic State Overlay */}
              <AnimatePresence mode="wait">
                <motion.div 
                  key={sliderIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{
                    boxShadow: `inset 0 0 80px ${currentData.halo}`
                  }}
                />
              </AnimatePresence>

              {/* Day Stamp Badge */}
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-gray-100 text-xs font-bold text-[#433B68]">
                Snapshot: {currentData.day}
              </div>
            </div>

            {/* Metrics Panel */}
            <div className="w-full md:w-[320px] shrink-0 flex flex-col gap-8">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={sliderIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="grid grid-cols-2 gap-6"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-[#433B68]/50 uppercase tracking-widest">Day</span>
                    <span className="text-2xl font-medium text-[#433B68]">{currentData.day}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-[#433B68]/50 uppercase tracking-widest">Twin State</span>
                    <span className={`text-lg font-medium ${currentData.color}`}>{currentData.state}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-[#433B68]/50 uppercase tracking-widest">SpO₂</span>
                    <span className="text-3xl font-medium text-[#433B68]">{currentData.spo2}%</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-[#433B68]/50 uppercase tracking-widest">Risk</span>
                    <span className="text-3xl font-medium text-[#433B68]">{currentData.risk}%</span>
                  </div>
                  <div className="flex flex-col gap-1 col-span-2">
                    <span className="text-[11px] font-bold text-[#433B68]/50 uppercase tracking-widest">Environment Exposure</span>
                    <span className="text-lg font-medium text-[#433B68]">{currentData.env}</span>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Play Replay Animation & Reset Buttons */}
              <div className="flex gap-2 w-full">
                <button
                  onClick={handlePlayToggle}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-[#433B68] hover:bg-[#FAFAFC] hover:border-[#7C5CFF]/30 transition-all"
                >
                  {isPlaying ? (
                    <>Replaying State Sequence...</>
                  ) : (
                    <>
                      <Play size={13} className="text-[#7C5CFF]" />
                      Play Longitudinal Replay
                    </>
                  )}
                </button>
                <button
                  onClick={() => setSliderIndex(0)}
                  className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-[#433B68] hover:bg-[#FAFAFC] hover:border-[#7C5CFF]/30 transition-all flex items-center justify-center"
                  title="Reset to Day 1"
                  aria-label="Reset to Day 1"
                >
                  <RotateCcw size={13} className="text-[#433B68]/60" />
                </button>
              </div>
            </div>

          </div>

          {/* Interactive Timeline Slider */}
          <div className="mt-14 pt-8 border-t border-gray-100 relative">
            <input 
              type="range" 
              min="0" 
              max="4" 
              step="1"
              value={sliderIndex}
              onChange={(e) => setSliderIndex(parseInt(e.target.value))}
              className="w-full h-2.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#7C5CFF]"
              aria-label="Replay timeline slider"
            />
            <div className="flex justify-between mt-4 px-1">
              {replayData.map((d, i) => (
                <button 
                  key={i} 
                  className={`text-xs font-semibold tracking-wider uppercase transition-all ${
                    i === sliderIndex ? 'text-[#7C5CFF] font-bold scale-110' : 'text-[#433B68]/40 hover:text-[#433B68]/70'
                  }`}
                  onClick={() => setSliderIndex(i)}
                >
                  {d.day}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
