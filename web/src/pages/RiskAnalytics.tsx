import { useState } from 'react'
import {
  Activity, TrendingDown, Shield, AlertTriangle,
  Search, RefreshCw, BarChart3, GitCompare,
} from 'lucide-react'
import { riskApi } from '../api/client'
import { PageLoading } from '../components/ui/Loading'
import { StatCard } from '../components/ui/StatCard'
import type { RiskAll } from '../types'

export function RiskAnalyticsPage() {
  const [ticker, setTicker] = useState('3045.TW')
  const [risk, setRisk] = useState<RiskAll | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchRisk = async () => {
    if (!ticker.trim()) return
    setLoading(true)
    setError('')
    setRisk(null)
    try {
      const res = await riskApi.all(ticker.trim(), '0050.TW', 2.0, 252)
      setRisk(res.data)
    } catch {
      setError(`Could not fetch risk data for ${ticker}. Check the ticker and try again.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Risk Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Quantitative risk metrics powered by market data</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex gap-2">
            <input
              className="input max-w-xs"
              placeholder="Ticker (e.g., 3045.TW)"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchRisk()}
            />
            <button className="btn-primary" onClick={fetchRisk} disabled={loading || !ticker.trim()}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Analyze
            </button>
          </div>
        </div>
      </div>

      {loading && <PageLoading />}
      {error && <div className="card p-6 text-red-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />{error}</div>}

      {risk && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Annualized Volatility"
              value={risk.annualized_volatility_pct != null ? `${risk.annualized_volatility_pct.toFixed(2)}%` : '-'}
              icon={Activity}
              trend={risk.annualized_volatility_pct != null ? {
                value: `${risk.annualized_volatility_pct < 20 ? 'Low' : risk.annualized_volatility_pct < 40 ? 'Moderate' : 'High'} volatility`,
                positive: (risk.annualized_volatility_pct ?? 0) < 30,
              } : undefined}
            />
            <StatCard
              label="Sharpe Ratio"
              value={risk.sharpe_ratio != null ? risk.sharpe_ratio.toFixed(2) : '-'}
              icon={BarChart3}
              trend={risk.sharpe_ratio != null ? {
                value: `Risk-adjusted return`,
                positive: (risk.sharpe_ratio ?? 0) > 1,
              } : undefined}
            />
            <StatCard
              label="Max Drawdown"
              value={risk.max_drawdown_pct != null ? `${risk.max_drawdown_pct.toFixed(2)}%` : '-'}
              icon={TrendingDown}
              trend={risk.max_drawdown_pct != null ? {
                value: 'Peak-to-trough decline',
                positive: (risk.max_drawdown_pct ?? 0) > -20,
              } : undefined}
            />
            <StatCard
              label="VaR (95% Daily)"
              value={risk.var_95_daily_pct != null ? `${risk.var_95_daily_pct.toFixed(2)}%` : '-'}
              icon={Shield}
              trend={risk.var_95_daily_pct != null ? {
                value: 'Worst expected daily loss',
                positive: (risk.var_95_daily_pct ?? 0) > -5,
              } : undefined}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><GitCompare className="w-4 h-4" /> Beta vs. Index</h3>
              {risk.beta_vs_index != null ? (
                <div className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{risk.beta_vs_index.toFixed(2)}</span>
                    <span className="text-sm text-gray-500">vs {risk.index_ticker}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${risk.beta_vs_index < 1 ? 'bg-green-500' : risk.beta_vs_index < 1.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(risk.beta_vs_index / 2 * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {risk.beta_vs_index < 0.5 ? 'Low correlation — defensive stock' :
                     risk.beta_vs_index < 1 ? 'Lower volatility than the market' :
                     risk.beta_vs_index < 1.5 ? 'Moves broadly in line with the market' :
                     'Higher volatility than the market — aggressive stock'}
                  </p>
                </div>
              ) : (
                <p className="text-gray-400 text-sm">Beta data not available</p>
              )}
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><Shield className="w-4 h-4" /> Risk Interpretation</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">Risk Profile</span>
                  <span className={`font-medium ${(risk.annualized_volatility_pct ?? 0) < 20 ? 'text-green-600' : (risk.annualized_volatility_pct ?? 0) < 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {(risk.annualized_volatility_pct ?? 0) < 20 ? 'Low' : (risk.annualized_volatility_pct ?? 0) < 40 ? 'Moderate' : 'High'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">Return Efficiency</span>
                  <span className={`font-medium ${(risk.sharpe_ratio ?? 0) > 1 ? 'text-green-600' : (risk.sharpe_ratio ?? 0) > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {(risk.sharpe_ratio ?? 0) > 1 ? 'Good' : (risk.sharpe_ratio ?? 0) > 0 ? 'Acceptable' : 'Poor'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-gray-500">Downside Risk</span>
                  <span className={`font-medium ${(risk.max_drawdown_pct ?? 0) > -15 ? 'text-green-600' : (risk.max_drawdown_pct ?? 0) > -30 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {(risk.max_drawdown_pct ?? 0) > -15 ? 'Controlled' : (risk.max_drawdown_pct ?? 0) > -30 ? 'Moderate' : 'Severe'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Market Sensitivity</span>
                  <span className={`font-medium ${(risk.beta_vs_index ?? 1) < 0.8 ? 'text-green-600' : (risk.beta_vs_index ?? 1) < 1.2 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {(risk.beta_vs_index ?? 1) < 0.8 ? 'Defensive' : (risk.beta_vs_index ?? 1) < 1.2 ? 'Neutral' : 'Aggressive'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Value at Risk (VaR) Confidence Levels</h3>
            {risk.var_95_daily_pct != null && (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-700">{risk.var_95_daily_pct.toFixed(2)}%</p>
                  <p className="text-xs text-gray-500 mt-1">Daily (95%)</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-700">{(risk.var_95_daily_pct! * Math.sqrt(5)).toFixed(2)}%</p>
                  <p className="text-xs text-gray-500 mt-1">Weekly (95%)</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-700">{(risk.var_95_daily_pct! * Math.sqrt(21)).toFixed(2)}%</p>
                  <p className="text-xs text-gray-500 mt-1">Monthly (95%)</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
