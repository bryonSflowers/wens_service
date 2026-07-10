import { useEffect, useState } from 'react'
import { Plus, Trash2, Briefcase } from 'lucide-react'
import { portfolioApi } from '../api/client'
import { PageLoading } from '../components/ui/Loading'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import type { Portfolio, Holding } from '../types'

export function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [selected, setSelected] = useState<Portfolio | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [summary, setSummary] = useState<{ total_cost: number; total_value: number; total_unrealized_pnl: number; total_unrealized_pnl_pct: number; holding_count: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [hTicker, setHTicker] = useState('')
  const [hShares, setHShares] = useState('')
  const [hCost, setHCost] = useState('')
  const [hNotes, setHNotes] = useState('')

  const load = async () => {
    try { setPortfolios((await portfolioApi.list()).data) } catch {}
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const select = async (p: Portfolio) => {
    setSelected(p)
    const [h, s] = await Promise.all([
      portfolioApi.listHoldings(p.id),
      portfolioApi.summary(p.id).catch(() => ({ data: null })),
    ])
    setHoldings(h.data)
    setSummary(s.data)
  }

  const create = async () => {
    if (!editName.trim()) return
    const res = await portfolioApi.create({ name: editName, description: editDesc || undefined })
    setPortfolios((p) => [...p, res.data])
    setShowCreate(false); setEditName(''); setEditDesc('')
  }

  const delPortfolio = async (id: number) => {
    await portfolioApi.delete(id)
    setPortfolios((p) => p.filter((x) => x.id !== id))
    if (selected?.id === id) { setSelected(null); setHoldings([]); setSummary(null) }
  }

  const addHolding = async () => {
    if (!selected || !hTicker.trim() || !hShares || !hCost) return
    const res = await portfolioApi.addHolding(selected.id, {
      ticker: hTicker.trim().toUpperCase(), shares: parseFloat(hShares), avg_cost: parseFloat(hCost), notes: hNotes || undefined,
    })
    setHoldings((h) => [...h, res.data])
    setShowAdd(false); setHTicker(''); setHShares(''); setHCost(''); setHNotes('')
    portfolioApi.summary(selected.id).then((s) => setSummary(s.data))
  }

  const delHolding = async (hid: number) => {
    if (!selected) return
    await portfolioApi.deleteHolding(selected.id, hid)
    setHoldings((h) => h.filter((x) => x.id !== hid))
    portfolioApi.summary(selected.id).then((s) => setSummary(s.data))
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Portfolio</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Track your positions, cost basis, and P&L</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditName(''); setEditDesc(''); setShowCreate(true) }}>
          <Plus className="w-4 h-4" /> New Portfolio
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {portfolios.length === 0 && <div className="md:col-span-3"><EmptyState title="No portfolios" description="Create your first portfolio." /></div>}
        {portfolios.map((p) => (
          <button key={p.id} onClick={() => select(p)}
            className={`card p-4 text-left hover:shadow-md transition-shadow ${selected?.id === p.id ? 'ring-2 ring-blue-500' : ''}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-500" />
                <span className="font-semibold text-[var(--text)]">{p.name}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); delPortfolio(p.id) }} className="btn-ghost p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
            </div>
            {p.description && <p className="text-xs text-[var(--text-secondary)] mt-1">{p.description}</p>}
          </button>
        ))}
      </div>

      {summary && (
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-[var(--text-secondary)]">Holdings</p><p className="text-xl font-bold font-mono">{summary.holding_count}</p></div>
              <div><p className="text-xs text-[var(--text-secondary)]">Total Value</p><p className="text-xl font-bold font-mono">${summary.total_value.toLocaleString()}</p></div>
              <div><p className="text-xs text-[var(--text-secondary)]">Total Cost</p><p className="text-xl font-bold font-mono">${summary.total_cost.toLocaleString()}</p></div>
              <div>
                <p className="text-xs text-[var(--text-secondary)]">Unrealized P&L</p>
                <p className={`text-xl font-bold font-mono ${summary.total_unrealized_pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                  {summary.total_unrealized_pnl >= 0 ? '▲' : '▼'} ${Math.abs(summary.total_unrealized_pnl).toLocaleString()} ({summary.total_unrealized_pnl_pct}%)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm text-[var(--text)]">{selected.name} — Holdings</h3>
            <button className="btn-secondary text-sm" onClick={() => { setHTicker(''); setHShares(''); setHCost(''); setHNotes(''); setShowAdd(true) }}>
              <Plus className="w-4 h-4" /> Add Holding
            </button>
          </div>
          <div className="p-0">
            {holdings.length === 0 ? <EmptyState title="No holdings" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                      <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Ticker</th>
                      <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Shares</th>
                      <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Avg Cost</th>
                      <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Price</th>
                      <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">Value</th>
                      <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">P&L</th>
                      <th className="text-right px-4 py-3 font-medium text-[var(--text-secondary)]">P&L %</th>
                      <th className="text-center px-4 py-3 font-medium text-[var(--text-secondary)]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => (
                      <tr key={h.id} className="border-b border-[var(--card-border)] hover:bg-[var(--sidebar-link-hover)]">
                        <td className="px-4 py-3 font-medium font-mono text-[var(--text)]">{h.ticker}</td>
                        <td className="px-4 py-3 text-right font-mono">{h.shares}</td>
                        <td className="px-4 py-3 text-right font-mono">${h.avg_cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right font-mono">{h.current_price != null ? `$${h.current_price.toFixed(2)}` : '-'}</td>
                        <td className="px-4 py-3 text-right font-mono">{h.current_value != null ? `$${h.current_value.toLocaleString()}` : '-'}</td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${(h.unrealized_pnl ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          {(h.unrealized_pnl ?? 0) >= 0 ? '▲' : '▼'} {h.unrealized_pnl != null ? `$${Math.abs(h.unrealized_pnl).toFixed(2)}` : '-'}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-medium ${(h.unrealized_pnl_pct ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                          {h.unrealized_pnl_pct != null ? `${h.unrealized_pnl_pct >= 0 ? '+' : ''}${h.unrealized_pnl_pct.toFixed(2)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => delHolding(h.id)} className="btn-ghost p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-4 h-4" /></button>
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Portfolio" size="sm">
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="My Portfolio" /></div>
          <div><label className="label">Description</label><input className="input" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Long-term growth" /></div>
          <button className="btn-primary w-full" onClick={create} disabled={!editName.trim()}>Create</button>
        </div>
      </Modal>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Holding" size="sm">
        <div className="space-y-4">
          <div><label className="label">Ticker</label><input className="input" value={hTicker} onChange={(e) => setHTicker(e.target.value)} placeholder="3045.TW" /></div>
          <div><label className="label">Shares</label><input className="input" type="number" value={hShares} onChange={(e) => setHShares(e.target.value)} placeholder="100" /></div>
          <div><label className="label">Avg Cost</label><input className="input" type="number" value={hCost} onChange={(e) => setHCost(e.target.value)} placeholder="110.50" /></div>
          <div><label className="label">Notes</label><input className="input" value={hNotes} onChange={(e) => setHNotes(e.target.value)} placeholder="Bought on dip" /></div>
          <button className="btn-primary w-full" onClick={addHolding} disabled={!hTicker.trim() || !hShares || !hCost}>Add</button>
        </div>
      </Modal>
    </div>
  )
}
