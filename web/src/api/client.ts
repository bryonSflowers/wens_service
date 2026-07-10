import axios, { AxiosError } from 'axios'

const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE || '')

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  const apiKey = sessionStorage.getItem('api_key')
  if (token) config.headers.Authorization = `Bearer ${token}`
  else if (apiKey) config.headers['X-API-Key'] = apiKey
  return config
})

client.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

export default client

// ===== Auth API =====
export const authApi = {
  register: (body: { username: string; email: string; password: string; role?: string }) =>
    client.post('/auth/register', body),
  login: (body: { username: string; password: string }) =>
    client.post('/auth/login', body),
  me: () => client.get('/auth/me'),
  listApiKeys: () => client.get('/auth/api-keys'),
  createApiKey: (body: { name: string; scopes?: string[] }) =>
    client.post('/auth/api-keys', body),
}

// ===== Reports API =====
export const reportsApi = {
  list: (params?: { year?: number; page?: number; page_size?: number }) =>
    client.get('/reports', { params }),
  get: (year: number, month: number) =>
    client.get(`/reports/${year}/${month}`),
  range: (params: { start_year: number; start_month: number; end_year: number; end_month: number }) =>
    client.get('/reports/range', { params }),
  generate: (body: { query: string; template_id?: number; llm_config_id?: number }) =>
    client.post('/reports/generate', body),
}

// ===== Templates API =====
export const templatesApi = {
  list: (params?: { page?: number; page_size?: number }) =>
    client.get('/templates', { params }),
  get: (id: number) =>
    client.get(`/templates/${id}`),
  create: (body: {
    name: string
    description?: string
    query_text: string
    parameters_schema?: Record<string, unknown>
    is_public?: boolean
  }) => client.post('/templates', body),
  update: (id: number, body: Partial<{
    name: string
    description: string
    query_text: string
    parameters_schema: Record<string, unknown>
    is_public: boolean
  }>) => client.put(`/templates/${id}`, body),
  delete: (id: number) => client.delete(`/templates/${id}`),
}

// ===== KV Store API =====
export const kvApi = {
  list: (namespace: string, params?: { page?: number; page_size?: number }) =>
    client.get(`/kv/${encodeURIComponent(namespace)}`, { params }),
  get: (namespace: string, key: string) =>
    client.get(`/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`),
  upsert: (namespace: string, key: string, body: { key: string; value: unknown; tags?: string[] }) =>
    client.put(`/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`, body),
  delete: (namespace: string, key: string) =>
    client.delete(`/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`),
  search: (namespace: string, body: { tags?: string[]; value_match?: Record<string, unknown>; page?: number; page_size?: number }) =>
    client.post(`/kv/${encodeURIComponent(namespace)}/search`, body),
}

// ===== LLM Configs API =====
export const llmConfigsApi = {
  list: (params?: { page?: number; page_size?: number }) =>
    client.get('/llm-configs', { params }),
  get: (id: number) =>
    client.get(`/llm-configs/${id}`),
  create: (body: {
    name: string
    provider?: string
    model: string
    base_url?: string
    api_key?: string
    parameters?: Record<string, unknown>
    is_active?: boolean
  }) => client.post('/llm-configs', body),
  update: (id: number, body: Partial<{
    name: string
    provider: string
    model: string
    base_url: string
    api_key: string
    parameters: Record<string, unknown>
    is_active: boolean
  }>) => client.put(`/llm-configs/${id}`, body),
  delete: (id: number) => client.delete(`/llm-configs/${id}`),
}

// ===== Chat API =====
export const chatApi = {
  send: (body: import('../types').ChatRequest) => client.post('/llm/chat', body),
}

// ===== Generated Reports API =====
export const generatedReportsApi = {
  list: (params?: { page?: number; page_size?: number }) =>
    client.get('/generated-reports', { params }),
  get: (id: number) =>
    client.get(`/generated-reports/${id}`),
}

// ===== Export API =====
export const exportApi = {
  reports: (format: 'csv' | 'json', year?: number) =>
    client.get('/export/reports', { params: { format, year }, responseType: 'blob' }),
  generated: (format: 'csv' | 'json') =>
    client.get('/export/generated', { params: { format }, responseType: 'blob' }),
}

// ===== Admin API =====
export const adminApi = {
  health: () => client.get('/admin/health'),
  stats: () => client.get('/admin/stats'),
  auditLogs: (params?: { page?: number; page_size?: number }) =>
    client.get('/admin/audit-logs', { params }),
}

