import { Router } from 'express'
import { Users, Bets, Referrals } from '../lib/db.js'
import { emitToUser } from '../lib/events.js'
import { authenticate } from '../middleware/auth.js'
import { getCurrentRound, getCurrentPrice } from '../services/roundService.js'
import { createPaymentLink } from '../lib/dalepago.js'
import { dbGet, dbRun } from '../lib/db.js'

const router = Router()

router.get('/round', (req, res) => {
  const round = getCurrentRound()
  const price = getCurrentPrice()
  if (!round) return res.json({ round: null, price })
  const timeLeft = Math.max(0, Math.floor((new Date(round.endTime).getTime() - Date.now()) / 1000))
  res.json({
    round: { id: round.id, startTime: round.startTime, endTime: round.endTime, startPrice: round.startPrice, timeLeft },
    price,
  })
})

router.get('/round/:roundId/bet', authenticate, (req, res) => {
  const bet = Bets.findByUserAndRound(req.userId, req.params.roundId)
  res.json({ bet })
})

router.post('/bet', authenticate, async (req, res) => {
  const { prediction } = req.body
  if (!['UP', 'DOWN'].includes(prediction))
    return res.status(400).json({ error: 'Predicción debe ser UP o DOWN' })

  const round = getCurrentRound()
  const price = getCurrentPrice()
  if (!round || !price)
    return res.status(409).json({ error: 'No hay una ronda activa en este momento' })

  const timeLeft = Math.floor((new Date(round.endTime).getTime() - Date.now()) / 1000)
  if (timeLeft <= 3)
    return res.status(409).json({ error: 'Demasiado tarde, espera la próxima ronda' })

  try {
    const user = Users.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    if (user.stickers < 1) return res.status(402).json({ error: 'No tienes stickers suficientes' })

    const existing = Bets.findByUserAndRound(req.userId, round.id)
    if (existing) return res.status(409).json({ error: 'Ya apostaste en esta ronda' })

    // Sticker is only consumed on loss — see roundService.settleCurrentRound
    const bet = Bets.create({
      id: crypto.randomUUID(),
      userId: req.userId,
      roundId: round.id,
      prediction,
      lockedAtPrice: price,
      streakAtBet: user.streak,
    })

    const updatedUser = Users.findById(req.userId)
    const { password, ...safeUser } = updatedUser
    res.status(201).json({ bet: { id: bet.id, prediction: bet.prediction, lockedAtPrice: bet.lockedAtPrice, roundId: bet.roundId }, user: safeUser })
  } catch (err) {
    console.error('bet error:', err)
    res.status(500).json({ error: 'Error al registrar apuesta' })
  }
})

const PACKS = {
  1:  { amount: 5,   price: 1000,  display: 1  },   // 1 sticker = 5 intentos
  5:  { amount: 25,  price: 4000,  display: 5  },   // 5 stickers = 25 intentos
  15: { amount: 75,  price: 10000, display: 15 },   // 15 stickers = 75 intentos
  50: { amount: 250, price: 30000, display: 50 },   // 50 stickers = 250 intentos
}

// POST /api/game/stickers/checkout — create DalePago payment link
router.post('/stickers/checkout', authenticate, async (req, res) => {
  const packId = parseInt(req.body.pack ?? 5)
  const pack   = PACKS[packId]
  if (!pack) return res.status(400).json({ error: 'Pack inválido' })
  try {
    const user = Users.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const buyOrder  = `BF-${req.userId.slice(0, 8)}-${Date.now()}`
    const sessionId = `sess-${req.userId.slice(0, 8)}`
    const returnUrl = `${process.env.APP_URL}/payment/result`

    // Save pending order in DB
    dbRun(`CREATE TABLE IF NOT EXISTS pending_orders (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      pack INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      dalepago_id TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now'))
    )`)
    dbRun(
      'INSERT OR IGNORE INTO pending_orders (id, userId, pack, amount) VALUES (?, ?, ?, ?)',
      [buyOrder, req.userId, packId, pack.price]
    )

    const payment = await createPaymentLink({
      amount:      pack.price,
      buyOrder,
      sessionId,
      returnUrl,
      email:       user.email,
      description: `BitcoFan — Pack ${pack.amount} sticker${pack.amount > 1 ? 's' : ''}`,
    })

    // Save DalePago payment id
    dbRun('UPDATE pending_orders SET dalepago_id = ? WHERE id = ?', [payment.id, buyOrder])

    res.json({ payment_url: payment.payment_url, buyOrder, paymentId: payment.id })
  } catch (err) {
    console.error('[DalePago] checkout error:', err.message)
    res.status(500).json({ error: err.message || 'Error al crear el pago' })
  }
})

