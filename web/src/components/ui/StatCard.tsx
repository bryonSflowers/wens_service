import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type AccentColor = 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'cyan'

const ACCENTS: Record<AccentColor, { border: string; iconBg: string; iconColor: string }> = {
  blue:   { border: '#3b82f6', iconBg: 'rgba(59,130,246,0.12)',  iconColor: '#3b82f6' },
  green:  { border: '#22c55e', iconBg: 'rgba(34,197,94,0.12)',   iconColor: '#22c55e' },
  purple: { border: '#a855f7', iconBg: 'rgba(168,85,247,0.12)', iconColor: '#a855f7' },
  amber:  { border: '#f59e0b', iconBg: 'rgba(245,158,11,0.12)', iconColor: '#f59e0b' },
  red:    { border: '#ef4444', iconBg: 'rgba(239,68,68,0.12)',   iconColor: '#ef4444' },
  cyan:   { border: '#06b6d4', iconBg: 'rgba(6,182,212,0.12)',   iconColor: '#06b6d4' },
}

interface StatCardProps {
  label: ReactNode
  value: string | number | ReactNode
  icon?: LucideIcon
  trend?: { value: string; positive: boolean }
  color?: AccentColor
}

export function StatCard({ label, value, icon: Icon, trend, color = 'blue' }: StatCardProps) {
  const accent = ACCENTS[color]
  return (
    <div
      className="card p-5 relative overflow-hidden flex flex-col gap-2"
      style={{ borderTop: `3px solid ${accent.border}` }}
    >
      <div className="flex items-start justify-between">
        <p className="stat-label">{label}</p>
        {Icon && (
          <div
            className="rounded-lg p-2 shrink-0"
            style={{ background: accent.iconBg, color: accent.iconColor }}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <p className="stat-value">{value}</p>
      {trend && (
        <p className={`text-xs font-semibold flex items-center gap-1 ${
          trend.positive ? 'text-[var(--green)]' : 'text-[var(--red)]'
        }`}>
          {trend.positive ? '▲' : '▼'} {trend.value}
        </p>
      )}
    </div>
  )
}