// ===== Portfolio API =====
export const portfolioApi = {
  list: () => client.get('/portfolios'),
  create: (body: { name: string; description?: string }) => client.post('/portfolios', body),
  get: (id: number) => client.get(`/portfolios/${id}`),
  update: (id: number, body: { name: string; description?: string }) => client.put(`/portfolios/${id}`, body),
  delete: (id: number) => client.delete(`/portfolios/${id}`),
  listHoldings: (id: number) => client.get(`/portfolios/${id}/holdings`),
  addHolding: (id: number, body: { ticker: string; shares: number; avg_cost: number; notes?: string }) =>
    client.post(`/portfolios/${id}/holdings`, body),
  updateHolding: (portfolioId: number, holdingId: number, body: { shares: number; avg_cost: number; notes?: string }) =>
    client.put(`/portfolios/${portfolioId}/holdings/${holdingId}`, body),
  deleteHolding: (portfolioId: number, holdingId: number) =>
    client.delete(`/portfolios/${portfolioId}/holdings/${holdingId}`),
  summary: (id: number) => client.get(`/portfolios/${id}/summary`),
}

// ===== Risk API =====
export const riskApi = {
  volatility: (ticker: string, days?: number) => client.get(`/risk/${ticker}/volatility`, { params: { days } }),
  sharpe: (ticker: string, riskFreeRate?: number, days?: number) =>
    client.get(`/risk/${ticker}/sharpe`, { params: { risk_free_rate: riskFreeRate, days } }),
  maxDrawdown: (ticker: string, days?: number) => client.get(`/risk/${ticker}/max-drawdown`, { params: { days } }),
  var: (ticker: string, confidence?: number, days?: number) =>
    client.get(`/risk/${ticker}/var`, { params: { confidence, days } }),
  beta: (ticker: string, index?: string, days?: number) =>
    client.get(`/risk/${ticker}/beta`, { params: { index_ticker: index, days } }),
  all: (ticker: string, index?: string, riskFreeRate?: number, days?: number) =>
    client.get(`/risk/${ticker}/all`, { params: { index_ticker: index, risk_free_rate: riskFreeRate, days } }),
}

// ===== Fundamentals API =====
export const fundamentalsApi = {
  get: (ticker: string) => client.get(`/fundamentals/${ticker}`),
  refresh: (ticker: string) => client.post(`/fundamentals/${ticker}/refresh`),
}

// ===== Chart API =====
export const chartApi = {
  sync: (ticker: string, period?: string) => client.post(`/chart/${ticker}/sync`, null, { params: { period } }),
  ohlcv: (ticker: string, days?: number) => client.get(`/chart/${ticker}/ohlcv`, { params: { days } }),
  ma: (ticker: string, windows?: string, days?: number) =>
    client.get(`/chart/${ticker}/ma`, { params: { windows, days } }),
  volumeProfile: (ticker: string, bins?: number, days?: number) =>
    client.get(`/chart/${ticker}/volume-profile`, { params: { bins, days } }),
}

// ===== Watchlist API =====
export const watchlistApi = {
  list: () => client.get('/watchlists'),
  create: (body: { name: string; description?: string }) => client.post('/watchlists', body),
  get: (id: number) => client.get(`/watchlists/${id}`),
  update: (id: number, body: { name: string; description?: string }) => client.put(`/watchlists/${id}`, body),
  delete: (id: number) => client.delete(`/watchlists/${id}`),
  listItems: (id: number) => client.get(`/watchlists/${id}/items`),
  addItem: (id: number, ticker: string, notes?: string) =>
    client.post(`/watchlists/${id}/items`, null, { params: { ticker, notes } }),
  removeItem: (watchlistId: number, itemId: number) =>
    client.delete(`/watchlists/${watchlistId}/items/${itemId}`),
}

// ===== Price Alerts API =====
export const alertsApi = {
  list: (ticker?: string) => client.get('/watchlists/alerts', { params: { ticker } }),
  create: (body: { ticker: string; alert_type: string; threshold_price: number; delivery_method?: string }) =>
    client.post('/watchlists/alerts', body),
  delete: (id: number) => client.delete(`/watchlists/alerts/${id}`),
  check: (ticker?: string) => client.post('/watchlists/alerts/check', null, { params: { ticker } }),
}

// ===== Documents API =====
export const documentsApi = {
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: (params?: { page?: number; page_size?: number }) =>
    client.get('/documents', { params }),
  get: (id: number) => client.get(`/documents/${id}`),
  delete: (id: number) => client.delete(`/documents/${id}`),
}

// ===== Screener API =====
export const screenerApi = {
  screen: (params: Record<string, string | number | undefined>) =>
    client.get('/screener', { params }),
  sectors: () => client.get('/screener/sectors'),
  industries: (sector?: string) => client.get('/screener/industries', { params: { sector } }),
}
