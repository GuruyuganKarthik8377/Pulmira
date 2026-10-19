import { motion } from 'framer-motion';
import { ArrowUpRight, AlertCircle, TrendingDown, Wind, CheckCircle2 } from 'lucide-react';
import { usePatient } from '../context/PatientContext';

export const SmartAlertCenter = () => {
  const { setSelectedPatientId, scrollToSection, selectedPatientId } = usePatient();

  const alerts = [
    {
      id: '042',
      type: 'HIGH',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      patient: 'Patient #042 · Sarah Jenkins',
      message: 'Risk increased 24% in 48h (High particulate desaturation)',
      icon: <AlertCircle size={20} className="text-red-500" />
    },
    {
      id: '018',
      type: 'MODERATE',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      patient: 'Patient #018 · Robert Chen',
      message: 'SpO₂ declining from personal baseline (Severe phenotype)',
      icon: <TrendingDown size={20} className="text-orange-500" />
    },
    {
      id: '073',
      type: 'EXPOSURE',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      patient: 'Patient #073 · Marcus Vance',
      message: 'High PM2.5 exposure detected with inhaler refill pending',
      icon: <Wind size={20} className="text-yellow-500" />
    }
  ];

  const handleViewTwin = (patientId: string) => {
    setSelectedPatientId(patientId);
    scrollToSection('digital-twin');
  };

  return (
    <section id="alerts" className="py-24 px-6 md:px-12 bg-white relative">
      <div className="max-w-[1000px] mx-auto flex flex-col items-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-8">
            Smart Alerts
          </div>
          
          <h2 className="text-4xl md:text-5xl font-medium text-[#433B68] leading-[1.1] tracking-tight">
            Surface the signals<br />
            that need attention.
          </h2>
        </motion.div>

        <div className="w-full flex flex-col gap-4">
          {alerts.map((alert, idx) => {
            const isCurrentlySelected = selectedPatientId === alert.id;

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className={`group flex flex-col md:flex-row items-start md:items-center justify-between p-6 md:p-8 rounded-[24px] border transition-all duration-300 ${
                  isCurrentlySelected
                    ? 'bg-[#FAFAFC] border-[#7C5CFF]/60 shadow-lg shadow-[#7C5CFF]/10 ring-1 ring-[#7C5CFF]/30'
                    : 'bg-[#FAFAFC] border-[#433B68]/5 hover:bg-white hover:border-[#7C5CFF]/30 hover:shadow-xl hover:shadow-[#7C5CFF]/10'
                }`}
              >
                <div className="flex items-start md:items-center gap-6 mb-6 md:mb-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${alert.bgColor}`}>
                    {alert.icon}
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold tracking-widest uppercase ${alert.color}`}>
                        {alert.type}
                      </span>
                      <span className="text-xs font-medium text-[#433B68]/60">
                        {alert.patient}
                      </span>
                      {isCurrentlySelected && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7C5CFF] text-white flex items-center gap-1">
                          <CheckCircle2 size={10} /> Active in Twin
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-medium text-[#433B68]">
                      {alert.message}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => handleViewTwin(alert.id)}
                  className={`flex items-center gap-2 text-xs font-bold tracking-wider px-5 py-2.5 rounded-full transition-all shrink-0 ${
                    isCurrentlySelected
                      ? 'bg-[#7C5CFF] text-white shadow-md shadow-[#7C5CFF]/20'
                      : 'text-[#7C5CFF] bg-[#EAE6FF]/60 hover:bg-[#7C5CFF] hover:text-white'
                  }`}
                >
                  <span>VIEW TWIN</span>
                  <ArrowUpRight size={15} />
                </button>
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
