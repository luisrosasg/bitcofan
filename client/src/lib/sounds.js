/**
 * All sounds generated with Web Audio API — zero assets needed.
 */

let ctx = null
let muted = false

export function setMuted(val) { muted = val }
export function getMuted()      { return muted }

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function gain(ac, value, at = 0) {
  const g = ac.createGain()
  g.gain.setValueAtTime(value, at)
  return g
}

// ── Lock prediction ─────────────────────────────────────────
// Two quick digital blips, ascending
export function playLock() {
  if (muted) return
  try {
    const ac = getCtx()
    const now = ac.currentTime
    ;[660, 990].forEach((freq, i) => {
      const osc = ac.createOscillator()
      const g   = gain(ac, 0)
      osc.connect(g); g.connect(ac.destination)
      osc.type = 'square'
      osc.frequency.setValueAtTime(freq, now + i * 0.08)
      g.gain.setValueAtTime(0, now + i * 0.08)
      g.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.12)
      osc.start(now + i * 0.08)
      osc.stop(now + i * 0.08 + 0.13)
    })
  } catch {}
}

// ── Normal tick (every second 20→6) ────────────────────────
// Short neutral click
export function playTick() {
  if (muted) return
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const osc = ac.createOscillator()
    const g   = gain(ac, 0)
    osc.connect(g); g.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now)
    g.gain.setValueAtTime(0.12, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    osc.start(now); osc.stop(now + 0.07)
  } catch {}
}

// ── Urgent tick (last 5 seconds) ───────────────────────────
// Higher pitch, sharper — generates tension
export function playTickUrgent() {
  if (muted) return
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    // Main beep
    const osc = ac.createOscillator()
    const g   = gain(ac, 0)
    osc.connect(g); g.connect(ac.destination)
    osc.type = 'square'
    osc.frequency.setValueAtTime(1320, now)
    g.gain.setValueAtTime(0.14, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    osc.start(now); osc.stop(now + 0.06)
    // Tiny echo
    const osc2 = ac.createOscillator()
    const g2   = gain(ac, 0)
    osc2.connect(g2); g2.connect(ac.destination)
    osc2.type = 'square'
    osc2.frequency.setValueAtTime(660, now + 0.04)
    g2.gain.setValueAtTime(0.07, now + 0.04)
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.10)
    osc2.start(now + 0.04); osc2.stop(now + 0.11)
  } catch {}
}

// ── Win — arcade jingle ─────────────────────────────────────
export function playWin() {
  if (muted) return
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const notes = [
      { f: 523, t: 0.00 },   // C5
      { f: 659, t: 0.10 },   // E5
      { f: 784, t: 0.20 },   // G5
      { f: 1047, t: 0.32 },  // C6
    ]
    notes.forEach(({ f, t }) => {
      const osc = ac.createOscillator()
      const g   = gain(ac, 0)
      osc.connect(g); g.connect(ac.destination)
      osc.type = 'square'
      osc.frequency.setValueAtTime(f, now + t)
      g.gain.setValueAtTime(0, now + t)
      g.gain.linearRampToValueAtTime(0.15, now + t + 0.01)
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.18)
      osc.start(now + t); osc.stop(now + t + 0.2)
    })
  } catch {}
}

// ── Lose — descending buzz ──────────────────────────────────
export function playLose() {
  if (muted) return
  try {
    const ac  = getCtx()
    const now = ac.currentTime
    const osc = ac.createOscillator()
    const g   = gain(ac, 0)
    osc.connect(g); g.connect(ac.destination)
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(300, now)
    osc.frequency.linearRampToValueAtTime(80, now + 0.5)
    g.gain.setValueAtTime(0.18, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    osc.start(now); osc.stop(now + 0.55)
  } catch {}
}
