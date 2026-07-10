import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { useNavigate } from 'react-router-dom'
import { Plus, ExternalLink } from 'lucide-react'
import { reportsApi } from '../api/client'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { PageLoading } from '../components/ui/Loading'
import { Modal } from '../components/ui/Modal'
import type { MonthlyReport } from '../types'

export function ReportsPage() {
  const navigate = useNavigate()
  const _ = useT()
  const [data, setData] = useState<MonthlyReport[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<MonthlyReport | null>(null)

  const fetch = async (p: number) => {
    setLoading(true)
    try {
      const { data: res } = await reportsApi.list({ page: p, page_size: 12 })
      setData(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
      setPage(res.page)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch(page) }, [page])

  const columns: Column<MonthlyReport>[] = [
    { key: 'year', header: 'Period', render: (r) => `${r.year}-${String(r.month).padStart(2, '0')}` },
    { key: 'revenue', header: `${_('reports.revenue')} (NT$M)`, render: (r) => r.revenue?.toLocaleString() ?? '-' },
    { key: 'expenses', header: `${_('reports.expenses')} (NT$M)`, render: (r) => r.expenses?.toLocaleString() ?? '-' },
    { key: 'net_income', header: `${_('reports.netIncome')} (NT$M)`, render: (r) => r.net_income?.toLocaleString() ?? '-' },
    { key: 'id', header: '', render: () => <ExternalLink className="w-4 h-4 text-gray-400" />, className: 'w-10' },
  ]

  if (loading && !data.length) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{_('reports.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">Taiwan Mobile financial data</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/reports/generate')}>
          <Plus className="w-4 h-4" /> {_('reports.generate')}
        </button>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          keyExtractor={(r) => `${r.year}-${r.month}`}
          onRowClick={setSelected}
        />
        <div className="px-4 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={`${_('reports.title')}: ${selected?.year}-${String(selected?.month).padStart(2, '0')}`} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-500">{_('reports.revenue')}</p>
                <p className="text-xl font-bold text-blue-600">{selected.revenue?.toLocaleString() ?? '-'}</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-500">{_('reports.expenses')}</p>
                <p className="text-xl font-bold text-red-600">{selected.expenses?.toLocaleString() ?? '-'}</p>
              </div>
              <div className="card p-4 text-center">
                <p className="text-xs text-gray-500">{_('reports.netIncome')}</p>
                <p className="text-xl font-bold text-green-600">{selected.net_income?.toLocaleString() ?? '-'}</p>
              </div>
            </div>
            {selected.notes && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Notes</h4>
                <p className="text-sm text-gray-600">{selected.notes}</p>
              </div>
            )}
            {selected.report_data && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Report Data</h4>
                <pre className="text-xs bg-gray-50 rounded-lg p-4 overflow-x-auto max-h-64">
                  {JSON.stringify(selected.report_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
