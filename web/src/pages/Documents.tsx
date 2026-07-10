import { useEffect, useState, useRef, useCallback } from 'react'
import { Upload, FileText, Trash2, FileSpreadsheet, AlertCircle, CheckCircle, X } from 'lucide-react'
import { documentsApi } from '../api/client'
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
  const [selected, setSelected] = useState<UploadedDoc | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await documentsApi.list({ page, page_size: 20 })
      setDocs(res.data.items || [])
      setTotal(res.data.total || 0)
      setTotalPages(res.data.total_pages || 1)
    } catch {}
    setLoading(false)
  }, [page])

  useEffect(() => { load() }, [load])

  const upload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setStatus({ ok: false, msg: `${file.name} is too large (max 20MB)` })
      return
    }
    setUploading(true)
    setStatus(null)
    try {
      await documentsApi.upload(file)
      setStatus({ ok: true, msg: `${file.name} uploaded successfully` })
      load()
    } catch (e: any) {
      setStatus({ ok: false, msg: e.response?.data?.detail || `Failed to upload ${file.name}` })
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

  const formatSize = (content: string) => {
    const bytes = new Blob([content]).size
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">Documents</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">Upload Excel, Word, or text files to extract and store their data</p>
      </div>

      <div
        className={`card p-8 text-center cursor-pointer transition-all ${
          dragOver ? 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-2 border-dashed border-[var(--card-border)]'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" hidden accept={ACCEPTED} multiple onChange={handleFileSelect} />
        <Upload className="w-10 h-10 mx-auto mb-3 text-[var(--text-secondary)]" />
        <p className="text-sm font-medium text-[var(--text)]">
          {uploading ? 'Uploading...' : dragOver ? 'Drop files here' : 'Drag & drop files or click to browse'}
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-1">Supports .txt, .csv, .xlsx, .xls, .docx, .doc (max 20MB)</p>
        {uploading && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
            <span className="text-sm text-[var(--text-secondary)]">Processing...</span>
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
          <div className="card-header"><h3 className="font-semibold text-sm text-[var(--text)]">Uploaded Files</h3></div>
          {docs.length === 0 ? <div className="card-body"><EmptyState title="No documents" description="Upload a file to get started." /></div> : (
            <div className="divide-y divide-[var(--card-border)] max-h-[500px] overflow-y-auto">
              {docs.map((d) => (
                <button key={d.id} onClick={() => setSelected(d)}
                  className={`w-full text-left p-4 hover:bg-[var(--sidebar-link-hover)] transition-colors flex items-center gap-3 ${
                    selected?.id === d.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}>
                  {fileIcon(d.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate">{d.filename}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {d.word_count.toLocaleString()} words <span className="mx-1">·</span> {formatSize(d.content)}
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
          {!selected ? (
            <div className="card-body">
              <EmptyState title="Select a document" description="Click a file on the left to view its parsed content." icon="inbox" />
            </div>
          ) : (
            <>
              <div className="card-header">
                <div className="flex items-center gap-3">
                  {fileIcon(selected.file_type)}
                  <div>
                    <h3 className="font-semibold text-sm text-[var(--text)]">{selected.filename}</h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {selected.word_count.toLocaleString()} words <span className="mx-1">·</span>
                      Uploaded {new Date(selected.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <button onClick={() => del(selected.id)} className="btn-ghost p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="card-body max-h-[600px] overflow-y-auto">
                {selected.raw_tables && selected.raw_tables.length > 0 ? (
                  <div className="space-y-6">
                    {(selected.raw_tables as string[][][]).map((table, ti) => (
                      <div key={ti}>
                        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">Table {ti + 1}</h4>
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
                          <p className="text-xs text-[var(--text-secondary)] mt-1">Showing first 100 of {table.length} rows</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="text-sm font-mono whitespace-pre-wrap text-[var(--text)] leading-relaxed">
                    {selected.content.length > 50000
                      ? selected.content.slice(0, 50000) + '\n\n... (truncated, full content too large to display)'
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
