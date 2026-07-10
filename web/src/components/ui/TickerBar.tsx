import { useEffect, useState } from 'react'

interface TickerItem {
  ticker: string
  price: number | null
  change?: number
}

export function TickerBar() {
  const [items, setItems] = useState<TickerItem[]>([
    { ticker: '3045.TW', price: null },
    { ticker: '0050.TW', price: null },
    { ticker: '2330.TW', price: null },
  ])

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws/prices`
    let ws: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      try {
        ws = new WebSocket(wsUrl)
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'prices') {
              setItems((prev) =>
                prev.map((item) => ({
                  ...item,
                  price: msg.data[item.ticker] ?? item.price,
                }))
              )
            }
          } catch {}
        }
        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 5000)
        }
      } catch {}
    }

    connect()
    return () => {
      if (ws) ws.close()
      clearTimeout(reconnectTimer)
    }
  }, [])

  if (items.length === 0) return null

  const doubled = [...items, ...items]

  return (
    <div className="w-full overflow-hidden bg-slate-900 dark:bg-black border-b border-slate-700 h-10">
      <div className="ticker-track flex items-center h-full px-4">
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2 shrink-0 text-xs">
            <span className="font-semibold text-slate-200">{item.ticker}</span>
            <span className="font-mono text-slate-300">
              {item.price != null ? `$${item.price.toFixed(2)}` : '--'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
