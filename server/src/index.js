import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const __dirname = dirname(fileURLToPath(import.meta.url))

import { initDb, DailyScores } from './lib/db.js'
import { registerSocket, setWss } from './lib/events.js'
import { getTodayString } from './lib/gameLogic.js'
import authRoutes    from './routes/auth.js'
import gameRoutes from './routes/game.js'
import rankingRoutes  from './routes/ranking.js'
import referralRoutes from './routes/referrals.js'
import {
  setCurrentPrice, getCurrentPrice, getCurrentRound,
  startNewRound, settleCurrentRound,
} from './services/roundService.js'

const app    = express()
const server = createServer(app)
const PORT   = process.env.PORT || 3001

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())

// ── Serve frontend in production ─────────────────────────
const DIST = join(__dirname, '../../client/dist')
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(DIST))
}

// ── WebSocket ────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' })
setWss(wss)

let fallbackRunning = false

function broadcast(data) {
  const msg = JSON.stringify(data)
  wss.clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(msg) })
}

function broadcastPrice(price, live = true) {
  const round    = getCurrentRound()
  const timeLeft = round
    ? Math.max(0, Math.floor((new Date(round.endTime).getTime() - Date.now()) / 1000))
    : null
  broadcast({
    type: 'price', price, live,
    round: round ? { id: round.id, timeLeft, startPrice: round.startPrice, endTime: round.endTime } : null,
  })
}

wss.on('connection', (ws, req) => {
  const price    = getCurrentPrice()
  const round    = getCurrentRound()
  const timeLeft = round
    ? Math.max(0, Math.floor((new Date(round.endTime).getTime() - Date.now()) / 1000))
    : null
  ws.send(JSON.stringify({
    type: 'init', price, live: !fallbackRunning,
    round: round ? { ...round, timeLeft } : null,
  }))

  // Client sends { type: 'auth', userId } to register for targeted messages
  ws.on('message', data => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'auth' && msg.userId) {
        registerSocket(msg.userId, ws)
      }
    } catch {}
  })
})

// ── Binance price feed ───────────────────────────────────────
let fallbackTimer = null
let fallbackPrice = 76000

function startFallback() {
  if (fallbackRunning) return
  fallbackRunning = true
  console.log('[price] Fallback simulator active')
  fallbackTimer = setInterval(() => {
    fallbackPrice = Math.max(50000, fallbackPrice + (Math.random() - 0.5) * 60)
    setCurrentPrice(fallbackPrice)
    broadcastPrice(fallbackPrice, false)
  }, 800)
}

function stopFallback() {
  if (!fallbackRunning) return
  clearInterval(fallbackTimer)
  fallbackTimer   = null
  fallbackRunning = false
}

function connectBinance() {
  try {
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade')
    ws.on('open', () => { console.log('[binance] Connected'); stopFallback(); broadcast({ type: 'connection', live: true }) })
    ws.on('message', data => {
      try {
        const { p } = JSON.parse(data.toString())
        const price = parseFloat(p)
        if (!isFinite(price)) return
        setCurrentPrice(price)
        broadcastPrice(price, true)
      } catch {}
    })
    ws.on('error', () => broadcast({ type: 'connection', live: false }))
    ws.on('close', () => {
      console.log('[binance] Disconnected, retry in 4s')
      broadcast({ type: 'connection', live: false })
      startFallback()
      setTimeout(connectBinance, 4000)
    })
    setTimeout(() => { if (!getCurrentPrice()) startFallback() }, 8000)
  } catch { startFallback() }
}

// ── Round engine ─────────────────────────────────────────────
function roundTick() {
  const round = getCurrentRound()
  if (!round) {
    if (getCurrentPrice()) {
      const nr = startNewRound()
      if (nr) broadcast({ type: 'round_start', round: nr })
    }
    return
  }
  const timeLeft = Math.floor((new Date(round.endTime).getTime() - Date.now()) / 1000)
  if (timeLeft <= 0) {
    const result = settleCurrentRound()
    if (result) broadcast({ type: 'round_end', result })
  }
}

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',    authRoutes)
app.use('/api/game',    gameRoutes)
app.use('/api/ranking',  rankingRoutes)
app.use('/api/referrals', referralRoutes)
app.use('/api/ref',       referralRoutes)
app.use('/api/payments',  gameRoutes)  // DalePago webhook
app.get('/api/health', (_, res) => res.json({ ok: true }))

// ── Catch-all: serve React app for non-API routes ────────
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(join(DIST, 'index.html'))
  })
}

// ── Start ────────────────────────────────────────────────────
async function main() {
  await initDb()
  console.log('[db] SQLite ready')
  server.listen(PORT, () => {
    console.log(`🚀 CriptoCrush server on http://localhost:${PORT}`)
    connectBinance()
    setInterval(roundTick, 1000)

    // ── Midnight reset: clear previous day's scores ──────────
    function scheduleMidnightReset() {
      const now  = new Date()
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      const msUntilMidnight = next.getTime() - now.getTime()
      console.log(`[ranking] Next daily reset in ${Math.round(msUntilMidnight / 60000)} min`)
      setTimeout(() => {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
        DailyScores.resetDay(yesterday)
        scheduleMidnightReset()   // reschedule for next midnight
      }, msUntilMidnight)
    }
    scheduleMidnightReset()
  })
}

main().catch(console.error)
