import { Router } from 'express'
import { DailyScores, dbAll } from '../lib/db.js'
import { getTodayString } from '../lib/gameLogic.js'

const router = Router()

router.get('/daily', (req, res) => {
  const today  = getTodayString()
  let scores   = DailyScores.getTop(today, 20)

  // Fallback: if no daily_scores yet, build ranking from users table
  if (scores.length === 0) {
    const users = dbAll(`
      SELECT id as userId, username, level, avatar, points, streak, bestStreak
      FROM users WHERE points > 0 ORDER BY bestStreak DESC, points DESC LIMIT 20
    `)
    scores = users.map(u => ({
      userId:     u.userId,
      username:   u.username,
      level:      u.level,
      avatar:     u.avatar,
      points:     u.points,
      bestStreak: u.bestStreak ?? 0,
      bestPoints: u.points,
    }))
  }

  const ranking = scores.map((s, i) => ({
    position:   i + 1,
    userId:     s.userId,
    username:   s.username,
    level:      s.level,
    avatar:     s.avatar ?? '₿',
    points:     s.points,
    bestStreak: s.bestStreak ?? 0,
    bestPoints: s.bestPoints ?? s.points ?? 0,
  }))
  res.json({ ranking, date: today })
})

router.get('/monthly', (req, res) => {
  const rows    = dbAll(`SELECT id, username, level, avatar, points, bestStreak FROM users ORDER BY bestStreak DESC, points DESC LIMIT 20`)
  const ranking = rows.map((u, i) => ({
    position:   i + 1,
    userId:     u.id,
    username:   u.username,
    level:      u.level,
    avatar:     u.avatar ?? '₿',
    points:     u.points,
    bestStreak: u.bestStreak ?? 0,
  }))
  res.json({ ranking })
})

router.get('/prizes', (req, res) => {
  res.json({
    daily:   parseInt(process.env.DAILY_PRIZE   || '100000'),
    monthly: parseInt(process.env.MONTHLY_PRIZE || '1000000'),
  })
})

export default router
