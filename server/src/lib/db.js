import { createRequire } from 'module'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const __dir   = dirname(fileURLToPath(import.meta.url))

const DB_PATH  = join(__dir, '../../dev.db.json')  // persist as JSON for sql.js
const DATA_DIR = join(__dir, '../..')

// ── Bootstrap sql.js ────────────────────────────────────────
let SQL, db

async function initDb() {
  if (db) return db

  // sql.js needs the wasm file — point to the node variant
  const initSqlJs = require('sql.js')
  SQL = await initSqlJs()

  if (existsSync(DB_PATH)) {
    const raw = readFileSync(DB_PATH)
    db = new SQL.Database(raw)
  } else {
    db = new SQL.Database()
  }

  createTables()
  // Migrate: add avatar column if it doesn't exist yet
  try { db.run("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '₿'") } catch {}
  try { db.run('ALTER TABLE daily_scores ADD COLUMN bestStreak INTEGER DEFAULT 0') } catch {}
  try { db.run('ALTER TABLE daily_scores ADD COLUMN bestPoints INTEGER DEFAULT 0') } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN firstPurchaseDone INTEGER DEFAULT 0") } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN shields INTEGER DEFAULT 0") } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN referredBy TEXT") } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN emailVerified INTEGER DEFAULT 0") } catch {}
  try { db.run("ALTER TABLE users ADD COLUMN emailVerifyToken TEXT") } catch {}
  return db
}

function saveDb() {
  if (!db) return
  const data = db.export()
  writeFileSync(DB_PATH, Buffer.from(data))
}

// Auto-save every 5 seconds
setInterval(() => { try { saveDb() } catch {} }, 5000)

