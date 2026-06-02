import { Rounds, Bets, Users, DailyScores } from '../lib/db.js'
import { calcPoints, didWin, getLevelFromXp, getXpForRound, getTodayString } from '../lib/gameLogic.js'
import { emitToUser, broadcastAll } from '../lib/events.js'

const ROUND_DURATION = parseInt(process.env.ROUND_DURATION_SECONDS || '60', 10) * 1000

let currentRound = null
let currentPrice = null

export function setCurrentPrice(price) { currentPrice = price }
export function getCurrentPrice()      { return currentPrice }
export function getCurrentRound()      { return currentRound }

export function startNewRound() {
  if (!currentPrice) { console.log('[round] Waiting for price feed...'); return null }

  const startTime = new Date().toISOString()
  const endTime   = new Date(Date.now() + ROUND_DURATION).toISOString()
  const id        = crypto.randomUUID()

  Rounds.create({ id, startTime, endTime, startPrice: currentPrice })

  currentRound = { id, startTime, endTime, startPrice: currentPrice, settled: false }
  console.log(`[round] New round ${id.slice(0,8)} started @ $${currentPrice.toFixed(2)}`)
  return currentRound
}

export function settleCurrentRound() {
  if (!currentRound || !currentPrice) return null

  const roundId  = currentRound.id
  const endPrice = currentPrice

  console.log(`[round] Settling ${roundId.slice(0,8)} @ $${endPrice.toFixed(2)}`)

  Rounds.update(roundId, { endPrice, settled: 1 })

  const bets  = Bets.findByRound(roundId)
  const today = getTodayString()

  for (const bet of bets) {
    const won         = didWin(bet.prediction, bet.lockedAtPrice, endPrice)
    const points      = won ? calcPoints(bet.lockedAtPrice, endPrice, bet.streakAtBet) : 0
    const newStreak   = won ? bet.streakAtBet + 1 : 0
    const xpGain      = getXpForRound(won, points)

    const user        = Users.findById(bet.userId)
    if (!user) continue

    const newXp       = user.xp + xpGain
    const newLevel    = getLevelFromXp(newXp)
    const newPoints   = user.points + points
    const newBest     = Math.max(user.bestStreak, newStreak)

    Bets.update(bet.id, { endPrice, won: won ? 1 : 0, pointsAwarded: points })

    // On loss: use shield if available, otherwise deduct sticker
    let stickerDelta = 0
    let shieldUsed = false
    if (!won) {
      if ((user.shields ?? 0) > 0) {
        shieldUsed = true
        stickerDelta = 0  // shield absorbs the loss
        console.log(`[shield] ${user.username} shield protected their sticker!`)
      } else {
        stickerDelta = -1
      }
    }

    Users.update(bet.userId, {
      points:     newPoints,
      streak:     newStreak,
      bestStreak: newBest,
      xp:         newXp,
      level:      newLevel,
      stickers:   Math.max(0, user.stickers + stickerDelta),
      shields:    shieldUsed ? Math.max(0, (user.shields ?? 0) - 1) : (user.shields ?? 0),
    })

    DailyScores.upsert(bet.userId, today, points, newStreak)

    // Check if this user just reached #1 and notify them
    if (won) {
      const top = DailyScores.getTop(today, 2)
      const isTop1 = top[0]?.userId === bet.userId
      const wasAlreadyTop1 = top.length > 1 && top[0]?.userId === bet.userId && top[0]?.bestStreak === newStreak
      if (isTop1) {
        // Notify the winner directly
        emitToUser(bet.userId, {
          type: 'top1_reached',
          streak: newStreak,
          points: newPoints,
        })
        // Broadcast to everyone else — creates tension
        broadcastAll({
          type: 'top1_alert',
          username: user.username,
          avatar:   user.avatar ?? '₿',
          streak:   newStreak,
        }, bet.userId) // exclude the winner (they got their own message)
      }
    }

    console.log(`[round] ${bet.username}: ${won ? 'WIN' : 'LOSS'} +${points}pts streak→${newStreak}`)
  }

  const result = { roundId, endPrice, betsSettled: bets.length }
  currentRound = null
  return result
}
