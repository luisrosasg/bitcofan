import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import GamePage from './pages/GamePage'
import LandingPage      from './pages/LandingPage'
import VerifyEmailPage    from './pages/VerifyEmailPage'
import PaymentResultPage from './pages/PaymentResultPage'
import AdminPage         from './pages/AdminPage'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function RefRoute() {
  const { username } = useParams()
  const navigate = useNavigate()
  useEffect(() => {
    fetch(`/api/ref/${username}`)
      .then(r => r.json())
      .then(({ referrerId }) => {
        if (referrerId) localStorage.setItem('cc_referrer', referrerId)
      })
      .catch(() => {})
      .finally(() => navigate('/register', { replace: true }))
  }, [username])
  return null
}

function LandingRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/game" replace /> : <LandingPage />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <Routes>
          <Route path="/"         element={<LandingRoute />} />
          <Route path="/ref/:username"  element={<RefRoute />} />
          <Route path="/verify-email"    element={<VerifyEmailPage />} />
          <Route path="/payment/result"   element={<ProtectedRoute><PaymentResultPage /></ProtectedRoute>} />
          <Route path="/admin"             element={<AdminPage />} />
          <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/game"     element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
          <Route path="/*"        element={<LandingRoute />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
