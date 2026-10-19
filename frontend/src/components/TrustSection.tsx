import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';

export const TrustSection = () => {
  return (
    <section className="py-24 px-6 md:px-12 bg-white relative">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-6">
            Built for Respiratory Care
          </div>
          
          <h2 className="text-4xl md:text-5xl font-medium text-[#433B68] leading-[1.1] tracking-tight">
            Designed around<br />
            clinical workflows.
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-[900px] bg-[#433B68] rounded-[40px] p-10 md:p-16 relative overflow-hidden flex flex-col md:flex-row items-center gap-12"
        >
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#7C5CFF] rounded-full blur-[100px] opacity-30 -mr-20 -mt-20 pointer-events-none" />

          {/* Abstract Image or Icon representation instead of fake person */}
          <div className="shrink-0 w-32 h-32 md:w-48 md:h-48 rounded-full bg-[#FAFAFC]/10 backdrop-blur-sm border border-white/10 flex items-center justify-center p-6 shadow-2xl">
             <div className="w-full h-full rounded-full border-2 border-white/20 border-dashed animate-[spin_60s_linear_infinite] flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-[#7C5CFF]/40 blur-md" />
             </div>
          </div>

          <div className="flex-1 flex flex-col z-10 text-center md:text-left">
            <Quote size={40} className="text-[#7C5CFF] mb-6 mx-auto md:mx-0 opacity-80" />
            <p className="text-2xl md:text-3xl font-medium text-white leading-relaxed mb-8 tracking-tight">
              "One view for changing respiratory signals, environmental exposure, and longitudinal risk."
            </p>
            <div>
              <p className="text-white/90 font-medium text-lg">System Design</p>
              <p className="text-white/50 text-sm mt-1 uppercase tracking-widest font-semibold">Clinical workflow concept</p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
};
