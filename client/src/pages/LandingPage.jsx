import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../lib/api'
import { Link } from 'react-router-dom'

/* ── Mini price hook (standalone, no server needed) ─────── */
function useLiveBtc() {
  const [price, setPrice]       = useState(null)
  const [prevPrice, setPrev]    = useState(null)
  const [pct24h, setPct24h]     = useState(0)
  const [history, setHistory]   = useState([])
  const [connected, setConnected] = useState(false)
  const fallback = useRef(null)
  const fallbackP = useRef(72000)

  const startFallback = useCallback(() => {
    if (fallback.current) return
    fallback.current = setInterval(() => {
      fallbackP.current += (Math.random() - 0.5) * 80
      const p = Math.max(50000, fallbackP.current)
      setPrev(prev => prev ?? p)
      setPrice(p)
      setHistory(h => { const n = [...h, { t: Date.now(), p }]; return n.length > 200 ? n.slice(-200) : n })
    }, 900)
  }, [])

  useEffect(() => {
    let ws
    const connect = () => {
      try {
        ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade')
        ws.onopen = () => { setConnected(true); if (fallback.current) { clearInterval(fallback.current); fallback.current = null } }
        ws.onmessage = e => {
          const { p } = JSON.parse(e.data)
          const val = parseFloat(p)
          if (!isFinite(val)) return
          setPrev(prev => { return prev ?? val })
          setPrice(val)
          setHistory(h => {
            const last = h[h.length - 1]
            if (last && Date.now() - last.t < 350) return h
            const n = [...h, { t: Date.now(), p: val }]
            return n.length > 200 ? n.slice(-200) : n
          })
        }
        ws.onerror = () => setConnected(false)
        ws.onclose = () => { setConnected(false); startFallback(); setTimeout(connect, 4000) }
        setTimeout(() => { if (!price) startFallback() }, 4000)
      } catch { startFallback() }
    }
    connect()
    // 24h pct
    fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
      .then(r => r.json()).then(d => setPct24h(parseFloat(d.priceChangePercent))).catch(() => {})
    return () => { ws?.close(); if (fallback.current) clearInterval(fallback.current) }
  }, [])

  return { price, prevPrice, pct24h, history, connected }
}

