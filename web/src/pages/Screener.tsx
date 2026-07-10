import { useState, useEffect } from 'react'
import { Search, SlidersHorizontal, RefreshCw } from 'lucide-react'
import { screenerApi } from '../api/client'
import { TermTooltip } from '../components/ui/TermTooltip'
import { useT } from '../i18n'
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
  const _ = useT()

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

  const Filter = ({ label, term, value, onChange, placeholder }: { label: string; term?: string; value: string; onChange: (v: string) => void; placeholder?: string }) => (
    <div>
      <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
        {term ? <TermTooltip term={term}>{label}</TermTooltip> : label}
      </label>
      <input className="input text-sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{_('scr.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{_('scr.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm" onClick={() => setFilters({ ...filters, pe_ratio_lt: '', pe_ratio_gt: '', dividend_yield_gt: '', market_cap_gt: '', sector: '', roe_gt: '', eps_growth_gt: '', debt_to_equity_lt: '', ev_ebitda_lt: '' })}>
            <SlidersHorizontal className="w-4 h-4" /> {_('scr.clear')}
          </button>
          <button className="btn-primary" onClick={search} disabled={loading}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {_('scr.screen')}
          </button>
        </div>
      </div>

      <div className="card"><div className="card-body">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <Filter label={_('scr.peMax')} term="P/E Ratio" value={filters.pe_ratio_lt} onChange={(v) => setFilters({ ...filters, pe_ratio_lt: v })} placeholder="15" />
          <Filter label={_('scr.peMin')} term="P/E Ratio" value={filters.pe_ratio_gt} onChange={(v) => setFilters({ ...filters, pe_ratio_gt: v })} placeholder="5" />
          <Filter label={_('scr.divYieldMin')} term="Div Yield" value={filters.dividend_yield_gt} onChange={(v) => setFilters({ ...filters, dividend_yield_gt: v })} placeholder="3" />
          <Filter label={_('scr.mktCapMin')} term="Market Cap" value={filters.market_cap_gt} onChange={(v) => setFilters({ ...filters, market_cap_gt: v })} placeholder="10" />
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{_('scr.sector')}</label>
            <select className="input text-sm" value={filters.sector} onChange={(e) => setFilters({ ...filters, sector: e.target.value })}>
              <option value="">{_('scr.allSectors')}</option>{sectors.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Filter label={_('scr.roeMin')} term="ROE" value={filters.roe_gt} onChange={(v) => setFilters({ ...filters, roe_gt: v })} placeholder="10" />
          <Filter label={_('scr.epsGrowthMin')} term="EPS Growth" value={filters.eps_growth_gt} onChange={(v) => setFilters({ ...filters, eps_growth_gt: v })} placeholder="5" />
          <Filter label={_('scr.deMax')} term="Debt-to-Equity" value={filters.debt_to_equity_lt} onChange={(v) => setFilters({ ...filters, debt_to_equity_lt: v })} placeholder="1.5" />
          <Filter label={_('scr.evEbitdaMax')} term="EV/EBITDA" value={filters.ev_ebitda_lt} onChange={(v) => setFilters({ ...filters, ev_ebitda_lt: v })} placeholder="10" />
          <div><label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">{_('scr.sortBy')}</label>
            <select className="input text-sm" value={filters.sort_by} onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}>
              <option value="market_cap">{_('fund.marketCap')}</option><option value="pe_ratio">{_('fund.pe')}</option>
              <option value="pb_ratio">{_('fund.pb')}</option><option value="dividend_yield">{_('fund.divYield')}</option>
              <option value="roe">{_('fund.roe')}</option><option value="eps_growth_pct">{_('fund.epsGrowth')}</option>
            </select>
          </div>
        </div>
      </div></div>

      {loading && <PageLoading />}

      {!loading && results.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-sm text-[var(--text)]">{total}</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--card-border)] bg-[var(--sidebar-link-hover)]">
                <th className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">{_('portfolio.ticker')}</th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]"><TermTooltip term="P/E Ratio">{_('fund.pe')}</TermTooltip></th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]"><TermTooltip term="P/B Ratio">{_('fund.pb')}</TermTooltip></th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]"><TermTooltip term="EV/EBITDA">{_('fund.evEbitda')}</TermTooltip></th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]"><TermTooltip term="Div Yield">{_('fund.divYield')}</TermTooltip></th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]"><TermTooltip term="ROE">{_('fund.roe')}</TermTooltip></th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]"><TermTooltip term="EPS Growth">{_('fund.epsGrowth')}</TermTooltip></th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]"><TermTooltip term="Debt-to-Equity">{_('fund.debtToEquity')}</TermTooltip></th>
                <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]"><TermTooltip term="Market Cap">{_('fund.marketCap')}</TermTooltip></th>
                <th className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">{_('fund.sector')}</th>
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

      {!loading && results.length === 0 && <EmptyState title={_('scr.noResults')} description={_('scr.noResultsDesc')} icon="search" />}
    </div>
  )
}
