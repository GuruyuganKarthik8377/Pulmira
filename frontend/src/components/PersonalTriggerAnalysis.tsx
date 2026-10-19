import { motion } from 'framer-motion';
import { usePatient } from '../context/PatientContext';

export const PersonalTriggerAnalysis = () => {
  const { currentPoint, patient } = usePatient();
  const spo2Drop = Math.max(0, Number((patient.baselineSpo2 - currentPoint.spo2).toFixed(1)));

  const triggers = [
    { name: 'PM2.5 Exposure', value: 41 },
    { name: 'Workplace fine dust', value: 29 },
    { name: 'Sleep fragmentation', value: 16 },
    { name: 'Second-hand smoke', value: 9 },
    { name: 'Exertional fatigue', value: 5 },
  ];

  return (
    <section id="triggers" className="py-24 px-6 md:px-12 bg-white relative">
      <div className="max-w-[1000px] mx-auto flex flex-col items-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-6">
            <span>Trigger Analysis</span>
            <span className="w-1 h-1 rounded-full bg-[#7C5CFF]" />
            <span className="text-[10px] text-[#433B68]/60 font-medium">{patient.name}</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-medium text-[#433B68] leading-[1.1] tracking-tight">
            What is affecting<br />
            this patient?
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="w-full bg-[#FAFAFC] rounded-[40px] border border-gray-100 p-8 md:p-12 shadow-xl shadow-[#7C5CFF]/5"
        >
          <div className="mb-12 border-b border-gray-100 pb-12">
            <h3 className="text-sm font-bold text-[#433B68]/50 uppercase tracking-widest mb-8">Personal Trigger Profile</h3>
            
            <div className="flex flex-col gap-6">
              {triggers.map((trigger, idx) => (
                <div key={trigger.name} className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-sm font-medium text-[#433B68]">
                    <span>{trigger.name}</span>
                    <span className="font-semibold">{trigger.value}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: `${trigger.value}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: idx * 0.1, ease: "easeOut" }}
                      className={`h-full rounded-full ${idx === 0 ? 'bg-[#7C5CFF]' : idx === 1 ? 'bg-[#7C5CFF]/70' : 'bg-[#433B68]/40'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-8 justify-between items-start">
            <div className="flex-1">
              <h3 className="text-[10px] font-bold text-[#433B68]/40 uppercase tracking-widest mb-4">Live Correlated Pattern</h3>
              <ul className="flex flex-col gap-3">
                <li className="text-sm font-medium text-[#433B68] flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7C5CFF] mt-1.5 shrink-0" />
                  PM2.5 ambient exposure peaked at {currentPoint.pm25} μg/m³ ({currentPoint.exposureLevel.toLowerCase()} zone).
                </li>
                <li className="text-sm font-medium text-[#433B68] flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                  SpO₂ desaturation observed: {currentPoint.spo2}% ({spo2Drop > 0 ? `-${spo2Drop}%` : 'normal'} vs personal baseline of {patient.baselineSpo2}%).
                </li>
                <li className="text-sm font-medium text-[#433B68] flex items-start gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                  Activity volume reduced by 31% during high-particulate afternoon hours.
                </li>
              </ul>
            </div>
            
            <div className="md:max-w-[240px] bg-[#EAE6FF]/40 rounded-xl p-4 border border-[#7C5CFF]/10 text-xs text-[#433B68]/70 leading-relaxed font-medium">
              Model-associated evidence from continuous multivariate tracking; not standalone proof of causation.
            </div>
          </div>
          
        </motion.div>

      </div>
    </section>
  );
};
