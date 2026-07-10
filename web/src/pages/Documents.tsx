import { useEffect, useState, useRef, useCallback } from 'react'
import { Upload, FileText, Trash2, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react'
import { documentsApi } from '../api/client'
import { useT } from '../i18n'
import { PageLoading } from '../components/ui/Loading'
import { EmptyState } from '../components/ui/EmptyState'
import { Pagination } from '../components/ui/Pagination'
import type { UploadedDoc } from '../types'

const ACCEPTED = '.txt,.csv,.xlsx,.xls,.docx,.doc'

function fileIcon(type: string) {
  switch (type) {
    case 'excel': return <FileSpreadsheet className="w-10 h-10 text-green-500" />
    case 'word': return <FileText className="w-10 h-10 text-blue-500" />
    default: return <FileText className="w-10 h-10 text-slate-400" />
  }
}

export function DocumentsPage() {
  const [docs, setDocs] = useState<UploadedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadTicker, setUploadTicker] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selected, setSelected] = useState<UploadedDoc | null>(null)
  const [selectLoading, setSelectLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const _ = useT()

  const load = useCallback(async () => {
    try {
      const res = await documentsApi.list({ page, page_size: 20 })
      setDocs(res.data.items || [])
      setTotal(res.data.total || 0)
      setTotalPages(res.data.total_pages || 1)
    } catch {}
    setLoading(false)
  }, [page])

  const selectDoc = async (id: number) => {
    setSelectedId(id)
    setSelectLoading(true)
    try {
      const res = await documentsApi.get(id)
      setSelected(res.data)
    } catch {
      setSelected(null)
    }
    setSelectLoading(false)
  }

  useEffect(() => { load() }, [load])

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setStatus({ ok: false, msg: `${file.name} ${_('doc.fileTooLarge')}` })
      return
    }
    setUploading(true)
    setStatus(null)
    try {
      await documentsApi.upload(file, uploadTicker || undefined)
      setStatus({ ok: true, msg: `${file.name} ${_('doc.uploadSuccess')}` })
      load()
    } catch (e: any) {
      setStatus({ ok: false, msg: e.response?.data?.detail || `${_('doc.uploadFailed')} ${file.name}` })
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    for (const f of Array.from(e.dataTransfer.files)) upload(f)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const f of Array.from(e.target.files || [])) upload(f)
    if (fileRef.current) fileRef.current.value = ''
  }

  const del = async (id: number) => {
    await documentsApi.delete(id)
    if (selected?.id === id) setSelected(null)
    load()
  }

  const formatSize = (wordCount: number) => {
    const bytes = wordCount * 6
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">{_('doc.title')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{_('doc.subtitle')}</p>
      </div>

      <div
        className={`card p-6 text-center transition-all ${
          dragOver ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-2 border-dashed border-[var(--card-border)]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="flex gap-4 items-start mb-4">
          <div className="flex-1 text-left">
            <label className="label">{_('portfolio.ticker')}</label>
            <input className="input max-w-xs" placeholder="3045.TW" value={uploadTicker}
              onChange={(e) => setUploadTicker(e.target.value)}
              onClick={(e) => e.stopPropagation()} />
          </div>
          <div className="flex-1 pt-5" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" hidden accept={ACCEPTED} multiple onChange={handleFileSelect} />
            <Upload className="w-10 h-10 mx-auto mb-2 text-[var(--text-secondary)]" />
            <p className="text-sm font-medium text-[var(--text)]">
              {uploading ? _('doc.uploading') : dragOver ? _('doc.uploadZoneDrag') : _('doc.uploadZone')}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{_('doc.supportedFormats')}</p>
          </div>
        </div>
        {uploading && (
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <span className="text-sm text-[var(--text-secondary)]">{_('doc.processing')}</span>
          </div>
        )}
      </div>

      {status && (
        <div className={`card p-4 flex items-center justify-between ${
          status.ok ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {status.ok ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" /> : <AlertCircle className="w-5 h-5 text-red-500 dark:text-red-400" />}
            <span className="text-sm">{status.msg}</span>
          </div>
          <button onClick={() => setStatus(null)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 card">
          <div className="card-header"><h3 className="font-semibold text-sm text-[var(--text)]">{_('doc.uploadedFiles')}</h3></div>
          {docs.length === 0 ? <div className="card-body"><EmptyState title={_('doc.noDocuments')} description={_('doc.noDocumentsDesc')} /></div> : (
            <div className="divide-y divide-[var(--card-border)] max-h-[500px] overflow-y-auto">
              {docs.map((d) => (
                <button key={d.id} onClick={() => selectDoc(d.id)}
                  className={`w-full text-left p-4 hover:bg-[var(--sidebar-link-hover)] transition-colors flex items-center gap-3 ${
                    selectedId === d.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}>
                  {fileIcon(d.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">{d.filename}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {d.word_count.toLocaleString()} {_('common.words')} <span className="mx-1">·</span> {formatSize(d.word_count)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="p-3 border-t border-[var(--card-border)]">
            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </div>
        </div>

        <div className="lg:col-span-2 card">
          {!selectedId ? (
            <div className="card-body">
              <EmptyState title={_('doc.selectDoc')} description={_('doc.selectDocDesc')} icon="inbox" />
            </div>
          ) : selectLoading ? (
            <div className="card-body flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : !selected ? (
            <div className="card-body">
              <EmptyState title={_('doc.errorLoading')} description={_('doc.errorLoadingDesc')} icon="alert" />
            </div>
          ) : (
            <>
              <div className="card-header">
                <div className="flex items-center gap-3">
                  {fileIcon(selected.file_type)}
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--text)]">{selected.filename}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {selected.word_count.toLocaleString()} {_('common.words')} <span className="mx-1">·</span>
                      {_('common.uploaded')} {new Date(selected.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button onClick={() => del(selected.id)} className="btn-ghost p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="card-body max-h-[600px] overflow-y-auto">
                {!selected.content ? (
                  <div className="text-center py-8 text-[var(--text-secondary)]">
                    <p className="text-sm">{_('doc.noContent')}</p>
                  </div>
                ) : selected.raw_tables && Array.isArray(selected.raw_tables) && selected.raw_tables.length > 0 ? (
                  <div className="space-y-6">
                    {(selected.raw_tables as string[][][]).map((table, ti) => (
                      <div key={ti}>
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">{_('doc.table')} {ti + 1}</h4>
                        <div className="overflow-x-auto border border-[var(--card-border)] rounded-lg">
                          <table className="w-full text-xs">
                            <tbody>
                              {table.slice(0, 100).map((row, ri) => (
                                <tr key={ri} className={ri === 0 ? 'bg-[var(--sidebar-link-hover)] font-medium' : 'border-t border-[var(--card-border)]'}>
                                  {row.map((cell, ci) => (
                                    <td key={ci} className="px-3 py-1.5 whitespace-nowrap font-mono">{cell}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {table.length > 100 && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1">{_('doc.showingFirst').replace('{count}', String(table.length))}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="text-sm font-mono whitespace-pre-wrap text-[var(--text)] leading-relaxed">
                    {selected.content.length > 50000
                      ? selected.content.slice(0, 50000) + `\n\n... (${_('doc.truncated')})`
                      : selected.content}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
