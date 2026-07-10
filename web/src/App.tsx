import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import { Layout } from './components/layout/Layout'
import { LoginPage } from './pages/Login'
import { RegisterPage } from './pages/Register'
import { DashboardPage } from './pages/Dashboard'
import { ReportsPage } from './pages/Reports'
import { GenerateReportPage } from './pages/GenerateReport'
import { TemplatesPage } from './pages/Templates'
import { KVStorePage } from './pages/KVStore'
import { ChatPage } from './pages/Chat'
import { GeneratedReportsPage } from './pages/GeneratedReports'
import { AdminPage } from './pages/Admin'
import { SettingsPage } from './pages/Settings'
import { PortfolioPage } from './pages/Portfolio'
import { RiskAnalyticsPage } from './pages/RiskAnalytics'
import { FundamentalsPage } from './pages/Fundamentals'
import { MarketChartPage } from './pages/MarketChart'
import { WatchlistPage } from './pages/WatchlistPage'
import { ScreenerPage } from './pages/Screener'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/watchlist" element={<WatchlistPage />} />
          <Route path="/risk" element={<RiskAnalyticsPage />} />
          <Route path="/fundamentals" element={<FundamentalsPage />} />
          <Route path="/chart" element={<MarketChartPage />} />
          <Route path="/screener" element={<ScreenerPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/generate" element={<GenerateReportPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/kv" element={<KVStorePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/generated" element={<GeneratedReportsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
