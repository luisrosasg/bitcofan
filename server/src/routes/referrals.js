import { Router } from 'express'
import { Users, Referrals } from '../lib/db.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

// GET /api/referrals/link — get user's referral link info
router.get('/link', authenticate, (req, res) => {
  const user = Users.findById(req.userId)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  const referrals = Referrals.findByReferrer(req.userId)
  const rewarded  = referrals.filter(r => r.rewardGiven).length
  res.json({
    link:     `/ref/${user.username}`,
    username: user.username,
    referrals: referrals.length,
    rewarded,
    shields:  user.shields ?? 0,
  })
})

// GET /api/ref/:username — called when someone visits /ref/USERNAME
// Stores referrer in session cookie / returns referrer info for register page
router.get('/:username', (req, res) => {
  const user = Users.findByUsername(req.params.username)
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
  res.json({ referrerId: user.id, referrerUsername: user.username })
})

// POST /api/referrals/register — called after registration to link referral
router.post('/register', authenticate, (req, res) => {
  const { referrerId } = req.body
  if (!referrerId) return res.status(400).json({ error: 'referrerId requerido' })
  try {
    const user = Users.findById(req.userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    if (user.referredBy) return res.json({ ok: true, alreadyLinked: true })
    if (referrerId === req.userId) return res.status(400).json({ error: 'No puedes referirte a ti mismo' })

    Users.update(req.userId, { referredBy: referrerId })
    Referrals.create(referrerId, req.userId)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Error al registrar referido' })
  }
})

export default router
