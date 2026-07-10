import { useEffect, useState } from 'react'
import { Plus, Trash2, Eye, Bell, AlertTriangle, CheckCircle, X } from 'lucide-react'
import { watchlistApi, alertsApi } from '../api/client'
import { useT } from '../i18n'
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
  const [showAdd, setShowAdd] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [newTicker, setNewTicker] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [alertTicker, setAlertTicker] = useState('')
  const [alertType, setAlertType] = useState<'above' | 'below'>('above')
  const [alertPrice, setAlertPrice] = useState('')
  const [checkResult, setCheckResult] = useState<{ triggered_count: number; triggered: any[] } | null>(null)
  const _ = useT()

  const load = async () => {
    try { setWatchlists((await watchlistApi.list()).data) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const select = async (w: Watchlist) => {
    setSelected(w)
    const [i, a] = await Promise.all([
      watchlistApi.listItems(w.id).catch(() => ({ data: [] })),
      alertsApi.list().catch(() => ({ data: [] })),
    ])
    setItems(i.data); setAlerts(a.data)
  }

  const create = async () => {
    if (!editName.trim()) return
    const res = await watchlistApi.create({ name: editName, description: editDesc || undefined })
    setWatchlists((p) => [...p, res.data])
    setShowCreate(false); setEditName(''); setEditDesc('')
  }

  const delWl = async (id: number) => {
    await watchlistApi.delete(id)
    setWatchlists((p) => p.filter((w) => w.id !== id))
    if (selected?.id === id) { setSelected(null); setItems([]) }
  }

  const addItem = async () => {
    if (!selected || !newTicker.trim()) return
    const res = await watchlistApi.addItem(selected.id, newTicker.trim().toUpperCase(), newNotes || undefined)
    setItems((p) => [...p, res.data]); setShowAdd(false); setNewTicker(''); setNewNotes('')
  }

  const removeItem = async (id: number) => {
    if (!selected) return; await watchlistApi.removeItem(selected.id, id)
    setItems((p) => p.filter((i) => i.id !== id))
  }

  const createAlert = async () => {
    if (!alertTicker.trim() || !alertPrice) return
    const res = await alertsApi.create({ ticker: alertTicker.trim().toUpperCase(), alert_type: alertType, threshold_price: parseFloat(alertPrice) })
    setAlerts((p) => [...p, res.data]); setShowAlert(false); setAlertTicker(''); setAlertPrice('')
  }

  const delAlert = async (id: number) => { await alertsApi.delete(id); setAlerts((p) => p.filter((a) => a.id !== id)) }
  const checkAlerts = async () => { setCheckResult((await alertsApi.check()).data) }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{_('wl.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{_('wl.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={checkAlerts}><Bell className="w-4 h-4" /> {_('wl.checkAlerts')}</button>
          <button className="btn-primary" onClick={() => { setEditName(''); setEditDesc(''); setShowCreate(true) }}><Plus className="w-4 h-4" /> {_('wl.newWatchlist')}</button>
        </div>
      </div>

      {checkResult && (
        <div className={`card p-4 ${checkResult.triggered_count > 0 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {checkResult.triggered_count > 0 ? <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" /> : <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />}
              <span className="font-medium text-sm">{checkResult.triggered_count} {_('wl.alertsTriggered')}</span>
            </div>
            <button onClick={() => setCheckResult(null)} className="btn-ghost p-1"><X className="w-4 h-4" /></button>
          </div>
          {checkResult.triggered.map((t: any) => (
            <p key={t.alert_id} className="text-xs mt-1 ml-7 text-[var(--text-secondary)]">{t.ticker} is {t.type} ${t.threshold} (current: ${t.current_price})</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {watchlists.map((w) => (
          <button key={w.id} onClick={() => select(w)}
            className={`card p-4 text-left hover:shadow-md transition-shadow ${selected?.id === w.id ? 'ring-2 ring-blue-500' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-blue-500" /><span className="font-semibold text-[var(--text)]">{w.name}</span></div>
              <button onClick={(e) => { e.stopPropagation(); delWl(w.id) }} className="btn-ghost p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
            </div>
            {w.description && <p className="text-xs text-[var(--text-secondary)] mt-1">{w.description}</p>}
          </button>
        ))}
      </div>

      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm text-[var(--text)]">{selected.name} — {_('wl.tickers')}</h3>
              <button className="btn-secondary text-sm" onClick={() => { setNewTicker(''); setNewNotes(''); setShowAdd(true) }}><Plus className="w-4 h-4" /> {_('wl.addTicker')}</button>
            </div>
            {items.length === 0 ? <div className="card-body"><EmptyState title={_('wl.noTickers')} /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">{_('wl.tickerPlaceholder')}</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">{_('portfolio.notes')}</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Added</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--text-secondary)]"></th>
                  </tr></thead>
                  <tbody>{items.map((i) => (
                    <tr key={i.id} className="border-b border-[var(--card-border)] hover:bg-[var(--sidebar-link-hover)]">
                      <td className="px-4 py-3 font-medium font-mono">{i.ticker}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{i.notes || '-'}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-secondary)] text-xs">{new Date(i.added_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-center"><button onClick={() => removeItem(i.id)} className="btn-ghost p-1 text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold text-sm text-[var(--text)] flex items-center gap-2"><Bell className="w-4 h-4" /> {_('wl.priceAlerts')}</h3>
              <button className="btn-secondary text-sm" onClick={() => { setAlertTicker(''); setAlertPrice(''); setAlertType('above'); setShowAlert(true) }}><Plus className="w-4 h-4" /> {_('wl.newAlert')}</button>
            </div>
            {alerts.length === 0 ? <div className="card-body"><EmptyState title={_('wl.noAlerts')} /></div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">{_('wl.tickerPlaceholder')}</th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">{_('wl.type')}</th>
                    <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">{_('wl.threshold')}</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--text-secondary)]">{_('common.status')}</th>
                    <th className="text-center px-4 py-3 font-medium text-[var(--text-secondary)]"></th>
                  </tr></thead>
                  <tbody>{alerts.map((a) => (
                    <tr key={a.id} className="border-b border-[var(--card-border)] hover:bg-[var(--sidebar-link-hover)]">
                      <td className="px-4 py-3 font-medium font-mono">{a.ticker}</td>
                      <td className="px-4 py-3"><span className={a.alert_type === 'above' ? 'badge-green' : 'badge-red'}>{a.alert_type === 'above' ? `▲ ${_('wl.above')}` : `▼ ${_('wl.below')}`}</span></td>
                      <td className="px-4 py-3 text-right font-mono font-medium">${a.threshold_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center"><span className={a.is_triggered ? 'badge-green' : 'badge-blue'}>{a.is_triggered ? _('wl.triggered') : _('common.active')}</span></td>
                      <td className="px-4 py-3 text-center"><button onClick={() => delAlert(a.id)} className="btn-ghost p-1 text-red-400"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={_('wl.createTitle')} size="sm"><div className="space-y-4">
        <div><label className="label">{_('portfolio.name')}</label><input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Tech Stocks" /></div>
        <div><label className="label">{_('portfolio.description')}</label><input className="input" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="My favorite tech tickers" /></div>
        <button className="btn-primary w-full" onClick={create} disabled={!editName.trim()}>{_('common.create')}</button>
      </div></Modal>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={_('wl.addTickerTitle')} size="sm"><div className="space-y-4">
        <div><label className="label">{_('wl.tickerPlaceholder')}</label><input className="input" value={newTicker} onChange={(e) => setNewTicker(e.target.value)} placeholder="2330.TW" /></div>
        <div><label className="label">{_('portfolio.notes')}</label><input className="input" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="TSMC" /></div>
        <button className="btn-primary w-full" onClick={addItem} disabled={!newTicker.trim()}>{_('common.save')}</button>
      </div></Modal>

      <Modal open={showAlert} onClose={() => setShowAlert(false)} title={_('wl.alertTitle')} size="sm"><div className="space-y-4">
        <div><label className="label">{_('wl.tickerPlaceholder')}</label><input className="input" value={alertTicker} onChange={(e) => setAlertTicker(e.target.value)} placeholder="3045.TW" /></div>
        <div><label className="label">{_('wl.alertType')}</label><select className="input" value={alertType} onChange={(e) => setAlertType(e.target.value as 'above' | 'below')}>
          <option value="above">{_('wl.above')}</option><option value="below">{_('wl.below')}</option>
        </select></div>
        <div><label className="label">{_('wl.thresholdPrice')}</label><input className="input" type="number" value={alertPrice} onChange={(e) => setAlertPrice(e.target.value)} placeholder="120.00" /></div>
        <button className="btn-primary w-full" onClick={createAlert} disabled={!alertTicker.trim() || !alertPrice}>{_('common.create')}</button>
      </div></Modal>
    </div>
  )
}