// Save on process exit
process.on('exit',    saveDb)
process.on('SIGINT',  () => { saveDb(); process.exit() })
process.on('SIGTERM', () => { saveDb(); process.exit() })

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT UNIQUE NOT NULL,
      username   TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      points     INTEGER DEFAULT 0,
      stickers   INTEGER DEFAULT 3,
      streak     INTEGER DEFAULT 0,
      bestStreak INTEGER DEFAULT 0,
      xp         INTEGER DEFAULT 0,
      level      INTEGER DEFAULT 1,
      avatar              TEXT    DEFAULT '₿',
      firstPurchaseDone   INTEGER DEFAULT 0,
      shields             INTEGER DEFAULT 0,
      referredBy          TEXT,
      emailVerified       INTEGER DEFAULT 0,
      emailVerifyToken    TEXT,
      createdAt           TEXT    DEFAULT (datetime('now')),
      updatedAt  TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS rounds (
      id         TEXT PRIMARY KEY,
      startTime  TEXT NOT NULL,
      endTime    TEXT NOT NULL,
      startPrice REAL NOT NULL,
      endPrice   REAL,
      settled    INTEGER DEFAULT 0,
      createdAt  TEXT DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS bets (
      id            TEXT PRIMARY KEY,
      userId        TEXT NOT NULL,
      roundId       TEXT NOT NULL,
      prediction    TEXT NOT NULL,
      lockedAtPrice REAL NOT NULL,
      endPrice      REAL,
      won           INTEGER,
      pointsAwarded INTEGER DEFAULT 0,
      streakAtBet   INTEGER DEFAULT 0,
      createdAt     TEXT DEFAULT (datetime('now')),
      UNIQUE(userId, roundId),
      FOREIGN KEY(userId)  REFERENCES users(id),
      FOREIGN KEY(roundId) REFERENCES rounds(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS referrals (
      id            TEXT PRIMARY KEY,
      referrerId    TEXT NOT NULL,
      referredId    TEXT NOT NULL,
      rewardGiven   INTEGER DEFAULT 0,
      createdAt     TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(referrerId) REFERENCES users(id),
      FOREIGN KEY(referredId) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS referrals (
      id            TEXT PRIMARY KEY,
      referrerId    TEXT NOT NULL,
      referredId    TEXT NOT NULL,
      rewardGiven   INTEGER DEFAULT 0,
      createdAt     TEXT DEFAULT (datetime('now')),
      UNIQUE(referredId),
      FOREIGN KEY(referrerId) REFERENCES users(id),
      FOREIGN KEY(referredId) REFERENCES users(id)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_scores (
      id          TEXT PRIMARY KEY,
      userId      TEXT NOT NULL,
      date        TEXT NOT NULL,
      points      INTEGER DEFAULT 0,
      bestStreak  INTEGER DEFAULT 0,
      bestPoints  INTEGER DEFAULT 0,
      updatedAt   TEXT DEFAULT (datetime('now')),
      UNIQUE(userId, date),
      FOREIGN KEY(userId) REFERENCES users(id)
    )
  `)
}

// ── Query helpers ────────────────────────────────────────────
function run(sql, params = []) {
  db.run(sql, params)
  saveDb()
}

function get(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row
  }
  stmt.free()
  return null
}

function all(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows = []
  while (stmt.step()) rows.push(stmt.getAsObject())
  stmt.free()
  return rows
}

// ── User DAO ─────────────────────────────────────────────────
export const Users = {
  findByEmail: (email) => get('SELECT * FROM users WHERE email = ?', [email]),
  findById:    (id)    => get('SELECT * FROM users WHERE id = ?', [id]),
  findByUsername: (u)  => get('SELECT * FROM users WHERE username = ?', [u]),

  create({ id, email, username, password }) {
    run(
      `INSERT INTO users (id, email, username, password) VALUES (?, ?, ?, ?)`,
      [id, email, username, password]
    )
    return this.findById(id)
  },

  update(id, fields) {
    const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
    const vals = Object.values(fields)
    run(`UPDATE users SET ${cols}, updatedAt = datetime('now') WHERE id = ?`, [...vals, id])
    return this.findById(id)
  },
}

// ── Round DAO ────────────────────────────────────────────────
export const Rounds = {
  create({ id, startTime, endTime, startPrice }) {
    run(
      `INSERT INTO rounds (id, startTime, endTime, startPrice) VALUES (?, ?, ?, ?)`,
      [id, startTime, endTime, startPrice]
    )
    return get('SELECT * FROM rounds WHERE id = ?', [id])
  },

  update(id, fields) {
    const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
    run(`UPDATE rounds SET ${cols} WHERE id = ?`, [...Object.values(fields), id])
  },
}

// ── Bet DAO ──────────────────────────────────────────────────
export const Bets = {
  findByUserAndRound: (userId, roundId) =>
    get('SELECT * FROM bets WHERE userId = ? AND roundId = ?', [userId, roundId]),

  findByRound: (roundId) =>
    all('SELECT bets.*, users.username, users.streak, users.points, users.xp, users.level, users.bestStreak FROM bets JOIN users ON bets.userId = users.id WHERE roundId = ?', [roundId]),

  create({ id, userId, roundId, prediction, lockedAtPrice, streakAtBet }) {
    run(
      `INSERT INTO bets (id, userId, roundId, prediction, lockedAtPrice, streakAtBet) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, roundId, prediction, lockedAtPrice, streakAtBet]
    )
    return get('SELECT * FROM bets WHERE id = ?', [id])
  },

  update(id, fields) {
    const cols = Object.keys(fields).map(k => `${k} = ?`).join(', ')
    run(`UPDATE bets SET ${cols} WHERE id = ?`, [...Object.values(fields), id])
  },

  findByUser: (userId, limit = 20) =>
    all(`SELECT bets.*, rounds.startPrice, rounds.endPrice as roundEndPrice, rounds.startTime, rounds.endTime
         FROM bets JOIN rounds ON bets.roundId = rounds.id
         WHERE bets.userId = ? ORDER BY bets.createdAt DESC LIMIT ?`, [userId, limit]),
}

// ── DailyScore DAO ───────────────────────────────────────────
export const DailyScores = {
  upsert(userId, date, roundPoints, streak) {
    const existing = get('SELECT * FROM daily_scores WHERE userId = ? AND date = ?', [userId, date])
    if (existing) {
      const newBestStreak = Math.max(existing.bestStreak ?? 0, streak ?? 0)
      const newBestPoints = Math.max(existing.bestPoints ?? 0, roundPoints)
      run(`UPDATE daily_scores SET bestStreak = ?, bestPoints = ?, points = ?, updatedAt = datetime('now') WHERE userId = ? AND date = ?`,
        [newBestStreak, newBestPoints, newBestPoints, userId, date])
    } else {
      const id = crypto.randomUUID()
      run(`INSERT INTO daily_scores (id, userId, date, points, bestStreak, bestPoints) VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, date, roundPoints, streak ?? 0, roundPoints])
    }
  },

  resetDay(date) {
    run(`DELETE FROM daily_scores WHERE date = ?`, [date])
    console.log(`[ranking] Daily scores reset for ${date}`)
  },

  getTop(date, limit = 20) {
    return all(`
      SELECT ds.userId, ds.points, ds.bestStreak, ds.bestPoints, u.username, u.level, u.avatar, u.bestStreak as allTimeBest
      FROM daily_scores ds JOIN users u ON ds.userId = u.id
      WHERE ds.date = ? ORDER BY ds.bestStreak DESC, ds.bestPoints DESC LIMIT ?
    `, [date, limit])
  },
}

// ── Init export ──────────────────────────────────────────────
export { initDb }

// ── Referrals DAO ────────────────────────────────────────────
export const Referrals = {
  create(referrerId, referredId) {
    const id = crypto.randomUUID()
    run('INSERT OR IGNORE INTO referrals (id, referrerId, referredId) VALUES (?, ?, ?)', [id, referrerId, referredId])
  },
  findByReferred: (referredId) => get('SELECT * FROM referrals WHERE referredId = ?', [referredId]),
  findByReferrer: (referrerId) => all('SELECT r.*, u.username FROM referrals r JOIN users u ON r.referredId = u.id WHERE r.referrerId = ?', [referrerId]),
  markRewarded:   (id)         => run('UPDATE referrals SET rewardGiven = 1 WHERE id = ?', [id]),
}

// ── Raw query helpers (exported) ─────────────────────────────
export function dbAll(sql, params = []) { return all(sql, params) }
export function dbGet(sql, params = []) { return get(sql, params) }
export function dbRun(sql, params = []) { return run(sql, params) }
