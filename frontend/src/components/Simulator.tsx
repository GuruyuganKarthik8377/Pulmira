import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Check, Sparkles, TrendingDown, Info } from 'lucide-react';
import { usePatient, SIMULATION_SCENARIOS } from '../context/PatientContext';

export const Simulator = () => {
  const {
    currentPoint,
    activeScenarioIds,
    toggleScenario,
    simulatedRisk,
    simulatedSpo2,
    simulatedExposureLevel
  } = usePatient();

  const getRiskColor = (risk: number) => {
    if (risk < 45) return 'text-emerald-600';
    if (risk < 65) return 'text-amber-500';
    return 'text-orange-600';
  };

  const getBgColor = (risk: number) => {
    if (risk < 45) return 'rgba(16, 185, 129, 0.04)';
    if (risk < 65) return 'rgba(245, 158, 11, 0.04)';
    return 'rgba(249, 115, 22, 0.04)';
  };

  const riskReduction = currentPoint.risk - simulatedRisk;
  const spo2Delta = Number((simulatedSpo2 - currentPoint.spo2).toFixed(1));

  return (
    <section id="simulator" className="py-24 px-6 md:px-12 bg-white relative">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-center">
        
        {/* Left Column: Interactive Scenario Controls */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-8">
              <Sparkles size={12} />
              <span>What-If Simulator</span>
            </div>
            
            <h2 className="text-4xl md:text-[56px] font-medium text-[#433B68] leading-[1.05] mb-6 tracking-tight">
              What if the<br />
              environment<br />
              changed?
            </h2>
            
            <p className="text-[#433B68]/70 text-lg leading-relaxed max-w-[440px] mb-8 font-light">
              Explore deterministic simulated interventions using the patient's live twin state. Select scenarios to combine their effects.
            </p>

            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-bold text-[#433B68]/40 uppercase tracking-widest mb-1">
                Select Simulation Scenarios
              </span>
              
              {SIMULATION_SCENARIOS.map((s) => {
                const isSelected = activeScenarioIds.includes(s.id);

                return (
                  <button
                    key={s.id}
                    onClick={() => toggleScenario(s.id)}
                    className={`text-left px-5 py-3.5 rounded-2xl border transition-all duration-300 font-medium flex items-center justify-between group ${
                      isSelected
                        ? 'bg-[#433B68] border-[#433B68] text-white shadow-lg shadow-[#433B68]/15 -translate-y-0.5'
                        : 'bg-white border-gray-200 text-[#433B68] hover:border-[#7C5CFF]/40 hover:bg-[#FAFAFC]'
                    }`}
                  >
                    <div className="flex flex-col pr-2">
                      <span className="text-sm font-semibold leading-snug">{s.label}</span>
                      <span className={`text-[11px] font-light mt-0.5 line-clamp-1 ${isSelected ? 'text-white/70' : 'text-[#433B68]/50'}`}>
                        {s.description}
                      </span>
                    </div>

                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-[#7C5CFF] text-white' : 'border border-gray-200 text-transparent group-hover:border-[#7C5CFF]/50'
                    }`}>
                      <Check size={14} className={isSelected ? 'opacity-100' : 'opacity-0'} />
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Dynamic Simulation Results & Trajectory */}
        <div className="lg:col-span-7 flex flex-col">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            animate={{ backgroundColor: getBgColor(simulatedRisk) }}
            className="w-full rounded-[36px] border border-gray-100 p-8 md:p-12 shadow-2xl shadow-[#7C5CFF]/5 transition-colors duration-700 ease-out"
          >
            {/* Header comparison badge */}
            <div className="flex justify-between items-center pb-6 border-b border-gray-100 mb-8">
              <span className="text-xs font-bold text-[#433B68]/60 uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={14} className="text-[#7C5CFF]" />
                Comparative Twin Projection
              </span>

              {riskReduction > 0 ? (
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-700 flex items-center gap-1">
                  <TrendingDown size={14} /> -{riskReduction}% Risk Reduction Projected
                </span>
              ) : (
                <span className="text-xs font-medium text-[#433B68]/40">
                  Select a scenario to model intervention
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-8 md:gap-14">
              
              {/* CURRENT OBSERVED STATE */}
              <div className="flex flex-col gap-6">
                <div className="pb-3 border-b border-gray-200">
                  <h3 className="text-xs font-bold text-[#433B68]/40 uppercase tracking-widest">
                    Current Observed State
                  </h3>
                  <span className="text-[10px] text-[#433B68]/40 font-mono">Patient #042 · Live Signal</span>
                </div>

                <div className="flex flex-col gap-5">
                  <div>
                    <div className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-wider mb-0.5">7-Day Risk</div>
                    <div className="text-4xl font-medium text-orange-600">{currentPoint.risk}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-wider mb-0.5">SpO₂</div>
                    <div className="text-3xl font-medium text-[#433B68]">{currentPoint.spo2}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-wider mb-0.5">Exposure Level</div>
                    <div className="text-xl font-medium text-orange-600 uppercase">{currentPoint.exposureLevel}</div>
                  </div>
                </div>
              </div>

              {/* SIMULATED MODEL STATE */}
              <div className="flex flex-col gap-6 relative">
                <div className="pb-3 border-b border-[#7C5CFF]/20">
                  <h3 className="text-xs font-bold text-[#7C5CFF] uppercase tracking-widest">
                    Simulated State
                  </h3>
                  <span className="text-[10px] text-[#7C5CFF]/70 font-mono">
                    {activeScenarioIds.length} Scenario{activeScenarioIds.length !== 1 ? 's' : ''} Applied
                  </span>
                </div>
                
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${simulatedRisk}-${simulatedSpo2}-${activeScenarioIds.join('-')}`}
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -15 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className="flex flex-col gap-5"
                  >
                    <div>
                      <div className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-wider mb-0.5">Simulated Risk</div>
                      <div className={`text-4xl font-medium ${getRiskColor(simulatedRisk)} flex items-baseline gap-2`}>
                        <span>{simulatedRisk}%</span>
                        {riskReduction > 0 && (
                          <span className="text-sm font-semibold text-emerald-600">↓ {riskReduction}%</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-wider mb-0.5">Simulated SpO₂</div>
                      <div className="text-3xl font-medium text-[#433B68] flex items-baseline gap-2">
                        <span>{simulatedSpo2}%</span>
                        {spo2Delta > 0 && (
                          <span className="text-sm font-semibold text-emerald-600">+{spo2Delta}%</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-wider mb-0.5">Simulated Exposure</div>
                      <div className={`text-xl font-medium uppercase ${simulatedExposureLevel === 'LOW' ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {simulatedExposureLevel}
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

            </div>

            {/* Comparative Trajectory Curve Visualization */}
            <div className="mt-10 pt-6 border-t border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-widest">
                  Simulated Risk Trajectory Comparison
                </span>
                <div className="flex items-center gap-4 text-[10px] font-semibold">
                  <span className="flex items-center gap-1.5 text-orange-600">
                    <span className="w-3 h-0.5 bg-orange-600 inline-block" /> Current (78%)
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-3 h-0.5 bg-emerald-500 inline-block border-t border-dashed" /> Simulated ({simulatedRisk}%)
                  </span>
                </div>
              </div>

              <div className="h-20 w-full bg-white/70 rounded-2xl border border-gray-100 p-2 overflow-hidden">
                <svg viewBox="0 0 500 60" className="w-full h-full overflow-visible">
                  {/* Current unmitigated trajectory curve (rising up) */}
                  <path
                    d="M 10,48 Q 150,42 280,24 T 490,12"
                    fill="none"
                    stroke="#ea580c"
                    strokeWidth="2.5"
                  />
                  <circle cx="490" cy="12" r="3.5" fill="#ea580c" />

                  {/* Simulated mitigated trajectory curve (diverging down) */}
                  <motion.path
                    key={`traj-${simulatedRisk}`}
                    d={`M 10,48 Q 150,42 280,32 T 490,${Math.min(52, 12 + (currentPoint.risk - simulatedRisk) * 0.7)}`}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeDasharray="5 3"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.8 }}
                  />
                  <circle
                    cx="490"
                    cy={Math.min(52, 12 + (currentPoint.risk - simulatedRisk) * 0.7)}
                    r="4"
                    fill="#10b981"
                  />
                </svg>
              </div>
            </div>

            {/* Medical / Scientific Model Disclosure */}
            <div className="mt-8 pt-5 border-t border-gray-200 flex items-start gap-3">
              <Info size={16} className="text-[#433B68]/40 mt-0.5 shrink-0" />
              <p className="text-xs text-[#433B68]/60 leading-relaxed font-light">
                Illustrative model simulation for clinical decision support. Not a clinically validated treatment recommendation or autonomous predictive model.
              </p>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
};
