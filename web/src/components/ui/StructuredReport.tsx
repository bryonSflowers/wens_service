import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, AlertTriangle, Info } from 'lucide-react'

type Section =
  | { type: 'metric_grid'; title: string; items: { label: string; value: string; change?: string }[] }
  | { type: 'chart'; title: string; chartType: 'bar' | 'line'; labels: string[]; datasets: { label: string; data: number[] }[] }
  | { type: 'insight'; icon: 'up' | 'down' | 'warning' | 'info'; text: string }
  | { type: 'narrative'; title?: string; text: string }
  | { type: 'table'; title?: string; headers: string[]; rows: string[][] }

const INSIGHT_ICONS = { up: TrendingUp, down: TrendingDown, warning: AlertTriangle, info: Info }
const INSIGHT_COLORS = { up: 'text-green-600', down: 'text-red-500', warning: 'text-yellow-600', info: 'text-blue-500' }
const CHART_COLORS = ['#2563eb', '#F58220', '#E5006D', '#0096D6', '#16a34a', '#7c3aed']

function MetricGrid({ section }: { section: Section & { type: 'metric_grid' } }) {
  return (
    <div className="mb-6">
      <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{section.title}</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {section.items.map((item, i) => (
          <div key={i} className="card p-3">
            <p className="text-[10px] text-[var(--text-secondary)]">{item.label}</p>
            <p className="text-lg font-bold font-mono text-[var(--text)]">{item.value}</p>
            {item.change && (
              <p className={`text-[11px] font-medium ${item.change.startsWith('+') || item.change.startsWith('▲') ? 'text-green-600' : 'text-red-500'}`}>
                {item.change}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChartSection({ section }: { section: Section & { type: 'chart' } }) {
  const data = section.labels.map((label, i) => {
    const point: Record<string, string | number> = { name: label }
    section.datasets.forEach((ds) => { point[ds.label] = ds.data[i] ?? 0 })
    return point
  })
  return (
    <div className="mb-6 card p-4">
      <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{section.title}</h4>
      <ResponsiveContainer width="100%" height={250}>
        {section.chartType === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
            <Tooltip />
            {section.datasets.map((ds, i) => <Bar key={ds.label} dataKey={ds.label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4,4,0,0]} barSize={36} />)}
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
            <Tooltip />
            {section.datasets.map((ds, i) => <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={false} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

function InsightCard({ section }: { section: Section & { type: 'insight' } }) {
  const Icon = INSIGHT_ICONS[section.icon] || Info
  return (
    <div className="mb-3 flex items-start gap-3 p-3 rounded-lg border border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${INSIGHT_COLORS[section.icon] || 'text-blue-500'}`} />
      <p className="text-sm text-[var(--text)] leading-relaxed">{section.text}</p>
    </div>
  )
}

function NarrativeBlock({ section }: { section: Section & { type: 'narrative' } }) {
  return (
    <div className="mb-4">
      {section.title && <h4 className="text-sm font-semibold text-[var(--text)] mb-2">{section.title}</h4>}
      <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{section.text}</p>
    </div>
  )
}

function DataTable({ section }: { section: Section & { type: 'table' } }) {
  return (
    <div className="mb-6 overflow-x-auto">
      {section.title && <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">{section.title}</h4>}
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[var(--card-border)]">
            {section.headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-semibold text-[var(--text-secondary)]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-[var(--card-border)] hover:bg-[var(--sidebar-link-hover)]">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 font-mono text-[var(--text)]">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StructuredReport({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-1">
      {sections.map((s, i) => {
        switch (s.type) {
          case 'metric_grid': return <MetricGrid key={i} section={s} />
          case 'chart': return <ChartSection key={i} section={s} />
          case 'insight': return <InsightCard key={i} section={s} />
          case 'narrative': return <NarrativeBlock key={i} section={s} />
          case 'table': return <DataTable key={i} section={s} />
          default: return null
        }
      })}
    </div>
  )
}
