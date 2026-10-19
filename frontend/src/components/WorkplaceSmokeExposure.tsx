import { motion } from 'framer-motion';
import { Building2, Cigarette } from 'lucide-react';

export const WorkplaceSmokeExposure = () => {
  return (
    <section className="py-24 px-6 md:px-12 bg-[#FAFAFC] relative">
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
        
        {/* Workplace Exposure Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-[40px] border border-gray-100 p-8 md:p-12 shadow-xl shadow-[#7C5CFF]/5 flex flex-col h-full"
        >
          <div className="flex items-center gap-4 mb-10 pb-6 border-b border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-[#EAE6FF] text-[#7C5CFF] flex items-center justify-center">
              <Building2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-medium text-[#433B68]">Workplace Exposure</h3>
              <p className="text-xs font-bold text-[#433B68]/40 uppercase tracking-widest mt-1">Construction Site</p>
            </div>
          </div>

          <div className="flex flex-col gap-8 flex-1">
            
            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[#433B68]/70">Dust exposure</span>
                <span className="text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded-full uppercase">High</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[#433B68]/70">Chemical fumes</span>
                <span className="text-sm font-bold text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full uppercase">Moderate</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[#433B68]/70">Ventilation</span>
                <span className="text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full uppercase">Poor</span>
              </div>
            </div>

            <div className="mt-auto pt-8 border-t border-gray-100 grid grid-cols-2 gap-4">
               <div>
                  <span className="text-[10px] font-bold text-[#433B68]/40 uppercase tracking-widest">Exposure Duration</span>
                  <div className="text-2xl font-medium text-[#433B68] mt-1">6.2 <span className="text-sm text-[#433B68]/50">hrs</span></div>
               </div>
               <div>
                  <span className="text-[10px] font-bold text-[#433B68]/40 uppercase tracking-widest">Risk Association</span>
                  <div className="text-2xl font-medium text-orange-600 mt-1 uppercase">High</div>
               </div>
            </div>
          </div>
        </motion.div>

        {/* Smoke Exposure Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white rounded-[40px] border border-gray-100 p-8 md:p-12 shadow-xl shadow-[#7C5CFF]/5 flex flex-col h-full"
        >
          <div className="flex items-center gap-4 mb-10 pb-6 border-b border-gray-100">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center">
              <Cigarette size={24} />
            </div>
            <div>
              <h3 className="text-xl font-medium text-[#433B68]">Smoke Exposure</h3>
              <p className="text-xs font-bold text-[#433B68]/40 uppercase tracking-widest mt-1">Environmental & Active</p>
            </div>
          </div>

          <div className="flex flex-col gap-8 flex-1">
            
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[#FAFAFC] p-4 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-bold text-[#433B68]/40 uppercase tracking-widest">Active smoking</span>
                <div className="text-xl font-medium text-[#433B68] mt-2">8 <span className="text-xs font-normal">cigarettes/day</span></div>
              </div>
              <div className="bg-[#FAFAFC] p-4 rounded-2xl border border-gray-100">
                <span className="text-[10px] font-bold text-[#433B68]/40 uppercase tracking-widest">Second-hand</span>
                <div className="text-xl font-medium text-[#433B68] mt-2">2.1 <span className="text-xs font-normal">hrs/day</span></div>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-100">
              <span className="text-[10px] font-bold text-[#433B68]/40 uppercase tracking-widest block mb-4">Weekly Exposure Timeline</span>
              
              <div className="flex flex-col gap-3">
                {[
                  { day: 'Mon', width: '50%' },
                  { day: 'Tue', width: '70%' },
                  { day: 'Wed', width: '30%' },
                  { day: 'Thu', width: '90%' },
                ].map((item, i) => (
                  <div key={item.day} className="flex items-center gap-4">
                    <span className="text-xs font-bold text-[#433B68]/50 w-8">{item.day}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        whileInView={{ width: item.width }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: i * 0.1 }}
                        className="h-full bg-orange-400 rounded-full" 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
};
