export const TICKER_NAMES: Record<string, string> = {
  '3045.TW': '台灣大哥大',
  '2330.TW': '台積電',
  '0050.TW': '元大台灣50',
  '2454.TW': '聯發科',
  '2308.TW': '台達電',
  '2317.TW': '鴻海',
  '2412.TW': '中華電',
  '2881.TW': '富邦金',
  '2882.TW': '國泰金',
  '3008.TW': '大立光',
  '2002.TW': '中鋼',
  '1301.TW': '台塑',
  '1303.TW': '南亞',
  '1326.TW': '台化',
  '1216.TW': '統一',
}

export function getTickerName(ticker: string): string {
  return TICKER_NAMES[ticker] || ticker.replace('.TW', '')
}
