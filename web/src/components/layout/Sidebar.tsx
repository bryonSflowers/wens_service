import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FileText, MessageSquare, Database,
  FileStack, FileInput, Settings, Shield, ChevronLeft, Menu,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/reports', icon: FileText, label: 'Reports' },
  { to: '/reports/generate', icon: FileInput, label: 'Generate Report' },
  { to: '/templates', icon: FileStack, label: 'Templates' },
  { to: '/generated', icon: FileText, label: 'Generated' },
  { to: '/chat', icon: MessageSquare, label: 'LLM Chat' },
  { to: '/kv', icon: Database, label: 'KV Store' },
  { to: '/admin', icon: Shield, label: 'Admin' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={`sidebar fixed left-0 top-0 h-screen bg-white border-r border-gray-200 z-40 transition-all duration-200 ${collapsed ? 'w-16' : ''}`}>
      <div className="flex items-center justify-between h-16 px-4 border-b">
        {!collapsed && (
          <span className="text-lg font-bold text-blue-700 tracking-tight">Wens</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn-ghost p-1.5 rounded-lg"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
      <nav className="p-2 space-y-1 overflow-y-auto" style={{ height: 'calc(100vh - 64px)' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'} ${collapsed ? 'justify-center px-2' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
