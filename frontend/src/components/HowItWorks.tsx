import { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  Card1ConnectPatient,
  Card2UnderstandEnvironment,
  Card3DetectPatterns,
  Card4PredictRisk
} from './HowItWorksCards';

interface CardItem {
  id: number;
  title: string;
  description: string;
  component: ReactNode;
}

const cards: CardItem[] = [
  {
    id: 1,
    title: 'Connect the patient',
    description: 'Bring together SpO₂, heart rate, respiratory rate, HRV, sleep, activity, symptoms, and medication data.',
    component: <Card1ConnectPatient />
  },
  {
    id: 2,
    title: 'Understand the environment',
    description: 'Map PM2.5, PM10, NO₂, temperature, humidity, and workplace exposure around the patient\'s daily movement.',
    component: <Card2UnderstandEnvironment />
  },
  {
    id: 3,
    title: 'Detect changing patterns',
    description: 'Compare current measurements with the patient\'s personal baseline.',
    component: <Card3DetectPatterns />
  },
  {
    id: 4,
    title: 'Predict changing risk',
    description: 'Surface model-associated signals that indicate an increasing risk trajectory.',
    component: <Card4PredictRisk />
  }
];

export const HowItWorks = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const nextCard = () => {
    setActiveIndex((prev) => (prev + 1) % cards.length);
  };

  const prevCard = () => {
    setActiveIndex((prev) => (prev === 0 ? cards.length - 1 : prev - 1));
  };

  useEffect(() => {
    if (carouselRef.current) {
      const scrollAmount = activeIndex * 340; // approx card width + gap
      carouselRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
    }
  }, [activeIndex]);

  return (
    <section id="how-it-works" className="py-24 px-6 md:px-12 bg-white relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-[34%_66%] gap-16 xl:gap-4">
        
        {/* Left Column */}
        <div className="flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-8">
              How It Works
            </div>
            
            <h2 className="text-4xl md:text-[52px] font-medium text-[#433B68] leading-[1.05] mb-12 tracking-tight">
              Connect signals,<br />
              understand change,<br />
              anticipate risk.
            </h2>
            
            <div className="flex items-end gap-2 mb-6">
              <span className="text-4xl font-medium text-[#433B68]">
                {String(activeIndex + 1).padStart(2, '0')}
              </span>
              <span className="text-xl text-[#433B68]/40 mb-1">
                / {String(cards.length).padStart(2, '0')}
              </span>
            </div>

            <p className="text-[#433B68]/70 text-lg leading-relaxed max-w-[400px] mb-12 font-light">
              Continuous respiratory intelligence connecting physiology, environment, exposure, and recovery into one patient model.
            </p>

            <div className="flex gap-4">
              <button 
                onClick={prevCard}
                className="w-12 h-12 rounded-2xl border border-gray-200 flex items-center justify-center text-[#433B68] hover:border-[#433B68] hover:bg-[#FAFAFC] transition-colors"
                aria-label="Previous card"
              >
                <ArrowLeft size={20} />
              </button>
              <button 
                onClick={nextCard}
                className="w-12 h-12 rounded-2xl bg-[#433B68] flex items-center justify-center text-white hover:bg-[#342e50] transition-colors shadow-lg shadow-[#433B68]/20"
                aria-label="Next card"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Right Column - Carousel */}
        <div className="relative w-full">
          <motion.div 
            ref={carouselRef}
            className="flex gap-6 overflow-x-auto pb-12 pt-4 snap-x snap-mandatory hide-scrollbar relative cursor-grab active:cursor-grabbing"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            whileTap={{ cursor: "grabbing" }}
          >
            {cards.map((card, idx) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, x: 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                onClick={() => setActiveIndex(idx)}
                className={`group shrink-0 w-[300px] md:w-[380px] aspect-[4/5] rounded-[40px] relative overflow-hidden snap-start cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#433B68]/20 border border-gray-100 ${
                  activeIndex === idx ? 'scale-100 shadow-2xl shadow-[#433B68]/15 opacity-100 ring-2 ring-[#7C5CFF]/30' : 'scale-[0.98] opacity-75 hover:opacity-100'
                }`}
              >
                {/* Real Interactive Preview Interface (Zero screenshots) */}
                <div className="absolute inset-0">
                  {card.component}
                </div>
                
                {/* Gradient overlay for clear typography contrast at bottom */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#151224] via-[#151224]/75 to-transparent pointer-events-none mt-auto h-[55%] self-end top-auto" />
                
                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-7 flex flex-col justify-end pointer-events-none z-20">
                  <h3 className="text-2xl font-medium text-white mb-2 leading-tight tracking-tight transition-transform duration-500 group-hover:-translate-y-[2px]">
                    {card.title}
                  </h3>
                  <motion.p 
                    initial={false}
                    animate={{ height: activeIndex === idx ? 'auto' : 0, opacity: activeIndex === idx ? 1 : 0 }}
                    className="text-white/80 text-xs md:text-sm leading-relaxed font-light overflow-hidden transition-opacity duration-500 group-hover:text-white"
                  >
                    {card.description}
                  </motion.p>
                </div>
              </motion.div>
            ))}
          </motion.div>
          
          {/* Gradient fade on the right side for desktop */}
          <div className="absolute top-0 right-0 bottom-0 w-32 bg-gradient-to-l from-white to-transparent pointer-events-none hidden xl:block" />
        </div>

      </div>
    </section>
  );
};
