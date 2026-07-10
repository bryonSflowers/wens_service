export interface TickerInfo {
  ticker: string
  name: string
  sector: string
}

export const TICKER_SECTORS: Record<string, string> = {
  'telecom': 'Telecom / Internet',
  'semiconductor': 'Semiconductor',
  'electronics': 'Electronics & Manufacturing',
  'financial': 'Financial',
  'petrochemical': 'Petrochemical',
  'steel': 'Steel & Materials',
  'consumer': 'Consumer & Retail',
  'etf': 'ETF / Index',
}

export const TICKER_DATA: TickerInfo[] = [
  { ticker: '3045.TW', name: '台灣大哥大', sector: 'telecom' },
  { ticker: '2412.TW', name: '中華電信', sector: 'telecom' },

  { ticker: '2330.TW', name: '台積電', sector: 'semiconductor' },
  { ticker: '2454.TW', name: '聯發科', sector: 'semiconductor' },
  { ticker: '3008.TW', name: '大立光', sector: 'semiconductor' },

  { ticker: '2308.TW', name: '台達電', sector: 'electronics' },
  { ticker: '2317.TW', name: '鴻海精密', sector: 'electronics' },

  { ticker: '2881.TW', name: '富邦金控', sector: 'financial' },
  { ticker: '2882.TW', name: '國泰金控', sector: 'financial' },

  { ticker: '1301.TW', name: '台塑', sector: 'petrochemical' },
  { ticker: '1303.TW', name: '南亞塑膠', sector: 'petrochemical' },
  { ticker: '1326.TW', name: '台化', sector: 'petrochemical' },

  { ticker: '2002.TW', name: '中鋼', sector: 'steel' },

  { ticker: '1216.TW', name: '統一企業', sector: 'consumer' },

  { ticker: '0050.TW', name: '元大台灣50', sector: 'etf' },
]

export const TICKER_NAMES: Record<string, string> = Object.fromEntries(
  TICKER_DATA.map((t) => [t.ticker, t.name])
)

export function getTickerName(ticker: string): string {
  return TICKER_NAMES[ticker] || ticker.replace('.TW', '')
}

export function getTickerSector(ticker: string): string {
  const info = TICKER_DATA.find((t) => t.ticker === ticker)
  return info ? TICKER_SECTORS[info.sector] || '' : ''
}

export function getSectorTickers(sector: string): TickerInfo[] {
  return TICKER_DATA.filter((t) => t.sector === sector)
}
