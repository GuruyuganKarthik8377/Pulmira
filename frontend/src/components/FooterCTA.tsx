import { motion } from 'framer-motion';
import { ArrowUpRight, Activity } from 'lucide-react';
import { AppLink } from './AppLink';

export const FinalCTA = () => {
  return (
    <section className="py-24 px-6 md:px-12 bg-white relative">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative w-full rounded-[40px] overflow-hidden flex flex-col items-center text-center px-6 py-24 md:py-32 shadow-2xl"
        >
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img 
              src="/assets/final_cta_bg_1791215250793.jpg" 
              alt="COPD Twin AI Concept" 
              className="w-full h-full object-cover"
            />
            {/* Overlay to ensure text readability */}
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[2px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent" />
          </div>

          <div className="relative z-10 max-w-[800px] mx-auto flex flex-col items-center">
            <h2 className="text-5xl md:text-7xl font-medium text-[#433B68] leading-[1.05] tracking-tight mb-8">
              See COPD<br />
              as a living system.
            </h2>
            
            <p className="text-lg md:text-xl text-[#433B68]/70 leading-relaxed font-light mb-12 max-w-[600px]">
              Explore how COPD Twin connects patient signals, environment, and risk into one continuously evolving digital twin.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
              <AppLink href="/demo" className="w-full sm:w-auto flex items-center justify-center gap-3 bg-[#433B68] text-white px-6 py-4 rounded-xl font-medium text-sm hover:bg-[#342e50] transition-colors group shadow-xl shadow-[#433B68]/20">
                <span className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
                  <ArrowUpRight size={14} />
                </span>
                OPEN COMMAND CENTER
              </AppLink>
              
              <a href="#how-it-works" className="w-full sm:w-auto flex items-center justify-center gap-3 bg-white text-[#433B68] px-6 py-4 rounded-xl font-medium text-sm border border-[#433B68]/10 hover:bg-[#FAFAFC] hover:border-[#433B68]/20 transition-all shadow-sm">
                EXPLORE THE PLATFORM
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export const Footer = () => {
  return (
    <footer className="bg-[#FAFAFC] pt-24 pb-12 px-6 md:px-12 border-t border-gray-100">
      <div className="max-w-[1400px] mx-auto">
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-24 mb-16 border-b border-gray-200 pb-16">
          
          {/* Logo & Disclaimer Area */}
          <div className="md:col-span-5 flex flex-col items-start">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-[#EAE6FF] text-[#7C5CFF]">
                <Activity size={20} strokeWidth={1.5} />
              </div>
              <span className="text-xl tracking-tight font-medium text-[#433B68]">
                COPD TWIN
              </span>
            </div>
            
            <p className="text-sm text-[#433B68]/50 leading-relaxed font-light max-w-[340px]">
              COPD Twin is a clinical decision-support concept. Model outputs are intended to support—not replace—professional clinical judgment.
            </p>
          </div>
          
          {/* Navigation Links */}
          <div className="md:col-span-3 flex flex-col gap-6">
            <h4 className="text-[11px] font-bold tracking-widest uppercase text-[#433B68]">Navigation</h4>
            <ul className="flex flex-col gap-3">
              {['Home', 'About', 'Platform', 'Patient Twin', 'Analytics', 'How It Works'].map(link => (
                <li key={link}>
                  <a href="#" className="text-sm font-medium text-[#433B68]/60 hover:text-[#7C5CFF] transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Product Links */}
          <div className="md:col-span-4 flex flex-col gap-6">
            <h4 className="text-[11px] font-bold tracking-widest uppercase text-[#433B68]">Product</h4>
            <div className="grid grid-cols-2 gap-3">
              {['Digital Twin', 'Risk Prediction', 'Exposure', 'Scenario Simulator', 'Alerts', 'Reports'].map(link => (
                <a key={link} href="#" className="text-sm font-medium text-[#433B68]/60 hover:text-[#7C5CFF] transition-colors">
                  {link}
                </a>
              ))}
            </div>
          </div>
          
        </div>
        
        {/* Bottom */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-medium text-[#433B68]/40">
          <p>© 2026 COPD Twin. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-[#433B68]">Privacy Policy</a>
            <a href="#" className="hover:text-[#433B68]">Terms of Service</a>
          </div>
        </div>
        
      </div>
    </footer>
  );
};
