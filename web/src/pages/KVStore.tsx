import { useEffect, useState } from 'react'
import { kvApi } from '../api/client'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { Modal } from '../components/ui/Modal'
import { Plus, Trash2, Eye } from 'lucide-react'
import { useT } from '../i18n'
import type { KVItem } from '../types'

export function KVStorePage() {
  const _ = useT()
  const [namespace, setNamespace] = useState('default')
  const [data, setData] = useState<KVItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [viewItem, setViewItem] = useState<KVItem | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newTags, setNewTags] = useState('')

  const fetch = async (p: number) => {
    setLoading(true)
    try {
      const { data: res } = await kvApi.list(namespace, { page: p, page_size: 15 })
      setData(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
      setPage(res.page)
    } catch {
      setData([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { setPage(1); fetch(1) }, [namespace])

  const handleCreate = async () => {
    if (!newKey.trim()) return
    let parsed: unknown
    try { parsed = JSON.parse(newValue) } catch { parsed = newValue }
    await kvApi.upsert(namespace, newKey.trim(), {
      key: newKey.trim(),
      value: parsed,
      tags: newTags ? newTags.split(',').map((t) => t.trim()) : undefined,
    })
    setShowCreate(false)
    setNewKey('')
    setNewValue('')
    setNewTags('')
    fetch(page)
  }

  const handleDelete = async (item: KVItem) => {
    if (!confirm(`${_('common.delete')} ${item.key}?`)) return
    await kvApi.delete(namespace, item.key)
    fetch(page)
  }

  const columns: Column<KVItem>[] = [
    { key: 'key', header: _('kv.key'), render: (i) => <span className="font-mono text-sm font-medium">{i.key}</span> },
    { key: 'value', header: _('kv.value'), render: (i) => {
      const v = typeof i.value === 'string' ? i.value : JSON.stringify(i.value)
      return <span className="text-sm text-gray-600 truncate block max-w-[300px]">{v}</span>
    }},
    { key: 'tags', header: _('kv.tags'), render: (i) => i.tags?.map((t) => <span key={t} className="badge-blue mr-1">{t}</span>) },
    { key: 'id', header: '', render: (i) => (
      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
        <button className="btn-ghost p-1" onClick={() => setViewItem(i)}><Eye className="w-4 h-4" /></button>
        <button className="btn-ghost p-1 text-red-500" onClick={() => handleDelete(i)}><Trash2 className="w-4 h-4" /></button>
      </div>
    ), className: 'w-16' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{_('kv.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">Multi-purpose namespaced key-value storage</p>
        </div>
        <div className="flex gap-2">
          <input
            className="input w-48"
            placeholder={_('kv.namespace')}
            value={namespace}
            onChange={(e) => setNamespace(e.target.value || 'default')}
          />
          <button className="btn-primary" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> {_('common.create')}</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <DataTable columns={columns} data={data} loading={loading} keyExtractor={(i) => i.id} />
        <div className="px-4 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={`${_('common.create')} KV Item`} size="md">
        <div className="space-y-4">
          <div>
            <label className="label">{_('kv.key')}</label>
            <input className="input font-mono" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="my.key.name" />
          </div>
          <div>
            <label className="label">{_('kv.value')}</label>
            <textarea className="input min-h-[100px] font-mono text-xs" value={newValue} onChange={(e) => setNewValue(e.target.value)} placeholder='{"hello": "world"}' />
          </div>
          <div>
            <label className="label">{_('kv.tags')}</label>
            <input className="input" value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="tag1, tag2" />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>{_('common.cancel')}</button>
            <button className="btn-primary" onClick={handleCreate}>{_('common.create')}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!viewItem} onClose={() => setViewItem(null)} title={`${_('kv.title')}: ${viewItem?.key}`} size="lg">
        {viewItem && (
          <div className="space-y-4">
            <div>
              <label className="label">{_('kv.value')}</label>
              <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-x-auto max-h-96">
                {JSON.stringify(viewItem.value, null, 2)}
              </pre>
            </div>
            {viewItem.tags && viewItem.tags.length > 0 && (
              <div>
                <label className="label">{_('kv.tags')}</label>
                <div className="flex gap-1">{viewItem.tags.map((t) => <span key={t} className="badge-blue">{t}</span>)}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
