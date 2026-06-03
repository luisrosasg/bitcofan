import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useGameSocket } from '../hooks/useGameSocket'
import { api } from '../lib/api'
import { fmtPrice, fmtPts, fmtTimer, getMultiplier, getNextTier, calcPointsPreview } from '../lib/gameHelpers'
import PriceChart from '../components/PriceChart'
import Toast from '../components/Toast'
import ResultModal from '../components/ResultModal'
import ProfilePage from './ProfilePage'
import { playLock, playTick, playTickUrgent, playWin, playLose, setMuted, getMuted } from '../lib/sounds'

function TournamentLeaderboard({ tournament: t, userId }) {
  const [lb, setLb] = React.useState([])
  const [myScore, setMyScore] = React.useState(null)

  React.useEffect(() => {
    api.tournaments.leaderboard(t.id).then(d => setLb(d.leaderboard || [])).catch(() => {})
    if (userId) api.tournaments.me(t.id).then(d => { setMyScore(d.score); }).catch(() => {})
  }, [t.id, userId])

  const diff = Math.max(0, new Date(t.endAt) - Date.now())
  const days = Math.floor(diff / 86400000)
  const hrs  = Math.floor((diff % 86400000) / 3600000)
  const min  = Math.floor((diff % 3600000) / 60000)
  const timeStr = days > 0 ? `${days}d ${hrs}h` : `${hrs}h ${min}m`
  const myPos = lb.findIndex(r => r.userId === userId) + 1

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, color: '#fff', marginBottom: 4 }}>{t.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {t.type === 'streak' ? '🔥 Mejor racha' : '⭐ Más puntos'} · ⏱ {timeStr} restantes
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 16, color: 'var(--gold)', textAlign: 'right' }}>{t.prize}</div>
      </div>

      {/* My score */}
      {myScore && (
        <div style={{ background: 'rgba(34,211,238,.08)', border: '1px solid rgba(34,211,238,.25)', borderRadius: 8, padding: '8px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, color: 'var(--cyan)' }}>TU POSICIÓN: #{myPos || '—'}</span>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 12, color: 'var(--gold)' }}>
            {t.type === 'streak' ? `🔥 ${myScore.bestStreak}` : `⭐ ${myScore.totalPoints}`}
          </span>
        </div>
      )}

      {/* Leaderboard */}
      {lb.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>Sin participantes aún. ¡Sé el primero!</div>
      ) : (
        <div className="ranking-cols-header">
          <span></span><span>JUGADOR</span>
          <span>{t.type === 'streak' ? '🔥 RACHA' : '⭐ PUNTOS'}</span>
          <span>{t.type === 'streak' ? '⭐ PUNTOS' : '🔥 RACHA'}</span>
        </div>
      )}
      {lb.map((row, i) => (
        <div key={row.userId} className={`ranking-row-detail ${row.userId === userId ? 'own' : ''}`}>
          <span className="rank-pos">
            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
          </span>
          <div className="rank-player">
            <div className="rank-avatar">{row.avatar ?? '₿'}</div>
            <div className="rank-player-info">
              <div className="rank-player-name">{row.username}</div>
              <div className="rank-player-level">NVL {row.level}</div>
            </div>
          </div>
          <div className="rank-streak-cell">
            <span className="rank-streak-val">{t.type === 'streak' ? row.bestStreak : row.totalPoints}</span>
            <span className="rank-streak-label">{t.type === 'streak' ? 'aciertos' : 'pts'}</span>
          </div>
          <div className="rank-best-cell">
            <span className="rank-best-val">{t.type === 'streak' ? row.totalPoints : row.bestStreak}</span>
            <span className="rank-best-label">{t.type === 'streak' ? 'pts' : 'racha'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function GamePage() {
  const { user, updateUser, logout } = useAuth()
  const { price, prevPrice, history, live, round, lastResult, setLastResult, startedAt, shieldNotif, setShieldNotif, top1Notif, setTop1Notif, top1Alert, setTop1Alert } = useGameSocket()

  const [activeBet, setActiveBet]   = useState(null)
  const [timeLeft, setTimeLeft]     = useState(0)
  const [toast, setToast]           = useState(null)  // { msg, id }
  const [result, setResult]         = useState(null)
  const [ranking, setRanking]       = useState([])
  const [buyLoading, setBuyLoading] = useState(false)
  const [betLoading, setBetLoading] = useState(false)
  const [betToast, setBetToast]     = useState(null)
  const [prizes, setPrizes]           = useState({ daily: 100000, monthly: 1000000 })
  const [tournaments, setTournaments]   = useState([])
  const [countdown, setCountdown]       = useState('')
  const [ctxMsg, setCtxMsg]           = useState(null)
  const [navTab, setNavTab]           = useState('game')
  const [ghostMode, setGhostMode]     = useState(false)
  const [ghostBet, setGhostBet]       = useState(null)   // { prediction, lockedAtPrice }
  const [ghostStreak, setGhostStreak] = useState(0)
  const [ghostResult, setGhostResult] = useState(null)   // { won, streak }
  const [muted, setMutedState]       = useState(() => localStorage.getItem('cc_muted') === '1')
  const prevTimeLeftRef = useRef(null)

  // Top 1 alert for spectators
  const [top1Banner, setTop1Banner] = useState(null)
  useEffect(() => {
    if (!top1Alert) return
    setTop1Banner(top1Alert)
    setTop1Alert(null)
    setTimeout(() => setTop1Banner(null), 5000)
  }, [top1Alert])

  // Top 1 notification — store it to show celebration
  const [top1Celebration, setTop1Celebration] = useState(null)
  const [winFlash, setWinFlash]               = useState(false)
  useEffect(() => {
    if (!top1Notif) return
    setTop1Celebration(top1Notif)
    setTop1Notif(null)
    setTimeout(() => setTop1Celebration(null), 4000)
  }, [top1Notif])

  // Shield notification
  useEffect(() => {
    if (!shieldNotif) return
    setToast({ msg: `🛡 ¡Recibiste un Escudo Bitcoin por tu referido ${shieldNotif}!`, id: Date.now() })
    api.auth.me().then(({ user: u }) => updateUser(u)).catch(() => {})
    setShieldNotif(null)
  }, [shieldNotif])

  // Sync mute state to sounds lib
  useEffect(() => { setMuted(muted) }, [muted])
  useEffect(() => { setMuted(getMuted()) }, [])

  useEffect(() => {
    if (!round) { setTimeLeft(0); return }
    const tick = () => {
      const tl = Math.max(0, Math.floor((new Date(round.endTime).getTime() - Date.now()) / 1000))
      setTimeLeft(tl)
      const prev = prevTimeLeftRef.current
      if (prev !== null && prev !== tl) {
        if (tl <= 5 && tl > 0)        playTickUrgent()
        else if (tl <= 20 && tl > 5)  playTick()
      }
      prevTimeLeftRef.current = tl
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [round])

  useEffect(() => { if (round) setActiveBet(null) }, [round?.id])

  // Ghost mode — settle ghost bet when round ends
  useEffect(() => {
    if (!ghostMode || !ghostBet || !lastResult) return
    const won = (ghostBet.prediction === 'UP' && lastResult.endPrice > ghostBet.lockedAtPrice) ||
                (ghostBet.prediction === 'DOWN' && lastResult.endPrice < ghostBet.lockedAtPrice)
    const newStreak = won ? ghostStreak + 1 : 0
    setGhostStreak(newStreak)
    setGhostResult({ won, streak: newStreak, endPrice: lastResult.endPrice, lockedAtPrice: ghostBet.lockedAtPrice })
    setGhostBet(null)
    if (won) { setWinFlash(true); setTimeout(() => setWinFlash(false), 600) }
    won ? playWin() : playLose()
  }, [lastResult])

  useEffect(() => {
    if (!lastResult || !activeBet) return
    api.auth.me().then(({ user: u }) => {
      updateUser(u)
      const didWin = u.streak > (user?.streak ?? 0) || u.points > (user?.points ?? 0)
      if (didWin) { setWinFlash(true); setTimeout(() => setWinFlash(false), 600) }
      didWin ? playWin() : playLose()
      setResult({
        won: didWin,
        pointsAwarded: u.points - (user?.points ?? 0),
        lockedAtPrice: activeBet.lockedAtPrice,
        endPrice: lastResult.endPrice,
        prediction: activeBet.prediction,
        streakBefore: user?.streak ?? 0,
        streakAfter: u.streak,
      })
    }).catch(() => {})
    setLastResult(null)
  }, [lastResult])

  useEffect(() => {
    api.ranking.prizes().then(setPrizes).catch(() => {})
    api.tournaments.list().then(d => setTournaments(d.tournaments || [])).catch(() => {})
    api.ranking.daily().then(({ ranking }) => setRanking(ranking)).catch(() => {})
    const id = setInterval(() => {
      api.ranking.daily().then(({ ranking }) => setRanking(ranking)).catch(() => {})
    }, 30000)
    return () => clearInterval(id)
  }, [])

  const placeGhostBet = useCallback((prediction) => {
    if (!ghostMode || ghostBet || timeLeft <= 3 || !price) return
    setGhostBet({ prediction, lockedAtPrice: price })
    playLock()
  }, [ghostMode, ghostBet, timeLeft, price])

  const placeBet = useCallback(async (prediction) => {
    if (!user || activeBet || betLoading) return
    if (user.stickers < 1) { setToast('Sin stickers. ¡Compra más!'); return }
    if (timeLeft <= 3) { setToast('Demasiado tarde. Esperá la próxima ronda.'); return }
    setBetLoading(true)
    try {
      const { bet, user: updatedUser } = await api.game.placeBet(prediction)
      setActiveBet({ prediction: bet.prediction, lockedAtPrice: bet.lockedAtPrice })
      updateUser(updatedUser)
      playLock()
      setBetToast({ prediction: bet.prediction, price: bet.lockedAtPrice })
      setTimeout(() => setBetToast(null), 3000)
    } catch (err) {
      setToast({ msg: err.message, id: Date.now() })
    } finally {
      setBetLoading(false)
    }
  }, [user, activeBet, betLoading, timeLeft, updateUser])


  // Contextual messages based on bet status
  useEffect(() => {
    if (!activeBet || !price || !round) { setCtxMsg(null); return }
    const winning = (activeBet.prediction === 'UP' && price > activeBet.lockedAtPrice) ||
                    (activeBet.prediction === 'DOWN' && price < activeBet.lockedAtPrice)
    const phase = timeLeft > 40 ? 'early' : timeLeft > 10 ? 'mid' : 'final'

    const msgs = {
      UP: {
        win: {
          early: '¡Rompiste la resistencia! Vas arriba. 🚀',
          mid:   '¡Sólido! El precio se mantiene sobre tu bloqueo.',
          final: '¡Aguanta ahí arriba! Quedan segundos... 🔥',
        },
        lose: {
          early: 'Precio bajo el bloqueo. ¡Fuerza alcista, despierta! ⚡',
          mid:   'Precio bajo el bloqueo. ¡Fuerza alcista, despierta! ⚡',
          final: '¡Se acaba el tiempo! Necesitamos un pump de último segundo...',
        },
      },
      DOWN: {
        win: {
          early: '¡Derrumbe controlado! Buen timing. 📉',
          mid:   '¡Esa caída es tuya! Mantén tu racha.',
          final: '¡Casi adentro! Que no rebote... ⏱️',
        },
        lose: {
          early: 'El mercado está contra ti... ¡Necesitamos una corrección! ⏳',
          mid:   'El mercado está contra ti... ¡Necesitamos una corrección! ⏳',
          final: '¡Que baje como un piano! Última oportunidad...',
        },
      },
    }
    const dir = activeBet.prediction
    const status = winning ? 'win' : 'lose'
    setCtxMsg({ text: msgs[dir][status][phase], winning, phase })
  }, [activeBet, price, timeLeft, round])

  const toggleMute = () => {
    const next = !muted
    setMutedState(next)
    localStorage.setItem('cc_muted', next ? '1' : '0')
  }

  const buyStickers = async (pack) => {
    setBuyLoading(pack)
    try {
      const { payment_url } = await api.game.checkout(pack)
      window.location.href = payment_url  // redirect to Webpay
    } catch (err) {
      setToast({ msg: err.message || 'Error al iniciar el pago', id: Date.now() })
      setBuyLoading(false)
    }
  }

  const priceUp   = price != null && prevPrice != null && price >= prevPrice
  const streak    = user?.streak ?? 0
  const multiplier = getMultiplier(streak)
  const nextTier  = getNextTier(streak)
  const pointsInPlay = activeBet ? calcPointsPreview(activeBet.lockedAtPrice, price, streak) : null
  const canBet    = !activeBet && timeLeft > 3 && round && (user?.stickers ?? 0) > 0 && !betLoading

  const posColor = (pos) => pos === 1 ? 'gold' : pos === 2 ? 'silver' : pos === 3 ? 'bronze' : ''

  return (
    <div className="game-layout">

      {/* ── Header ── */}
      <header className="header">
        <div className="header-avatar">{user?.avatar ?? '₿'}</div>
        <div className="header-info">
          <div className="header-name">{user?.username ?? '—'}</div>
          <div className="header-level">NIVEL {user?.level ?? 1}</div>
        </div>
        <div className="header-pills">
          <div className="stat-pill">
            <span className="stat-pill-value">{fmtPts(user?.points ?? 0)}</span>
            <span className="stat-pill-label">PUNTOS</span>
          </div>
          <div className="stat-pill">
            <span className="stat-pill-value">{user?.stickers ?? 0}</span>
            <span className="stat-pill-label">STICKERS</span>
          </div>
          <div className="stat-pill stat-pill-rank">
            <span className="stat-pill-value">
              {ranking.find(r => r.userId === user?.id)?.position
                ? `#${ranking.find(r => r.userId === user?.id).position}`
                : '—'}
            </span>
            <span className="stat-pill-label">RANKING</span>
          </div>
          {(user?.shields ?? 0) > 0 && (
            <div className="stat-pill stat-pill-shield" title="Escudo Bitcoin — protege tu sticker 1 vez">
              <span className="stat-pill-value">🛡 {user.shields}</span>
              <span className="stat-pill-label">ESCUDO</span>
            </div>
          )}
        </div>
        <button className="header-btn" onClick={toggleMute} title={muted ? 'Activar sonido' : 'Silenciar'}>
          {muted ? '🔇' : '🔊'}
        </button>
      </header>

      {/* ── Email verification banner ── */}
      {user && !user.emailVerified && (
        <div className="verify-banner">
          <span>📧 Verifica tu email para asegurar tu cuenta.</span>
          <button className="verify-banner-btn" onClick={async () => {
            try {
              await fetch('/api/auth/resend-verification', {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.getItem('cc_token')}` }
              })
              alert('Email reenviado. Revisa tu bandeja.')
            } catch {}
          }}>
            Reenviar
          </button>
        </div>
      )}

      {/* ── Tab content ── */}
      {navTab === 'profile' && <ProfilePage />}

      {navTab === 'ranking' && (
        <div className="tab-page">
          <div className="tab-page-title">🏆 TORNEOS</div>
          <div className="tab-page-sub">Tu mejor racha desde el inicio de cada torneo</div>

          {tournaments.length === 0 ? (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
              No hay torneos activos en este momento.
            </div>
          ) : tournaments.map(t => (
            <TournamentLeaderboard key={t.id} tournament={t} userId={user?.id} />
          ))}
        </div>
      )}

            {navTab === 'shop' && (
        <div className="tab-page">
          <div className="tab-page-title">🎟 TIENDA</div>
          <div className="tab-page-sub">Compra stickers para seguir jugando</div>
          <div className="card" style={{ padding: 20 }}>
            <div className="pack-grid">
              {[
                { pack: 1,  amount: 1,  price: '$1.000',  discount: null,   img: '/sticker1.png' },
                { pack: 5,  amount: 5,  price: '$4.000',  discount: '-20%', img: '/sticker2.png' },
                { pack: 15, amount: 15, price: '$10.000', discount: '-33%', img: '/sticker3.png' },
                { pack: 50, amount: 50, price: '$30.000', discount: '-40%', img: '/sticker4.png' },
              ].map(({ pack, amount, price, discount, img }) => (
                <button key={pack} className={`pack-card ${buyLoading === pack ? 'pack-loading' : ''}`}
                  onClick={() => buyStickers(pack)} disabled={!!buyLoading}>
                  {discount && <span className="pack-discount">{discount}</span>}
                  <img src={img} alt={`${amount} sticker`} className="pack-img" />
                  <span className="pack-amount">{amount} sticker{amount > 1 ? 's' : ''}</span>
                  <span className="pack-price">{price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {navTab === 'game' && <>
      {/* ── Hero ── */}
      <section className="hero">
        <div>
          <img src="/bitcofan-logo.png" alt="BitcoFan" className="game-logo-img" />
          
        </div>
        {/* A: Active tournament prize cards only */}
        {tournaments.length > 0 && (
        <div className="prize-stack">
          {tournaments.map(t => {
            const diff = Math.max(0, new Date(t.endAt) - Date.now())
            const days = Math.floor(diff / 86400000)
            const hrs  = Math.floor((diff % 86400000) / 3600000)
            const min  = Math.floor((diff % 3600000) / 60000)
            const timeStr = days > 0 ? `${days}d ${hrs}h` : `${hrs}h ${min}m`
            return (
              <div key={t.id} className="prize-card prize-card-tournament">
                <div className="prize-card-left">
                  <span className="prize-label">🎯 {t.name.toUpperCase()}</span>
                  <span className="prize-amount prize-amount-sm">{t.prize}</span>
                </div>
                <div className="prize-card-right">
                  <span className="prize-label">⏱ QUEDAN</span>
                  <span className="prize-countdown">{timeStr}</span>
                </div>
              </div>
            )
          })}
        </div>
        )}

        {!ghostMode && (user?.stickers ?? 0) === 0 && (
          <div className="ghost-entry-btns">
            <button className="btn btn-gold" onClick={() => setNavTab('shop')}>🎟 CONSEGUIR STICKERS</button>
            <button className="ghost-entry-btn" onClick={() => setGhostMode(true)}>👻 JUGAR COMO FANTASMA</button>
          </div>
        )}
      </section>

      {/* ── Game area: card + streak lado a lado en desktop, apilados en mobile ── */}
      <section className="game-area">

        {/* Game Card */}
        <div className={`card game-card ${winFlash ? 'game-win-flash' : ''}`}>

          {ghostMode && (
            <div className="ghost-banner">
              <span>👻 MODO FANTASMA — Sin stickers, sin ranking</span>
              <button className="ghost-exit-btn" onClick={() => { setGhostMode(false); setGhostStreak(0); setGhostBet(null); setGhostResult(null) }}>
                SALIR
              </button>
            </div>
          )}

          {/* Round row — always visible */}
          <div className="round-row">
            <span className="round-badge">⚡ RONDA</span>
            <div className={`timer-block ${timeLeft <= 10 && round ? 'urgent' : ''}`}>
              {fmtTimer(timeLeft)}
            </div>
            <div className="price-block">
              <div className={`price-value ${priceUp ? 'up' : 'down'}`}>
                {fmtPrice(price)}
              </div>
              {/* Entry price shown directly below current price for visual reference */}
              {(activeBet || ghostBet) && (() => {
                const bet = ghostMode ? ghostBet : activeBet
                const delta = price != null ? price - bet.lockedAtPrice : 0
                const winning = (bet.prediction === 'UP' && delta > 0) || (bet.prediction === 'DOWN' && delta < 0)
                return (
                  <div className="price-entry-sub">
                    <span className="price-entry-label">{ghostMode ? '👻' : '🔒'} {fmtPrice(bet.lockedAtPrice)}</span>
                    <span className={`price-entry-delta ${winning ? 'up' : 'down'}`}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(2)}
                    </span>
                  </div>
                )
              })()}
            </div>
          </div>

          <PriceChart
            history={history}
            lockedAtPrice={ghostMode ? ghostBet?.lockedAtPrice : activeBet?.lockedAtPrice}
            prediction={ghostMode ? ghostBet?.prediction : activeBet?.prediction}
            live={live}
            price={price}
            startedAt={startedAt}
            timeLeft={timeLeft}
            pointsInPlay={pointsInPlay}
          />

          {/* Streak inline — solo visible en mobile, oculto en desktop */}
          <div className="streak-inline">
            <div className="streak-inline-item">
              <span className="streak-label">RACHA</span>
              <span className="streak-inline-val">{streak}</span>
            </div>
            <div className="streak-inline-item">
              <span className="streak-label">MULT.</span>
              <span className="streak-inline-val">×{multiplier.toFixed(1)}</span>
            </div>
            <div className="streak-inline-item">
              <span className="streak-label">EN JUEGO</span>
              <span className="streak-inline-val">{pointsInPlay != null ? fmtPts(pointsInPlay) : '—'}</span>
            </div>
          </div>

          {/* Contextual message */}
          {ctxMsg && (
            <div className={`ctx-msg ${ctxMsg.winning ? 'ctx-win' : 'ctx-lose'} ${ctxMsg.phase === 'final' ? 'ctx-final' : ''}`}>
              {ctxMsg.text}
            </div>
          )}

          <div className="choice-prompt">¿QUÉ HARÁ BITCOIN EN ESTA RONDA?</div>
          <div className="choice-buttons">
            <button
              className={`btn btn-sube ${(activeBet?.prediction === 'UP' || ghostBet?.prediction === 'UP') ? 'btn-selected' : ''}`}
              disabled={ghostMode ? (!!ghostBet || !round || timeLeft <= 2) : (!!activeBet || !canBet)}
              onClick={() => ghostMode ? placeGhostBet('UP') : placeBet('UP')}
            >
              {activeBet?.prediction === 'UP' ? (
                <div className="choice-btn-inner">
                  <span className="choice-icon">↗</span>
                  <span className="choice-name">SUBE</span>
                  <span className="locked-in-btn">🔒 BLOQUEADO</span>
                </div>
              ) : (
                <div className="choice-btn-inner">
                  <span className="choice-icon">↗</span>
                  <span className="choice-name">SUBE</span>
                  <span className="choice-hint">Ganas si el precio sube</span>
                </div>
              )}
            </button>
            <button
              className={`btn btn-baja ${(activeBet?.prediction === 'DOWN' || ghostBet?.prediction === 'DOWN') ? 'btn-selected' : ''}`}
              disabled={ghostMode ? (!!ghostBet || !round || timeLeft <= 2) : (!!activeBet || !canBet)}
              onClick={() => ghostMode ? placeGhostBet('DOWN') : placeBet('DOWN')}
            >
              {activeBet?.prediction === 'DOWN' ? (
                <div className="choice-btn-inner">
                  <span className="choice-icon">↘</span>
                  <span className="choice-name">BAJA</span>
                  <span className="locked-in-btn">🔒 BLOQUEADO</span>
                </div>
              ) : (
                <div className="choice-btn-inner">
                  <span className="choice-icon">↘</span>
                  <span className="choice-name">BAJA</span>
                  <span className="choice-hint">Ganas si el precio baja</span>
                </div>
              )}
            </button>
          </div>

          {!round && !activeBet && (
            <div style={{ textAlign: 'center', marginTop: 14, fontFamily: 'var(--font-pixel)', fontSize: 9, color: 'var(--text-dim)' }}>
              Esperando próxima ronda…
            </div>
          )}
        </div>

        {/* Streak Panel — solo visible en desktop */}
        <div className="card streak-panel">
            {/* Ghost upsell inside streak panel */}
            {ghostMode && ghostStreak >= 3 && (user?.stickers ?? 0) === 0 && (
              <div className="ghost-upsell-inline">
                <div className="ghost-upsell-title">👻 MODO FANTASMA</div>
                <div className="ghost-upsell-row"><span>Racha</span><strong>{ghostStreak}</strong></div>
                <div className="ghost-upsell-row"><span>Ranking est.</span><strong>#{Math.max(1, (ranking.length + 1) - ranking.filter(r => r.bestStreak < ghostStreak).length)}</strong></div>
                <div className="ghost-upsell-row"><span>Premio</span><strong style={{color:'var(--gold)'}}>${typeof prizes.daily === 'number' ? prizes.daily.toLocaleString('es-CL') : prizes.daily}</strong></div>
                <button className="btn btn-gold" style={{width:'100%',marginTop:8,fontSize:9}}
                  onClick={() => { setGhostMode(false); setNavTab('shop') }}>
                  🎟 CONSEGUIR STICKERS
                </button>
              </div>
            )}
          <div className="streak-section">
            <span className="streak-label">TU RACHA ACTUAL</span>
            <div className="streak-number">{streak}</div>
            <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, color: 'var(--text-dim)' }}>ACIERTOS</div>
            <div className="flame-bars">
              {Array.from({ length: Math.min(streak, 11) }, (_, i) => (
                <div key={i} className="flame-bar"
                  style={{ height: 12 + Math.floor(Math.random() * 20), animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
          </div>
          <div className="streak-section">
            <span className="streak-label">MULTIPLICADOR</span>
            <div className="multiplier-value">×{multiplier.toFixed(1)}</div>
            {nextTier && <div className="next-tier">{nextTier.need} más para ×{nextTier.next.toFixed(1)}</div>}
          </div>
          <div className="streak-section">
            <span className="streak-label">PUNTOS EN JUEGO</span>
            <div className="points-in-play">{pointsInPlay != null ? fmtPts(pointsInPlay) : '—'}</div>
          </div>
        </div>
      </section>

      {/* ── No stickers CTA ── */}
      {(user?.stickers ?? 0) === 0 && !ghostMode && (
        <div className="no-stickers-cta card">
          <div className="no-stickers-icon">🎟</div>
          <div className="no-stickers-text">
            <div className="no-stickers-title">SIN STICKERS</div>
            <div className="no-stickers-sub">Compra tu pack o prueba el modo fantasma.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn btn-gold" onClick={() => setNavTab('shop')}>COMPRAR</button>
            <button className="btn" style={{ background: 'rgba(168,85,247,.2)', border: '1px solid rgba(168,85,247,.5)', color: '#c084fc' }}
              onClick={() => setGhostMode(true)}>👻</button>
          </div>
        </div>
      )}

      {/* ── Ranking ── */}
      <div className="card ranking-section">
        <div className="ranking-header">
          <div className="section-title" style={{ marginBottom: 0 }}>RANKING DEL DÍA</div>
          <div className="ranking-subtitle">Ordenado por mejor racha</div>
        </div>

        {/* Column headers */}
        {ranking.length > 0 && (
          <div className="ranking-cols-header">
            <span></span>
            <span>JUGADOR</span>
            <span>🔥 RACHA</span>
            <span>⭐ MEJOR JUGADA</span>
          </div>
        )}

        {ranking.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            Nadie jugó todavía hoy. ¡Sé el primero!
          </div>
        ) : (
          ranking.map(row => (
            <div key={row.userId} className={`ranking-row-detail ${row.userId === user?.id ? 'own' : ''}`}>
              {/* Position */}
              <span className={`rank-pos ${posColor(row.position)}`}>
                {row.position === 1 ? '🥇' : row.position === 2 ? '🥈' : row.position === 3 ? '🥉' : `#${row.position}`}
              </span>

              {/* Avatar + info */}
              <div className="rank-player">
                <div className="rank-avatar">{row.avatar ?? '₿'}</div>
                <div className="rank-player-info">
                  <div className="rank-player-name">{row.username}</div>
                  <div className="rank-player-level">NVL {row.level}</div>
                </div>
              </div>

              {/* Best streak */}
              <div className="rank-streak-cell">
                <span className="rank-streak-val">{row.bestStreak ?? 0}</span>
                <span className="rank-streak-label">aciertos</span>
              </div>

              {/* Best single round */}
              <div className="rank-best-cell">
                <span className="rank-best-val">{fmtPts(row.bestPoints ?? row.points ?? 0)}</span>
                <span className="rank-best-label">pts</span>
              </div>
            </div>
          ))
        )}
      </div>

      </> /* end navTab===game */}

      {/* ── Bottom nav ── */}
      <nav className="bottom-nav">
        {[
          { tab: 'game',    icon: '🎮', label: 'JUGAR'   },
          { tab: 'ranking', icon: '🏆', label: 'RANKING' },
          { tab: 'shop',    icon: '🎟', label: 'TIENDA'  },
          { tab: 'profile', icon: '👤', label: 'PERFIL'  },
        ].map(({ tab, icon, label }) => (
          <button key={tab} className={`nav-item ${navTab === tab ? 'active' : ''}`} onClick={() => setNavTab(tab)}>
            <span className="nav-icon">{icon}</span>{label}
          </button>
        ))}
        <button className="nav-item nav-logout" onClick={logout}>
          <span className="nav-icon">🚪</span>SALIR
        </button>
      </nav>

      {toast    && <Toast key={toast.id} message={toast.msg} onDone={() => setToast(null)} />}
      {betToast && (
        <div className={`bet-flash-badge ${betToast.prediction === 'UP' ? 'flash-up' : 'flash-down'}`}>
          Predicción bloqueada: {betToast.prediction === 'UP' ? '↗' : '↘'} {betToast.prediction === 'UP' ? 'SUBE' : 'BAJA'} @ {fmtPrice(betToast.price)}
        </div>
      )}
      {result && <ResultModal result={result} onClose={() => setResult(null)} />}

      {/* Ghost result modal */}
      {ghostResult && (
        <div className="ghost-modal-overlay" onClick={() => setGhostResult(null)}>
          <div className="ghost-modal" onClick={e => e.stopPropagation()}>
            <div className="ghost-modal-icon">{ghostResult.won ? '👻✅' : '👻💀'}</div>
            <div className={`ghost-modal-title ${ghostResult.won ? 'ghost-win-txt' : 'ghost-lose-txt'}`}>
              {ghostResult.won ? '¡HABRÍAS GANADO ESTA RONDA!' : 'FALLASTE EN MODO FANTASMA'}
            </div>
            <div className="ghost-modal-body">
              {ghostResult.won ? (
                <>
                  <div className="ghost-modal-row"><span>Racha fantasma</span><strong>🔥 {ghostResult.streak}</strong></div>
                  <div className="ghost-modal-row"><span>Entrada</span><strong>{fmtPrice(ghostResult.lockedAtPrice)}</strong></div>
                  <div className="ghost-modal-row"><span>Cierre</span><strong>{fmtPrice(ghostResult.endPrice)}</strong></div>
                  {ghostResult.streak >= 3 && (
                    <div className="ghost-modal-upsell">
                      🏆 Con stickers reales ya estarías en el ranking.<br/>
                      Premio hoy: <strong style={{color:'var(--gold)'}}>${typeof prizes.daily === 'number' ? prizes.daily.toLocaleString('es-CL') : prizes.daily}</strong>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="ghost-modal-row"><span>Entrada</span><strong>{fmtPrice(ghostResult.lockedAtPrice)}</strong></div>
                  <div className="ghost-modal-row"><span>Cierre</span><strong>{fmtPrice(ghostResult.endPrice)}</strong></div>
                  <div className="ghost-modal-row"><span>Racha</span><strong>0 — reiniciada</strong></div>
                </>
              )}
            </div>
            <div className="ghost-modal-btns" style={{flexDirection:'column'}}>
              <button style={{width:'100%', background:'linear-gradient(135deg,#f59e0b,#fcd34d)', color:'#1a0a00', border:'none', borderRadius:10, padding:'14px', cursor:'pointer', fontFamily:'system-ui,sans-serif', fontSize:14, fontWeight:800}}
                onClick={() => { setGhostResult(null); setGhostMode(false); setNavTab('shop') }}>
                🎟 Conseguir stickers
              </button>
              <button style={{width:'100%', background:'rgba(255,255,255,.06)', color:'var(--text-dim)', border:'1px solid var(--card-stroke)', borderRadius:10, padding:'12px', cursor:'pointer', fontFamily:'system-ui,sans-serif', fontSize:13, fontWeight:600}}
                onClick={() => setGhostResult(null)}>
                👻 Continuar Fantasma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ghost mode upsell — shown when streak >= 3 and no real stickers */}
      {ghostMode && ghostStreak >= 3 && (user?.stickers ?? 0) === 0 && (
        <div className="ghost-upsell">
          <div className="ghost-upsell-title">👻 MODO FANTASMA</div>
          <div className="ghost-upsell-row">
            <span>Racha:</span><strong>{ghostStreak}</strong>
          </div>
          <div className="ghost-upsell-row">
            <span>Ranking estimado:</span>
            <strong>#{Math.max(1, (ranking.length + 1) - ranking.filter(r => r.bestStreak < ghostStreak).length)}</strong>
          </div>
          <div className="ghost-upsell-row">
            <span>Premio potencial:</span>
            <strong style={{ color: 'var(--gold)' }}>${typeof prizes.daily === 'number' ? prizes.daily.toLocaleString('es-CL') : prizes.daily}</strong>
          </div>
          <div className="ghost-upsell-sub">¡Con stickers reales esto ya sería tuyo!</div>
          <button className="btn btn-gold" style={{ width: '100%', marginTop: 12 }}
            onClick={() => { setGhostMode(false); setNavTab('shop') }}>
            🎟 CONSEGUIR MI PRIMER STICKER
          </button>
        </div>
      )}

      {/* ── Top 1 alert banner for spectators ── */}
      {top1Banner && (
        <div className="top1-banner" onClick={() => setTop1Banner(null)}>
          <span className="top1-banner-crown">👑</span>
          <div className="top1-banner-text">
            <span className="top1-banner-name">{top1Banner.avatar} {top1Banner.username}</span>
            <span className="top1-banner-msg"> acaba de tomar el #1 con {top1Banner.streak} aciertos 🔥</span>
          </div>
        </div>
      )}

      {/* ── Top 1 celebration ── */}
      {top1Celebration && (
        <div className="top1-overlay" onClick={() => setTop1Celebration(null)}>
          <div className="top1-card">
            <div className="top1-crown">👑</div>
            <div className="top1-title">¡ERES #1 DEL DÍA!</div>
            <div className="top1-streak">🔥 {top1Celebration.streak} aciertos consecutivos</div>
            <div className="top1-pts">{(top1Celebration.points ?? 0).toLocaleString('es-CL')} pts</div>
            <div className="top1-sub">Mantén la racha para llevarte el premio</div>
          </div>
        </div>
      )}
    </div>
  )
}
