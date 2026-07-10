import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number | ReactNode
  icon?: LucideIcon
  trend?: { value: string; positive: boolean }
}

export function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="glass rounded-xl p-5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
        {Icon && <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500" />}
      </div>
      <span className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
        {value}
      </span>
      {trend && (
        <span className={`text-xs font-medium flex items-center gap-1 ${
          trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
        }`}>
          {trend.positive ? '▲' : '▼'} {trend.value}
        </span>
      )}
    </div>
  )
}
