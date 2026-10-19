import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

export const PlatformSection = () => {
  return (
    <section id="features" className="py-24 px-6 md:px-12 bg-[#FAFAFC] relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
        
        {/* Left Column - Large Image */}
        <motion.div
          initial={{ opacity: 0, x: -30, filter: 'blur(2px)' }}
          whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="w-full relative rounded-[40px] overflow-hidden shadow-2xl shadow-[#7C5CFF]/10 aspect-[4/5] max-h-[800px] group hover:shadow-[#7C5CFF]/20 transition-shadow duration-700"
        >
          <motion.img 
            initial={{ scale: 1.05 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: 'easeOut' }}
            src="/assets/platform_lungs_1791213688820.jpg" 
            alt="Intelligent View of Respiratory State" 
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out will-change-transform"
          />
        </motion.div>

        {/* Right Column - Content */}
        <div className="flex flex-col">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-8">
              The Platform
            </div>
            
            <h2 className="text-4xl md:text-[56px] font-medium text-[#433B68] leading-[1.05] mb-8 tracking-tight">
              One intelligent view<br />
              of the patient's<br />
              respiratory state.
            </h2>
            
            <p className="text-[#433B68]/70 text-lg leading-relaxed max-w-[540px] mb-16 font-light">
              From oxygen saturation and heart rate to sleep, activity, air quality, workplace exposure, and smoking exposure — COPD Twin brings the signals together so clinicians can understand the patient as a system.
            </p>

            <div className="pt-8 border-t border-[#433B68]/10 max-w-[540px]">
              <h3 className="text-2xl font-medium text-[#433B68] mb-4">
                Patient-centered intelligence
              </h3>
              <p className="text-[#433B68]/70 text-[16px] leading-relaxed mb-8 font-light">
                Unify physiology, environment, exposure, and longitudinal history in one continuously evolving digital twin.
              </p>
              
              <button className="group flex items-center gap-3 bg-[#7C5CFF] text-white px-6 py-3.5 rounded-xl font-medium text-sm hover:bg-[#684be6] transition-all duration-300 shadow-lg shadow-[#7C5CFF]/25 hover:shadow-[#7C5CFF]/40 hover:-translate-y-0.5 active:scale-[0.98]">
                <span className="w-7 h-7 rounded-md bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                  <ArrowUpRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
                EXPLORE THE DIGITAL TWIN
              </button>
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
};
