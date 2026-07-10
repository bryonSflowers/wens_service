import { create } from 'zustand'
import type { User } from '../types'

function hydrate(): { user: User | null; token: string | null; isAuthenticated: boolean } {
  const token = sessionStorage.getItem('token')
  const userStr = sessionStorage.getItem('user')
  if (token && userStr) {
    try {
      return { user: JSON.parse(userStr) as User, token, isAuthenticated: true }
    } catch {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
    }
  }
  return { user: null, token: null, isAuthenticated: false }
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  ...hydrate(),

  setAuth: (user, token) => {
    sessionStorage.setItem('token', token)
    sessionStorage.setItem('user', JSON.stringify(user))
    set({ user, token, isAuthenticated: true })
  },

  logout: () => {
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    sessionStorage.removeItem('api_key')
    set({ user: null, token: null, isAuthenticated: false })
  },
}))
