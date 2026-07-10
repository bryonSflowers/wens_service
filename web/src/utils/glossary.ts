export const GLOSSARY: Record<string, string> = {
  'P/E': '本益比 (Price-to-Earnings Ratio) — 股價除以每股盈餘，衡量股票價格相對於盈利能力的指標。數值越低表示股票可能被低估。',
  'P/E Ratio': '本益比 (Price-to-Earnings Ratio) — 股價除以每股盈餘，衡量股票價格相對於盈利能力的指標。數值越低表示股票可能被低估。',
  'P/B': '股價淨值比 (Price-to-Book Ratio) — 股價除以每股淨值，衡量市場對公司資產的估值倍數。',
  'P/B Ratio': '股價淨值比 (Price-to-Book Ratio) — 股價除以每股淨值，衡量市場對公司資產的估值倍數。',
  'EV/EBITDA': '企業價值倍數 (Enterprise Value to EBITDA) — 企業價值除以稅息折舊攤銷前盈餘，衡量公司整體估值相對於營運現金流的倍數。',
  'ROE': '股東權益報酬率 (Return on Equity) — 稅後淨利除以股東權益，衡量公司為股東創造利潤的效率。',
  'EPS': '每股盈餘 (Earnings Per Share) — 稅後淨利除以流通在外股數，代表每一股能分配到的利潤。',
  'EPS Growth': '每股盈餘增長率 (Earnings Per Share Growth) — 本期EPS相較去年同期的增長百分比。',
  'Debt-to-Equity': '負債權益比 (Debt-to-Equity Ratio) — 總負債除以股東權益，衡量公司財務槓桿程度。',
  'Dividend Yield': '股息率 (Dividend Yield) — 每股股息除以股價，代表持有股票一年的現金回報率。',
  'Payout Ratio': '配息率 (Payout Ratio) — 每股股息除以每股盈餘，衡量公司將盈利分配給股東的比例。',
  'Market Cap': '市值 (Market Capitalization) — 股價乘以流通在外股數，代表公司的市場總價值。',
  'PEG Ratio': '本益成長比 (PEG Ratio) — 本益比除以EPS增長率，衡量估值與增長之間的關係。低於1可能表示被低估。',

  'Sharpe Ratio': '夏普比率 (Sharpe Ratio) — (投資回報率 - 無風險利率) / 波動率，衡量每單位風險所獲得的超額回報。越高越好。',
  'Annualized Volatility': '年化波動率 (Annualized Volatility) — 以年為單位的標準差，衡量資產價格的波動程度。越高表示風險越大。',
  'Max Drawdown': '最大回撤 (Maximum Drawdown) — 從歷史最高點到最低點的跌幅百分比，衡量最壞情況下的損失。',
  'Value at Risk': '在險價值 (Value at Risk, VaR) — 在給定信心水準下，一段時間內的最大預期損失。例如95% VaR為-2%表示有95%的把握每日損失不超過2%。',
  'VaR': '在險價值 (Value at Risk, VaR) — 在給定信心水準下，一段時間內的最大預期損失。',
  'Beta': 'Beta係數 (Beta) — 衡量股票相對於大盤的波動程度。Beta=1表示與大盤同步，>1表示波動更大，<1表示波動較小。',
  'Correlation': '相關係數 (Correlation) — 衡量兩個資產之間價格變動的相關程度，範圍從-1到+1。',

  'Unrealized P&L': '未實現損益 (Unrealized Profit & Loss) — 持倉的當前市值與買入成本之間的差額，尚未實際平倉實現。',
  'Realized P&L': '已實現損益 (Realized Profit & Loss) — 實際平倉後實現的利潤或損失。',
  'Cost Basis': '成本基礎 (Cost Basis) — 買入資產的原始成本，包括交易費用。',
  'SMA': '簡單移動平均線 (Simple Moving Average) — 一定期間內收盤價的算術平均值，用於識別趨勢方向。',
  'Moving Average': '移動平均線 (Moving Average) — 平滑價格數據以識別趨勢的技術指標。',
  'OHLCV': '開高低收量 (Open, High, Low, Close, Volume) — 金融數據的標準格式，分別代表開盤價、最高價、最低價、收盤價和成交量。',
  'Volume Profile': '成交量分布 (Volume Profile) — 顯示在不同價格水準上的成交量分布，用於識別重要的支撐和壓力位。',

  'Revenue': '營收 (Revenue) — 公司在一定期間內透過銷售商品或服務獲得的總收入。',
  'Net Income': '淨利潤 (Net Income) — 營收減去所有成本、費用和稅金後的利潤，即稅後淨利。',
  'Expenses': '費用 (Expenses) — 公司營運產生的各項成本與支出。',
  'Profit Margin': '利潤率 (Profit Margin) — 淨利潤除以營收，衡量公司獲利能力的百分比。',

  'Free Cash Flow': '自由現金流 (Free Cash Flow, FCF) — 營運現金流減去資本支出，代表公司可自由運用的現金。',
  'EBITDA': '稅息折舊攤銷前盈餘 (Earnings Before Interest, Taxes, Depreciation, and Amortization) — 衡量公司營運獲利能力的指標。',
}

export const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length)
