import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePatient } from '../context/PatientContext';
import { Activity, Heart, Wind, Moon, Footprints, Zap } from 'lucide-react';

type MetricKey = 'spo2' | 'hr' | 'hrv' | 'rr' | 'activity' | 'sleep';
type TimeRangeKey = '24 HOURS' | '7 DAYS' | '30 DAYS';

interface MetricConfig {
  key: MetricKey;
  name: string;
  unit: string;
  format: (v: number) => string;
  icon: typeof Activity;
  color: string;
  fillColor: string;
  baseline: number;
  yMin: number;
  yMax: number;
  history: Record<TimeRangeKey, { labels: string[]; values: number[] }>;
}

const METRICS_DATA: Record<MetricKey, MetricConfig> = {
  spo2: {
    key: 'spo2',
    name: 'SpO₂',
    unit: '%',
    format: (v) => `${v}%`,
    icon: Activity,
    color: '#433B68',
    fillColor: '#7C5CFF',
    baseline: 96,
    yMin: 88,
    yMax: 100,
    history: {
      '24 HOURS': {
        labels: ['00:00', '04:00', '08:00', '10:00', '12:00', '14:00', '16:00', '20:00'],
        values: [96, 95, 96, 95, 93, 92, 92, 94]
      },
      '7 DAYS': {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
        values: [96, 96, 95, 94, 93, 92.5, 92]
      },
      '30 DAYS': {
        labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
        values: [96.2, 95.8, 94.2, 92.0]
      }
    }
  },
  hr: {
    key: 'hr',
    name: 'Heart Rate',
    unit: 'BPM',
    format: (v) => `${Math.round(v)} BPM`,
    icon: Heart,
    color: '#e11d48',
    fillColor: '#fb7185',
    baseline: 70,
    yMin: 60,
    yMax: 90,
    history: {
      '24 HOURS': {
        labels: ['00:00', '04:00', '08:00', '10:00', '12:00', '14:00', '16:00', '20:00'],
        values: [66, 64, 68, 74, 76, 78, 75, 70]
      },
      '7 DAYS': {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
        values: [68, 70, 71, 73, 75, 77, 78]
      },
      '30 DAYS': {
        labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
        values: [69, 71, 74, 78]
      }
    }
  },
  hrv: {
    key: 'hrv',
    name: 'HRV (RMSSD)',
    unit: 'ms',
    format: (v) => `${Math.round(v)} ms`,
    icon: Zap,
    color: '#8b5cf6',
    fillColor: '#a78bfa',
    baseline: 45,
    yMin: 25,
    yMax: 60,
    history: {
      '24 HOURS': {
        labels: ['00:00', '04:00', '08:00', '10:00', '12:00', '14:00', '16:00', '20:00'],
        values: [48, 50, 46, 42, 38, 36, 38, 41]
      },
      '7 DAYS': {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
        values: [46, 45, 44, 41, 39, 37, 36]
      },
      '30 DAYS': {
        labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
        values: [47, 44, 40, 36]
      }
    }
  },
  rr: {
    key: 'rr',
    name: 'Respiratory Rate',
    unit: '/min',
    format: (v) => `${Math.round(v)} /min`,
    icon: Wind,
    color: '#0284c7',
    fillColor: '#38bdf8',
    baseline: 16,
    yMin: 12,
    yMax: 24,
    history: {
      '24 HOURS': {
        labels: ['00:00', '04:00', '08:00', '10:00', '12:00', '14:00', '16:00', '20:00'],
        values: [14, 14, 15, 16, 18, 19, 18, 16]
      },
      '7 DAYS': {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
        values: [15, 15, 16, 17, 18, 18.5, 19]
      },
      '30 DAYS': {
        labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
        values: [15.2, 16.0, 17.5, 19.0]
      }
    }
  },
  activity: {
    key: 'activity',
    name: 'Steps & Activity',
    unit: 'steps',
    format: (v) => `${Math.round(v).toLocaleString()} steps`,
    icon: Footprints,
    color: '#d97706',
    fillColor: '#fbbf24',
    baseline: 6000,
    yMin: 2000,
    yMax: 8000,
    history: {
      '24 HOURS': {
        labels: ['00:00', '04:00', '08:00', '10:00', '12:00', '14:00', '16:00', '20:00'],
        values: [200, 200, 1200, 2100, 2800, 3400, 3800, 4120]
      },
      '7 DAYS': {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
        values: [5900, 5600, 5200, 4800, 4400, 4200, 4120]
      },
      '30 DAYS': {
        labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
        values: [5800, 5400, 4700, 4120]
      }
    }
  },
  sleep: {
    key: 'sleep',
    name: 'Sleep Duration',
    unit: 'hours',
    format: (v) => `${v.toFixed(1)} hrs`,
    icon: Moon,
    color: '#4f46e5',
    fillColor: '#818cf8',
    baseline: 7.5,
    yMin: 4.5,
    yMax: 9.0,
    history: {
      '24 HOURS': {
        labels: ['22:00', '00:00', '02:00', '04:00', '06:00', '07:00'],
        values: [1.0, 2.8, 4.2, 5.5, 6.2, 6.2]
      },
      '7 DAYS': {
        labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Today'],
        values: [7.4, 7.2, 7.0, 6.6, 6.4, 6.2, 6.2]
      },
      '30 DAYS': {
        labels: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
        values: [7.5, 7.1, 6.7, 6.2]
      }
    }
  }
};

