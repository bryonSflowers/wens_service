import { useEffect, useState } from 'react'
import { templatesApi } from '../api/client'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { Modal } from '../components/ui/Modal'
import { PageLoading } from '../components/ui/Loading'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useT } from '../i18n'
import type { ReportTemplate, TemplateCreate } from '../types'

export function TemplatesPage() {
  const _ = useT()
  const [data, setData] = useState<ReportTemplate[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<ReportTemplate | null>(null)
  const [form, setForm] = useState<TemplateCreate>({ name: '', query_text: '', description: '', is_public: false })

  const fetch = async (p: number) => {
    setLoading(true)
    try {
      const { data: res } = await templatesApi.list({ page: p, page_size: 10 })
      setData(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
      setPage(res.page)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch(page) }, [page])

  const openCreate = () => {
    setEditItem(null)
    setForm({ name: '', query_text: '', description: '', is_public: false })
    setModalOpen(true)
  }

  const openEdit = (t: ReportTemplate) => {
    setEditItem(t)
    setForm({ name: t.name, query_text: t.query_text, description: t.description || '', is_public: t.is_public })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (editItem) {
      await templatesApi.update(editItem.id, form)
    } else {
      await templatesApi.create(form)
    }
    setModalOpen(false)
    fetch(page)
  }

  const handleDelete = async (id: number) => {
    if (!confirm(`${_('common.delete')} this template?`)) return
    await templatesApi.delete(id)
    fetch(page)
  }

  const columns: Column<ReportTemplate>[] = [
    { key: 'name', header: _('templates.name'), render: (t) => <span className="font-medium">{t.name}</span> },
    { key: 'description', header: _('templates.description') },
    { key: 'is_public', header: _('templates.public'), render: (t) => t.is_public ? <span className="badge-green">Yes</span> : <span className="badge-gray">No</span> },
    { key: 'id', header: '', render: (t) => (
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <button className="btn-ghost p-1" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></button>
        <button className="btn-ghost p-1 text-red-500" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4" /></button>
      </div>
    ), className: 'w-20' },
  ]

  if (loading && !data.length) return <PageLoading />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{_('templates.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">Pre-defined queries for report generation</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus className="w-4 h-4" /> {_('templates.newTemplate')}</button>
      </div>

      <div className="card overflow-hidden">
        <DataTable columns={columns} data={data} loading={loading} keyExtractor={(t) => t.id} />
        <div className="px-4 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? `${_('common.edit')} Template` : _('templates.newTemplate')} size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">{_('templates.name')}</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">{_('templates.description')}</label>
            <input className="input" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="label">{_('templates.query')}</label>
            <textarea className="input min-h-[120px] font-mono text-xs" value={form.query_text} onChange={(e) => setForm({ ...form, query_text: e.target.value })} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} className="rounded" />
            <span className="text-sm">{_('templates.public')}</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>{_('common.cancel')}</button>
            <button className="btn-primary" onClick={handleSave}>{_('common.save')}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
