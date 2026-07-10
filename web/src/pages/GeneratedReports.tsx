import { useEffect, useState } from 'react'
import { generatedReportsApi } from '../api/client'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { Modal } from '../components/ui/Modal'
import { PageLoading } from '../components/ui/Loading'
import type { GeneratedReport } from '../types'
import { useT } from '../i18n'
import { ExternalLink } from 'lucide-react'

export function GeneratedReportsPage() {
  const _ = useT()
  const [data, setData] = useState<GeneratedReport[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<GeneratedReport | null>(null)

  const fetch = async (p: number) => {
    setLoading(true)
    try {
      const { data: res } = await generatedReportsApi.list({ page: p, page_size: 15 })
      setData(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
      setPage(res.page)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch(page) }, [page])

  const columns: Column<GeneratedReport>[] = [
    { key: 'id', header: 'ID', render: (r: GeneratedReport) => <span className="font-mono text-xs">#{r.id}</span> },
    { key: 'query', header: 'Query', render: (r: GeneratedReport) => (
      <span className="truncate block max-w-[400px]">{r.query}</span>
    )},
    { key: 'model', header: _('generated.model'), render: (r: GeneratedReport) => r.model || '-' },
    { key: 'tokens_used', header: _('generated.tokens'), render: (r: GeneratedReport) => r.tokens_used ?? '-' },
    { key: 'created_at', header: 'Date', render: (r: GeneratedReport) => new Date(r.created_at).toLocaleDateString() },
    { key: 'id2', header: '', render: () => <ExternalLink className="w-4 h-4 text-gray-400" />, className: 'w-10' },
  ]

  if (loading && !data.length) return <PageLoading />

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{_('generated.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">History of LLM-generated financial reports</p>
      </div>

      <div className="card overflow-hidden">
        <DataTable
          columns={columns}
          data={data}
          loading={loading}
          keyExtractor={(r) => r.id}
          onRowClick={setSelected}
        />
        <div className="px-4 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title={_('generated.title')} size="xl">
        {selected && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm text-gray-500">
              <span>{_('generated.model')}: {selected.model || 'N/A'}</span>
              <span>{_('generated.tokens')}: {selected.tokens_used ?? 'N/A'}</span>
              <span>Date: {new Date(selected.created_at).toLocaleString()}</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Query</h4>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selected.query}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Report</h4>
              <div className="prose-report bg-gray-50 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
                {selected.report.split('\n').map((line, i) => (
                  <p key={i} className="text-sm">{line}</p>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
