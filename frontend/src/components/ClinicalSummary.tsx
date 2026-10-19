import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Loader2, ArrowDown, ArrowUp, CheckCircle2, Printer } from 'lucide-react';
import { usePatient } from '../context/PatientContext';

export const ClinicalSummary = () => {
  const { patient, currentPoint } = usePatient();
  const [btnState, setBtnState] = useState<'idle' | 'generating' | 'success'>('idle');
  const [isGenerated, setIsGenerated] = useState(false);

  const handleGenerate = () => {
    setBtnState('generating');
    setTimeout(() => {
      setBtnState('success');
      setIsGenerated(true);
      setTimeout(() => {
        setBtnState('idle');
      }, 1800);
    }, 1200);
  };

  const handlePrint = () => {
    window.print();
  };

  const spo2Drop = Number((patient.baselineSpo2 - currentPoint.spo2).toFixed(1));

  return (
    <section id="summary" className="py-24 px-6 md:px-12 bg-white relative">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
        
        {/* Left Content */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-8">
            Clinical Reporting
          </div>
          
          <h2 className="text-4xl md:text-5xl font-medium text-[#433B68] leading-[1.1] tracking-tight mb-6">
            Turn the twin<br />
            into a clear summary.
          </h2>

          <p className="text-[#433B68]/70 text-lg leading-relaxed max-w-[440px] mb-10 font-light">
            Generate an automated clinical briefing combining continuous telemetry, environmental exposure episodes, and model attribution for <b className="font-semibold text-[#433B68]">{patient.name}</b>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative inline-block">
              {btnState === 'generating' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0, 0.5, 0], scale: [1, 1.2, 1.4] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-xl bg-[#7C5CFF]"
                />
              )}
              <button 
                onClick={handleGenerate}
                disabled={btnState !== 'idle'}
                className={`relative flex items-center justify-center gap-3 px-6 py-3.5 min-w-[280px] rounded-xl font-medium text-sm transition-all duration-300 shadow-lg overflow-hidden ${
                  btnState === 'success'
                    ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
                    : btnState === 'generating'
                    ? 'bg-[#7C5CFF] text-white shadow-[#7C5CFF]/40 border border-[#7C5CFF]/50'
                    : 'bg-[#433B68] text-white hover:bg-[#342e50] shadow-[#433B68]/20 hover:-translate-y-0.5'
                }`}
              >
                {/* Shimmer effect while generating */}
                {btnState === 'generating' && (
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-1/2"
                  />
                )}
                
                <div className="relative z-10 flex items-center gap-3">
                  <AnimatePresence mode="wait">
                    {btnState === 'generating' ? (
                      <motion.div key="gen" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-2">
                        <Loader2 size={18} className="animate-spin" />
                        <span>Synthesizing Twin Data...</span>
                      </motion.div>
                    ) : btnState === 'success' ? (
                      <motion.div key="suc" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-2">
                        <CheckCircle2 size={18} />
                        <span>Summary Generated</span>
                      </motion.div>
                    ) : (
                      <motion.div key="idle" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-md bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                          <FileText size={16} />
                        </span>
                        <span>GENERATE CLINICAL SUMMARY</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
            </div>

            {isGenerated && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-xs font-bold text-[#433B68] hover:bg-[#FAFAFC] transition-colors"
              >
                <Printer size={15} />
                <span>Export / Print</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Right - Live Dynamic Report Preview Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="w-full relative"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-[#7C5CFF]/20 to-transparent blur-3xl rounded-full -z-10" />
          
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl p-8 md:p-10 relative overflow-hidden min-h-[480px]">
            
            {!isGenerated && btnState !== 'generating' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/80 backdrop-blur-sm z-20">
                <FileText size={48} className="text-[#433B68]/20 mb-4" />
                <p className="text-sm font-medium text-[#433B68]/70">Click generate to compile {patient.name}'s report</p>
                <span className="text-xs text-[#433B68]/40 mt-1 font-mono">Patient #{patient.id} · {patient.stage}</span>
              </div>
            )}

            {btnState === 'generating' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20">
                <Loader2 size={40} className="text-[#7C5CFF] animate-spin mb-6" />
                <div className="flex flex-col items-center gap-2">
                  <div className="h-2 w-48 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }} 
                      animate={{ width: "100%" }} 
                      transition={{ duration: 1.2, ease: "linear" }}
                      className="h-full bg-[#7C5CFF]" 
                    />
                  </div>
                  <p className="text-xs font-bold tracking-widest text-[#433B68]/50 uppercase">Synthesizing Twin State...</p>
                </div>
              </div>
            )}

            <AnimatePresence>
              {isGenerated && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="flex flex-col h-full"
                >
                  <div className="flex justify-between items-start border-b border-gray-100 pb-5 mb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[10px] font-bold text-[#7C5CFF] uppercase tracking-widest">
                          PATIENT #{patient.id} · {patient.name.toUpperCase()}
                        </h3>
                        <span className="text-[9px] text-gray-400 font-mono">AGE {patient.age}</span>
                      </div>
                      <h4 className="text-lg font-semibold text-[#433B68] mt-0.5">COPD DIGITAL TWIN CLINICAL SUMMARY</h4>
                      <p className="text-xs text-[#433B68]/60 font-medium">{patient.diagnosis} ({patient.stage})</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-0.5">Current state</div>
                      <div className={`text-sm font-bold uppercase ${currentPoint.state === 'WORSENING' ? 'text-orange-600' : 'text-emerald-600'}`}>
                        {currentPoint.state}
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 flex justify-between items-end">
                    <div>
                      <div className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-widest mb-1">7-DAY EXACERBATION RISK</div>
                      <div className="text-4xl font-medium text-[#433B68]">{currentPoint.risk}%</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 uppercase tracking-wider block">Observed At</span>
                      <span className="text-xs font-mono font-bold text-[#433B68]">{currentPoint.time} · {currentPoint.location}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                      <div className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-widest mb-3">KEY VARIATIONS</div>
                      <ul className="flex flex-col gap-2.5">
                        <li className="flex items-center gap-2 text-xs text-[#433B68] font-medium">
                          <ArrowDown size={13} className="text-red-500" /> SpO₂ {currentPoint.spo2}% ({spo2Drop > 0 ? `-${spo2Drop}%` : `${Math.abs(spo2Drop)}%`}, base {patient.baselineSpo2}%)
                        </li>
                        <li className="flex items-center gap-2 text-xs text-[#433B68] font-medium">
                          <ArrowUp size={13} className="text-orange-500" /> Heart Rate {currentPoint.hr} BPM (base {patient.baselineHr})
                        </li>
                        <li className="flex items-center gap-2 text-xs text-[#433B68] font-medium">
                          <ArrowUp size={13} className="text-red-500" /> PM2.5 Peak {currentPoint.pm25} μg/m³
                        </li>
                        <li className="flex items-center gap-2 text-xs text-[#433B68] font-medium">
                          <ArrowUp size={13} className="text-red-500" /> AQI {currentPoint.aqi} ({currentPoint.exposureLevel})
                        </li>
                      </ul>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-widest mb-3">MODEL-ASSOCIATED FACTORS</div>
                      <ul className="flex flex-col gap-2">
                        <li className="text-xs text-[#433B68]/80 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7C5CFF]" /> PM2.5 Inhalation Exposure (41% weight)
                        </li>
                        <li className="text-xs text-[#433B68]/80 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7C5CFF]" /> Workplace Fine Dust (29% weight)
                        </li>
                        <li className="text-xs text-[#433B68]/80 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7C5CFF]" /> Sleep Fragmentation (16% weight)
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-widest mb-1">ACTIVE CLINICAL ALERT</div>
                      <div className="text-xs font-semibold text-red-600">
                        {patient.activeAlert?.title || 'Stable parameters recorded'}
                      </div>
                    </div>

                    <span className="text-[10px] px-2 py-1 rounded bg-gray-100 text-gray-600 font-mono">
                      Rx: {patient.medicationStatus}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
      </div>
    </section>
  );
};
