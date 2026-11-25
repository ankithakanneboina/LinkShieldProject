import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { COLORS, PREDICTION_LABEL, RISK_LABEL } from '../../lib/constants';
import { formatDayLabel, formatNumber } from '../../lib/format';

const AXIS = { fontSize: 12, fill: COLORS.axis };
const MARGIN = { top: 8, right: 8, bottom: 0, left: -12 };

/** Legend that is always text + swatch (identity is never colour alone). */
export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5" aria-label="Legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-sm text-ink-soft">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export const PREDICTION_LEGEND = [
  { label: PREDICTION_LABEL.legitimate, color: COLORS.legitimate },
  { label: PREDICTION_LABEL.phishing, color: COLORS.phishing },
];

function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line-strong bg-navy-800 px-3 py-2 text-sm shadow-panel">
      <p className="mb-1 font-medium text-ink">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-ink-soft">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color || p.payload?.fill }} aria-hidden="true" />
          {p.name}: <span className="font-mono text-ink">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

const Frame = ({ height = 260, label, children }) => (
  <div style={{ height }} role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height="100%">
      {children}
    </ResponsiveContainer>
  </div>
);

/** Stacked daily bars: legitimate + phishing. 2px surface strokes keep adjacent fills apart. */
export function ActivityChart({ data }) {
  return (
    <Frame label="Daily scans, split into legitimate and phishing">
      <BarChart data={data} margin={MARGIN} barCategoryGap="22%">
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={formatDayLabel} tick={AXIS} axisLine={{ stroke: COLORS.grid }} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={44} />
        <Tooltip cursor={{ fill: 'rgba(148,170,220,0.08)' }} content={<ChartTooltip labelFormatter={formatDayLabel} />} />
        <Bar dataKey="legitimate" name="Legitimate" stackId="scans" fill={COLORS.legitimate} stroke={COLORS.surface} strokeWidth={2} />
        <Bar dataKey="phishing" name="Phishing" stackId="scans" fill={COLORS.phishing} stroke={COLORS.surface} strokeWidth={2} radius={[4, 4, 0, 0]} />
      </BarChart>
    </Frame>
  );
}

/** Weekly trend lines. Markers are 8px with a surface ring, lines are 2px. */
export function TrendChart({ data }) {
  const dot = (color) => ({ r: 4, fill: color, stroke: COLORS.surface, strokeWidth: 2 });
  return (
    <Frame label="Weekly scans, legitimate and phishing">
      <LineChart data={data} margin={MARGIN}>
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey="weekStart" tickFormatter={formatDayLabel} tick={AXIS} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={44} />
        <Tooltip content={<ChartTooltip labelFormatter={(d) => `Week of ${formatDayLabel(d)}`} />} />
        <Line type="monotone" dataKey="legitimate" name="Legitimate" stroke={COLORS.legitimate} strokeWidth={2} dot={dot(COLORS.legitimate)} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="phishing" name="Phishing" stroke={COLORS.phishing} strokeWidth={2} dot={dot(COLORS.phishing)} activeDot={{ r: 5 }} />
      </LineChart>
    </Frame>
  );
}

/** Donut + text list. items: [{ key, label, value, color }] */
export function DonutChart({ items, centerLabel = 'scans', ariaLabel }) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (total === 0) {
    return <p className="py-12 text-center text-sm text-ink-mute">No data in this period.</p>;
  }
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div className="relative h-[190px] w-[190px] shrink-0" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} dataKey="value" nameKey="label" innerRadius={58} outerRadius={88} paddingAngle={items.filter((i) => i.value > 0).length > 1 ? 2 : 0} stroke={COLORS.surface} strokeWidth={2} isAnimationActive={false}>
              {items.map((i) => (
                <Cell key={i.key} fill={i.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold tabular-nums">{formatNumber(total)}</span>
          <span className="text-xs text-ink-mute">{centerLabel}</span>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {items.map((i) => (
          <li key={i.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden="true" />
              {i.label}
            </span>
            <span className="font-mono text-ink">
              {formatNumber(i.value)} <span className="text-ink-mute">({Math.round((i.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function riskDonutItems(riskDistribution = []) {
  return ['low', 'medium', 'high'].map((level) => ({
    key: level,
    label: RISK_LABEL[level],
    value: riskDistribution.find((r) => r.category === level)?.count || 0,
    color: COLORS[level],
  }));
}

export function predictionDonutItems(counts) {
  return [
    { key: 'legitimate', label: PREDICTION_LABEL.legitimate, value: counts.legitimate || 0, color: COLORS.legitimate },
    { key: 'phishing', label: PREDICTION_LABEL.phishing, value: counts.phishing || 0, color: COLORS.phishing },
  ];
}

/** Single-series column chart (neutral colour: there is only one series, so no legend is needed). */
export function SimpleBars({ data, xKey, yKey, name, label, xFormatter }) {
  return (
    <Frame label={label} height={230}>
      <BarChart data={data} margin={MARGIN} barCategoryGap="18%">
        <CartesianGrid stroke={COLORS.grid} vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={xFormatter} tick={AXIS} axisLine={{ stroke: COLORS.grid }} tickLine={false} interval="preserveStartEnd" minTickGap={14} />
        <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={44} />
        <Tooltip cursor={{ fill: 'rgba(148,170,220,0.08)' }} content={<ChartTooltip labelFormatter={xFormatter} />} />
        <Bar dataKey={yKey} name={name} fill={COLORS.neutral} radius={[4, 4, 0, 0]} />
      </BarChart>
    </Frame>
  );
}

/**
 * Horizontal bar list rendered as HTML (labels are real text, so it reads well and wraps on mobile).
 * items: [{ label, value, secondary?, detail? }]; `secondary` is drawn as a phishing-coloured part of the bar.
 */
export function BarList({ items, secondaryLabel, empty = 'Nothing to show yet.' }) {
  if (!items.length) return <p className="py-8 text-center text-sm text-ink-mute">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3.5">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink" title={i.label}>
              {i.label}
            </span>
            <span className="shrink-0 font-mono text-xs text-ink-soft">
              {formatNumber(i.value)}
              {typeof i.secondary === 'number' && secondaryLabel ? ` · ${formatNumber(i.secondary)} ${secondaryLabel}` : ''}
              {i.detail ? ` · ${i.detail}` : ''}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-navy-700" aria-hidden="true">
            <div className="relative h-full rounded-full" style={{ width: `${(i.value / max) * 100}%`, background: COLORS.neutral }}>
              {typeof i.secondary === 'number' && i.value > 0 && (
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(i.secondary / i.value) * 100}%`, background: COLORS.phishing }} />
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
