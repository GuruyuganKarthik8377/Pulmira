import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

type Period = '30 DAYS' | '90 DAYS' | '6 MONTHS';

interface DataPoint {
  label: string;
  envPct: number;
  physioPct: number;
  pm25: number;
  spo2: number;
}

const DATA_BY_PERIOD: Record<Period, DataPoint[]> = {
  '30 DAYS': [
    { label: 'Day 1', envPct: 22, physioPct: 96, pm25: 18, spo2: 96 },
    { label: 'Day 3', envPct: 28, physioPct: 96, pm25: 22, spo2: 96 },
    { label: 'Day 6', envPct: 35, physioPct: 95, pm25: 29, spo2: 95.5 },
    { label: 'Day 9', envPct: 30, physioPct: 96, pm25: 25, spo2: 96 },
    { label: 'Day 12', envPct: 42, physioPct: 94, pm25: 38, spo2: 94.5 },
    { label: 'Day 15', envPct: 52, physioPct: 93, pm25: 49, spo2: 93 },
    { label: 'Day 18', envPct: 40, physioPct: 95, pm25: 34, spo2: 95 },
    { label: 'Day 21', envPct: 65, physioPct: 92, pm25: 64, spo2: 92.5 },
    { label: 'Day 24', envPct: 74, physioPct: 92, pm25: 72, spo2: 92 },
    { label: 'Day 27', envPct: 60, physioPct: 93, pm25: 58, spo2: 93 },
    { label: 'Today', envPct: 78, physioPct: 92, pm25: 78, spo2: 92 },
  ],
  '90 DAYS': [
    { label: 'Week 1', envPct: 20, physioPct: 97, pm25: 16, spo2: 97 },
    { label: 'Week 3', envPct: 25, physioPct: 96, pm25: 21, spo2: 96.5 },
    { label: 'Week 5', envPct: 32, physioPct: 96, pm25: 28, spo2: 96 },
    { label: 'Week 7', envPct: 45, physioPct: 94, pm25: 42, spo2: 94 },
    { label: 'Week 9', envPct: 38, physioPct: 95, pm25: 32, spo2: 95.5 },
    { label: 'Week 11', envPct: 68, physioPct: 92, pm25: 66, spo2: 92.5 },
    { label: 'Week 12', envPct: 75, physioPct: 92, pm25: 74, spo2: 92 },
  ],
  '6 MONTHS': [
    { label: 'Month 1', envPct: 24, physioPct: 96, pm25: 20, spo2: 96.2 },
    { label: 'Month 2', envPct: 28, physioPct: 96, pm25: 24, spo2: 96.0 },
    { label: 'Month 3', envPct: 34, physioPct: 95, pm25: 30, spo2: 95.4 },
    { label: 'Month 4', envPct: 46, physioPct: 94, pm25: 44, spo2: 94.1 },
    { label: 'Month 5', envPct: 58, physioPct: 93, pm25: 56, spo2: 93.0 },
    { label: 'Month 6', envPct: 72, physioPct: 92, pm25: 71, spo2: 92.2 },
  ]
};

export const LongitudinalAnalytics = () => {
  const [activeFilter, setActiveFilter] = useState<Period>('30 DAYS');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const currentStream = useMemo(() => DATA_BY_PERIOD[activeFilter], [activeFilter]);

  return (
    <section id="analytics" className="py-24 px-6 md:px-12 bg-[#FAFAFC] relative">
      <div className="max-w-[1200px] mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-6">
              Longitudinal Analytics
            </div>
            <h2 className="text-4xl md:text-5xl font-medium text-[#433B68] leading-[1.1] tracking-tight">
              See the pattern<br />
              over time.
            </h2>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm self-start md:self-auto"
          >
            {(['30 DAYS', '90 DAYS', '6 MONTHS'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => {
                  setActiveFilter(filter);
                  setHoveredIdx(null);
                }}
                className={`px-4 py-2 text-xs font-bold tracking-wider rounded-lg transition-colors ${
                  activeFilter === filter 
                    ? 'bg-[#433B68] text-white shadow-sm' 
                    : 'text-[#433B68]/60 hover:text-[#433B68]'
                }`}
              >
                {filter}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Chart Area */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="w-full bg-white rounded-[32px] border border-gray-100 shadow-xl shadow-[#7C5CFF]/5 p-8 md:p-12"
        >
          {/* Chart Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#433B68]/20" />
                <span className="text-xs font-bold tracking-wider text-[#433B68] uppercase">PM2.5 Exposure</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#7C5CFF]" />
                <span className="text-xs font-bold tracking-wider text-[#7C5CFF] uppercase">SpO₂ Physiology</span>
              </div>
            </div>

            <div className="text-xs text-[#433B68]/50 font-medium">
              Hover bars to inspect correlated measurements
            </div>
          </div>

          {/* Interactive Bar Chart Visualization */}
          <div className="relative h-[280px] w-full border-b border-gray-100 mb-8 select-none">
            {/* Background grid */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full border-t border-gray-100 h-0" />
              ))}
            </div>

            {/* Bars */}
            <div className="absolute inset-0 flex items-end justify-between px-4">
              {currentStream.map((item, i) => {
                const isHovered = hoveredIdx === i;

                return (
                  <div 
                    key={`${activeFilter}-${item.label}`}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="flex-1 max-w-[40px] mx-1 group relative flex flex-col justify-end gap-1.5 h-full cursor-pointer"
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-[#201c33] text-white px-3 py-1.5 rounded-xl border border-white/10 shadow-xl whitespace-nowrap text-[10px] flex flex-col gap-0.5">
                        <span className="font-bold text-white/60">{item.label}</span>
                        <span>PM2.5: <b className="text-orange-400">{item.pm25} μg/m³</b></span>
                        <span>SpO₂: <b className="text-[#A294F9]">{item.spo2}%</b></span>
                      </div>
                    )}

                    {/* Environment Exposure Bar */}
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${item.envPct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.03 }}
                      className={`w-full rounded-sm transition-colors ${
                        isHovered ? 'bg-orange-400' : 'bg-[#433B68]/20'
                      }`}
                    />
                    {/* Physiology SpO₂ Level Bar */}
                    <motion.div 
                      initial={{ height: 0 }}
                      animate={{ height: `${(item.physioPct - 80) * 4}%` }}
                      transition={{ duration: 0.6, delay: i * 0.03 + 0.15 }}
                      className={`w-full rounded-t-sm transition-colors ${
                        isHovered ? 'bg-[#7C5CFF]' : 'bg-[#7C5CFF]/80'
                      }`} 
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between px-4 mb-8 text-[10px] font-bold tracking-wider text-[#433B68]/40 uppercase">
            {currentStream.map(item => (
              <span key={item.label}>{item.label}</span>
            ))}
          </div>

          {/* Insight Box */}
          <div className="bg-[#EAE6FF]/40 rounded-2xl p-6 flex flex-col gap-2 border border-[#7C5CFF]/15">
            <span className="text-[10px] font-bold text-[#7C5CFF] tracking-widest uppercase">
              Model-Associated Longitudinal Correlation
            </span>
            <p className="text-[#433B68] text-sm font-medium leading-relaxed max-w-[840px]">
              Across the selected {activeFilter.toLowerCase()} window, episodes where ambient PM2.5 exceeded 50 μg/m³ consistently coincided with a 3.5%–4.2% drop in peripheral oxygenation and elevated recovery latency.
            </p>
          </div>
          
        </motion.div>

      </div>
    </section>
  );
};