// POST /api/payments/webhook — DalePago notifies payment result
router.post('/payments/webhook', async (req, res) => {
  res.sendStatus(200) // acknowledge immediately
  try {
    const { status, buy_order, payment_id } = req.body
    if (status !== 'AUTHORIZED') return
    const order = dbGet('SELECT * FROM pending_orders WHERE id = ?', [buy_order])
    if (!order || order.status === 'completed') return
    dbRun('UPDATE pending_orders SET status = ? WHERE id = ?', ['completed', buy_order])
    await deliverStickers(order.userId, order.pack)
  } catch (err) {
    console.error('[DalePago] webhook error:', err.message)
  }
})

// GET /api/game/stickers/payment-result — called after Webpay redirect
router.get('/stickers/payment-result', authenticate, async (req, res) => {
  const { status, buy_order } = req.query
  try {
    if (status === 'AUTHORIZED') {
      const order = dbGet('SELECT * FROM pending_orders WHERE id = ?', [buy_order])
      if (order && order.status !== 'completed') {
        dbRun('UPDATE pending_orders SET status = ? WHERE id = ?', ['completed', buy_order])
        await deliverStickers(order.userId, order.pack)
      }
    }
    const user = Users.findById(req.userId)
    const { password, ...safeUser } = user
    res.json({ status, user: safeUser })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Deliver stickers after successful payment
async function deliverStickers(userId, packId) {
  const pack = PACKS[packId]
  if (!pack) return
  const user = Users.findById(userId)
  if (!user) return

  const isFirstPurchase = !user.firstPurchaseDone
  const bonusStickers   = isFirstPurchase ? 10 : 0  // 2 display stickers × 5
  const totalStickers   = user.stickers + pack.amount + bonusStickers
  const updates         = { stickers: totalStickers }
  if (isFirstPurchase) updates.firstPurchaseDone = 1

  if (isFirstPurchase && user.referredBy) {
    const referral = Referrals.findByReferred(userId)
    if (referral && !referral.rewardGiven) {
      const referrer = Users.findById(referral.referrerId)
      if (referrer) {
        Users.update(referral.referrerId, { shields: (referrer.shields ?? 0) + 1 })
        Referrals.markRewarded(referral.id)
        emitToUser(referral.referrerId, { type: 'shield_awarded', referredUsername: user.username })
      }
    }
  }

  Users.update(userId, updates)
  console.log(`[DalePago] Stickers delivered to ${user.username}: +${pack.amount + bonusStickers}`)
}

// Keep old direct buy for dev/testing (can be disabled in prod)
router.post('/stickers/buy', authenticate, (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Use /stickers/checkout' })
  }
  const pack = PACKS[parseInt(req.body.pack ?? 5)]
  if (!pack) return res.status(400).json({ error: 'Pack inválido' })
  try {
    const user = Users.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    const isFirstPurchase = !user.firstPurchaseDone
    const bonusStickers   = isFirstPurchase ? 10 : 0  // 2 display stickers × 5
    const updates = { stickers: user.stickers + pack.amount + bonusStickers }
    if (isFirstPurchase) updates.firstPurchaseDone = 1
    const updated = Users.update(req.userId, updates)
    const { password, ...safeUser } = updated
    res.json({ user: safeUser, message: `¡Compraste ${pack.amount} stickers!`, bonusStickers, isFirstPurchase })
  } catch (err) {
    res.status(500).json({ error: 'Error al comprar stickers' })
  }
})

router.get('/history', authenticate, (req, res) => {
  const bets = Bets.findByUser(req.userId, 20)
  res.json({ bets })
})

export default router
