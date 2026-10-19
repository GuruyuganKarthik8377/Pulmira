import { motion, useScroll, useTransform } from 'framer-motion';
import { useState, useRef } from 'react';

export const Hero = () => {
  const { scrollY } = useScroll();
  const heroRef = useRef<HTMLDivElement>(null);
  
  // Scroll Parallax
  const bgY = useTransform(scrollY, [0, 1000], [0, 150]);
  const bgScale = useTransform(scrollY, [0, 1000], [1.03, 1]);

  // Mouse Movement
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!heroRef.current) return;
    const { left, top, width, height } = heroRef.current.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    setMousePos({ x, y });
  };

  const transformY = useTransform(bgY, (val) => `${val + mousePos.y * -10}px`);

  return (
    <div className="p-2 md:p-4 bg-white" ref={heroRef} onMouseMove={handleMouseMove}>
      <section className="relative min-h-[95vh] rounded-[32px] overflow-hidden flex flex-col items-center justify-center bg-[#E5DFFF]">
        
        {/* Background DNA Graphic */}
        <div className="absolute inset-0 z-0 flex items-end justify-center pointer-events-none">
          <motion.img 
            style={{ 
              scale: bgScale,
              x: mousePos.x * -10,
              y: transformY,
              maskImage: 'linear-gradient(to bottom, transparent, black 40%)', 
              WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 40%)' 
            }}
            transition={{ type: "spring", stiffness: 100, damping: 30 }}
            src="/assets/hero_dna_bg.jpg" 
            alt="DNA Structure Background" 
            className="w-full h-[80%] object-cover object-top mix-blend-multiply opacity-50 will-change-transform"
          />
        </div>

        {/* Massive Center Text */}
        <div className="relative z-10 flex flex-col items-center text-center mt-[-10vh]">
          <h1 className="text-[clamp(42px,10vw,140px)] font-medium tracking-tighter text-[#3B3259] leading-[0.9] drop-shadow-sm flex flex-col items-center">
            <span className="overflow-hidden block">
              <motion.span 
                initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                Smart
              </motion.span>
            </span>
            <span className="overflow-hidden block">
              <motion.span 
                initial={{ opacity: 0, y: 40, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 1, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                AI Healthcare
              </motion.span>
            </span>
          </h1>
        </div>

        {/* Bottom Left Text */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute bottom-10 left-6 md:bottom-12 md:left-12 z-20 max-w-[280px]"
        >
          <p className="text-[13px] font-medium text-[#3B3259]/80 leading-relaxed">
            AI platform helping providers<br />
            automate care, improve<br />
            diagnostics, and streamline<br />
            workflows.
          </p>
        </motion.div>

      </section>
    </div>
  );
};
