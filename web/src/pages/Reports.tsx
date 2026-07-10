import { useEffect, useState } from 'react'
import { useT } from '../i18n'
import { useNavigate } from 'react-router-dom'
import { Plus, ExternalLink, TrendingUp } from 'lucide-react'
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
    {
      key: 'year',
      header: 'Period',
      render: (r) => (
        <span className="font-mono font-semibold text-[var(--text)]">
          {r.year}-{String(r.month).padStart(2, '0')}
        </span>
      ),
    },
    {
      key: 'revenue',
      header: `${_('reports.revenue')} (NT$M)`,
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[var(--text)]">{r.revenue?.toLocaleString() ?? '—'}</span>
      ),
    },
    {
      key: 'expenses',
      header: `${_('reports.expenses')} (NT$M)`,
      align: 'right',
      render: (r) => (
        <span className="font-mono text-[var(--red)]">{r.expenses?.toLocaleString() ?? '—'}</span>
      ),
    },
    {
      key: 'net_income',
      header: `${_('reports.netIncome')} (NT$M)`,
      align: 'right',
      render: (r) => {
        const positive = (r.net_income ?? 0) >= 0
        return (
          <span className={`font-mono font-semibold ${positive ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
            {positive ? '+' : ''}{r.net_income?.toLocaleString() ?? '—'}
          </span>
        )
      },
    },
    {
      key: 'id',
      header: '',
      className: 'w-10',
      render: () => <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)]" />,
    },
  ]

  if (loading && !data.length) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{_('reports.title')}</h1>
          <p className="page-subtitle">Taiwan Mobile Co. financial data</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/reports/generate')}>
          <Plus className="w-4 h-4" /> {_('reports.generate')}
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="font-semibold text-sm flex items-center gap-2 text-[var(--text)]">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
            Monthly Financials
          </h3>
          <span className="badge badge-blue">{total} records</span>
        </div>
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          keyExtractor={(r) => `${r.year}-${r.month}`}
          onRowClick={setSelected}
        />
        <div className="px-4 pb-4 border-t border-[var(--card-border)] pt-3">
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={`${_('reports.title')}: ${selected?.year}-${String(selected?.month).padStart(2, '0')}`}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: _('reports.revenue'),   value: selected.revenue,   color: 'text-[var(--accent)]' },
                { label: _('reports.expenses'),  value: selected.expenses,  color: 'text-[var(--red)]' },
                { label: _('reports.netIncome'), value: selected.net_income, color: 'text-[var(--green)]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="card p-4 text-center">
                  <p className="text-xs text-[var(--text-secondary)] mb-1">{label}</p>
                  <p className={`text-xl font-bold font-mono ${color}`}>{value?.toLocaleString() ?? '—'}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">NT$M</p>
                </div>
              ))}
            </div>
            {selected.notes && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--text)] mb-1">Notes</h4>
                <p className="text-sm text-[var(--text-secondary)]">{selected.notes}</p>
              </div>
            )}
            {selected.report_data && (
              <div>
                <h4 className="text-sm font-semibold text-[var(--text)] mb-1">Report Data</h4>
                <pre className="text-xs bg-[var(--accent-light)] text-[var(--text)] rounded-lg p-4 overflow-x-auto max-h-64">
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
