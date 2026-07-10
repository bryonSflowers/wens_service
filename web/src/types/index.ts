// ===== Auth =====
export interface User {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  role?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface ApiKey {
  id: number
  name: string
  key_prefix: string
  scopes: string[]
  is_active: boolean
  expires_at: string | null
  created_at: string
}

export interface ApiKeyFull extends ApiKey {
  full_key: string
}

// ===== Reports =====
export interface MonthlyReport {
  id: number
  year: number
  month: number
  revenue: number | null
  expenses: number | null
  net_income: number | null
  report_data: Record<string, unknown> | null
  notes: string | null
  created_at: string
}

export interface ReportGenerateRequest {
  query: string
  template_id?: number
  llm_config_id?: number
  stream?: boolean
}

export interface GeneratedReport {
  id: number
  query: string
  report: string
  model: string | null
  tokens_used: number | null
  created_at: string
}

// ===== Templates =====
export interface ReportTemplate {
  id: number
  name: string
  description: string | null
  query_text: string
  parameters_schema: Record<string, unknown> | null
  is_public: boolean
  created_by: number | null
  created_at: string
  updated_at: string
}

export interface TemplateCreate {
  name: string
  description?: string
  query_text: string
  parameters_schema?: Record<string, unknown>
  is_public?: boolean
}

// ===== KV Store =====
export interface KVItem {
  id: number
  namespace: string
  key: string
  value: unknown
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface KVItemCreate {
  key: string
  value: unknown
  tags?: string[]
}

// ===== LLM Configs =====
export interface LLMConfig {
  id: number
  name: string
  provider: string
  model: string
  base_url: string | null
  parameters: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ChatRequest {
  messages: { role: string; content: string }[]
  llm_config_id?: number
  stream?: boolean
  max_tokens?: number
  temperature?: number
}

export interface ChatResponse {
  id: string
  model: string
  content: string
  finish_reason: string | null
  tokens_used: number | null
}

// ===== Portfolio =====
export interface Portfolio {
  id: number
  user_id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Holding {
  id: number
  portfolio_id: number
  ticker: string
  shares: number
  avg_cost: number
  current_price: number | null
  current_value: number | null
  unrealized_pnl: number | null
  unrealized_pnl_pct: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PortfolioSummary {
  id: number
  name: string
  total_cost: number
  total_value: number
  total_unrealized_pnl: number
  total_unrealized_pnl_pct: number
  holding_count: number
}

// ===== Risk =====
export interface VolatilityMetric {
  ticker: string
  days: number
  annualized_volatility_pct: number
}

export interface SharpeMetric {
  ticker: string
  sharpe_ratio: number
  risk_free_rate_pct: number
  annualized_return_pct: number
  annualized_volatility_pct: number
}

export interface MaxDrawdownMetric {
  ticker: string
  max_drawdown_pct: number
  peak_date: string | null
  trough_date: string | null
}

export interface VaRMetric {
  ticker: string
  confidence: number
  var_daily_pct: number
  var_weekly_pct: number
  var_monthly_pct: number
}

export interface BetaMetric {
  ticker: string
  index_ticker: string
  beta: number
  correlation: number
}

export interface RiskAll {
  ticker: string
  annualized_volatility_pct: number | null
  sharpe_ratio: number | null
  max_drawdown_pct: number | null
  var_95_daily_pct: number | null
  beta_vs_index: number | null
  index_ticker: string | null
}

// ===== Fundamentals =====
export interface Fundamental {
  ticker: string
  pe_ratio: number | null
  pb_ratio: number | null
  ev_ebitda: number | null
  roe: number | null
  debt_to_equity: number | null
  eps: number | null
  eps_growth_pct: number | null
  dividend_yield: number | null
  dividend_payout_ratio: number | null
  market_cap: number | null
  sector: string | null
  industry: string | null
  updated_at: string | null
}

// ===== Chart =====
export interface OHLCVItem {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface OHLCVResponse {
  ticker: string
  interval: string
  items: OHLCVItem[]
}

export interface MAItem {
  time: string
  value: number
}

export interface MAResponse {
  ticker: string
  window: number
  items: MAItem[]
}

export interface VolumeProfileItem {
  price: number
  volume: number
}

export interface VolumeProfileResponse {
  ticker: string
  items: VolumeProfileItem[]
}

// ===== Watchlist =====
export interface Watchlist {
  id: number
  user_id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface WatchlistItem {
  id: number
  watchlist_id: number
  ticker: string
  notes: string | null
  added_at: string
}

export interface PriceAlert {
  id: number
  user_id: number
  ticker: string
  alert_type: string
  threshold_price: number
  is_triggered: boolean
  is_active: boolean
  delivery_method: string
  triggered_at: string | null
  created_at: string
}

// ===== Screener =====
export interface ScreenerResult {
  ticker: string
  pe_ratio: number | null
  pb_ratio: number | null
  ev_ebitda: number | null
  roe: number | null
  debt_to_equity: number | null
  eps: number | null
  eps_growth_pct: number | null
  dividend_yield: number | null
  market_cap: number | null
  sector: string | null
  industry: string | null
}

// ===== Documents =====
export interface UploadedDoc {
  id: number
  user_id: number
  filename: string
  file_type: string
  content: string
  raw_tables: unknown[] | null
  word_count: number
  metadata: Record<string, unknown> | null
  created_at: string
}

// ===== Common =====
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface HealthResponse {
  status: string
  version: string
  database: string
}

export interface AdminStats {
  users: number
  monthly_reports: number
  generated_reports: number
  report_templates: number
  kv_store_items: number
  api_keys: number
  llm_configs: number
}

export interface AuditLog {
  id: number
  user_id: number | null
  action: string
  resource_type: string
  resource_id: string | null
  details: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}
