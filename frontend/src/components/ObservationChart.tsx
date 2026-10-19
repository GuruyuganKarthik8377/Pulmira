import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Clock3 } from 'lucide-react';
import { CHANNEL_NAMES, formatDate, formatValue } from '../lib/monitoring';
import type { Channel } from '../lib/monitoring';
import { chartSegments, timestamp } from '../lib/patient-data';
import type { Observation } from '../lib/patient-data';

export function ObservationChart({ rows, series, asOf }: { rows: Observation[]; series: Channel; asOf: string }) {
  const [range, setRange] = useState('all');
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(760);
  useEffect(() => {
    if (!chartRef.current) return;
    const observer = new ResizeObserver(entries => setChartWidth(Math.max(240, Math.round(entries[0].contentRect.width))));
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, []);
  const [point, setPoint] = useState<number | null>(null);
  const points = useMemo(() => rows.filter(row => range === 'all' || Date.parse(row.measurement_end) >= Date.parse(asOf) - Number(range) * 86400000), [rows, asOf, range]);
  const currentIndex = Math.min(point ?? points.length - 1, points.length - 1);
  const current = points[currentIndex];
  const W = chartWidth, H = 225, L = 54, R = 18, T = 24, B = 38;
  const minTime = points.length ? Date.parse(points[0].measurement_end) : 0;
  const maxTime = points.length ? Date.parse(points.at(-1)!.measurement_end) : 1;
  const values = points.map(row => row.value);
  if (series.baseline.mean !== null) values.push(series.baseline.mean);
  const low = values.length ? Math.min(...values) : 0, high = values.length ? Math.max(...values) : 1;
  const pad = Math.max((high - low) * .2, series.channel === 'spo2_pct' ? .5 : .1);
  const yMin = low - pad, yMax = high + pad;
  const x = (time: string) => points.length === 1 ? (W + L - R) / 2 : L + (Date.parse(time) - minTime) / Math.max(1, maxTime - minTime) * (W - L - R);
  const y = (value: number) => T + (yMax - value) / (yMax - yMin) * (H - T - B);
  return <div className="observation-chart" ref={chartRef}>
    <div className="chart-toolbar"><div><span className="chart-legend"><i /> Recorded value</span>{series.baseline.mean !== null && <span className="chart-legend baseline-legend"><i /> Baseline at this snapshot</span>}</div><label className="chart-range-label">Window <select aria-label="Chart time window" value={range} onChange={event => { setRange(event.target.value); setPoint(null); }}><option value="all">All available history</option><option value="30">30 days before snapshot</option><option value="7">7 days before snapshot</option></select></label></div>
    {!points.length ? <div className="patient-empty chart-empty"><Activity size={27} /><h3>No readings in this window</h3><p>Try all available history. Older readings are not moved into this period.</p><button className="text-link" onClick={() => setRange('all')}>Show all history</button></div> : <>
      <div className="chart-readout" aria-live="polite"><strong>{formatValue({ ...series, value: current.value })}</strong><span>{timestamp(current.measurement_end)}</span><small>{currentIndex + 1} of {points.length} recorded values</small></div>
      <svg className="patient-line-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${CHANNEL_NAMES[series.channel]} history: ${points.length} observations from ${formatDate(points[0].measurement_end)} to ${formatDate(points.at(-1)!.measurement_end)}. Gaps greater than 48 hours are not connected.`}>
        {[0, 1, 2, 3].map(i => { const value = yMin + (yMax - yMin) * i / 3; return <g key={i}><line x1={L} x2={W-R} y1={y(value)} y2={y(value)} stroke="#eeeaf6" strokeDasharray="4 5" /><text x={L-12} y={y(value)+4} textAnchor="end">{value.toFixed(series.channel === 'gait_speed_m_per_s' ? 2 : 1)}</text></g>; })}
        {series.baseline.mean !== null && <line x1={L} x2={W-R} y1={y(series.baseline.mean)} y2={y(series.baseline.mean)} stroke="#b5a7cf" strokeDasharray="6 5" />}
        {chartSegments(points).filter(group => group.length > 1).map(group => <path key={group[0].observation_id} d={group.map((row, i) => `${i ? 'L' : 'M'}${x(row.measurement_end)},${y(row.value)}`).join(' ')} fill="none" stroke="#9473dc" strokeWidth="2.2" strokeLinejoin="round" />)}
        {points.map((row, i) => <circle key={row.observation_id} cx={x(row.measurement_end)} cy={y(row.value)} r={i === currentIndex ? 5 : 2.5} fill={i === currentIndex ? '#7050bc' : '#b69cde'} onMouseEnter={() => setPoint(i)} onClick={() => setPoint(i)}><title>{timestamp(row.measurement_end)} · {row.value} {row.units}</title></circle>)}
        <text x={L} y={H-8}>{formatDate(points[0].measurement_end)}</text><text x={W-R} y={H-8} textAnchor="end">{points.length > 1 ? formatDate(points.at(-1)!.measurement_end) : ''}</text>
      </svg>
      <div className="chart-point-control"><label htmlFor="observation-point">Inspect observation</label><input id="observation-point" aria-label="Inspect observation" aria-valuetext={`${timestamp(current.measurement_end)}, ${formatValue({ ...series, value: current.value })}`} type="range" min="0" max={Math.max(0,points.length-1)} value={currentIndex} disabled={points.length === 1} onChange={event => setPoint(Number(event.target.value))} /><span>{currentIndex+1}/{points.length}</span></div>
      <div className="chart-availability"><Clock3 size={13} /> Available by {timestamp(current.available_at)}</div>
      <details className="observation-table-details"><summary>View recorded values ({points.length})</summary><div className="patient-table-scroll"><table><thead><tr><th>Measurement time</th><th>Value</th><th>Available at</th></tr></thead><tbody>{points.map(row => <tr key={row.observation_id}><td>{timestamp(row.measurement_end)}</td><td>{formatValue({ ...series, value: row.value })}</td><td>{timestamp(row.available_at)}</td></tr>)}</tbody></table></div></details>
    </>}
    <p className="chart-caption">Recorded timestamps only. Lines stop at gaps over 48 hours. Chart calendar dates use UTC; detailed times show their timezone. Baseline is descriptive and fixed to the selected snapshot.</p>
  </div>;
}
