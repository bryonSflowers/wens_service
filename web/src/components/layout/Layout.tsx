import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '../../store/auth'

export function Layout() {
  const { user, logout } = useAuthStore()

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="ml-60">
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
