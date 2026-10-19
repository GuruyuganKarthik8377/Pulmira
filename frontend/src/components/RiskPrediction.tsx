import { motion } from 'framer-motion';
import { usePatient } from '../context/PatientContext';
import { TrendingUp } from 'lucide-react';

export const RiskPrediction = () => {
  const { currentPoint, patient } = usePatient();
  const isHighRisk = currentPoint.risk >= 65;

  return (
    <section id="risk-prediction" className="py-24 md:py-32 px-6 md:px-12 bg-[#201c33] text-white relative overflow-hidden">
      
      {/* Background glowing effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#7C5CFF]/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-orange-500/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-[1200px] mx-auto relative z-10 flex flex-col items-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-bold tracking-widest uppercase mb-8 border border-white/10">
            <TrendingUp size={12} className="text-[#A294F9]" />
            <span>Risk Prediction · {patient.name}</span>
          </div>
          <h2 className="text-4xl md:text-6xl font-medium leading-[1.05] tracking-tight">
            Anticipate changing risk.
          </h2>
        </motion.div>

        {/* Central Focal Point */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-[800px] bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 md:p-16 mb-12 flex flex-col items-center relative overflow-hidden"
        >
          <div className="text-center z-20">
            <h3 className="text-sm font-bold text-white/50 uppercase tracking-widest mb-6">7-Day Exacerbation Risk</h3>
            <div className="text-7xl md:text-9xl font-medium text-white tracking-tighter mb-4 text-shadow-lg drop-shadow-[0_0_30px_rgba(249,115,22,0.3)]">
              {currentPoint.risk}%
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/20 text-orange-400 font-bold text-sm tracking-wide border border-orange-500/30">
              <span>↑</span> +24% THIS WEEK
            </div>
          </div>

          {/* Dynamic SVG Background Trajectory Chart */}
          <div className="absolute bottom-0 left-0 right-0 h-1/2 opacity-40 pointer-events-none">
            <svg viewBox="0 0 1000 200" className="w-full h-full" preserveAspectRatio="none">
              <motion.path 
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
                d="M 0,160 Q 250,150 450,100 T 750,45 T 1000,12" 
                fill="none" 
                stroke="url(#riskGradient)" 
                strokeWidth="7" 
              />
              <defs>
                <linearGradient id="riskGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.5" />
                  <stop offset="50%" stopColor="#f97316" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </motion.div>

        {/* Previous Pattern Match Alert */}
        {isHighRisk && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-[800px] mb-12 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center justify-center gap-3 text-red-400 font-medium tracking-wide"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs uppercase font-bold tracking-wider">
              Previous Exacerbation Pattern Match Detected · Elevated Intervention Priority
            </span>
          </motion.div>
        )}

        {/* Evidence Cards */}
        <div className="w-full max-w-[1000px] grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { label: 'PM2.5 EXPOSURE', val: `${currentPoint.pm25} μg/m³ (↑ Peak)`, color: 'text-orange-400' },
            { label: 'SpO₂', val: `${currentPoint.spo2}% (Base ${patient.baselineSpo2}%)`, color: 'text-orange-400' },
            { label: 'SLEEP', val: '6h 12m (↓ -18%)', color: 'text-orange-400' },
            { label: 'ACTIVITY', val: '4,120 steps (↓ -31%)', color: 'text-orange-400' },
          ].map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 + (idx * 0.08) }}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6 flex flex-col justify-between h-[120px]"
            >
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{item.label}</span>
              <span className={`text-sm font-bold ${item.color}`}>{item.val}</span>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};