export const PhysiologicalMonitoring = () => {
  const { currentPoint, patient } = usePatient();
  const [activeMetricKey, setActiveMetricKey] = useState<MetricKey>('spo2');
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('7 DAYS');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeConfig = METRICS_DATA[activeMetricKey];
  const dataset = activeConfig.history[timeRange];

  // Map values to SVG coordinates (width=1000, height=260)
  const chartHeight = 240;
  const chartWidth = 1000;
  const paddingX = 40;
  const effectiveWidth = chartWidth - paddingX * 2;

  const points = useMemo(() => {
    const vals = dataset.values;
    const len = vals.length;
    const { yMin, yMax } = activeConfig;

    return vals.map((v, i) => {
      const x = paddingX + (i / (len - 1)) * effectiveWidth;
      // Normalizing Y (invert because SVG 0 is top)
      const normalized = Math.max(0, Math.min(1, (v - yMin) / (yMax - yMin)));
      const y = chartHeight - normalized * (chartHeight - 40) - 20;
      return { x, y, value: v, label: dataset.labels[i] };
    });
  }, [dataset, activeConfig, effectiveWidth, chartHeight]);

  // Baseline Y coordinate
  const baselineY = useMemo(() => {
    const { baseline, yMin, yMax } = activeConfig;
    const normalized = Math.max(0, Math.min(1, (baseline - yMin) / (yMax - yMin)));
    return chartHeight - normalized * (chartHeight - 40) - 20;
  }, [activeConfig, chartHeight]);

  // Build SVG path string with smooth bezier curves
  const pathString = useMemo(() => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cx1 = prev.x + (curr.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (curr.x - prev.x) / 2;
      const cy2 = curr.y;
      d += ` C ${cx1},${cy1} ${cx2},${cy2} ${curr.x},${curr.y}`;
    }
    return d;
  }, [points]);

  const areaPathString = useMemo(() => {
    if (!pathString || points.length === 0) return '';
    const last = points[points.length - 1];
    const first = points[0];
    return `${pathString} L ${last.x},${chartHeight} L ${first.x},${chartHeight} Z`;
  }, [pathString, points, chartHeight]);

  // Dynamic baseline and current value from PatientContext if applicable
  const baselineVal = useMemo(() => {
    if (activeConfig.key === 'spo2') return patient.baselineSpo2;
    if (activeConfig.key === 'hr') return patient.baselineHr;
    if (activeConfig.key === 'rr') return patient.baselineRr;
    return activeConfig.baseline;
  }, [activeConfig, patient]);

  const currentValue = useMemo(() => {
    if (timeRange === '24 HOURS') {
      if (activeConfig.key === 'spo2') return currentPoint.spo2;
      if (activeConfig.key === 'hr') return currentPoint.hr;
      if (activeConfig.key === 'rr') return currentPoint.rr;
    }
    return points[points.length - 1]?.value ?? baselineVal;
  }, [timeRange, activeConfig, currentPoint, points, baselineVal]);

  const delta = currentValue - baselineVal;
  const isLowerBetter = activeConfig.key === 'hr' || activeConfig.key === 'rr';
  const isWorsening = isLowerBetter ? delta > 0 : delta < 0;

  return (
    <section id="monitoring" className="py-24 px-6 md:px-12 bg-white relative">
      <div className="max-w-[1200px] mx-auto">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-14">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#EAE6FF] text-[#7C5CFF] text-xs font-bold tracking-widest uppercase mb-4">
              Physiological Intelligence
            </div>
            <h2 className="text-4xl md:text-5xl font-medium text-[#433B68] leading-[1.1] tracking-tight">
              From raw signals<br />
              to personal baseline.
            </h2>
          </motion.div>

          {/* Time Range Filter Buttons */}
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex bg-[#FAFAFC] p-1.5 rounded-2xl border border-gray-100 self-start md:self-auto shadow-sm"
          >
            {(['24 HOURS', '7 DAYS', '30 DAYS'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setTimeRange(filter)}
                className={`px-5 py-2.5 text-[11px] font-bold tracking-wider rounded-xl transition-all uppercase ${
                  timeRange === filter 
                    ? 'bg-white text-[#433B68] shadow-md border border-gray-100' 
                    : 'text-[#433B68]/40 hover:text-[#433B68]/80'
                }`}
              >
                {filter}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Primary Interactive Chart Area */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="w-full bg-[#FAFAFC] rounded-[40px] border border-gray-100 p-8 md:p-12 mb-10 shadow-2xl shadow-[#7C5CFF]/5 relative"
        >
          {/* Chart Header Metrics Bar */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-12 gap-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-[#433B68]">{activeConfig.name}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EAE6FF] text-[#7C5CFF] uppercase tracking-wider">
                  Active Focus
                </span>
              </div>
              <span className="text-[11px] font-semibold text-[#433B68]/50 uppercase tracking-widest">
                Interactive Trend Analysis · {timeRange}
              </span>
            </div>
            
            <div className="flex gap-8 md:gap-14">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-[#7C5CFF] uppercase tracking-widest flex items-center gap-1">
                  <span className="w-2 h-0.5 bg-[#7C5CFF] inline-block border-t border-dashed" /> Baseline
                </span>
                <span className="text-3xl font-medium text-[#433B68]">
                  {activeConfig.format(baselineVal)}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-[#433B68]/50 uppercase tracking-widest">Current</span>
                <span className="text-3xl font-medium text-[#433B68]">
                  {activeConfig.format(currentValue)}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isWorsening ? 'text-orange-500' : 'text-emerald-500'}`}>
                  Variance
                </span>
                <span className={`text-3xl font-medium ${isWorsening ? 'text-orange-600' : 'text-emerald-600'}`}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)} {activeConfig.unit}
                </span>
              </div>
            </div>
          </div>

          {/* Elegant SVG Chart with Interactive Hover Cursor & Tooltips */}
          <div 
            className="relative w-full h-[260px] md:h-[290px] border-b border-gray-200 cursor-crosshair select-none"
            onMouseLeave={() => setHoveredIndex(null)}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = ((e.clientX - rect.left) / rect.width) * chartWidth;
              // Find closest point
              let closestIdx = 0;
              let closestDist = Infinity;
              points.forEach((p, idx) => {
                const dist = Math.abs(p.x - relX);
                if (dist < closestDist) {
                  closestDist = dist;
                  closestIdx = idx;
                }
              });
              setHoveredIndex(closestIdx);
            }}
          >
            {/* Grid horizontal guidelines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full border-t border-[#433B68]/5 h-0" />
              ))}
            </div>

            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Personal Baseline Reference Line */}
              <line
                x1={paddingX}
                y1={baselineY}
                x2={chartWidth - paddingX}
                y2={baselineY}
                stroke="#7C5CFF"
                strokeWidth="2"
                strokeDasharray="6 6"
              />
              <text 
                x={chartWidth - paddingX} 
                y={baselineY - 8} 
                textAnchor="end" 
                fill="#7C5CFF" 
                fontSize="11" 
                fontWeight="bold"
                letterSpacing="0.05em"
              >
                PERSONAL BASELINE ({activeConfig.format(baselineVal)})
              </text>

              {/* Area fill */}
              <motion.path
                key={`area-${activeMetricKey}-${timeRange}`}
                d={areaPathString}
                fill="url(#metricGrad)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              />

              {/* Primary Line */}
              <motion.path
                key={`path-${activeMetricKey}-${timeRange}`}
                d={pathString}
                fill="none"
                stroke="#433B68"
                strokeWidth="3.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />

              {/* Data point anchors */}
              {points.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoveredIndex === i ? 6 : 4}
                  fill={hoveredIndex === i ? "#7C5CFF" : "#433B68"}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="transition-all duration-200"
                />
              ))}

              {/* Active hover crosshair vertical guide */}
              {hoveredIndex !== null && points[hoveredIndex] && (
                <line
                  x1={points[hoveredIndex].x}
                  y1={0}
                  x2={points[hoveredIndex].x}
                  y2={chartHeight}
                  stroke="#7C5CFF"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}
            </svg>

            {/* Interactive Tooltip Card */}
            {hoveredIndex !== null && points[hoveredIndex] && (
              <div 
                className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3"
                style={{
                  left: `${(points[hoveredIndex].x / chartWidth) * 100}%`,
                  top: `${(points[hoveredIndex].y / chartHeight) * 100}%`
                }}
              >
                <div className="bg-[#201c33] text-white p-3 rounded-2xl shadow-2xl border border-white/10 min-w-[130px] flex flex-col gap-0.5">
                  <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">
                    {points[hoveredIndex].label}
                  </span>
                  <div className="text-base font-bold text-white">
                    {activeConfig.format(points[hoveredIndex].value)}
                  </div>
                  <span className={`text-[10px] font-semibold ${
                    points[hoveredIndex].value < baselineVal ? 'text-orange-400' : 'text-emerald-400'
                  }`}>
                    {points[hoveredIndex].value - baselineVal >= 0 ? '+' : ''}
                    {(points[hoveredIndex].value - baselineVal).toFixed(1)} {activeConfig.unit} vs baseline
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Axis Labels */}
          <div className="flex justify-between mt-4 px-2 text-[10px] font-bold tracking-widest text-[#433B68]/40 uppercase">
            {dataset.labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </motion.div>

        {/* Secondary Metric Tabs / Switchers */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {(Object.keys(METRICS_DATA) as MetricKey[]).map((key, idx) => {
            const m = METRICS_DATA[key];
            const isSelected = activeMetricKey === key;
            const Icon = m.icon;
            const latestVal = m.history[timeRange].values[m.history[timeRange].values.length - 1];

            return (
              <motion.button
                key={key}
                onClick={() => setActiveMetricKey(key)}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-[120px] ${
                  isSelected
                    ? 'bg-[#433B68] text-white border-[#433B68] shadow-xl shadow-[#433B68]/15 -translate-y-1'
                    : 'bg-white text-[#433B68] border-gray-100 hover:border-[#7C5CFF]/30 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-white/70' : 'text-[#433B68]/50'}`}>
                    {m.name}
                  </span>
                  <Icon size={14} className={isSelected ? 'text-[#A294F9]' : 'text-[#433B68]/30'} />
                </div>

                <div className="flex flex-col mt-auto">
                  <span className="text-lg font-semibold tracking-tight">
                    {m.format(latestVal)}
                  </span>
                  <span className={`text-[10px] font-medium ${isSelected ? 'text-white/60' : 'text-[#433B68]/40'}`}>
                    Base: {m.format(m.baseline)}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

      </div>
    </section>
  );
};
