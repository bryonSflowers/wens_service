import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts'
import { DollarSign, TrendingUp, FileText, BarChart3, Activity, Database } from 'lucide-react'
import { reportsApi, adminApi } from '../api/client'
import { StatCard } from '../components/ui/StatCard'
import { PageLoading } from '../components/ui/Loading'
import { EmptyState } from '../components/ui/EmptyState'
import type { MonthlyReport, AdminStats } from '../types'

export function DashboardPage() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<MonthlyReport[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      reportsApi.list({ page_size: 50 }),
      adminApi.stats().catch(() => null),
    ]).then(([r, s]) => {
      setReports(r.data.items)
      if (s) setStats(s.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoading />

  const chartData = [...reports].reverse().map((r) => ({
    label: `${r.year}-${String(r.month).padStart(2, '0')}`,
    revenue: r.revenue ?? 0,
    expenses: r.expenses ?? 0,
    net_income: r.net_income ?? 0,
  }))

  const totalRevenue = reports.reduce((s, r) => s + (r.revenue ?? 0), 0)
  const totalNetIncome = reports.reduce((s, r) => s + (r.net_income ?? 0), 0)
  const lastReport = reports[reports.length - 1]
  const avgMargin = totalRevenue > 0 ? ((totalNetIncome / totalRevenue) * 100).toFixed(1) : '0.0'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Financial overview for Taiwan Mobile (3045.TW)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`NT$${(totalRevenue / 1000).toFixed(1)}B`} icon={DollarSign} />
        <StatCard label="Net Income" value={`NT$${(totalNetIncome / 1000).toFixed(1)}B`} icon={TrendingUp} />
        <StatCard label="Avg. Profit Margin" value={`${avgMargin}%`} icon={Activity} />
        <StatCard label="Reports" value={reports.length} icon={FileText} />
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Users" value={stats.users} icon={BarChart3} />
          <StatCard label="Generated Reports" value={stats.generated_reports} icon={FileText} />
          <StatCard label="Templates" value={stats.report_templates} icon={FileText} />
          <StatCard label="KV Items" value={stats.kv_store_items} icon={Database} />
        </div>
      )}

      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Revenue & Expenses</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} name="Expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Net Income Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="net_income" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="Net Income" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {lastReport && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">Latest Report Notes</h3>
            <button className="btn-secondary text-sm" onClick={() => navigate(`/reports`)}>
              View All
            </button>
          </div>
          <div className="card-body">
            <p className="text-sm font-medium text-gray-700 mb-1">
              {lastReport.year}-{String(lastReport.month).padStart(2, '0')}
            </p>
            <p className="text-sm text-gray-600">{lastReport.notes || 'No notes'}</p>
          </div>
        </div>
      )}

      {!chartData.length && <EmptyState title="No financial data" description="Run seed.py or sync market data to populate reports." />}
    </div>
  )
}


