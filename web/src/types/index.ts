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
