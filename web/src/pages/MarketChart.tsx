import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CandlestickSeries, HistogramSeries, type IChartApi, type CandlestickData, type HistogramData } from 'lightweight-charts'
import { Search, RefreshCw, AlertTriangle } from 'lucide-react'
import { chartApi } from '../api/client'
import { useT } from '../i18n'
import { ChartSkeleton } from '../components/ui/Skeleton'
import type { OHLCVItem } from '../types'

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
]

export function MarketChartPage() {
  const [ticker, setTicker] = useState('3045.TW')
  const [ohlcv, setOhlcv] = useState<OHLCVItem[]>([])
  const [days, setDays] = useState(180)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstance = useRef<IChartApi | null>(null)
  const dark = document.documentElement.classList.contains('dark')
  const _ = useT()

  const fetchData = async (d: number) => {
    if (!ticker.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await chartApi.ohlcv(ticker.trim(), d)
      setOhlcv(res.data.items || [])
    } catch {
      setError(`No cached data for ${ticker}. Click Sync to load price history first.`)
    } finally {
      setLoading(false)
    }
  }

  const syncData = async () => {
    if (!ticker.trim()) return
    setSyncing(true)
    setError('')
    try {
      await chartApi.sync(ticker.trim(), '1y')
      await fetchData(days)
    } catch {
      setError(`Could not sync data for ${ticker}.`)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    if (!chartRef.current || ohlcv.length === 0) return

    if (chartInstance.current) {
      chartInstance.current.remove()
      chartInstance.current = null
    }

    const isDark = document.documentElement.classList.contains('dark')
    const chart = createChart(chartRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#94a3b8' : '#6b7280',
      },
      grid: {
        vertLines: { color: isDark ? '#1e293b' : '#f0f0f0' },
        horzLines: { color: isDark ? '#1e293b' : '#f0f0f0' },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: isDark ? '#334155' : '#e5e7eb' },
      timeScale: { borderColor: isDark ? '#334155' : '#e5e7eb' },
      width: chartRef.current.clientWidth,
      height: 450,
    })

    const candles = ohlcv.map((item) => ({
      time: item.time.slice(0, 10) as string,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
    })) as CandlestickData[]

    const volumes = ohlcv.map((item) => ({
      time: item.time.slice(0, 10) as string,
      value: item.volume,
      color: item.close >= item.open
        ? 'rgba(34,197,94,0.3)'
        : 'rgba(239,68,68,0.3)',
    })) as HistogramData[]

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    })
    candlestickSeries.setData(candles)

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    })
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    })
    volumeSeries.setData(volumes)

    chart.timeScale().fitContent()
    chartInstance.current = chart

    const handleResize = () => {
      if (chartRef.current && chartInstance.current) {
        chartInstance.current.applyOptions({ width: chartRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartInstance.current = null
    }
  }, [ohlcv, dark])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">{_('chart.title')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{_('chart.subtitle')}</p>
      </div>

      <div className="card">
        <div className="card-body flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <input
              className="input max-w-[140px]"
              placeholder={_('chart.tickerPlaceholder')}
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchData(days)}
            />
            <button className="btn-primary" onClick={() => fetchData(days)} disabled={loading || !ticker.trim()}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
            <button className="btn-secondary" onClick={syncData} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {_('common.sync')}
            </button>
          </div>
          <div className="pill-group ml-auto">
            {PERIODS.map((p) => (
              <button
                key={p.label}
                className={`pill ${days === p.days ? 'active' : ''}`}
                onClick={() => { setDays(p.days); fetchData(p.days) }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="card p-4 text-red-500 dark:text-red-400 flex items-center gap-2 text-sm"><AlertTriangle className="w-4 h-4" />{error}</div>}

      {loading && <ChartSkeleton />}

      {!loading && ohlcv.length > 0 && (
        <div className="card overflow-hidden">
          <div ref={chartRef} className="w-full" />
          <div className="flex items-center gap-4 px-4 pb-3 text-xs text-[var(--text-secondary)]">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 inline-block rounded-sm bg-green-500" /> {_('chart.up')}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 inline-block rounded-sm bg-red-500" /> {_('chart.down')}
            </span>
            <span className="live-dot bg-green-400 ml-auto" />
            <span>{_('dashboard.live')}</span>
          </div>
        </div>
      )}

      {!loading && ohlcv.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-sm">{_('chart.latestPrices')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  <th className="text-left px-3 py-2 font-medium text-[var(--text-secondary)]">{_('chart.date')}</th>
                  <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">{_('chart.open')}</th>
                  <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">{_('chart.high')}</th>
                  <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">{_('chart.low')}</th>
                  <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">{_('chart.close')}</th>
                  <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">{_('chart.change')}</th>
                  <th className="text-right px-3 py-2 font-medium text-[var(--text-secondary)]">{_('chart.volume')}</th>
                </tr>
              </thead>
              <tbody>
                {ohlcv.slice(-15).reverse().map((item, i) => {
                  const change = item.close - item.open
                  const changePct = (change / item.open * 100)
                  return (
                    <tr key={i} className="border-b border-[var(--card-border)] hover:bg-[var(--sidebar-link-hover)]">
                      <td className="px-3 py-2 text-[var(--text-secondary)] font-mono text-xs">{item.time.slice(0, 10)}</td>
                      <td className="px-3 py-2 text-right font-mono">{item.open.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono">{item.high.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right font-mono">{item.low.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right font-mono font-medium ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {item.close.toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right font-mono ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {change >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--text-secondary)]">{item.volume.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && ohlcv.length === 0 && !error && (
        <div className="card p-12 text-center text-[var(--text-secondary)]">
          Search a ticker and sync data to view the chart.
        </div>
      )}
    </div>
  )
}
