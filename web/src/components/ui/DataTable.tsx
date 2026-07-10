import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'
import { TableSkeleton } from './Skeleton'

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => ReactNode
  className?: string
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  keyExtractor: (item: T) => string | number
  onRowClick?: (item: T) => void
}

export function DataTable<T>({
  columns, data, loading, keyExtractor, onRowClick,
}: DataTableProps<T>) {
  if (loading) return <TableSkeleton rows={8} cols={columns.length} />
  if (!data.length) return <EmptyState />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--card-border)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-${col.align ?? 'left'} ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={`border-b border-[var(--card-border)] transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-[var(--text)] text-${col.align ?? 'left'} ${col.className ?? ''}`}
                >
                  {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
