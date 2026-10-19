import { motion } from 'framer-motion';
import { Activity, ShieldAlert, Workflow } from 'lucide-react';

export const AboutSection = () => {
  return (
    <section id="about" className="py-32 px-6 md:px-12 bg-white relative">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Section Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EAE6FF]/60 text-[#7C5CFF] text-[11px] font-bold tracking-[0.2em] uppercase mb-6 border border-[#7C5CFF]/10">
            <Activity size={14} />
            About COPD Twin
          </div>
          
          <h2 className="text-4xl md:text-[56px] font-medium text-[#3B3259] leading-[1.05] tracking-tight max-w-[800px]">
            Built for continuous<br />
            respiratory intelligence.
          </h2>
        </motion.div>

        {/* Bento Box Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[600px]">
          
          {/* Main Large Card */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="lg:col-span-7 bg-[#FAFAFC] rounded-[40px] border border-gray-100 p-8 md:p-12 relative overflow-hidden group flex flex-col justify-between hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#7C5CFF]/5 hover:border-[#7C5CFF]/20 transition-all duration-400"
          >
            <div className="absolute top-0 right-0 w-3/4 h-full pointer-events-none opacity-40 group-hover:scale-[1.04] group-hover:opacity-60 transition-all duration-700 ease-out">
              <img 
                src="/assets/digital_lung_1791213475161.jpg" 
                alt="Digital Lung Visualization" 
                className="w-full h-full object-cover rounded-bl-full mix-blend-multiply"
                style={{ maskImage: 'linear-gradient(to bottom left, black, transparent 70%)', WebkitMaskImage: 'linear-gradient(to bottom left, black, transparent 70%)' }}
              />
            </div>
            
            <div className="relative z-10 max-w-[400px] group-hover:-translate-y-[2px] transition-transform duration-400">
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-[#7C5CFF] mb-8 group-hover:scale-105 transition-transform duration-400">
                <Activity size={28} strokeWidth={1.5} />
              </div>
              <h3 className="text-3xl font-medium text-[#3B3259] mb-4">
                Built around the patient
              </h3>
              <p className="text-[#3B3259]/60 text-lg leading-relaxed font-light">
                COPD Twin seamlessly connects physiological signals, environmental exposure, activity, sleep, medication, and patient history into one continuously evolving digital representation.
              </p>
            </div>
          </motion.div>

          {/* Right Column Stack */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Top Right Card - Dark */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex-1 bg-[#40385B] rounded-[40px] p-8 md:p-10 relative overflow-hidden group hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#7C5CFF]/20 transition-all duration-400"
            >
              {/* Subtle animated light gradient */}
              <motion.div 
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent w-1/2 opacity-0 group-hover:opacity-100"
              />
              
              {/* Abstract glowing orb in background */}
              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#7C5CFF] rounded-full blur-[80px] opacity-40 group-hover:opacity-60 transition-opacity duration-700" />
              
              <div className="relative z-10 group-hover:-translate-y-[2px] transition-transform duration-400">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-[#A294F9] mb-6 group-hover:bg-white/20 transition-colors duration-400">
                  <Workflow size={24} strokeWidth={1.5} />
                </div>
                <h3 className="text-2xl font-medium text-white mb-3">
                  System-first intelligence
                </h3>
                <p className="text-white/70 text-[15px] leading-relaxed font-light pr-8">
                  Built around the exact workflows respiratory care teams use to monitor, interpret, and respond to rapidly changing patient states in real time.
                </p>
              </div>
            </motion.div>

            {/* Bottom Right Card - Image/Graphic Focused */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex-1 bg-[#FAFAFC] border border-gray-100 rounded-[40px] p-8 md:p-10 flex items-center gap-6 group hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#7C5CFF]/5 hover:border-[#7C5CFF]/20 transition-all duration-400"
            >
              <div className="flex-1 group-hover:-translate-y-[2px] transition-transform duration-400">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-6 group-hover:scale-105 transition-transform duration-400">
                  <ShieldAlert size={24} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-medium text-[#3B3259] mb-2">
                  Risk-aware by design
                </h3>
                <p className="text-[#3B3259]/60 text-sm leading-relaxed font-light">
                  Surfaces model-associated risk signals and subtle pattern shifts long before they become clinically visible.
                </p>
              </div>
              
              <div className="w-[120px] h-[120px] rounded-3xl overflow-hidden shrink-0 relative shadow-sm group-hover:shadow-md transition-shadow duration-400">
                <img 
                  src="/assets/wearable_monitoring_1791213491026.jpg" 
                  alt="Monitoring" 
                  className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700 ease-out"
                />
              </div>
            </motion.div>

          </div>
        </div>

      </div>
    </section>
  );
};
