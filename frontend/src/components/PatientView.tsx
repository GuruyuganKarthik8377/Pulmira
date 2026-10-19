import { motion } from 'framer-motion';
import { Wind, ShieldCheck, Heart, Activity } from 'lucide-react';
import { usePatient } from '../context/PatientContext';

export const PatientView = () => {
  const { patient, currentPoint } = usePatient();
  const firstName = patient.name.split(' ')[0] || 'Patient';

  // Dynamic styling based on current state
  const isWorsening = currentPoint.state === 'WORSENING';
  const isElevated = currentPoint.state === 'ELEVATED';
  const isMonitoring = currentPoint.state === 'MONITORING';
  const statusColor = isWorsening ? 'text-amber-600' : isElevated ? 'text-orange-500' : isMonitoring ? 'text-amber-500' : 'text-emerald-600';
  const statusBg = isWorsening ? 'bg-amber-500' : isElevated ? 'bg-orange-500' : isMonitoring ? 'bg-amber-400' : 'bg-emerald-500';

  return (
    <section className="py-24 px-6 md:px-12 bg-[#FAFAFC] relative">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-16 lg:gap-24">
        
        {/* Left - Phone Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="w-full md:w-[340px] shrink-0"
        >
          {/* Phone Frame */}
          <div className="w-[300px] md:w-[320px] h-[640px] bg-white rounded-[48px] border-[12px] border-gray-900 shadow-2xl relative overflow-hidden mx-auto">
            
            {/* Notch */}
            <div className="absolute top-0 inset-x-0 h-6 bg-gray-900 rounded-b-2xl w-32 mx-auto z-20" />

            {/* App UI */}
            <div className="absolute inset-0 bg-[#FAFAFC] pt-12 flex flex-col">
              
              {/* Header */}
              <div className="px-6 pb-6">
                <span className="text-sm font-semibold tracking-wide text-[#433B68]">Hi, {firstName}</span>
                <h3 className="text-2xl font-medium text-[#433B68] mt-1 tracking-tight">Today's Outlook</h3>
              </div>

              <div className="px-6 flex flex-col gap-4 overflow-y-auto pb-8">
                
                {/* Status Card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3 relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-24 h-24 ${isWorsening ? 'bg-amber-50' : 'bg-emerald-50'} rounded-full blur-xl -mr-8 -mt-8 pointer-events-none`} />
                  <span className="text-[10px] font-bold tracking-widest text-[#433B68]/40 uppercase">Your Respiratory Status</span>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${statusBg} shadow-[0_0_12px_rgba(16,185,129,0.5)]`} />
                    <span className={`text-xl font-medium ${statusColor}`}>{currentPoint.state}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100/80 text-xs text-[#433B68]/60 font-medium">
                    <span className="flex items-center gap-1.5"><Heart size={12} className="text-rose-500" /> SpO₂: <strong className="text-[#433B68]">{currentPoint.spo2}%</strong></span>
                    <span className="flex items-center gap-1.5"><Activity size={12} className="text-[#7C5CFF]" /> HR: <strong className="text-[#433B68]">{currentPoint.hr} bpm</strong></span>
                  </div>
                </div>

                {/* Insight Card */}
                <div className={`${currentPoint.aqi > 90 ? 'bg-orange-50/60 border-orange-100' : 'bg-blue-50/50 border-blue-100'} rounded-2xl p-5 border flex flex-col gap-4`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold tracking-widest ${currentPoint.aqi > 90 ? 'text-orange-600/70' : 'text-blue-600/70'} uppercase flex items-center gap-2`}>
                      <Wind size={12} /> Air Quality • {currentPoint.location}
                    </span>
                    <span className={`text-xs font-bold uppercase ${currentPoint.aqi > 90 ? 'text-orange-600' : 'text-blue-600'}`}>
                      {currentPoint.exposureLevel}
                    </span>
                  </div>
                  
                  <p className="text-sm text-[#433B68]/80 font-medium leading-relaxed">
                    {currentPoint.aqi > 100 
                      ? `Particulate levels (${currentPoint.pm25} µg/m³) are elevated near ${currentPoint.location}.`
                      : `Ambient conditions are moderate (${currentPoint.pm25} µg/m³ PM2.5).`}
                  </p>
                  
                  <div className="bg-white/70 p-3.5 rounded-xl flex items-start gap-3 mt-1 shadow-xs">
                    <ShieldCheck size={18} className="text-[#7C5CFF] mt-0.5 shrink-0" />
                    <p className="text-xs text-[#433B68]/70 leading-relaxed font-medium">
                      {isWorsening 
                        ? 'Follow your prescribed COPD action plan and limit strenuous outdoor activity.'
                        : 'Routine activity is safe. Maintain baseline hydration and rescue inhaler proximity.'}
                    </p>
                  </div>
                </div>

              </div>
              
              {/* Bottom Nav Mockup */}
              <div className="mt-auto h-20 bg-white border-t border-gray-100 flex justify-around items-center px-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={`w-6 h-6 rounded-md ${i === 1 ? 'bg-[#7C5CFF]/20' : 'bg-gray-200'}`} />
                ))}
              </div>

            </div>
          </div>
        </motion.div>

        {/* Right - Content */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex-1"
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-8">
            Patient Experience
          </div>
          
          <h2 className="text-4xl md:text-5xl font-medium text-[#433B68] leading-[1.1] tracking-tight mb-8">
            Designed for clinicians.<br />
            Clear for patients.
          </h2>

          <p className="text-[#433B68]/70 text-lg leading-relaxed max-w-[480px] font-light">
            Extend the intelligence of the digital twin directly to the patient. Surface relevant environmental insights, status updates, and contextual guidance without overwhelming them with clinical metrics.
          </p>
        </motion.div>

      </div>
    </section>
  );
};
