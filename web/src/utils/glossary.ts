type Def = { en: string; 'zh-TW': string }

export const GLOSSARY: Record<string, Def> = {
  // ── Valuation ──
  'P/E Ratio': {
    en: 'Price-to-Earnings — stock price ÷ EPS. Lower often means undervalued relative to earnings.',
    'zh-TW': '本益比 — 股價 ÷ 每股盈餘。數值越低可能表示股票被低估。',
  },
  'P/E': {
    en: 'Price-to-Earnings — stock price ÷ EPS. Lower often means undervalued relative to earnings.',
    'zh-TW': '本益比 — 股價 ÷ 每股盈餘。數值越低可能表示股票被低估。',
  },
  'P/B Ratio': {
    en: 'Price-to-Book — stock price ÷ book value per share. Measures what investors pay per dollar of net assets.',
    'zh-TW': '股價淨值比 — 股價 ÷ 每股淨值。衡量市場對公司資產的估值倍數。',
  },
  'P/B': {
    en: 'Price-to-Book — stock price ÷ book value per share. Measures what investors pay per dollar of net assets.',
    'zh-TW': '股價淨值比 — 股價 ÷ 每股淨值。衡量市場對公司資產的估值倍數。',
  },
  'EV/EBITDA': {
    en: 'Enterprise Value ÷ EBITDA. A valuation multiple comparing total company value to operating earnings. Lower may indicate undervaluation.',
    'zh-TW': '企業價值 ÷ EBITDA。衡量公司整體估值相對於營運現金流的倍數，數值越低可能越被低估。',
  },
  'PEG Ratio': {
    en: 'P/E divided by EPS growth rate. Values below 1 may indicate the stock is undervalued relative to its growth.',
    'zh-TW': '本益成長比 — 本益比 ÷ EPS增長率。低於1可能表示被低估。',
  },
  'Market Cap': {
    en: 'Market Capitalisation — stock price × shares outstanding. The total market value of the company.',
    'zh-TW': '市值 — 股價 × 流通在外股數，代表公司的市場總價值。',
  },

  // ── Profitability ──
  'ROE': {
    en: 'Return on Equity — net income ÷ shareholders\' equity. Measures how efficiently a company turns equity into profit.',
    'zh-TW': '股東權益報酬率 — 稅後淨利 ÷ 股東權益。衡量公司為股東創造利潤的效率。',
  },
  'EPS': {
    en: 'Earnings Per Share — net income ÷ shares outstanding. The profit attributable to each share.',
    'zh-TW': '每股盈餘 — 稅後淨利 ÷ 流通在外股數。代表每股可分配到的利潤。',
  },
  'EPS Growth': {
    en: 'Year-over-year growth in earnings per share.',
    'zh-TW': '每股盈餘增長率 — 本期EPS相較去年同期的增長百分比。',
  },
  'EBITDA': {
    en: 'Earnings Before Interest, Taxes, Depreciation and Amortisation. A measure of core operating profitability.',
    'zh-TW': '稅息折舊攤銷前盈餘。衡量公司核心營運獲利能力的指標。',
  },
  'Revenue': {
    en: 'Total income from sales of goods or services before any costs are deducted.',
    'zh-TW': '營收 — 公司在一定期間內透過銷售商品或服務獲得的總收入。',
  },
  'Net Income': {
    en: 'Revenue minus all costs, expenses, interest, and taxes. The bottom-line profit.',
    'zh-TW': '淨利潤 — 營收減去所有成本、費用和稅金後的利潤，即稅後淨利。',
  },
  'Expenses': {
    en: 'Costs incurred in running the business.',
    'zh-TW': '費用 — 公司營運產生的各項成本與支出。',
  },
  'Profit Margin': {
    en: 'Net income as a percentage of revenue. How much profit a company keeps per dollar of revenue.',
    'zh-TW': '利潤率 — 淨利潤 ÷ 營收，衡量公司每元收入的獲利百分比。',
  },
  'Free Cash Flow': {
    en: 'Operating cash flow minus capital expenditure. The cash a company can freely deploy.',
    'zh-TW': '自由現金流 — 營運現金流減去資本支出，代表公司可自由運用的現金。',
  },

  // ── Income ──
  'Dividend Yield': {
    en: 'Annual dividend per share ÷ stock price. The cash return for holding the stock for one year.',
    'zh-TW': '股息率 — 每股年股息 ÷ 股價，代表持有股票一年的現金回報率。',
  },
  'Div Yield': {
    en: 'Annual dividend per share ÷ stock price. The cash return for holding the stock for one year.',
    'zh-TW': '股息率 — 每股年股息 ÷ 股價，代表持有股票一年的現金回報率。',
  },
  'Payout Ratio': {
    en: 'Proportion of earnings paid as dividends. A very high ratio may not be sustainable.',
    'zh-TW': '配息率 — 每股股息 ÷ 每股盈餘，衡量公司將盈利分配給股東的比例。',
  },

  // ── Risk ──
  'Sharpe Ratio': {
    en: '(Return − Risk-free rate) ÷ Volatility. Measures risk-adjusted return — higher is better.',
    'zh-TW': '夏普比率 — (投資回報率 - 無風險利率) ÷ 波動率，衡量每單位風險的超額回報。越高越好。',
  },
  'Annualized Volatility': {
    en: 'Standard deviation of daily returns scaled to one year. Higher means greater price swings and risk.',
    'zh-TW': '年化波動率 — 以年為單位的標準差，衡量資產價格的波動程度。越高表示風險越大。',
  },
  'Annualized Vol': {
    en: 'Standard deviation of daily returns scaled to one year. Higher means greater price swings and risk.',
    'zh-TW': '年化波動率 — 衡量資產價格的年化波動程度。越高表示風險越大。',
  },
  'Max Drawdown': {
    en: 'The largest peak-to-trough decline in price history. Measures the worst loss an investor could have experienced.',
    'zh-TW': '最大回撤 — 從歷史最高點到最低點的跌幅百分比，衡量最壞情況下的損失。',
  },
  'Value at Risk': {
    en: 'At 95% confidence, the maximum expected daily loss. A VaR of −2% means there is a 95% chance the daily loss will not exceed 2%.',
    'zh-TW': '在險價值 (VaR) — 在95%信心水準下的最大預期損失。例如VaR為-2%表示有95%把握每日損失不超過2%。',
  },
  'VaR': {
    en: 'Value at Risk — at 95% confidence, the maximum expected loss over the given period.',
    'zh-TW': '在險價值 — 在95%信心水準下，給定期間內的最大預期損失。',
  },
  'Beta': {
    en: 'Price sensitivity relative to the market. Beta > 1 = more volatile than market; Beta < 1 = less volatile.',
    'zh-TW': 'Beta係數 — 衡量股票相對於大盤的波動程度。>1表示波動更大，<1表示波動較小。',
  },
  'Correlation': {
    en: 'How two assets move together, from −1 (opposite) to +1 (identical movement).',
    'zh-TW': '相關係數 — 衡量兩資產之間的相關程度，範圍從-1到+1。',
  },

  // ── Portfolio ──
  'Unrealized P&L': {
    en: 'Gain or loss on an open position at current market price vs. cost basis — not yet booked.',
    'zh-TW': '未實現損益 — 持倉當前市值與買入成本之間的差額，尚未平倉實現。',
  },
  'Realized P&L': {
    en: 'Profit or loss actually booked after closing a position.',
    'zh-TW': '已實現損益 — 實際平倉後實現的利潤或損失。',
  },
  'Cost Basis': {
    en: 'The original purchase price of an asset, including transaction costs.',
    'zh-TW': '成本基礎 — 買入資產的原始成本，包括交易費用。',
  },
  'Debt-to-Equity': {
    en: 'Total debt ÷ shareholders\' equity. Measures financial leverage — higher means more debt relative to equity.',
    'zh-TW': '負債權益比 — 總負債 ÷ 股東權益，衡量公司財務槓桿程度。',
  },

  // ── Technical ──
  'SMA': {
    en: 'Simple Moving Average — arithmetic mean of closing prices over a set period, used to identify trend direction.',
    'zh-TW': '簡單移動平均線 — 一定期間內收盤價的算術平均值，用於識別趨勢方向。',
  },
  'Moving Average': {
    en: 'A smoothed price series used to identify trend direction by averaging prices over a rolling window.',
    'zh-TW': '移動平均線 — 平滑價格數據以識別趨勢的技術指標。',
  },
  'OHLCV': {
    en: 'Open, High, Low, Close, Volume — the standard format for daily price data.',
    'zh-TW': '開高低收量 — 金融數據的標準格式：開盤價、最高價、最低價、收盤價和成交量。',
  },
  'Volume Profile': {
    en: 'Distribution of trading volume across price levels, used to identify support and resistance.',
    'zh-TW': '成交量分布 — 顯示不同價格水準上的成交量，用於識別支撐和壓力位。',
  },
}

export const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length)
