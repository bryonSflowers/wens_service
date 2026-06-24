import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-gray-500">{total} total items</p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-ghost p-1 disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
          .map((p, idx, arr) => (
            <span key={p} className="flex items-center">
              {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-400">...</span>}
              <button
                onClick={() => onPageChange(p)}
                className={`min-w-[32px] h-8 rounded-md text-sm font-medium ${
                  p === page ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            </span>
          ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-ghost p-1 disabled:opacity-30"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
