import { useEffect, useState } from 'react'
import { adminApi, llmConfigsApi } from '../api/client'
import { StatCard } from '../components/ui/StatCard'
import { DataTable, type Column } from '../components/ui/DataTable'
import { Pagination } from '../components/ui/Pagination'
import { Modal } from '../components/ui/Modal'
import { PageLoading } from '../components/ui/Loading'
import { Plus, Trash2, Shield, Users, Database, Cpu } from 'lucide-react'
import type { AdminStats, AuditLog, LLMConfig } from '../types'

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [logPage, setLogPage] = useState(1)
  const [logTotal, setLogTotal] = useState(0)
  const [logTotalPages, setLogTotalPages] = useState(1)
  const [llmConfigs, setLlmConfigs] = useState<LLMConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showLlmModal, setShowLlmModal] = useState(false)
  const [llmForm, setLlmForm] = useState({ name: '', provider: 'ollama', model: '', base_url: '', api_key: '', is_active: true })

  useEffect(() => {
    Promise.all([
      adminApi.stats().catch(() => null),
      adminApi.auditLogs({ page: 1, page_size: 10 }).catch(() => null),
      llmConfigsApi.list().catch(() => null),
    ]).then(([s, l, c]) => {
      if (s) setStats(s.data)
      if (l) { setLogs(l.data.items); setLogTotal(l.data.total); setLogTotalPages(l.data.total_pages) }
      if (c) setLlmConfigs(c.data.items)
    }).finally(() => setLoading(false))
  }, [])

  const loadLogs = async (p: number) => {
    const { data } = await adminApi.auditLogs({ page: p, page_size: 10 })
    setLogs(data.items)
    setLogTotal(data.total)
    setLogTotalPages(data.total_pages)
    setLogPage(data.page)
  }

  const handleCreateLlm = async () => {
    await llmConfigsApi.create(llmForm)
    setShowLlmModal(false)
    const { data } = await llmConfigsApi.list()
    setLlmConfigs(data.items)
  }

  const handleDeleteLlm = async (id: number) => {
    if (!confirm('Delete this LLM config?')) return
    await llmConfigsApi.delete(id)
    const { data } = await llmConfigsApi.list()
    setLlmConfigs(data.items)
  }

  if (loading) return <PageLoading />

  const logColumns: Column<AuditLog>[] = [
    { key: 'action', header: 'Action', render: (l) => <span className="badge-blue">{l.action}</span> },
    { key: 'resource_type', header: 'Resource' },
    { key: 'resource_id', header: 'Resource ID' },
    { key: 'created_at', header: 'Date', render: (l) => new Date(l.created_at).toLocaleString() },
  ]

  const llmColumns: Column<LLMConfig>[] = [
    { key: 'name', header: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'provider', header: 'Provider', render: (c) => <span className="badge-blue">{c.provider}</span> },
    { key: 'model', header: 'Model' },
    { key: 'is_active', header: 'Status', render: (c) => c.is_active ? <span className="badge-green">Active</span> : <span className="badge-red">Inactive</span> },
    { key: 'id', header: '', render: (c) => (
      <button className="btn-ghost p-1 text-red-500" onClick={() => handleDeleteLlm(c.id)}><Trash2 className="w-4 h-4" /></button>
    ), className: 'w-10' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-sm text-gray-500 mt-1">System administration and monitoring</p>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total Users" value={stats.users} icon={Users} />
          <StatCard label="Monthly Reports" value={stats.monthly_reports} icon={Database} />
          <StatCard label="KV Items" value={stats.kv_store_items} icon={Database} />
          <StatCard label="LLM Configs" value={stats.llm_configs} icon={Cpu} />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-gray-500" />
            <span className="font-semibold">LLM Configurations</span>
          </div>
          <button className="btn-primary text-sm" onClick={() => setShowLlmModal(true)}>
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        <div className="card-body">
          <DataTable columns={llmColumns} data={llmConfigs} loading={false} keyExtractor={(c) => c.id} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-500" />
            <span className="font-semibold">Audit Logs</span>
          </div>
        </div>
        <div className="card-body">
          <DataTable columns={logColumns} data={logs} loading={false} keyExtractor={(l) => l.id} />
          <Pagination page={logPage} totalPages={logTotalPages} total={logTotal} onPageChange={loadLogs} />
        </div>
      </div>

      <Modal open={showLlmModal} onClose={() => setShowLlmModal(false)} title="Add LLM Configuration">
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={llmForm.name} onChange={(e) => setLlmForm({ ...llmForm, name: e.target.value })} placeholder="My Ollama" />
          </div>
          <div>
            <label className="label">Provider</label>
            <select className="input" value={llmForm.provider} onChange={(e) => setLlmForm({ ...llmForm, provider: e.target.value })}>
              <option value="ollama">Ollama</option>
              <option value="claude">Claude</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="label">Model</label>
            <input className="input" value={llmForm.model} onChange={(e) => setLlmForm({ ...llmForm, model: e.target.value })} placeholder="qwen2.5:7b" />
          </div>
          <div>
            <label className="label">Base URL</label>
            <input className="input" value={llmForm.base_url} onChange={(e) => setLlmForm({ ...llmForm, base_url: e.target.value })} placeholder="http://localhost:11434/v1" />
          </div>
          <div>
            <label className="label">API Key</label>
            <input className="input" type="password" value={llmForm.api_key} onChange={(e) => setLlmForm({ ...llmForm, api_key: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setShowLlmModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={handleCreateLlm}>Save</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
