import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TickerBar } from '../ui/TickerBar'
import { CommandPalette } from '../ui/CommandPalette'
import { useAuthStore } from '../../store/auth'
import { useSidebarStore } from '../../store/sidebar'
import { useThemeStore } from '../../store/theme'
import { Sun, Moon, LogOut } from 'lucide-react'

export function Layout() {
  const { user, logout } = useAuthStore()
  const collapsed = useSidebarStore((s) => s.collapsed)
  const dark = useThemeStore((s) => s.dark)
  const toggleTheme = useThemeStore((s) => s.toggle)

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <CommandPalette />
      <Sidebar />
      <div className={`transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-60'}`}>
        <TickerBar items={[]} />
        <header className="sticky top-0 z-30 h-14 bg-[var(--card-bg)] border-b border-[var(--card-border)] flex items-center justify-end px-6 gap-3">
          {user && (
            <>
              <button onClick={toggleTheme} className="btn-ghost p-2 rounded-lg" title="Toggle theme">
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <span className="text-xs text-[var(--text-secondary)]">
                {user.username}
                <span className="ml-2 badge-gray">{user.role}</span>
              </span>
              <button onClick={logout} className="btn-ghost text-xs p-2">
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
