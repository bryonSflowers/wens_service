import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: { value: string; positive: boolean }
}

export function StatCard({ label, value, icon: Icon, trend }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {Icon && <Icon className="w-5 h-5 text-gray-400" />}
      </div>
      <span className="stat-value">{value}</span>
      {trend && (
        <span className={`text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
          {trend.positive ? '↑' : '↓'} {trend.value}
        </span>
      )}
    </div>
  )
}
