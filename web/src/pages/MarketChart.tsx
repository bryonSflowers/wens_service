import { useState } from 'react'
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Line, ComposedChart,
} from 'recharts'
import { Search, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react'
import { chartApi } from '../api/client'
import { PageLoading } from '../components/ui/Loading'
import type { OHLCVItem, MAResponse } from '../types'

const CHART_COLORS = {
  up: '#22c55e',
  down: '#ef4444',
  ma20: '#3b82f6',
  ma50: '#f59e0b',
  ma200: '#8b5cf6',
}

export function MarketChartPage() {
  const [ticker, setTicker] = useState('3045.TW')
  const [ohlcv, setOhlcv] = useState<OHLCVItem[]>([])
  const [mas, setMas] = useState<MAResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const [days] = useState(180)

  const fetchData = async () => {
    if (!ticker.trim()) return
    setLoading(true)
    setError('')
    try {
      const [ohlcvRes, maRes] = await Promise.all([
        chartApi.ohlcv(ticker.trim(), days),
        chartApi.ma(ticker.trim(), '20,50,200', days).catch(() => ({ data: [] })),
      ])
      setOhlcv(ohlcvRes.data.items || [])
      setMas(maRes.data || [])
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
      await fetchData()
    } catch {
      setError(`Could not sync data for ${ticker}.`)
    } finally {
      setSyncing(false)
    }
  }

  const formatOHLCV = ohlcv.map((item) => ({
    ...item,
    date: item.time.slice(0, 10),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stock Chart</h1>
        <p className="text-sm text-gray-500 mt-1">OHLCV, moving averages, and volume profile</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex gap-2">
            <input
              className="input max-w-xs"
              placeholder="Ticker (e.g., 3045.TW)"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchData()}
            />
            <button className="btn-primary" onClick={fetchData} disabled={loading || !ticker.trim()}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Load
            </button>
            <button className="btn-secondary" onClick={syncData} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync Data
            </button>
          </div>
        </div>
      </div>

      {loading && <PageLoading />}
      {error && <div className="card p-6 text-red-600 flex items-center gap-2"><AlertTriangle className="w-5 h-5" />{error}</div>}

      {formatOHLCV.length > 0 && (
        <>
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Price Chart with Moving Averages
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={formatOHLCV}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip />
                <Bar dataKey="volume" fill="#e5e7eb" opacity={0.5} yAxisId={0} name="Volume" />
                <Line type="monotone" dataKey="close" stroke="#111827" strokeWidth={2} dot={false} name="Close" />
                {mas.filter((m) => m.window === 20).map((m) => (
                  <Line key={m.window} type="monotone" data={m.items.map((i) => ({ date: i.time, [`ma${m.window}`]: i.value }))} dataKey={`ma${m.window}`} stroke={CHART_COLORS.ma20} strokeWidth={1} dot={false} name={`SMA ${m.window}`} />
                ))}
                {mas.filter((m) => m.window === 50).map((m) => (
                  <Line key={m.window} type="monotone" data={m.items.map((i) => ({ date: i.time, [`ma${m.window}`]: i.value }))} dataKey={`ma${m.window}`} stroke={CHART_COLORS.ma50} strokeWidth={1} dot={false} name={`SMA ${m.window}`} />
                ))}
                {mas.filter((m) => m.window === 200).map((m) => (
                  <Line key={m.window} type="monotone" data={m.items.map((i) => ({ date: i.time, [`ma${m.window}`]: i.value }))} dataKey={`ma${m.window}`} stroke={CHART_COLORS.ma200} strokeWidth={1} dot={false} name={`SMA ${m.window}`} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-gray-900 inline-block" /> Close</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> SMA 20</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-yellow-500 inline-block" /> SMA 50</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-500 inline-block" /> SMA 200</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Latest Prices</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-2 py-2 font-medium text-gray-500">Date</th>
                      <th className="text-right px-2 py-2 font-medium text-gray-500">Open</th>
                      <th className="text-right px-2 py-2 font-medium text-gray-500">High</th>
                      <th className="text-right px-2 py-2 font-medium text-gray-500">Low</th>
                      <th className="text-right px-2 py-2 font-medium text-gray-500">Close</th>
                      <th className="text-right px-2 py-2 font-medium text-gray-500">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formatOHLCV.slice(-10).reverse().map((item, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-2 py-2 text-gray-500">{item.date}</td>
                        <td className="px-2 py-2 text-right">{item.open.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right">{item.high.toFixed(2)}</td>
                        <td className="px-2 py-2 text-right">{item.low.toFixed(2)}</td>
                        <td className={`px-2 py-2 text-right font-medium ${item.close >= item.open ? 'text-green-600' : 'text-red-600'}`}>
                          {item.close.toFixed(2)}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-500">{item.volume.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Price Summary</h3>
              {formatOHLCV.length > 0 && (() => {
                const closes = formatOHLCV.map((i) => i.close)
                const volumes = formatOHLCV.map((i) => i.volume)
                const first = closes[0]
                const last = closes[closes.length - 1]
                const change = last - first
                const changePct = (change / first * 100)
                const highest = Math.max(...closes)
                const lowest = Math.min(...closes)
                const avgVol = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length)
                return (
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm text-gray-500">Period Change</span>
                      <span className={`text-sm font-semibold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {change >= 0 ? '+' : ''}${change.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm text-gray-500">52W High</span>
                      <span className="text-sm font-semibold">${highest.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm text-gray-500">52W Low</span>
                      <span className="text-sm font-semibold">${lowest.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-sm text-gray-500">Avg Volume</span>
                      <span className="text-sm font-semibold">{avgVol.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-sm text-gray-500">Trading Days</span>
                      <span className="text-sm font-semibold">{formatOHLCV.length}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
