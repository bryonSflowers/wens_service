import { useEffect, useState } from 'react'
import { authApi } from '../api/client'
import { useAuthStore } from '../store/auth'
import { Modal } from '../components/ui/Modal'
import { DataTable, type Column } from '../components/ui/DataTable'
import { PageLoading } from '../components/ui/Loading'
import { Key, Plus, Copy, Check } from 'lucide-react'
import { useT } from '../i18n'
import type { ApiKey, ApiKeyFull } from '../types'

export function SettingsPage() {
  const _ = useT()
  const { user } = useAuthStore()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [newKey, setNewKey] = useState<ApiKeyFull | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    authApi.listApiKeys().then(({ data }) => setApiKeys(data)).finally(() => setLoading(false))
  }, [])

  const handleCreate = async () => {
    if (!keyName.trim()) return
    const { data } = await authApi.createApiKey({ name: keyName })
    setNewKey(data)
    setKeyName('')
    authApi.listApiKeys().then(({ data }) => setApiKeys(data))
  }

  const copyKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey.full_key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) return <PageLoading />

  const columns: Column<ApiKey>[] = [
    { key: 'name', header: 'Name' },
    { key: 'key_prefix', header: 'Key Prefix', render: (k) => <span className="font-mono text-sm">{k.key_prefix}...</span> },
    { key: 'scopes', header: 'Scopes', render: (k) => k.scopes.join(', ') },
    { key: 'is_active', header: _('common.active'), render: (k) => k.is_active ? <span className="badge-green">Yes</span> : <span className="badge-red">No</span> },
    { key: 'created_at', header: 'Created', render: (k) => new Date(k.created_at).toLocaleDateString() },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{_('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and API keys</p>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="font-semibold">{_('settings.profile')}</span>
        </div>
        <div className="card-body space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">{_('auth.username')}</label>
              <p className="text-sm font-medium">{user?.username}</p>
            </div>
            <div>
              <label className="label">{_('auth.email')}</label>
              <p className="text-sm font-medium">{user?.email}</p>
            </div>
            <div>
              <label className="label">Role</label>
              <span className="badge-blue">{user?.role}</span>
            </div>
            <div>
              <label className="label">User ID</label>
              <span className="font-mono text-sm">#{user?.id}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-gray-500" />
            <span className="font-semibold">{_('settings.apiKeys')}</span>
          </div>
          <button className="btn-primary text-sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> {_('settings.createKey')}
          </button>
        </div>
        <div className="card-body">
          <DataTable columns={columns} data={apiKeys} loading={false} keyExtractor={(k) => k.id} />
        </div>
      </div>

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setNewKey(null) }} title={_('settings.createKey')}>
        {newKey ? (
          <div className="space-y-4">
            <div className="card p-4 border-yellow-200 bg-yellow-50">
              <p className="text-sm font-medium text-yellow-800 mb-2">{_('settings.copyKey')}</p>
              <div className="flex gap-2">
                <input className="input font-mono text-xs" readOnly value={newKey.full_key} />
                <button className="btn-secondary" onClick={copyKey}>
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button className="btn-primary w-full" onClick={() => { setShowCreate(false); setNewKey(null) }}>Done</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="label">{_('settings.keyName')}</label>
              <input className="input" value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="e.g. Production API" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowCreate(false)}>{_('common.cancel')}</button>
              <button className="btn-primary" onClick={handleCreate}>{_('settings.createKey')}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
