import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../lib/api'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const [status, setStatus] = useState('loading') // loading | ok | error

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('error'); return }
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="auth-page">
      <div className="card auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo">
          <h1>BITCOFAN</h1>
        </div>
        {status === 'loading' && (
          <>
            <div className="spinner" style={{ margin: '24px auto' }} />
            <p style={{ color: 'var(--text-dim)' }}>Verificando tu email...</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <div style={{ fontSize: 56, margin: '16px 0' }}>✅</div>
            <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, color: 'var(--green)', marginBottom: 12 }}>
              EMAIL VERIFICADO
            </h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>
              Tu cuenta está confirmada. ¡Ya puedes jugar!
            </p>
            <Link to="/game" className="btn btn-purple" style={{ width: '100%' }}>
              EMPEZAR A JUGAR
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 56, margin: '16px 0' }}>❌</div>
            <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: 14, color: 'var(--red)', marginBottom: 12 }}>
              LINK INVÁLIDO
            </h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>
              El link expiró o ya fue usado. Inicia sesión para reenviar la verificación.
            </p>
            <Link to="/login" className="btn btn-purple" style={{ width: '100%' }}>
              INICIAR SESIÓN
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
