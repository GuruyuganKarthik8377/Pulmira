import { useState, useEffect } from 'react';
import { ArrowUpRight, Menu, Sparkles, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { AppLink } from './AppLink';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.nav 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`sticky top-0 z-50 h-[84px] transition-all duration-500 ease-out flex items-center justify-between ${
        isScrolled 
          ? 'px-5 md:px-8 py-4 bg-white/90 backdrop-blur-xl border-b border-white/20 shadow-sm' 
          : 'px-5 md:px-8 py-6 bg-white'
      }`}
    >
      {/* Left Links */}
      <div className="hidden 2xl:flex items-center gap-5 lg:gap-6 text-[12px] font-medium tracking-wide text-[#3B3259]">
        {[
          { label: 'ABOUT', href: '#about' },
          { label: 'HOW IT WORKS', href: '#how-it-works' },
          { label: 'DIGITAL TWIN', href: '#digital-twin' },
          { label: 'MONITORING', href: '#monitoring' },
          { label: 'SIMULATOR', href: '#simulator' }
        ].map((item) => (
          <a 
            key={item.label}
            href={item.href} 
            className="relative group transition-opacity hover:opacity-100 opacity-80"
          >
            <span className="block group-hover:-translate-y-[1px] transition-transform duration-200">
              {item.label}
            </span>
            <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#7C5CFF] rounded-full transition-all duration-300 group-hover:w-full opacity-0 group-hover:opacity-100" />
          </a>
        ))}
      </div>
      <button className="2xl:hidden flex items-center justify-center w-9 h-9 text-[#433B68] rounded-lg hover:bg-white/50" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="homepage-mobile-menu" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
      {menuOpen && <div id="homepage-mobile-menu" className="absolute top-full left-3 right-3 bg-white shadow-xl border border-[#EAE6FF] rounded-2xl p-4 flex flex-col gap-1 2xl:hidden">{[{ label: 'About', href: '#about' }, { label: 'How it works', href: '#how-it-works' }, { label: 'Digital twin', href: '#digital-twin' }, { label: 'Monitoring', href: '#monitoring' }, { label: 'Simulator', href: '#simulator' }].map(item => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="px-4 py-3 text-sm text-[#433B68] rounded-xl hover:bg-[#F4F0FF]">{item.label}</a>)}<AppLink href="/demo" className="px-4 py-3 text-sm font-medium text-[#7C5CFF] rounded-xl hover:bg-[#F4F0FF]">Enter the demo ↗</AppLink></div>}

      {/* Center Logo */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-[#3B3259]">
        <div className="flex items-center gap-0.5 opacity-80">
          <div className="w-0.5 h-3 bg-current rounded-full" />
          <div className="w-0.5 h-5 bg-current rounded-full" />
          <div className="w-0.5 h-4 bg-current rounded-full" />
          <div className="w-0.5 h-2 bg-current rounded-full" />
        </div>
        <Sparkles size={16} className="hidden sm:block text-[#3B3259] -mt-2 -ml-1 opacity-80" />
        <span className="text-lg md:text-xl tracking-tight font-medium ml-1">
          Pulmira
        </span>
      </div>

      {/* Right Button */}
      <AppLink
        href="/demo"
        className="group flex h-9 items-center gap-2 md:gap-3 bg-[#40385B] text-white pl-3 sm:pl-1.5 pr-3 md:pr-5 py-1.5 rounded-lg font-medium text-[10px] md:text-[11px] hover:bg-[#2d2744] transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 cursor-pointer"
      >
        <span className="hidden sm:flex w-6 h-6 rounded-md bg-[#7C6AF1]/30 items-center justify-center group-hover:bg-[#7C6AF1]/40 transition-colors">
          <ArrowUpRight size={12} className="text-[#A294F9] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
        OPEN DEMO
      </AppLink>
    </motion.nav>
  );
};
