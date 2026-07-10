interface TooltipEntry {
  dataKey: string
  name?: string
  value?: number | string
  color?: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
  formatter?: (value: number | string, name: string) => string
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="glass rounded-xl px-4 py-3 shadow-xl border border-[var(--card-border)] min-w-[140px]">
      {label && (
        <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2 pb-2 border-b border-[var(--card-border)]">
          {label}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry, i) => {
          const display = formatter && typeof entry.value !== 'undefined'
            ? formatter(entry.value, entry.name ?? entry.dataKey)
            : typeof entry.value === 'number'
              ? entry.value.toLocaleString()
              : String(entry.value ?? '-')
          return (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
                <span className="text-xs text-[var(--text-secondary)]">{entry.name ?? entry.dataKey}</span>
              </div>
              <span className="text-xs font-mono font-semibold text-[var(--text)]">{display}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
