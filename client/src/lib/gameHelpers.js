export function getMultiplier(streak) {
  if (streak >= 11) return 3.0
  if (streak >= 8)  return 2.5
  if (streak >= 5)  return 2.0
  if (streak >= 3)  return 1.5
  return 1.0
}

export function getNextTier(streak) {
  if (streak >= 11) return null
  if (streak >= 8)  return { need: 11 - streak, next: 3.0 }
  if (streak >= 5)  return { need: 8 - streak,  next: 2.5 }
  if (streak >= 3)  return { need: 5 - streak,  next: 2.0 }
  return { need: 3 - streak, next: 1.5 }
}

export function fmtPrice(n) {
  if (n == null) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPts(n) {
  return Math.round(n).toLocaleString('en-US')
}

export function fmtTimer(sec) {
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export function calcPointsPreview(lockedAtPrice, currentPrice, streak) {
  if (!lockedAtPrice || !currentPrice) return 0
  return Math.round(Math.abs(currentPrice - lockedAtPrice) * getMultiplier(streak))
}
