import { AppLink } from '../components/AppLink';
import { Hero } from '../components/Hero';
import { Navbar } from '../components/Navbar';
import { AboutSection } from '../components/AboutSection';

// PART 2 Components
import { HowItWorks } from '../components/HowItWorks';
import { DigitalTwinHero } from '../components/DigitalTwinHero';
import { PhysiologicalMonitoring } from '../components/PhysiologicalMonitoring';
import { EnvironmentalExposure } from '../components/EnvironmentalExposure';
import { WorkplaceSmokeExposure } from '../components/WorkplaceSmokeExposure';
import { PersonalTriggerAnalysis } from '../components/PersonalTriggerAnalysis';
import { RiskPrediction } from '../components/RiskPrediction';

// PART 3 Components
import { TwinState } from '../components/TwinState';
import { TwinReplay } from '../components/TwinReplay';
import { Simulator } from '../components/Simulator';
import { SmartAlertCenter } from '../components/SmartAlertCenter';
import { LongitudinalAnalytics } from '../components/LongitudinalAnalytics';
import { ClinicalSummary } from '../components/ClinicalSummary';
import { PatientView } from '../components/PatientView';
import { TrustSection } from '../components/TrustSection';
import { FinalCTA, Footer } from '../components/FooterCTA';

import { motion, useScroll } from 'framer-motion';
import { useEffect } from 'react';

export function HomePage() {
  const { scrollYProgress } = useScroll();
  useEffect(() => { document.title = 'Pulmira · Respiratory digital twin'; }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFC] text-[#433B68] font-sans selection:bg-[#7C5CFF]/20 selection:text-[#433B68]">
      <motion.div 
        className="fixed top-0 left-0 right-0 h-[2px] bg-[#7C5CFF] z-[100] origin-left"
        style={{ scaleX: scrollYProgress }}
      />
      <main>
        <div className="homepage-demo-boundary">Homepage charts and named profiles are illustrative design examples. <AppLink href="/demo">Open the connected observation workspace →</AppLink></div>
        <Navbar />
        {/* PART 1 */}
        <Hero />
        <AboutSection />

        {/* PART 2 */}
        <HowItWorks />
        <DigitalTwinHero />
        <PhysiologicalMonitoring />
        <EnvironmentalExposure />
        <WorkplaceSmokeExposure />
        <PersonalTriggerAnalysis />
        <RiskPrediction />

        {/* PART 3 */}
        <TwinState />
        <TwinReplay />
        <Simulator />
        <SmartAlertCenter />
        <LongitudinalAnalytics />
        <ClinicalSummary />
        <PatientView />
        <TrustSection />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

