import { useState } from 'react'
import { Activity, TrendingDown, Shield, AlertTriangle, Search, RefreshCw, BarChart3, GitCompare } from 'lucide-react'
import { riskApi } from '../api/client'
import { StatCard } from '../components/ui/StatCard'
import { TermTooltip } from '../components/ui/TermTooltip'
import { useT } from '../i18n'
import { PageLoading } from '../components/ui/Loading'
import type { RiskAll } from '../types'

export function RiskAnalyticsPage() {
  const [ticker, setTicker] = useState('3045.TW')
  const [risk, setRisk] = useState<RiskAll | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const _ = useT()

  const fetchRisk = async () => {
    if (!ticker.trim()) return
    setLoading(true); setError(''); setRisk(null)
    try {
      const res = await riskApi.all(ticker.trim(), '0050.TW', 2.0, 252)
      setRisk(res.data)
    } catch {
      setError(`Could not fetch risk data for ${ticker}.`)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">{_('risk.title')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{_('risk.subtitle')}</p>
      </div>

      <div className="card">
        <div className="card-body flex gap-2">
          <input className="input max-w-xs" placeholder={_('risk.tickerPlaceholder')} value={ticker}
            onChange={(e) => setTicker(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchRisk()} />
          <button className="btn-primary" onClick={fetchRisk} disabled={loading || !ticker.trim()}>
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} {_('risk.analyze')}
          </button>
        </div>
      </div>

      {loading && <PageLoading />}
      {error && <div className="card p-4 text-red-500 dark:text-red-400 flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {risk && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={<TermTooltip term="Annualized Vol">{_('risk.annualizedVol')}</TermTooltip>} value={risk.annualized_volatility_pct != null ? `${risk.annualized_volatility_pct.toFixed(2)}%` : '-'} icon={Activity}
              trend={{ value: (risk.annualized_volatility_pct ?? 0) < 20 ? 'Low' : (risk.annualized_volatility_pct ?? 0) < 40 ? 'Moderate' : 'High', positive: (risk.annualized_volatility_pct ?? 0) < 30 }} />
            <StatCard label={<TermTooltip term="Sharpe Ratio">{_('risk.sharpeRatio')}</TermTooltip>} value={risk.sharpe_ratio != null ? risk.sharpe_ratio.toFixed(2) : '-'} icon={BarChart3}
              trend={{ value: 'Risk-adjusted return', positive: (risk.sharpe_ratio ?? 0) > 1 }} />
            <StatCard label={<TermTooltip term="Max Drawdown">{_('risk.maxDrawdown')}</TermTooltip>} value={risk.max_drawdown_pct != null ? `${risk.max_drawdown_pct.toFixed(2)}%` : '-'} icon={TrendingDown}
              trend={{ value: 'Peak-to-trough', positive: (risk.max_drawdown_pct ?? 0) > -20 }} />
            <StatCard label={<TermTooltip term="VaR">{_('risk.var95')}</TermTooltip>} value={risk.var_95_daily_pct != null ? `${risk.var_95_daily_pct.toFixed(2)}%` : '-'} icon={Shield}
              trend={{ value: 'Worst daily loss', positive: (risk.var_95_daily_pct ?? 0) > -5 }} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2"><GitCompare className="w-4 h-4" /> <TermTooltip term="Beta">{_('risk.beta')}</TermTooltip></h3>
              {risk.beta_vs_index != null ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold font-mono">{risk.beta_vs_index.toFixed(2)}</span>
                    <span className="text-sm text-[var(--text-secondary)]">vs {risk.index_ticker}</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${risk.beta_vs_index < 1 ? 'bg-green-500' : risk.beta_vs_index < 1.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(risk.beta_vs_index / 2 * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {risk.beta_vs_index < 0.5 ? 'Low correlation — defensive stock' :
                     risk.beta_vs_index < 1 ? 'Lower volatility than the market' :
                     risk.beta_vs_index < 1.5 ? 'Moves broadly in line with the market' : 'Higher volatility than the market'}
                  </p>
                </div>
              ) : <p className="text-sm text-[var(--text-secondary)]">Beta data not available</p>}
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-4 flex items-center gap-2"><Shield className="w-4 h-4" /> {_('risk.interpretation')}</h3>
              <div className="space-y-3 text-sm">
                {[
                  { label: _('risk.riskProfile'), value: (risk.annualized_volatility_pct ?? 0) < 20 ? _('risk.low') : (risk.annualized_volatility_pct ?? 0) < 40 ? _('risk.moderate') : _('risk.high'),
                    color: (risk.annualized_volatility_pct ?? 0) < 20 ? 'text-green-600 dark:text-green-400' : (risk.annualized_volatility_pct ?? 0) < 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400' },
                  { label: _('risk.returnEfficiency'), value: (risk.sharpe_ratio ?? 0) > 1 ? _('risk.good') : (risk.sharpe_ratio ?? 0) > 0 ? _('risk.acceptable') : _('risk.poor'),
                    color: (risk.sharpe_ratio ?? 0) > 1 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400' },
                  { label: _('risk.downsideRisk'), value: (risk.max_drawdown_pct ?? 0) > -15 ? _('risk.controlled') : (risk.max_drawdown_pct ?? 0) > -30 ? _('risk.moderate') : _('risk.severe'),
                    color: (risk.max_drawdown_pct ?? 0) > -15 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400' },
                  { label: _('risk.marketSensitivity'), value: (risk.beta_vs_index ?? 1) < 0.8 ? _('risk.defensive') : (risk.beta_vs_index ?? 1) < 1.2 ? _('risk.neutral') : _('risk.aggressive'),
                    color: (risk.beta_vs_index ?? 1) < 0.8 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between py-2 border-b border-[var(--card-border)]">
                    <span className="text-[var(--text-secondary)]">{label}</span>
                    <span className={`font-medium font-mono ${color}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-[var(--text)] mb-4"><TermTooltip term="Value at Risk">Value at Risk (VaR)</TermTooltip></h3>
            {risk.var_95_daily_pct != null && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: _('risk.daily'), value: risk.var_95_daily_pct, color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' },
                  { label: _('risk.weekly'), value: risk.var_95_daily_pct * Math.sqrt(5), color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400' },
                  { label: _('risk.monthly'), value: risk.var_95_daily_pct * Math.sqrt(21), color: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`text-center p-4 rounded-lg ${color}`}>
                    <p className="text-2xl font-bold font-mono">{value.toFixed(2)}%</p>
                    <p className="text-xs mt-1 opacity-70">{label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
