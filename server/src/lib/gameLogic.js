/**
 * Game logic — canonical formulas (same as design spec)
 */

export function getMultiplier(streak) {
  if (streak >= 11) return 3.0
  if (streak >= 8)  return 2.5
  if (streak >= 5)  return 2.0
  if (streak >= 3)  return 1.5
  return 1.0
}

export function calcPoints(lockedAtPrice, endPrice, streak) {
  const diff = Math.abs(endPrice - lockedAtPrice)
  const multiplier = getMultiplier(streak)
  return Math.round(diff * multiplier)
}

export function didWin(prediction, lockedAtPrice, endPrice) {
  if (endPrice === lockedAtPrice) return false
  if (prediction === 'UP')   return endPrice > lockedAtPrice
  if (prediction === 'DOWN') return endPrice < lockedAtPrice
  return false
}

export function getLevelFromXp(xp) {
  // Simple level formula: level = floor(xp / 1000) + 1, max 50
  return Math.min(50, Math.floor(xp / 1000) + 1)
}

export function getXpForRound(won, points) {
  if (!won) return 10
  return 10 + Math.floor(points / 100)
}

export function getTodayString() {
  return new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
}
