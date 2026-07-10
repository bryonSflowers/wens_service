import { useEffect, useState } from 'react'
import {
  Plus, Trash2, Eye, Bell, AlertTriangle, CheckCircle, X,
} from 'lucide-react'
import { watchlistApi, alertsApi } from '../api/client'
import { PageLoading } from '../components/ui/Loading'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import type { Watchlist, WatchlistItem, PriceAlert } from '../types'

export function WatchlistPage() {
  const [watchlists, setWatchlists] = useState<Watchlist[]>([])
  const [selected, setSelected] = useState<Watchlist | null>(null)
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAlert, setShowAlert] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [newTicker, setNewTicker] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [alertTicker, setAlertTicker] = useState('')
  const [alertType, setAlertType] = useState<'above' | 'below'>('above')
  const [alertPrice, setAlertPrice] = useState('')
  const [checkResult, setCheckResult] = useState<{ triggered_count: number; triggered: any[] } | null>(null)

  const load = async () => {
    try {
      const res = await watchlistApi.list()
      setWatchlists(res.data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const selectWatchlist = async (w: Watchlist) => {
    setSelected(w)
    const [itemsRes, alertsRes] = await Promise.all([
      watchlistApi.listItems(w.id).catch(() => ({ data: [] })),
      alertsApi.list().catch(() => ({ data: [] })),
    ])
    setItems(itemsRes.data)
    setAlerts(alertsRes.data)
  }

  const createWatchlist = async () => {
    if (!editName.trim()) return
    const res = await watchlistApi.create({ name: editName, description: editDesc || undefined })
    setWatchlists((prev) => [...prev, res.data])
    setShowCreate(false)
    setEditName('')
    setEditDesc('')
  }

  const deleteWatchlist = async (id: number) => {
    await watchlistApi.delete(id)
    setWatchlists((prev) => prev.filter((w) => w.id !== id))
    if (selected?.id === id) { setSelected(null); setItems([]) }
  }

  const addItem = async () => {
    if (!selected || !newTicker.trim()) return
    const res = await watchlistApi.addItem(selected.id, newTicker.trim().toUpperCase(), newNotes || undefined)
    setItems((prev) => [...prev, res.data])
    setShowAddItem(false)
    setNewTicker('')
    setNewNotes('')
  }

  const removeItem = async (itemId: number) => {
    if (!selected) return
    await watchlistApi.removeItem(selected.id, itemId)
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }

  const createAlert = async () => {
    if (!alertTicker.trim() || !alertPrice) return
    const res = await alertsApi.create({
      ticker: alertTicker.trim().toUpperCase(),
      alert_type: alertType,
      threshold_price: parseFloat(alertPrice),
    })
    setAlerts((prev) => [...prev, res.data])
    setShowAlert(false)
    setAlertTicker('')
    setAlertPrice('')
  }

  const deleteAlert = async (id: number) => {
    await alertsApi.delete(id)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const checkAlerts = async () => {
    const res = await alertsApi.check()
    setCheckResult(res.data)
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Watchlists & Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">Track tickers and set price alerts</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={checkAlerts}>
            <Bell className="w-4 h-4" /> Check Alerts
          </button>
          <button className="btn-primary" onClick={() => { setEditName(''); setEditDesc(''); setShowCreate(true) }}>
            <Plus className="w-4 h-4" /> New Watchlist
          </button>
        </div>
      </div>

      {checkResult && (
        <div className={`card p-4 ${checkResult.triggered_count > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {checkResult.triggered_count > 0 ? <AlertTriangle className="w-5 h-5 text-yellow-600" /> : <CheckCircle className="w-5 h-5 text-green-600" />}
              <span className="font-medium">{checkResult.triggered_count} alert{checkResult.triggered_count !== 1 ? 's' : ''} triggered</span>
            </div>
            <button onClick={() => setCheckResult(null)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
          </div>
          {checkResult.triggered.map((t: any) => (
            <p key={t.alert_id} className="text-sm mt-1 ml-7">{t.ticker} is {t.type} ${t.threshold} (current: ${t.current_price})</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {watchlists.map((w) => (
          <button
            key={w.id}
            onClick={() => selectWatchlist(w)}
            className={`card p-4 text-left hover:shadow-md transition-shadow ${selected?.id === w.id ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">{w.name}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteWatchlist(w.id) }} className="btn-ghost p-1 text-red-500 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {w.description && <p className="text-xs text-gray-500 mt-1">{w.description}</p>}
          </button>
        ))}
      </div>

      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold">{selected.name} — Tickers</h3>
              <button className="btn-secondary text-sm" onClick={() => { setNewTicker(''); setNewNotes(''); setShowAddItem(true) }}>
                <Plus className="w-4 h-4" /> Add Ticker
              </button>
            </div>
            {items.length === 0 ? <div className="card-body"><EmptyState title="No tickers" description="Add tickers to track." /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Ticker</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Notes</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Added</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{i.ticker}</td>
                        <td className="px-4 py-3 text-gray-500">{i.notes || '-'}</td>
                        <td className="px-4 py-3 text-gray-500">{new Date(i.added_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => removeItem(i.id)} className="btn-ghost p-1 text-red-500 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold flex items-center gap-2"><Bell className="w-4 h-4" /> Price Alerts</h3>
              <button className="btn-secondary text-sm" onClick={() => { setAlertTicker(''); setAlertPrice(''); setAlertType('above'); setShowAlert(true) }}>
                <Plus className="w-4 h-4" /> New Alert
              </button>
            </div>
            {alerts.length === 0 ? <div className="card-body"><EmptyState title="No alerts" description="Set price alerts for your tickers." /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Ticker</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Threshold</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.map((a) => (
                      <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{a.ticker}</td>
                        <td className="px-4 py-3">
                          <span className={a.alert_type === 'above' ? 'badge-green' : 'badge-red'}>
                            {a.alert_type === 'above' ? '↑ Above' : '↓ Below'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">${a.threshold_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={a.is_triggered ? 'badge-green' : 'badge-blue'}>
                            {a.is_triggered ? 'Triggered' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => deleteAlert(a.id)} className="btn-ghost p-1 text-red-500 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Watchlist" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Tech Stocks" />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="My favorite tech tickers" />
          </div>
          <button className="btn-primary w-full" onClick={createWatchlist} disabled={!editName.trim()}>Create</button>
        </div>
      </Modal>

      <Modal open={showAddItem} onClose={() => setShowAddItem(false)} title="Add Ticker" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Ticker</label>
            <input className="input" value={newTicker} onChange={(e) => setNewTicker(e.target.value)} placeholder="2330.TW" />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="TSMC" />
          </div>
          <button className="btn-primary w-full" onClick={addItem} disabled={!newTicker.trim()}>Add</button>
        </div>
      </Modal>

      <Modal open={showAlert} onClose={() => setShowAlert(false)} title="New Price Alert" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Ticker</label>
            <input className="input" value={alertTicker} onChange={(e) => setAlertTicker(e.target.value)} placeholder="3045.TW" />
          </div>
          <div>
            <label className="label">Alert Type</label>
            <select className="input" value={alertType} onChange={(e) => setAlertType(e.target.value as 'above' | 'below')}>
              <option value="above">Price Above</option>
              <option value="below">Price Below</option>
            </select>
          </div>
          <div>
            <label className="label">Threshold Price</label>
            <input className="input" type="number" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} placeholder="120.00" />
          </div>
          <button className="btn-primary w-full" onClick={createAlert} disabled={!alertTicker.trim() || !alertPrice}>Create Alert</button>
        </div>
      </Modal>
    </div>
  )
}
