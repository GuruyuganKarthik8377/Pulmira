import { motion } from 'framer-motion';
import { usePatient } from '../context/PatientContext';

export const TwinState = () => {
  const { currentPoint, patient } = usePatient();

  const isWorsening = currentPoint.state === 'WORSENING';
  const isElevated = currentPoint.state === 'ELEVATED';
  const isMonitoring = currentPoint.state === 'MONITORING';

  const states = [
    {
      label: 'RESPIRATORY STATE',
      status: currentPoint.state,
      color: isWorsening ? 'bg-orange-500' : isElevated ? 'bg-amber-500' : isMonitoring ? 'bg-yellow-500' : 'bg-emerald-500'
    },
    {
      label: 'PHYSIOLOGICAL STATE',
      status: currentPoint.spo2 < 94 ? 'WORSENING' : currentPoint.spo2 < 96 ? 'MONITORING' : 'STABLE',
      color: currentPoint.spo2 < 94 ? 'bg-orange-500' : currentPoint.spo2 < 96 ? 'bg-yellow-500' : 'bg-emerald-500'
    },
    {
      label: 'ENVIRONMENTAL STATE',
      status: currentPoint.exposureLevel,
      color: currentPoint.exposureLevel === 'HIGH' || currentPoint.exposureLevel === 'VERY HIGH' ? 'bg-red-500' : currentPoint.exposureLevel === 'MODERATE' ? 'bg-yellow-500' : 'bg-emerald-500'
    },
    {
      label: 'ACTIVITY STATE',
      status: currentPoint.locationType === 'OUTDOOR' || currentPoint.locationType === 'WORK' ? 'REDUCED' : 'MONITORING',
      color: 'bg-yellow-500'
    },
    {
      label: 'RECOVERY STATE',
      status: currentPoint.hour >= 18 ? 'RECOVERING' : isWorsening ? 'COMPROMISED' : 'STABLE',
      color: currentPoint.hour >= 18 ? 'bg-emerald-500' : isWorsening ? 'bg-orange-500' : 'bg-emerald-500'
    },
  ];

  const timeline = [
    { time: '7 DAYS AGO', status: 'Stable', dot: 'bg-emerald-500' },
    { time: '5 DAYS AGO', status: 'Stable', dot: 'bg-emerald-500' },
    { time: '3 DAYS AGO', status: 'Monitoring', dot: 'bg-yellow-500' },
    { time: 'TODAY', status: currentPoint.state, dot: isWorsening ? 'bg-orange-500' : isElevated ? 'bg-amber-500' : 'bg-yellow-500' },
  ];

  return (
    <section id="twin-state" className="py-24 px-6 md:px-12 bg-white relative">
      <div className="max-w-[1400px] mx-auto flex flex-col items-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-8">
            <span>Twin State</span>
            <span className="w-1 h-1 rounded-full bg-[#7C5CFF]" />
            <span className="text-[10px] text-[#433B68]/60 font-medium">{patient.name}</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-medium text-[#433B68] leading-[1.1] tracking-tight">
            The patient's<br />
            state, at a glance.
          </h2>
        </motion.div>

        {/* Horizontal State Indicators */}
        <div className="w-full flex flex-wrap justify-center gap-3 md:gap-6 mb-20">
          {states.map((item, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 + idx * 0.08 }}
              whileHover={{ y: -4 }}
              className="flex flex-col items-center bg-[#FAFAFC] border border-gray-100 rounded-2xl p-4 min-w-[180px] shadow-sm hover:shadow-md hover:border-[#7C5CFF]/20 transition-all cursor-default"
            >
              <span className="text-[10px] font-bold tracking-wider text-[#433B68]/60 uppercase mb-2">
                {item.label}
              </span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${item.color} shadow-sm`} />
                <span className="text-sm font-semibold text-[#433B68] uppercase tracking-wide">
                  {item.status}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Central Statement */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="text-center mb-24 relative"
        >
          <div className="absolute inset-0 bg-[#EAE6FF]/40 blur-[100px] rounded-full -z-10" />
          <p className="text-sm font-bold tracking-widest text-[#433B68]/60 uppercase mb-4">
            Overall Twin State
          </p>
          <motion.div 
            whileHover={{ scale: 1.02 }}
            className={`inline-flex items-center gap-4 border px-8 py-4 rounded-full shadow-lg transition-transform duration-300 cursor-default ${
              isWorsening
                ? 'bg-orange-50/80 border-orange-200 text-orange-600 shadow-orange-500/10'
                : isElevated
                ? 'bg-amber-50/80 border-amber-200 text-amber-600 shadow-amber-500/10'
                : 'bg-emerald-50/80 border-emerald-200 text-emerald-600 shadow-emerald-500/10'
            }`}
          >
            <div className={`w-4 h-4 rounded-full animate-pulse shadow-md ${
              isWorsening ? 'bg-orange-500' : isElevated ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />
            <h3 className="text-4xl md:text-5xl font-medium uppercase tracking-tight">
              {currentPoint.state}
            </h3>
          </motion.div>
        </motion.div>

        {/* Timeline */}
        <div className="w-full max-w-[800px] mx-auto relative overflow-hidden pb-8 pt-4">
          <div className="relative flex justify-between items-end">
            {/* Animated Connecting Line */}
            <motion.div 
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
              className="absolute left-0 right-0 bottom-[18px] h-[2px] bg-gray-200 -z-10 origin-left" 
            />
            
            {timeline.map((point, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.6 + idx * 0.15 }}
                className="flex flex-col items-center gap-3 relative group cursor-default"
              >
                <span className="text-xs font-semibold tracking-wider text-[#433B68]/50 uppercase mb-2 group-hover:text-[#433B68] transition-colors duration-300">
                  {point.time}
                </span>
                <div className={`w-4 h-4 rounded-full border-[3px] border-white ring-1 ring-gray-200 ${point.dot} shadow-sm z-10 transition-transform duration-300 group-hover:scale-125`} />
                <span className="text-sm font-medium text-[#433B68]">
                  {point.status}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