function fmtP(n) { return n == null ? '—' : '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtT(s) { const t = Math.max(0, s); return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}` }

/* ── Mini demo chart (SVG step-line) ─────────────────────── */
function DemoChart({ history, lockPrice, prediction }) {
  if (history.length < 2) return (
    <div className="lp-chart-empty">⏳ Conectando precio...</div>
  )
  const W = 400, H = 140, PR = 48, PT = 8, PB = 8
  const prices = history.map(h => h.p)
  let min = Math.min(...prices), max = Math.max(...prices)
  const range = Math.max(1, max - min)
  min -= range * 0.08; max += range * 0.08
  const toX = i => (i / (prices.length - 1)) * (W - PR)
  const toY = p => PT + (1 - (p - min) / (max - min)) * (H - PT - PB)
  const trend = prices[prices.length - 1] >= prices[0]
  const color = trend ? '#22ff88' : '#ff3355'

  // Step-after path (pixel art style)
  let path = `M ${toX(0).toFixed(1)} ${toY(prices[0]).toFixed(1)}`
  for (let i = 1; i < prices.length; i++) {
    path += ` L ${toX(i).toFixed(1)} ${toY(prices[i-1]).toFixed(1)} L ${toX(i).toFixed(1)} ${toY(prices[i]).toFixed(1)}`
  }
  const area = `${path} L ${(W - PR).toFixed(1)} ${H - PB} L 0 ${H - PB} Z`
  const lx = toX(prices.length - 1)
  const ly = toY(prices[prices.length - 1])
  const lockY = lockPrice ? toY(lockPrice) : null

  return (
    <div className="lp-chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="lpGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#lpGrad)" />
        <path d={path} fill="none" stroke={color} strokeWidth="2" />
        {lockY && (
          <line x1="0" x2={W - PR} y1={lockY} y2={lockY}
            stroke={prediction === 'up' ? '#22ff88' : '#ff3355'}
            strokeWidth="1.5" strokeDasharray="5 3" opacity="0.9" />
        )}
        <circle cx={lx} cy={ly} r="5" fill={color} opacity="0.3" />
        <circle cx={lx} cy={ly} r="2.5" fill="#fff" stroke={color} strokeWidth="1.2" />
      </svg>
      <div className="lp-chart-rocket" style={{ left: `${(lx / W) * 100}%`, top: `${(ly / H) * 100}%` }}>🚀</div>
    </div>
  )
}

/* ── Live demo card ───────────────────────────────────────── */
function LiveDemo({ price, prevPrice, history, connected }) {
  const ROUND = 15
  const [timer, setTimer]         = useState(ROUND)
  const [prediction, setPrediction] = useState(null)
  const [lockPrice, setLockPrice] = useState(null)
  const [streak, setStreak]       = useState(0)
  const [score, setScore]         = useState(0)
  const [result, setResult]       = useState(null)
  const priceRef = useRef(price)
  useEffect(() => { priceRef.current = price }, [price])

  useEffect(() => {
    if (result) return
    const id = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          // settle
          const cur = priceRef.current
          if (prediction != null && lockPrice != null && cur != null) {
            const win = (prediction === 'up' && cur > lockPrice) || (prediction === 'down' && cur < lockPrice)
            const diff = Math.abs(cur - lockPrice)
            const mult = streak >= 5 ? 2.0 : streak >= 3 ? 1.5 : 1.0
            const pts = win ? Math.round(diff * mult) : 0
            setResult({ win, pts, diff, mult })
            if (win) { setScore(s => s + pts); setStreak(s => s + 1) } else setStreak(0)
            setPrediction(null); setLockPrice(null)
          }
          return ROUND
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [result, prediction, lockPrice, streak])

  useEffect(() => {
    if (!result) return
    const id = setTimeout(() => setResult(null), 2400)
    return () => clearTimeout(id)
  }, [result])

  const choose = dir => {
    if (prediction != null || price == null || timer <= 2) return
    setPrediction(dir); setLockPrice(price)
  }

  const dir = price != null && prevPrice != null ? (price >= prevPrice ? 'up' : 'down') : 'up'
  const urgent = timer <= 5 && !result

  return (
    <div className="lp-demo-card">
      <div className="lp-demo-badge">▸ DEMO JUGABLE · GRATIS · SIN REGISTRO</div>
      <div className="lp-demo-top">
        <div className="lp-demo-round">⚡ MINI RONDA</div>
        <div className="lp-demo-price-block">
          <div className="lp-demo-price-label">
            <span className={`lp-live-dot ${connected ? 'on' : 'off'}`} />
            BTC EN VIVO
          </div>
          <div className={`lp-demo-price ${dir}`}>{fmtP(price)}</div>
        </div>
      </div>

      <div className={`lp-demo-timer ${urgent ? 'urgent' : ''}`}>{fmtT(timer)}</div>

      <DemoChart history={history} lockPrice={lockPrice} prediction={prediction} />

      {result ? (
        <div className={`lp-demo-result ${result.win ? 'win' : 'lose'}`}>
          {result.win
            ? `🎉 +${result.pts} PTS · Δ$${result.diff.toFixed(2)} × ×${result.mult.toFixed(1)}`
            : '💀 Fallaste · Racha perdida'}
        </div>
      ) : (
        <div className="lp-demo-choices">
          <button className="lp-btn-up"
            disabled={prediction != null || price == null || timer <= 2}
            style={prediction === 'up' ? { outline: '3px solid #fff', outlineOffset: 2 } : {}}
            onClick={() => choose('up')}>↗ SUBE</button>
          <button className="lp-btn-down"
            disabled={prediction != null || price == null || timer <= 2}
            style={prediction === 'down' ? { outline: '3px solid #fff', outlineOffset: 2 } : {}}
            onClick={() => choose('down')}>↘ BAJA</button>
        </div>
      )}

      <div className="lp-demo-footer">
        <span>🏆 {score} PTS · 🔥 {streak}</span>
        <span className="lp-demo-status">
          {prediction ? `Locked ${prediction === 'up' ? '↗' : '↘'} @ ${fmtP(lockPrice)}`
            : timer <= 2 ? 'Esperando cierre...' : 'Elige dirección'}
        </span>
      </div>
    </div>
  )
}

/* ── Pack art — real sticker images ─────────────────────── */
const STICKER_IMGS = {
  starter:  '/sticker1.png',
  fanatico: '/sticker2.png',
  popular:  '/sticker3.png',
  ballena:  '/sticker4.png',
}

function PackArt({ kind }) {
  const src = STICKER_IMGS[kind] || STICKER_IMGS.starter
  return (
    <div className="lp-pack-art-wrap">
      <img src={src} alt="sticker pack" className="lp-pack-img" />
    </div>
  )
}

/* ── Main Landing Page ────────────────────────────────────── */
export default function LandingPage() {
  const { price, prevPrice, pct24h, history, connected } = useLiveBtc()
  const [faqOpen, setFaqOpen] = useState(0)
  const [prizes, setPrizes]       = useState({ daily: 100000, monthly: 1000000 })
  const [topRanking, setTopRanking] = useState([])
  const dir = price != null && prevPrice != null ? (price >= prevPrice ? 'up' : 'down') : 'up'

  // Fetch prizes and ranking from server
  useEffect(() => {
    api.ranking.prizes().then(setPrizes).catch(() => {})
    api.ranking.daily().then(({ ranking }) => setTopRanking(ranking)).catch(() => {})
  }, [])

  // Countdown to midnight UTC (prize reset)
  const [countdown, setCountdown] = useState('')
  useEffect(() => {
    const tick = () => {
      const now  = new Date()
      // Chile is UTC-3, so midnight UTC-3 = 03:00 UTC
      const nowUTC3 = new Date(now.getTime() - 3 * 60 * 60 * 1000)
      const midnightUTC3 = new Date(Date.UTC(
        nowUTC3.getUTCFullYear(), nowUTC3.getUTCMonth(), nowUTC3.getUTCDate() + 1
      ) + 3 * 60 * 60 * 1000)
      const diff = Math.floor((midnightUTC3 - now) / 1000)
      const h = String(Math.floor(diff / 3600)).padStart(2, '0')
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0')
      const s = String(diff % 60).padStart(2, '0')
      setCountdown(`${h}:${m}:${s}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const faqs = [
    { q: '¿Cómo gano el premio diario?', a: 'El que arme la racha más larga de aciertos consecutivos durante el día se lleva el premio. No importa si jugaste 5 misiones o 50: con una sola racha épica puedes ganar el día.' },
    { q: '¿Cuándo empiezo a competir?', a: 'Al instante. Compra tu primer sticker y ya estás en juego — cada racha que armes cuenta para el ranking diario. No hay periodo de espera.' },
    { q: '¿De dónde sale el precio de Bitcoin?', a: 'Lo tomamos directo del WebSocket público de Binance, el exchange más grande del mundo. Es el mismo precio que verás en TradingView o cualquier broker serio.' },
    { q: '¿Qué pasa si fallo una predicción?', a: 'Tu racha vuelve a 0 y empiezas una nueva. El sticker se consume. Arrancar de cero no te saca del juego — siempre puedes armar una nueva racha.' },
    { q: '¿Necesito saber de criptomonedas?', a: 'Nada. Solo debes decidir si Bitcoin va a estar más arriba o más abajo en 30 segundos. Es tan simple como cara o sello, pero con datos en vivo.' },
    { q: '¿Puedo probar antes de pagar?', a: '¡Sí! Tenemos el 👻 Modo Fantasma: juegas con precio real de Binance, ves el gráfico en vivo, acumulas rachas y recibes feedback exactamente igual que en el juego real — pero sin gastar stickers ni aparecer en el ranking. Cuando tu racha fantasma crece, te mostramos en qué posición estarías y cuánto podrías ganar. Cuando estés listo, un clic y compras tu primer sticker.' },
  ]

  // Step visual content — matches design reference
  const stepVisuals = [
    // Step 1: Sticker ticket
    { emoji: null, visual: (
      <div className="lp-step-visual lp-step-sticker">
        <svg width="120" height="80" viewBox="0 0 120 80" shapeRendering="crispEdges">
          <g transform="rotate(-8 60 40)">
            <rect x="10" y="14" width="100" height="52" rx="6" fill="#1a0050" stroke="#a855f7" strokeWidth="3"/>
            <rect x="10" y="14" width="100" height="52" rx="6" fill="none" strokeDasharray="6 4" stroke="#7c3aed" strokeWidth="1.5" opacity="0.6"/>
            <circle cx="10"  cy="40" r="8" fill="#07021a"/>
            <circle cx="110" cy="40" r="8" fill="#07021a"/>
            <rect x="10" y="30" width="100" height="1" fill="#7c3aed" opacity="0.4"/>
            <rect x="10" y="50" width="100" height="1" fill="#7c3aed" opacity="0.4"/>
            {/* Bitcoin symbol */}
            <circle cx="60" cy="40" r="16" fill="#f59e0b" stroke="#fcd34d" strokeWidth="2"/>
            <text x="60" y="46" textAnchor="middle" fontFamily="serif" fontSize="18" fill="#1a0a00" fontWeight="bold">₿</text>
            {/* Sparkles */}
            <text x="22" y="26" fontFamily="serif" fontSize="10" fill="#c084fc">✦</text>
            <text x="90" y="58" fontFamily="serif" fontSize="8"  fill="#c084fc">✦</text>
            <text x="96" y="24" fontFamily="serif" fontSize="7"  fill="#fcd34d">★</text>
          </g>
        </svg>
        <div className="lp-step-tag lp-tag-purple">🎟 1 STICKER = 1 MISIÓN</div>
      </div>
    )},
    // Step 2: Lock price
    { emoji: null, visual: (
      <div className="lp-step-visual lp-step-bullbear">
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ marginBottom: 10, filter: 'drop-shadow(0 0 10px rgba(34,255,136,.5))' }}>
          {/* Outer ring */}
          <circle cx="32" cy="32" r="28" fill="none" stroke="#22ff88" strokeWidth="2" opacity="0.4"/>
          {/* Middle ring */}
          <circle cx="32" cy="32" r="20" fill="none" stroke="#22ff88" strokeWidth="2" opacity="0.7"/>
          {/* Inner ring */}
          <circle cx="32" cy="32" r="10" fill="none" stroke="#22ff88" strokeWidth="2"/>
          {/* Center dot */}
          <circle cx="32" cy="32" r="3" fill="#22ff88"/>
          {/* Crosshair lines */}
          <line x1="32" y1="2"  x2="32" y2="18" stroke="#22ff88" strokeWidth="2" strokeLinecap="round"/>
          <line x1="32" y1="46" x2="32" y2="62" stroke="#22ff88" strokeWidth="2" strokeLinecap="round"/>
          <line x1="2"  y1="32" x2="18" y2="32" stroke="#22ff88" strokeWidth="2" strokeLinecap="round"/>
          <line x1="46" y1="32" x2="62" y2="32" stroke="#22ff88" strokeWidth="2" strokeLinecap="round"/>
          {/* Price tag */}
          <text x="32" y="36" textAnchor="middle" fontFamily="'Press Start 2P'" fontSize="7" fill="#fcd34d">$</text>
        </svg>
        <div className="lp-sube-baja-row">
          <div className="lp-mini-sube">↑ SUBE</div>
          <div className="lp-mini-baja">↓ BAJA</div>
        </div>
      </div>
    )},
    // Step 3: Fire + multiplier
    { emoji: null, visual: (
      <div className="lp-step-visual lp-step-fire">
        <div className="lp-fire-row">
          <span className="lp-fire-emoji">🔥</span>
          <span className="lp-multiplier-big">×3.0</span>
        </div>
        <div className="lp-step-tag lp-tag-orange">X1.0 → X1.5 → X2.0 → X3.0</div>
      </div>
    )},
    // Step 4: Trophy + prize
    { emoji: null, visual: (
      <div className="lp-step-visual lp-step-trophy">
        <div className="lp-trophy-row">
          <span className="lp-trophy-emoji">🏆</span>
          <span className="lp-coins-emoji">🪙💵</span>
        </div>
        <div className="lp-step-tag lp-tag-gold">
          🎁 PREMIO DIARIO EN EFECTIVO<br/>
          <span className="lp-prize-tag-amount">${prizes.daily.toLocaleString('es-CL')}</span>
        </div>
      </div>
    )},
  ]

  const steps = [
    { num: 1, title: 'USA 1 STICKER',     text: 'Cada sticker activa una misión oficial de 30 segundos.' },
    { num: 2, title: 'BLOQUEA UN PRECIO', text: 'Elige SUBE o BAJA y bloquea el precio actual de Bitcoin.' },
    { num: 3, title: 'MANTÉN TU RACHA',   text: 'Cada acierto suma. El multiplicador llega hasta ×3.0.' },
    { num: 4, title: 'GANA EL PREMIO',    text: 'La mejor racha del día se lleva el premio diario.' },
  ]

  const packs = [
    { kind: 'starter',  name: 'STARTER',  stickers: 1,  rounds: 1,  price: '$1.000',  discount: null,   popular: false, badge: null, firstBonus: true,
      perks: ['⚡ 1 misión', '🏆 Compite por el premio diario', '🛡 Perfecto para empezar'] },
    { kind: 'fanatico', name: 'FANÁTICO',  stickers: 5,  rounds: 5,  price: '$4.000',  discount: '20%',  popular: false, badge: null,
      perks: ['⚡ 5 misiones', '🏆 Más chances de hacer la mejor racha', '🛡 Ideal para jugadores frecuentes'] },
    { kind: 'popular',  name: 'PRO',       stickers: 15, rounds: 15, price: '$10.000', discount: '30%',  popular: true,  badge: 'MÁS POPULAR',
      perks: ['⚡ 15 misiones', '🏆 Maximiza tus chances de ganar', '🛡 La mejor opción'] },
    { kind: 'ballena',  name: 'BALLENA',   stickers: 50, rounds: 50, price: '$30.000', discount: '40%',  popular: false, badge: null,
      perks: ['⚡ 50 misiones', '🏆 Máxima ventaja para el premio diario', '🛡 Para los más competitivos'] },
  ]

  return (
    <div className="lp-root">
      {/* Stars bg */}
      <div className="lp-stars" />

      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-nav-logo">
          <img src="/bitcofan-logo.png" alt="BitcoFan" className="lp-logo-img lp-logo-nav" />
        </div>
        <div className="lp-nav-links">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#packs">Packs</a>
          <a href="#ranking">Ranking</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="lp-nav-ctas">
          <Link className="lp-btn-ghost" to="/login">Entrar</Link>
          <Link className="lp-btn-primary lp-btn-nav" to="/register">⚡ Registrarse</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="lp-hero" id="top">
        <div className="lp-hero-inner">

          {/* Tagline */}
          <div className="lp-hero-tagline">
            🚀 BTC <span className="lp-accent-up">SUBE</span> O <span className="lp-accent-down">BAJA</span><br/>
            🏆 ¿PODRÁS CONSEGUIR LA MEJOR RACHA DEL DÍA?
          </div>



          {/* Premio del día countdown */}
          <div className="lp-hero-prize-row">
            <div className="lp-hero-prize-card">
              <span className="lp-hero-prize-label">🏆 PREMIO HOY</span>
              <span className="lp-hero-prize-amount">${prizes.daily.toLocaleString('es-CL')}</span>
            </div>
            <div className="lp-hero-prize-card lp-hero-countdown-card lp-countdown-sm">
              <span className="lp-hero-prize-label">⏱ QUEDAN</span>
              <span className="lp-hero-countdown">{countdown}</span>
            </div>
          </div>

          {/* Best streak — below prizes, always visible */}
          <div className="lp-hero-best-streak">
            <span>👑 Mejor racha actual:</span>
            {topRanking.length > 0
              ? <span className="lp-hbs-val">🔥 {topRanking[0].bestStreak} aciertos — {topRanking[0].avatar ?? '₿'} {topRanking[0].username}</span>
              : <span className="lp-hbs-val" style={{ color: 'var(--text-dim)' }}>Nadie aún — ¡sé el primero!</span>
            }
            <span className="lp-hbs-cta">⏳ Aún puedes superarla</span>
          </div>

          {/* CTA */}
          <div className="lp-hero-ctas">
            <Link className="lp-btn-primary lp-btn-lg" to="/register">🎟 CONSEGUIR MI PRIMER STICKER</Link>
          </div>

          <div className="lp-trust">
            <span><span className="lp-check">✓</span> Precio real Binance</span>
            <span><span className="lp-check">✓</span> Premios diarios</span>
            <span><span className="lp-check">✓</span> Desde $1.000</span>
          </div>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="lp-section" id="como-funciona">
        <div className="lp-section-inner">
          <div className="lp-eyebrow">▸ EN 4 PASOS</div>
          <h2 className="lp-section-title">🔥 SOLO UNA RACHA<br/>GANA $100.000</h2>
          <p className="lp-section-sub">Tan simple como tocar un botón. Tan adictivo como mirar gráficos.</p>
          <div className="lp-steps">
            {steps.map((s, i) => (
              <div key={s.num} className="lp-step">
                <div className="lp-step-num">{s.num}</div>
                {stepVisuals[i].visual}
                <div className="lp-step-title">{s.title}</div>
                <div className="lp-step-text">{s.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Packs ── */}
      <section className="lp-section" id="packs">
        <div className="lp-section-inner">
          <div className="lp-eyebrow">▸ ELIGE TU NIVEL</div>
          <h2 className="lp-section-title">PACKS DE STICKERS</h2>
          <p className="lp-section-sub">Cada sticker = una ronda + una chance de hacer la mejor racha del día.</p>
          <div className="lp-packs">
            {packs.map(p => (
              <div key={p.name} className={`lp-pack ${p.popular ? 'lp-pack-popular' : ''}`}>
                {p.badge && <div className="lp-pack-badge">★ {p.badge}</div>}
                <div className="lp-pack-art"><PackArt kind={p.kind} /></div>
                <div className="lp-pack-name">✦ {p.name} ✦</div>
                <div className="lp-pack-count">{p.stickers} STICKER{p.stickers > 1 ? 'S' : ''}</div>
                <div className="lp-pack-price">{p.price}</div>
                {p.discount && (
                  <div className={`lp-pack-savings ${p.popular ? 'lp-savings-pink' : 'lp-savings-green'}`}>
                    🏷 AHORRAS {p.discount}
                  </div>
                )}
                {p.firstBonus && (
                  <div className="lp-first-bonus-box">
                    <div className="lp-first-bonus-label">🎁 Solo en tu primera compra:</div>
                    <div className="lp-first-bonus-val">+2 stickers gratis</div>
                    <div className="lp-first-bonus-total">Total: <strong>3 stickers</strong> · Después: 1</div>
                  </div>
                )}
                <ul className="lp-pack-perks">
                  {p.perks.map((pk, i) => <li key={i}>{pk}</li>)}
                </ul>
                <Link to="/register" className={`lp-btn-pack ${p.popular ? 'lp-btn-primary' : 'lp-btn-ghost'}`}>
                  {p.popular ? '⚡ COMPRAR YA' : 'COMPRAR'}
                </Link>
              </div>
            ))}
          </div>

          {/* Trust bar */}
          <div className="lp-trust-bar">
            {[
              { icon: '🎁', title: 'PREMIO DIARIO',       text: 'El jugador con la mejor racha del día se lleva el premio.' },
              { icon: '📅', title: 'SE RENUEVA CADA DÍA', text: 'Las misiones se reinician todos los días a las 00:00 (UTC-3).' },
              { icon: '✅', title: 'JUEGO JUSTO',          text: 'Sistema transparente y verificado. Sin trampas.' },
              { icon: '🔒', title: 'PAGO SEGURO',          text: 'Tus compras están protegidas con encriptación.' },
            ].map(t => (
              <div key={t.title} className="lp-trust-item">
                <span className="lp-trust-icon">{t.icon}</span>
                <div>
                  <div className="lp-trust-title">{t.title}</div>
                  <div className="lp-trust-text">{t.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ranking ── */}
      <section className="lp-section" id="ranking">
        <div className="lp-section-inner">
          <div className="lp-eyebrow">▸ ACTUALIZADO EN TIEMPO REAL</div>
          <h2 className="lp-section-title">MEJOR RACHA DEL DÍA</h2>
          <p className="lp-section-sub">El jugador con la racha más larga al cierre de las 24h se lleva el premio.</p>
          <div className="lp-ranking-wrap">
            <div className="lp-ranking-side">
              <h3>🎯 CÓMO SE GANA EL PREMIO</h3>
              <p>No importa cuántas rondas juegues por día. Lo que importa es tu <strong style={{ color: '#fcd34d' }}>mejor racha de aciertos consecutivos</strong>. Una racha rota arranca otra: siempre tienes chance.</p>
              <div className="lp-prize-card">
                <span style={{ fontSize: 36 }}>🏆</span>
                <div>
                  <div className="lp-prize-label">PREMIO DIARIO · MEJOR RACHA</div>
                  <div className="lp-prize-value">${prizes.daily.toLocaleString('es-CL')}</div>
                </div>
              </div>
              <div className="lp-prize-card lp-prize-gold">
                <span style={{ fontSize: 36 }}>💎</span>
                <div>
                  <div className="lp-prize-label" style={{ color: '#fcd34d' }}>PREMIO MENSUAL · MEJOR RACHA DEL MES</div>
                  <div className="lp-prize-value">${prizes.monthly.toLocaleString('es-CL')}</div>
                </div>
              </div>

              {/* Best streak today */}
              <div className="lp-best-streak-card">
                <div className="lp-bsc-row">
                  <span>👑</span>
                  <div>
                    <div className="lp-bsc-label">MEJOR RACHA HOY</div>
                    <div className="lp-bsc-val">
                      {topRanking[0]
                        ? <>{topRanking[0].avatar ?? '₿'} {topRanking[0].username} · 🔥 {topRanking[0].bestStreak} aciertos</>
                        : 'Nadie aún — ¡sé el primero!'}
                    </div>
                  </div>
                </div>
                <div className="lp-bsc-cta">⏳ Aún puedes superarla</div>
              </div>
            </div>
            <div className="lp-ranking-list">
              {[
                { pos: 1, av: '👑', name: 'CryptoKing',    streak: 14 },
                { pos: 2, av: '🦍', name: 'MoonWalker',    streak: 11 },
                { pos: 3, av: '💎', name: 'DiamondHands',  streak: 9  },
                { pos: 4, av: '🐋', name: 'PixelWhale',    streak: 7  },
                { pos: 5, av: '⚡', name: 'NeonTrader',    streak: 5  },
              ].map(r => (
                <div key={r.pos} className={`lp-rank-row ${r.pos <= 3 ? `lp-top${r.pos}` : ''}`}>
                  <span className="lp-rank-pos">{r.pos}</span>
                  <span className="lp-rank-av">{r.av}</span>
                  <span className="lp-rank-name">{r.name}</span>
                  <span className="lp-rank-streak">🔥 {r.streak}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Escudos + Referidos ── */}
      <section className="lp-section" id="escudos">
        <div className="lp-section-inner">
          <div className="lp-eyebrow">▸ POWERED BY ESCUDO BITCOIN</div>
          <h2 className="lp-section-title">🛡 SEGUNDA OPORTUNIDAD</h2>
          <p className="lp-section-sub">Invita amigos y gana protección — si fallas una predicción, el escudo absorbe el golpe y no pierdes tu sticker.</p>

          <div className="lp-shields-grid">
            <div className="lp-shield-card lp-shield-first">
              <div className="lp-shield-icon">🎟</div>
              <div className="lp-shield-title">PRIMERA COMPRA</div>
              <div className="lp-shield-desc">Al hacer tu primera compra de cualquier pack, recibes <strong>+2 misiones bonus</strong> de bienvenida automáticamente.</div>
              <div className="lp-shield-tag">$1.000 → 3 misiones</div>
            </div>

            <div className="lp-shield-arrow">→</div>

            <div className="lp-shield-card lp-shield-ref">
              <div className="lp-shield-icon">👥</div>
              <div className="lp-shield-title">REFIERE UN AMIGO</div>
              <div className="lp-shield-desc">Comparte tu link único. Cuando tu amigo hace su primera compra, <strong>recibes un Escudo Bitcoin</strong> al instante.</div>
              <div className="lp-shield-tag">1 amigo activo → 🛡 Escudo</div>
            </div>

            <div className="lp-shield-arrow">→</div>

            <div className="lp-shield-card lp-shield-win">
              <div className="lp-shield-icon">🛡</div>
              <div className="lp-shield-title">SEGUNDA OPORTUNIDAD</div>
              <div className="lp-shield-desc">Con un escudo activo, si fallas una predicción el sticker <strong>no se consume</strong>. El escudo se gasta en su lugar.</div>
              <div className="lp-shield-tag">Fallas → sticker a salvo</div>
            </div>
          </div>

          <div className="lp-shield-cta">
            <Link to="/register" className="lp-btn-primary">🚀 EMPEZAR Y REFERIR AMIGOS</Link>
            <p className="lp-shield-note">Puedes acumular múltiples escudos invitando a más amigos.</p>
          </div>
        </div>
      </section>

      {/* ── Modo Fantasma ── */}
      <section className="lp-section" id="fantasma">
        <div className="lp-section-inner" style={{ maxWidth: 780 }}>
          <div className="lp-eyebrow">▸ SIN RIESGO</div>
          <h2 className="lp-section-title">👻 MODO FANTASMA</h2>
          <p className="lp-section-sub">Juega con precio real. Sin gastar nada. Sin registrarte.</p>

          <div className="lp-ghost-grid">
            <div className="lp-ghost-feature">
              <span className="lp-ghost-icon">📈</span>
              <div>
                <div className="lp-ghost-feat-title">PRECIO REAL DE BINANCE</div>
                <div className="lp-ghost-feat-desc">El mismo gráfico, el mismo precio en vivo, las mismas rondas de 30 segundos que usan los competidores reales.</div>
              </div>
            </div>
            <div className="lp-ghost-feature">
              <span className="lp-ghost-icon">🔥</span>
              <div>
                <div className="lp-ghost-feat-title">ACUMULA RACHAS REALES</div>
                <div className="lp-ghost-feat-desc">Cada acierto suma a tu racha fantasma. Ves exactamente cómo funcionaría tu estrategia antes de apostar stickers reales.</div>
              </div>
            </div>
            <div className="lp-ghost-feature">
              <span className="lp-ghost-icon">🏆</span>
              <div>
                <div className="lp-ghost-feat-title">VE TU POSICIÓN ESTIMADA</div>
                <div className="lp-ghost-feat-desc">Con racha ≥ 3 te mostramos en qué puesto estarías en el ranking y cuánto habrías ganado con stickers reales.</div>
              </div>
            </div>
            <div className="lp-ghost-feature">
              <span className="lp-ghost-icon">🎟</span>
              <div>
                <div className="lp-ghost-feat-title">UN CLIC PARA COMPETIR</div>
                <div className="lp-ghost-feat-desc">Cuando estés listo, pasa al modo real al instante. Tu racha no se transfiere — pero ya sabrás exactamente cómo ganar.</div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link to="/register" className="lp-btn-primary lp-btn-lg">👻 PROBAR MODO FANTASMA</Link>
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)', fontFamily: '-apple-system, sans-serif' }}>
              Sin tarjeta de crédito · Sin descargar nada · Sin trucos
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="lp-section" id="faq">
        <div className="lp-section-inner" style={{ maxWidth: 700 }}>
          <div className="lp-eyebrow">▸ DUDAS FRECUENTES</div>
          <h2 className="lp-section-title">PREGUNTAS</h2>
          <div className="lp-faq">
            {faqs.map((f, i) => (
              <div key={i} className={`lp-faq-item ${faqOpen === i ? 'open' : ''}`}>
                <button className="lp-faq-q" onClick={() => setFaqOpen(faqOpen === i ? -1 : i)}>
                  <span>{f.q}</span>
                  <span className="lp-faq-chev">▼</span>
                </button>
                {faqOpen === i && <div className="lp-faq-a">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-col">
            <div className="lp-nav-logo" style={{ marginBottom: 12 }}>
              <img src="/bitcofan-logo.png" alt="BitcoFan" className="lp-logo-img lp-logo-footer" />
            </div>
            <p className="lp-footer-tag">El juego de predicción de Bitcoin más rápido. Compra un sticker, predice, gana premios reales.</p>
          </div>
          <div className="lp-footer-col">
            <h5>JUGAR</h5>
            <a href="#packs">Comprar stickers</a>
            <a href="#como-funciona">Cómo funciona</a>
          </div>
          <div className="lp-footer-col">
            <h5>CUENTA</h5>
            <Link to="/login">Iniciar sesión</Link>
            <Link to="/register">Registrarse</Link>
          </div>
          <div className="lp-footer-col">
            <h5>SOPORTE</h5>
            <a href="#faq">FAQ</a>
            <a href="#contact">Contacto</a>
          </div>
        </div>
        <div className="lp-footer-bottom">
          <span>© 2026 Bitcofan · Hecho con ₿ y muchos pixels</span>
          <span>v1.0.0 BETA</span>
        </div>
      </footer>
    </div>
  )
}
