import type { ReactNode } from 'react'
import { EmptyState } from './EmptyState'
import { Loading } from './Loading'

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => ReactNode
  className?: string
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
  if (loading) return <Loading />
  if (!data.length) return <EmptyState />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {columns.map((col) => (
              <th key={col.key} className={`text-left px-4 py-3 font-medium text-gray-500 ${col.className || ''}`}>
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
              className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
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
