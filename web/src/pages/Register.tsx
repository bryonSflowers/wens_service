import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/client'
import { BarChart3 } from 'lucide-react'

export function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      await authApi.register({ username: form.username, email: form.email, password: form.password })
      navigate('/login')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Registration failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <BarChart3 className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
        </div>
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input className="input" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </form>
          <p className="text-sm text-gray-500 text-center mt-6">
            Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
