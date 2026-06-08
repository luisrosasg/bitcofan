import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function PaymentResultPage() {
  const [params] = useSearchParams()
  const { updateUser } = useAuth()
  const [status, setStatus]   = useState('loading')
  const [stickers, setStickers] = useState(0)

  useEffect(() => {
    const dpStatus   = params.get('status')
    const buyOrder   = params.get('buy_order')
    const paymentId  = params.get('payment_id')

    if (!buyOrder) { setStatus('error'); return }

    const check = (attempt = 0) => {
      // Use fetch directly — no auth required for this endpoint
      fetch(`/api/game/stickers/payment-result?buy_order=${buyOrder || ''}&status=${dpStatus || ''}&payment_id=${paymentId || ''}`)
        .then(r => r.json())
        .then(({ status: s, user, token }) => {
          // If server returns a fresh token, update localStorage
          if (token) localStorage.setItem('cc_token', token)
          if (user) updateUser(user)
          setStickers(user?.stickers ?? 0)
          const mapped = (s === 'AUTHORIZED' || s === 'paid') ? 'ok'
                       : s === 'CANCELLED' ? 'cancelled'
                       : s === 'pending' && attempt < 4 ? 'checking'
                       : 'error'
          setStatus(mapped)
          if (mapped === 'checking') setTimeout(() => check(attempt + 1), 2500)
        })
        .catch(() => setStatus('error'))
    }
    check()
  }, [])

  return (
    <div className="auth-page">
      <div className="card auth-card" style={{ textAlign: 'center', maxWidth: 380 }}>
        <img src="/bitcofan-logo.png" alt="BitcoFan" className="auth-logo-img" />

        {(status === 'loading' || status === 'checking') && (
          <>
            <div className="spinner" style={{ margin: '24px auto' }} />
            <p style={{ color: 'var(--text-dim)' }}>{status === 'checking' ? 'Verificando con el banco...' : 'Confirmando tu pago...'}</p>
          </>
        )}

        {status === 'ok' && (
          <>
            <div style={{ fontSize: 56, margin: '12px 0' }}>🎟✅</div>
            <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, color: 'var(--green)', marginBottom: 10 }}>
              ¡PAGO CONFIRMADO!
            </h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>
              Tus stickers fueron agregados a tu cuenta. ¡A jugar!
            </p>
            <Link to="/game" className="btn btn-gold" style={{ display: 'block', textAlign: 'center', padding: 14 }}>
              🚀 EMPEZAR A JUGAR
            </Link>
          </>
        )}

        {status === 'cancelled' && (
          <>
            <div style={{ fontSize: 56, margin: '12px 0' }}>❌</div>
            <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>
              PAGO CANCELADO
            </h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>
              Cancelaste el pago. Puedes intentarlo nuevamente cuando quieras.
            </p>
            <Link to="/game" className="btn" style={{ display: 'block', textAlign: 'center', padding: 14, background: 'rgba(255,255,255,.06)', color: 'var(--text-dim)', border: '1px solid var(--card-stroke)', borderRadius: 10 }}>
              Volver al juego
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 56, margin: '12px 0' }}>⚠️</div>
            <h2 style={{ fontFamily: 'var(--font-pixel)', fontSize: 13, color: 'var(--gold)', marginBottom: 10 }}>
              ERROR EN EL PAGO
            </h2>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 24 }}>
              Hubo un problema al procesar tu pago. Si se descontó de tu cuenta, contáctanos.
            </p>
            <Link to="/game" className="btn btn-gold" style={{ display: 'block', textAlign: 'center', padding: 14 }}>
              Volver al juego
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
