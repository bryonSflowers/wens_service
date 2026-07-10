import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FileText, MessageSquare, Database,
  FileStack, FileInput, Settings, Shield, ChevronLeft, Menu,
  Briefcase, Activity, BarChart3, Eye, TrendingUp, Search,
} from 'lucide-react'
import { useSidebarStore } from '../../store/sidebar'

const mainNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Market Overview', exact: true },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/watchlist', icon: Eye, label: 'Watchlists' },
]

const analyticsNavItems = [
  { to: '/risk', icon: Activity, label: 'Risk Analytics' },
  { to: '/fundamentals', icon: BarChart3, label: 'Fundamentals' },
  { to: '/chart', icon: TrendingUp, label: 'Stock Chart' },
  { to: '/screener', icon: Search, label: 'Screener' },
]

const dataNavItems = [
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/reports/generate', icon: FileInput, label: 'Generate Report' },
  { to: '/templates', icon: FileStack, label: 'Templates' },
  { to: '/generated', icon: FileText, label: 'Generated' },
  { to: '/chat', icon: MessageSquare, label: 'LLM Chat' },
]

const systemNavItems = [
  { to: '/kv', icon: Database, label: 'KV Store' },
  { to: '/admin', icon: Shield, label: 'Admin' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function NavGroup({ label, items, collapsed }: { label: string; items: typeof mainNavItems; collapsed: boolean }) {
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
          title={item.label}
        >
          <item.icon className="w-5 h-5 shrink-0" />
        </NavLink>
      ))}
    </div>
  )

  return (
    <div className="pt-3 first:pt-0">
      <p className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
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
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  )
}

export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed)
  const toggle = useSidebarStore((s) => s.toggle)

  return (
    <aside className={`sidebar fixed left-0 top-0 h-screen z-40 transition-all duration-200 bg-gradient-to-b from-slate-900 to-blue-950 ${collapsed ? 'w-16' : 'w-60'}`}>
      <div className="flex items-center justify-between h-14 px-4 border-b border-slate-700/50">
        {!collapsed && (
          <span className="text-lg font-bold text-blue-400 tracking-tight">Wens</span>
        )}
        <button onClick={toggle} className="btn-ghost p-1.5 rounded-lg text-slate-400 hover:text-white">
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
      <nav className="p-2 space-y-1 overflow-y-auto" style={{ height: 'calc(100vh - 56px)' }}>
        <NavGroup label="Overview" items={mainNavItems} collapsed={collapsed} />
        <NavGroup label="Analytics" items={analyticsNavItems} collapsed={collapsed} />
        <NavGroup label="Reports" items={dataNavItems} collapsed={collapsed} />
        <NavGroup label="System" items={systemNavItems} collapsed={collapsed} />
      </nav>
    </aside>
  )
}
