import { useState, useEffect } from 'react'
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { screenerApi } from '../api/client'
import { PageLoading } from '../components/ui/Loading'
import { EmptyState } from '../components/ui/EmptyState'

export function ScreenerPage() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [sectors, setSectors] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    pe_ratio_lt: '', pe_ratio_gt: '', dividend_yield_gt: '', market_cap_gt: '',
    sector: '', roe_gt: '', eps_growth_gt: '', debt_to_equity_lt: '',
    ev_ebitda_lt: '', sort_by: 'market_cap', sort_dir: 'desc', limit: 50, offset: 0,
  })

  useEffect(() => { screenerApi.sectors().then((r) => setSectors(r.data)).catch(() => {}) }, [])

  const search = async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = {}
      Object.entries(filters).forEach(([k, v]) => { if (v !== '') params[k] = v })
      const res = await screenerApi.screen(params)
      setResults(res.data.items || []); setTotal(res.data.total || 0)
    } catch {}
    setLoading(false)
  }

  const Filter = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{label}</label>
    <input className="input text-sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Stock Screener</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Filter stocks by financial criteria</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => setFilters({ ...filters, pe_ratio_lt: '', pe_ratio_gt: '', dividend_yield_gt: '', market_cap_gt: '', sector: '', roe_gt: '', eps_growth_gt: '', debt_to_equity_lt: '', ev_ebitda_lt: '' })}>
            <SlidersHorizontal className="w-4 h-4" /> Clear
          </button>
          <button className="btn-primary" onClick={search} disabled={loading}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Screen
          </button>
        </div>
      </div>

      <div className="card"><div className="card-body">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <Filter label="P/E Max" value={filters.pe_ratio_lt} onChange={(v) => setFilters({ ...filters, pe_ratio_lt: v })} placeholder="15" />
          <Filter label="P/E Min" value={filters.pe_ratio_gt} onChange={(v) => setFilters({ ...filters, pe_ratio_gt: v })} placeholder="5" />
          <Filter label="Div Yield Min %" value={filters.dividend_yield_gt} onChange={(v) => setFilters({ ...filters, dividend_yield_gt: v })} placeholder="3" />
          <Filter label="Mkt Cap Min (B)" value={filters.market_cap_gt} onChange={(v) => setFilters({ ...filters, market_cap_gt: v })} placeholder="10" />
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Sector</label>
            <select className="input text-sm" value={filters.sector} onChange={(e) => setFilters({ ...filters, sector: e.target.value })}>
              <option value="">All</option>{sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Filter label="ROE Min %" value={filters.roe_gt} onChange={(v) => setFilters({ ...filters, roe_gt: v })} placeholder="10" />
          <Filter label="EPS Growth Min %" value={filters.eps_growth_gt} onChange={(v) => setFilters({ ...filters, eps_growth_gt: v })} placeholder="5" />
          <Filter label="D/E Max" value={filters.debt_to_equity_lt} onChange={(v) => setFilters({ ...filters, debt_to_equity_lt: v })} placeholder="1.5" />
          <Filter label="EV/EBITDA Max" value={filters.ev_ebitda_lt} onChange={(v) => setFilters({ ...filters, ev_ebitda_lt: v })} placeholder="10" />
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">Sort By</label>
            <select className="input text-sm" value={filters.sort_by} onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}>
              <option value="market_cap">Market Cap</option><option value="pe_ratio">P/E</option>
              <option value="pb_ratio">P/B</option><option value="dividend_yield">Div Yield</option>
              <option value="roe">ROE</option><option value="eps_growth_pct">EPS Growth</option>
            </select>
          </div>
        </div>
      </div></div>

      {loading && <PageLoading />}

      {!loading && results.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-sm text-[var(--text)]">Results ({total} found)</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                <th className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">Ticker</th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">P/E</th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">P/B</th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">EV/EBITDA</th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">Div Yield</th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">ROE</th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">EPS Growth</th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">D/E</th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">Mkt Cap</th>
                <th className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">Sector</th>
              </tr></thead>
              <tbody>{results.map((r: any, i: number) => (
                <tr key={i} className="border-b border-[var(--card-border)] hover:bg-[var(--sidebar-link-hover)]">
                  <td className="px-3 py-2 font-medium font-mono">{r.ticker}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.pe_ratio?.toFixed(1) ?? '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.pb_ratio?.toFixed(1) ?? '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.ev_ebitda?.toFixed(1) ?? '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.dividend_yield != null ? `${(r.dividend_yield * 100).toFixed(1)}%` : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.roe != null ? `${(r.roe * 100).toFixed(0)}%` : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.eps_growth_pct != null ? `${(r.eps_growth_pct * 100).toFixed(0)}%` : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.debt_to_equity?.toFixed(1) ?? '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.market_cap != null ? `$${(r.market_cap / 1e9).toFixed(1)}B` : '-'}</td>
                  <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{r.sector ?? '-'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && results.length === 0 && <EmptyState title="No results" description="Set filters and click Screen." icon="search" />}
    </div>
  )
}
