import axios, { AxiosError } from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

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
  send: (body: ChatRequest) => client.post('/llm/chat', body),
}

import type { ChatRequest } from '../types'

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
