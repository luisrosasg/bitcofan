import { Router } from 'express'
import { Tournaments, Users, dbAll } from '../lib/db.js'
import { authenticate } from '../middleware/auth.js'
import { sendVerificationEmail } from '../lib/email.js'

const router = Router()

// ── Public ────────────────────────────────────────────────────

// GET /api/tournaments — active tournaments
router.get('/', (req, res) => {
  const active = Tournaments.findActive()
  res.json({ tournaments: active })
})

// GET /api/tournaments/:id/leaderboard
router.get('/:id/leaderboard', (req, res) => {
  const t = Tournaments.findById(req.params.id)
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' })
  const leaderboard = Tournaments.getLeaderboard(req.params.id, t.type)
  res.json({ tournament: t, leaderboard })
})

// GET /api/tournaments/:id/me — current user score
router.get('/:id/me', authenticate, (req, res) => {
  const score = Tournaments.getScore(req.params.id, req.userId)
  const lb    = Tournaments.getLeaderboard(req.params.id)
  const pos   = lb.findIndex(r => r.userId === req.userId) + 1
  res.json({ score, position: pos || null })
})

// ── Admin ──────────────────────────────────────────────────────

function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key']
  if (key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'No autorizado' })
  next()
}

// GET /api/tournaments/admin/all
router.get('/admin/all', adminAuth, (req, res) => {
  const tournaments = Tournaments.findAll()
  res.json({ tournaments })
})

// POST /api/tournaments/admin — create tournament
router.post('/admin', adminAuth, (req, res) => {
  const { name, description, prize, type, startAt, endAt } = req.body
  if (!name || !prize || !startAt || !endAt) {
    return res.status(400).json({ error: 'name, prize, startAt, endAt son requeridos' })
  }
  const t = Tournaments.create({
    id: crypto.randomUUID(),
    name, description: description || '',
    prize, type: type || 'streak',
    startAt, endAt,
  })
  res.json({ tournament: t })
})

// PUT /api/tournaments/admin/:id — update tournament
router.put('/admin/:id', adminAuth, (req, res) => {
  const t = Tournaments.findById(req.params.id)
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' })
  const allowed = ['name', 'description', 'prize', 'type', 'startAt', 'endAt', 'status']
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))
  const updated = Tournaments.update(req.params.id, updates)
  res.json({ tournament: updated })
})

// DELETE /api/tournaments/admin/:id
router.delete('/admin/:id', adminAuth, (req, res) => {
  Tournaments.delete(req.params.id)
  res.json({ ok: true })
})

// POST /api/tournaments/admin/:id/finish — manually finish and notify winner
router.post('/admin/:id/finish', adminAuth, async (req, res) => {
  const t = Tournaments.findById(req.params.id)
  if (!t) return res.status(404).json({ error: 'Torneo no encontrado' })
  await finishTournament(t)
  res.json({ ok: true, tournament: Tournaments.findById(req.params.id) })
})

// ── Tournament finisher (also used by cron) ────────────────────
export async function finishTournament(t) {
  const lb = Tournaments.getLeaderboard(t.id, t.type, 1)
  if (!lb.length) {
    Tournaments.update(t.id, { status: 'finished' })
    return null
  }
  const winner = lb[0]
  Tournaments.update(t.id, { status: 'finished', winnerId: winner.userId })

  // Notify winner by email
  const user = Users.findById(winner.userId)
  if (user?.email) {
    try {
      await notifyWinner(user, t, winner)
    } catch (e) {
      console.error('[tournament] email error:', e.message)
    }
  }
  console.log(`[tournament] ${t.name} finished. Winner: ${winner.username}`)
  return winner
}

