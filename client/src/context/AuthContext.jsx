import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('cc_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ user }) => setUser(user))
      .catch(() => { localStorage.removeItem('cc_token'); setToken(null) })
      .finally(() => setLoading(false))
  }, [token])

  const login = (tok, userData) => {
    localStorage.setItem('cc_token', tok)
    setToken(tok)
    setUser(userData)
  }

  const logout = () => {
    localStorage.removeItem('cc_token')
    setToken(null)
    setUser(null)
  }

  const updateUser = (updates) => setUser(u => ({ ...u, ...updates }))

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
