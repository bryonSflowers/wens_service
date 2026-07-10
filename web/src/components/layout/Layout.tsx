import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '../../store/auth'
import { useSidebarStore } from '../../store/sidebar'

export function Layout() {
  const { user, logout } = useAuthStore()
  const collapsed = useSidebarStore((s) => s.collapsed)

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className={`transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-60'}`}>
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-end px-6 gap-4">
          {user && (
            <>
              <span className="text-sm text-gray-500">
                {user.username}
                <span className="ml-2 badge-gray">{user.role}</span>
              </span>
              <button onClick={logout} className="btn-ghost text-sm">
                Logout
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
