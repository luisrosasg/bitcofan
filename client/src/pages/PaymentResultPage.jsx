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
    const dpStatus   = params.get('status')       // AUTHORIZED, CANCELLED, TIMEOUT
    const buyOrder   = params.get('buy_order')

    if (!buyOrder) { setStatus('error'); return }

    api.game.paymentResult(buyOrder, dpStatus)
      .then(({ status: s, user }) => {
        if (user) updateUser(user)
        setStickers(user?.stickers ?? 0)
        setStatus(s === 'AUTHORIZED' ? 'ok' : s === 'CANCELLED' ? 'cancelled' : 'error')
      })
      .catch(() => setStatus('error'))
  }, [])

  return (
    <div className="auth-page">
      <div className="card auth-card" style={{ textAlign: 'center', maxWidth: 380 }}>
        <img src="/bitcofan-logo.png" alt="BitcoFan" className="auth-logo-img" />

        {status === 'loading' && (
          <>
            <div className="spinner" style={{ margin: '24px auto' }} />
            <p style={{ color: 'var(--text-dim)' }}>Confirmando tu pago...</p>
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
