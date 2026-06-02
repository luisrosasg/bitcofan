import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  useEffect(() => { setForm({ email: '', password: '' }) }, [])
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token, user } = await api.auth.login(form)
      login(token, user)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-logo">
          <img src="/bitcofan-logo.png" alt="BitcoFan" className="auth-logo-img" />
          <p>🚀 Continúa tu misión</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}

          <div className="form-group">
            <label>Email</label>
            <input
              className="input"
              type="email" autoComplete="email"
              placeholder="tu@email.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              className="input"
              type="password" autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>

          <button className="btn btn-purple" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : 'ENTRAR'}
          </button>
        </form>

        <div className="auth-switch">
          <Link to="/" className="auth-back">← Volver al inicio</Link>
        <div style={{marginTop:8}}>¿No tienes cuenta? <Link to="/register">Regístrate</Link></div>
        </div>
      </div>
    </div>
  )
}