async function notifyWinner(user, tournament, score) {
  const { Resend } = await import('resend')
  const resend = new Resend(process.env.RESEND_API_KEY)
  const APP_URL = process.env.APP_URL || 'http://localhost:5173'

  const statLabel = tournament.type === 'streak'
    ? `Mejor racha: ${score.bestStreak} aciertos`
    : `Puntos totales: ${score.totalPoints.toLocaleString('es-CL')}`

  await resend.emails.send({
    from:    process.env.EMAIL_FROM || 'noreply@bitcofan.com',
    to:      [user.email],
    subject: `🏆 ¡Ganaste el torneo "${tournament.name}"! — BitcoFan`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="background:#07021a;margin:0;padding:40px 20px;font-family:system-ui,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#150732;border:1.5px solid #4a1d8f;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1d0a4a,#07021a);padding:32px 40px;text-align:center;border-bottom:1px solid #4a1d8f;">
      <div style="font-size:64px;">🏆</div>
      <div style="font-size:24px;font-weight:900;color:#fcd34d;letter-spacing:2px;">¡GANASTE!</div>
    </div>
    <div style="padding:32px 40px;">
      <h2 style="color:#e9d5ff;font-size:18px;margin:0 0 8px;">Hola, ${user.username}!</h2>
      <p style="color:#a78bfa;font-size:15px;line-height:1.6;">
        Eres el ganador del torneo <strong style="color:#fcd34d;">"${tournament.name}"</strong>.
      </p>
      <div style="background:rgba(252,211,77,.1);border:1px solid rgba(252,211,77,.3);border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
        <div style="font-size:11px;color:#a78bfa;margin-bottom:4px;">PREMIO</div>
        <div style="font-size:28px;font-weight:900;color:#fcd34d;">${tournament.prize}</div>
        <div style="font-size:12px;color:#6d4aa8;margin-top:4px;">${statLabel}</div>
      </div>
      <p style="color:#a78bfa;font-size:14px;">Nos pondremos en contacto contigo pronto para coordinar la entrega del premio.</p>
      ${user.phone ? `<div style="background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.3);border-radius:10px;padding:12px 16px;margin:16px 0;text-align:center;">
        <div style="font-size:11px;color:#a78bfa;margin-bottom:4px;">TE CONTACTAREMOS AL</div>
        <div style="font-size:18px;font-weight:700;color:#fff;">${user.phone}</div>
        <div style="font-size:12px;color:#6d4aa8;margin-top:4px;">Si tu número cambió, responde este email.</div>
      </div>` : ''}
      <a href="${APP_URL}" style="display:block;text-align:center;background:linear-gradient(135deg,#a855f7,#8b5cf6);color:#fff;padding:14px;border-radius:10px;text-decoration:none;font-weight:700;margin-top:20px;">IR A BITCOFAN</a>
    </div>
  </div>
</body></html>`,
  })
}

// GET /api/tournaments/admin/stats
router.get('/admin/stats', adminAuth, (req, res) => {
  const today    = new Date().toISOString().slice(0, 10)
  const thisMonth = new Date().toISOString().slice(0, 7)

  const totalUsers    = dbAll("SELECT COUNT(*) as n FROM users")[0]?.n ?? 0
  const todayUsers    = dbAll("SELECT COUNT(*) as n FROM users WHERE createdAt >= ?", [today])[0]?.n ?? 0
  const monthUsers    = dbAll("SELECT COUNT(*) as n FROM users WHERE createdAt >= ?", [thisMonth + '-01'])[0]?.n ?? 0

  // Pending orders = attempted purchases
  const totalOrders   = dbAll("SELECT COUNT(*) as n FROM pending_orders")[0]?.n ?? 0
  const paidOrders    = dbAll("SELECT COUNT(*) as n FROM pending_orders WHERE status = 'completed'")[0]?.n ?? 0
  const todayOrders   = dbAll("SELECT COUNT(*) as n FROM pending_orders WHERE status = 'completed' AND createdAt >= ?", [today])[0]?.n ?? 0
  const monthOrders   = dbAll("SELECT COUNT(*) as n FROM pending_orders WHERE status = 'completed' AND createdAt >= ?", [thisMonth + '-01'])[0]?.n ?? 0

  const revenue       = dbAll("SELECT COALESCE(SUM(amount),0) as total FROM pending_orders WHERE status = 'completed'")[0]?.total ?? 0
  const todayRevenue  = dbAll("SELECT COALESCE(SUM(amount),0) as total FROM pending_orders WHERE status = 'completed' AND createdAt >= ?", [today])[0]?.total ?? 0
  const monthRevenue  = dbAll("SELECT COALESCE(SUM(amount),0) as total FROM pending_orders WHERE status = 'completed' AND createdAt >= ?", [thisMonth + '-01'])[0]?.total ?? 0

  const recentUsers   = dbAll("SELECT username, avatar, level, createdAt FROM users ORDER BY createdAt DESC LIMIT 5")
  const recentOrders  = dbAll("SELECT po.id, po.amount, po.pack, po.status, po.createdAt, u.username FROM pending_orders po LEFT JOIN users u ON po.userId = u.id ORDER BY po.createdAt DESC LIMIT 10")

  res.json({
    users:   { total: totalUsers, today: todayUsers, month: monthUsers },
    orders:  { total: totalOrders, paid: paidOrders, today: todayOrders, month: monthOrders },
    revenue: { total: revenue, today: todayRevenue, month: monthRevenue },
    recentUsers, recentOrders,
  })
})

export default router
