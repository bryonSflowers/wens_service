import { useEffect, useState } from 'react'
import {
  Plus, Trash2, TrendingUp, TrendingDown,
  Briefcase,
} from 'lucide-react'
import { portfolioApi } from '../api/client'
import { PageLoading } from '../components/ui/Loading'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'
import type { Portfolio, Holding, PortfolioSummary } from '../types'

export function PortfolioPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null)
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAddHolding, setShowAddHolding] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const [holdingTicker, setHoldingTicker] = useState('')
  const [holdingShares, setHoldingShares] = useState('')
  const [holdingCost, setHoldingCost] = useState('')
  const [holdingNotes, setHoldingNotes] = useState('')

  const load = async () => {
    try {
      const res = await portfolioApi.list()
      setPortfolios(res.data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const selectPortfolio = async (p: Portfolio) => {
    setSelectedPortfolio(p)
    const [h, s] = await Promise.all([
      portfolioApi.listHoldings(p.id),
      portfolioApi.summary(p.id),
    ])
    setHoldings(h.data)
    setSummary(s.data)
  }

  const createPortfolio = async () => {
    if (!editName.trim()) return
    const res = await portfolioApi.create({ name: editName, description: editDesc || undefined })
    setPortfolios((prev) => [...prev, res.data])
    setShowCreate(false)
    setEditName('')
    setEditDesc('')
  }

  const deletePortfolio = async (id: number) => {
    await portfolioApi.delete(id)
    setPortfolios((prev) => prev.filter((p) => p.id !== id))
    if (selectedPortfolio?.id === id) {
      setSelectedPortfolio(null)
      setHoldings([])
      setSummary(null)
    }
  }

  const addHolding = async () => {
    if (!selectedPortfolio || !holdingTicker.trim() || !holdingShares || !holdingCost) return
    const res = await portfolioApi.addHolding(selectedPortfolio.id, {
      ticker: holdingTicker.trim().toUpperCase(),
      shares: parseFloat(holdingShares),
      avg_cost: parseFloat(holdingCost),
      notes: holdingNotes || undefined,
    })
    setHoldings((prev) => [...prev, res.data])
    setShowAddHolding(false)
    setHoldingTicker('')
    setHoldingShares('')
    setHoldingCost('')
    setHoldingNotes('')
    portfolioApi.summary(selectedPortfolio.id).then((s) => setSummary(s.data))
  }

  const deleteHolding = async (holdingId: number) => {
    if (!selectedPortfolio) return
    await portfolioApi.deleteHolding(selectedPortfolio.id, holdingId)
    setHoldings((prev) => prev.filter((h) => h.id !== holdingId))
    portfolioApi.summary(selectedPortfolio.id).then((s) => setSummary(s.data))
  }

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-sm text-gray-500 mt-1">Track your positions, cost basis, and P&L</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditName(''); setEditDesc(''); setShowCreate(true) }}>
          <Plus className="w-4 h-4" /> New Portfolio
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {portfolios.length === 0 && <div className="md:col-span-3"><EmptyState title="No portfolios" description="Create your first portfolio to start tracking." /></div>}
        {portfolios.map((p) => (
          <button
            key={p.id}
            onClick={() => selectPortfolio(p)}
            className={`card p-4 text-left hover:shadow-md transition-shadow ${selectedPortfolio?.id === p.id ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                <span className="font-semibold">{p.name}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deletePortfolio(p.id) }} className="btn-ghost p-1 text-red-500 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {p.description && <p className="text-xs text-gray-500 mt-1">{p.description}</p>}
          </button>
        ))}
      </div>

      {summary && (
        <div className="card">
          <div className="card-body">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Holdings</p>
                <p className="text-xl font-bold">{summary.holding_count}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Value</p>
                <p className="text-xl font-bold">${summary.total_value.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Cost</p>
                <p className="text-xl font-bold">${summary.total_cost.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Unrealized P&L</p>
                <p className={`text-xl font-bold ${summary.total_unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summary.total_unrealized_pnl >= 0 ? '+' : ''}${summary.total_unrealized_pnl.toLocaleString()}
                  <span className="text-sm ml-1">({summary.total_unrealized_pnl_pct}%)</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPortfolio && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">{selectedPortfolio.name} — Holdings</h3>
            <button className="btn-secondary text-sm" onClick={() => { setHoldingTicker(''); setHoldingShares(''); setHoldingCost(''); setHoldingNotes(''); setShowAddHolding(true) }}>
              <Plus className="w-4 h-4" /> Add Holding
            </button>
          </div>
          <div className="card-body p-0">
            {holdings.length === 0 ? <EmptyState title="No holdings" description="Add your first position." /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Ticker</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Shares</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Avg Cost</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Current Price</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">Current Value</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">P&L</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-500">P&L %</th>
                      <th className="text-center px-4 py-3 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((h) => (
                      <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{h.ticker}</td>
                        <td className="px-4 py-3 text-right">{h.shares}</td>
                        <td className="px-4 py-3 text-right">${h.avg_cost.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right">{h.current_price != null ? `$${h.current_price.toFixed(2)}` : '-'}</td>
                        <td className="px-4 py-3 text-right">{h.current_value != null ? `$${h.current_value.toLocaleString()}` : '-'}</td>
                        <td className={`px-4 py-3 text-right font-medium ${(h.unrealized_pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          <span className="flex items-center justify-end gap-1">
                            {(h.unrealized_pnl ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {h.unrealized_pnl != null ? `${h.unrealized_pnl >= 0 ? '+' : ''}$${h.unrealized_pnl.toFixed(2)}` : '-'}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${(h.unrealized_pnl_pct ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {h.unrealized_pnl_pct != null ? `${h.unrealized_pnl_pct >= 0 ? '+' : ''}${h.unrealized_pnl_pct.toFixed(2)}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => deleteHolding(h.id)} className="btn-ghost p-1 text-red-500 hover:bg-red-50">
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

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Portfolio" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="My Portfolio" />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <input className="input" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Long-term growth" />
          </div>
          <button className="btn-primary w-full" onClick={createPortfolio} disabled={!editName.trim()}>Create</button>
        </div>
      </Modal>

      <Modal open={showAddHolding} onClose={() => setShowAddHolding(false)} title="Add Holding" size="sm">
        <div className="space-y-4">
          <div>
            <label className="label">Ticker</label>
            <input className="input" value={holdingTicker} onChange={(e) => setHoldingTicker(e.target.value)} placeholder="3045.TW" />
          </div>
          <div>
            <label className="label">Shares</label>
            <input className="input" type="number" value={holdingShares} onChange={(e) => setHoldingShares(e.target.value)} placeholder="100" />
          </div>
          <div>
            <label className="label">Avg Cost Per Share</label>
            <input className="input" type="number" value={holdingCost} onChange={(e) => setHoldingCost(e.target.value)} placeholder="110.50" />
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input className="input" value={holdingNotes} onChange={(e) => setHoldingNotes(e.target.value)} placeholder="Bought on dip" />
          </div>
          <button className="btn-primary w-full" onClick={addHolding} disabled={!holdingTicker.trim() || !holdingShares || !holdingCost}>Add</button>
        </div>
      </Modal>
    </div>
  )
}
