import { useEffect, useRef } from 'react'

export default function PriceChart({ history, lockedAtPrice, prediction, live, price, startedAt, timeLeft, pointsInPlay }) {
  const canvasRef = useRef(null)
  const connState = live ? 'live' : 'loading'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || history.length < 2) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width  = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight

    const MARGIN_RIGHT = 52
    const prices = history.map(h => h.p)
    const min = Math.min(...prices) - 20
    const max = Math.max(...prices) + 20
    const range = max - min || 1

    const toY = (p) => H - ((p - min) / range) * H
    const toX = (i) => (i / (prices.length - 1)) * (W - MARGIN_RIGHT)

    const trend = prices[prices.length - 1] >= prices[0]
    const color  = trend ? '#22ff88' : '#ff3355'
    const colorA = trend ? 'rgba(34,255,136,' : 'rgba(255,51,85,'

    ctx.clearRect(0, 0, W, H)

    // Area fill
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, colorA + '.35)')
    grad.addColorStop(1, colorA + '0)')
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(prices[0]))
    for (let i = 1; i < prices.length; i++) ctx.lineTo(toX(i), toY(prices[i]))
    ctx.lineTo(W - MARGIN_RIGHT, H); ctx.lineTo(0, H); ctx.closePath()
    ctx.fillStyle = grad; ctx.fill()

    // Glow
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(prices[0]))
    for (let i = 1; i < prices.length; i++) ctx.lineTo(toX(i), toY(prices[i]))
    ctx.strokeStyle = colorA + '.3)'; ctx.lineWidth = 6; ctx.stroke()

    // Main line
    ctx.beginPath()
    ctx.moveTo(toX(0), toY(prices[0]))
    for (let i = 1; i < prices.length; i++) ctx.lineTo(toX(i), toY(prices[i]))
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke()

    // Lock line
    if (lockedAtPrice) {
      const ly = toY(lockedAtPrice)
      const lc = prediction === 'UP' ? '#22ff88' : '#ff3355'
      ctx.setLineDash([6, 4])
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly)
      ctx.strokeStyle = lc; ctx.lineWidth = 1.5; ctx.stroke()
      ctx.setLineDash([])

      // Crosshair / target sight where current price meets lock line
      const currentY = toY(prices[prices.length - 1])
      const cx = toX(prices.length - 1)
      const cy = ly   // on the lock line at the current x
      const glowColor = lc.includes('ff88') ? 'rgba(34,255,136,' : 'rgba(255,51,85,'

      // Outer glow ring
      ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2)
      ctx.strokeStyle = glowColor + '.15)'; ctx.lineWidth = 8; ctx.stroke()

      // Middle ring
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2)
      ctx.strokeStyle = glowColor + '.4)'; ctx.lineWidth = 2; ctx.stroke()

      // Inner ring
      ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2)
      ctx.strokeStyle = lc; ctx.lineWidth = 1.5; ctx.stroke()

      // Center dot
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2)
      ctx.fillStyle = lc; ctx.fill()

      // Crosshair lines — 4 short ticks
      const tickLen = 5; const gap = 10
      ctx.strokeStyle = lc; ctx.lineWidth = 1.5
      ;[[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
        ctx.beginPath()
        ctx.moveTo(cx + dx * gap,       cy + dy * gap)
        ctx.lineTo(cx + dx * (gap + tickLen), cy + dy * (gap + tickLen))
        ctx.stroke()
      })
    }

    // Last point dot
    const lx = toX(prices.length - 1)
    const ly2 = toY(prices[prices.length - 1])
    ctx.beginPath(); ctx.arc(lx, ly2, 5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fill()
    ctx.beginPath(); ctx.arc(lx, ly2, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'; ctx.fill()

    // Rocket emoji at tip
    ctx.font = '36px serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'bottom'
    ctx.fillText('🚀', lx + 6, ly2 - 10)

  }, [history, lockedAtPrice, prediction])

  return (
    <div className="chart-outer">
      <canvas ref={canvasRef} className="chart-canvas" />
      {connState === 'loading' && (
        <div className="chart-conn-badge conn-loading">◌ CONECTANDO…</div>
      )}
    </div>
  )
}
