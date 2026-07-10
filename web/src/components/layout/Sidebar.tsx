import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FileText, MessageSquare, Database,
  FileStack, FileInput, Settings, Shield, ChevronLeft, Menu,
  Briefcase, Activity, BarChart3, Eye, TrendingUp, Search,
  Upload,
} from 'lucide-react'
import { useSidebarStore } from '../../store/sidebar'
import { useT } from '../../i18n'

const mainNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'sidebar.marketOverview', exact: true },
  { to: '/portfolio', icon: Briefcase, label: 'sidebar.portfolio' },
  { to: '/watchlist', icon: Eye, label: 'sidebar.watchlists' },
]

const analyticsNavItems = [
  { to: '/risk', icon: Activity, label: 'sidebar.risk' },
  { to: '/fundamentals', icon: BarChart3, label: 'sidebar.fundamentals' },
  { to: '/chart', icon: TrendingUp, label: 'sidebar.chart' },
  { to: '/screener', icon: Search, label: 'sidebar.screener' },
]

const dataNavItems = [
  { to: '/reports', icon: FileText, label: 'sidebar.reportsPage', exact: true },
  { to: '/reports/generate', icon: FileInput, label: 'sidebar.generate' },
  { to: '/templates', icon: FileStack, label: 'sidebar.templates' },
  { to: '/generated', icon: FileText, label: 'sidebar.generated' },
  { to: '/chat', icon: MessageSquare, label: 'sidebar.chat' },
  { to: '/documents', icon: Upload, label: 'sidebar.documents' },
]

const systemNavItems = [
  { to: '/kv', icon: Database, label: 'sidebar.kv' },
  { to: '/admin', icon: Shield, label: 'sidebar.admin' },
  { to: '/settings', icon: Settings, label: 'sidebar.settings' },
]

function NavGroup({ label, items, collapsed }: { label: string; items: typeof mainNavItems; collapsed: boolean }) {
  const _ = useT()
  if (collapsed) return (
    <div className="pt-3 first:pt-0">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'} justify-center px-2`
          }
          title={_(item.label as any)}
        >
          <item.icon className="w-5 h-5 shrink-0" />
        </NavLink>
      ))}
    </div>
  )

  return (
    <div className="pt-3 first:pt-0">
      <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{_(label as any)}</p>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          className={({ isActive }) =>
            `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}`
          }
        >
          <item.icon className="w-5 h-5 shrink-0" />
          <span>{_(item.label as any)}</span>
        </NavLink>
      ))}
    </div>
  )
}

export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggle = useSidebarStore((s) => s.toggle)
  const _ = useT()

  return (
    <aside className={`sidebar fixed left-0 top-0 h-screen z-40 transition-all duration-200 bg-gradient-to-b from-slate-900 to-blue-950 ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className="flex items-center justify-between h-14 px-4 border-b border-slate-700/50">
        {!collapsed && (
          <span className="text-lg font-bold text-blue-400 tracking-tight">{_('app.title')}</span>
        )}
        <button onClick={toggle} className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-white">
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
      <nav className="p-2 space-y-1 overflow-y-auto" style={{ height: 'calc(100vh - 56px)' }}>
        <NavGroup label="sidebar.overview" items={mainNavItems} collapsed={collapsed} />
        <NavGroup label="sidebar.analytics" items={analyticsNavItems} collapsed={collapsed} />
        <NavGroup label="sidebar.reports" items={dataNavItems} collapsed={collapsed} />
        <NavGroup label="sidebar.system" items={systemNavItems} collapsed={collapsed} />
      </nav>
    </aside>
  )
}
