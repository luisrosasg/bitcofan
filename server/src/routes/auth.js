import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Users, dbGet } from '../lib/db.js'
import { sendVerificationEmail } from '../lib/email.js'

const router = Router()

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

function safeUser(user) {
  const { password, ...rest } = user
  return rest
}

router.post('/register', async (req, res) => {
  const { email, username, password } = req.body
  if (!email || !username || !password)
    return res.status(400).json({ error: 'Email, username y password son requeridos' })
  if (password.length < 6)
    return res.status(400).json({ error: 'Password debe tener al menos 6 caracteres' })
  if (username.length < 3 || username.length > 20)
    return res.status(400).json({ error: 'Username debe tener entre 3 y 20 caracteres' })
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    return res.status(400).json({ error: 'Username solo puede contener letras, números y _' })

  try {
    if (Users.findByEmail(email))
      return res.status(409).json({ error: 'Ese email ya está en uso' })
    if (Users.findByUsername(username))
      return res.status(409).json({ error: 'Ese username ya está en uso' })

    const hash        = await bcrypt.hash(password, 10)
    const verifyToken = crypto.randomUUID()
    const user = Users.create({ id: crypto.randomUUID(), email, username, password: hash })
    Users.update(user.id, { emailVerifyToken: verifyToken })

    // Send verification email (non-blocking — don't fail registration if email fails)
    sendVerificationEmail(email, username, verifyToken).catch(err => {
      console.error('[email] Failed to send verification:', err.message)
    })

    const token = signToken(user.id)
    return res.status(201).json({ token, user: safeUser(user) })
  } catch (err) {
    console.error('register error:', err)
    return res.status(500).json({ error: 'Error al registrar' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'Email y password son requeridos' })
  try {
    const user = Users.findByEmail(email)
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' })
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' })
    const token = signToken(user.id)
    return res.json({ token, user: safeUser(user) })
  } catch (err) {
    console.error('login error:', err)
    return res.status(500).json({ error: 'Error al iniciar sesión' })
  }
})

router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' })
  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET)
    const user = Users.findById(payload.userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    return res.json({ user: safeUser(user) })
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
})


// GET /api/auth/verify-email?token=xxx
router.get('/verify-email', (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'Token requerido' })
  try {
    const found = dbGet('SELECT * FROM users WHERE emailVerifyToken = ?', [token])
    if (!found) return res.status(400).json({ error: 'Token inválido o expirado' })
    if (found.emailVerified) return res.json({ ok: true, alreadyVerified: true })
    Users.update(found.id, { emailVerified: 1, emailVerifyToken: null })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'Error al verificar' })
  }
})

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' })
  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET)
    const user = Users.findById(payload.userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true })
    const verifyToken = crypto.randomUUID()
    Users.update(user.id, { emailVerifyToken: verifyToken })
    await sendVerificationEmail(user.email, user.username, verifyToken)
    return res.json({ ok: true })
  } catch (err) {
    console.error('[email] Resend error:', err.message)
    return res.status(500).json({ error: 'Error al reenviar' })
  }
})

// POST /api/auth/change-password
router.post('/change-password', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' })
  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET)
    const user = Users.findById(payload.userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    const { current, next } = req.body
    if (!current || !next) return res.status(400).json({ error: 'Campos requeridos' })
    if (next.length < 6) return res.status(400).json({ error: 'Mínimo 6 caracteres' })
    const valid = await bcrypt.compare(current, user.password)
    if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta' })
    const hash = await bcrypt.hash(next, 10)
    Users.update(payload.userId, { password: hash })
    return res.json({ ok: true })
  } catch { return res.status(401).json({ error: 'Token inválido' }) }
})

// POST /api/auth/update-profile
router.post('/update-profile', async (req, res) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' })
  try {
    const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET)
    const user = Users.findById(payload.userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    const { username, email, avatar } = req.body
    if (!username || !email) return res.status(400).json({ error: 'Campos requeridos' })
    if (username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Username entre 3 y 20 caracteres' })
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return res.status(400).json({ error: 'Username solo letras, números y _' })
    // Check uniqueness (excluding self)
    const byUsername = Users.findByUsername(username)
    if (byUsername && byUsername.id !== payload.userId) return res.status(409).json({ error: 'Ese username ya está en uso' })
    const byEmail = Users.findByEmail(email)
    if (byEmail && byEmail.id !== payload.userId) return res.status(409).json({ error: 'Ese email ya está en uso' })
    const updated = Users.update(payload.userId, { username, email, ...(avatar ? { avatar } : {}) })
    const { password, ...safeUser } = updated
    return res.json({ user: safeUser })
  } catch { return res.status(401).json({ error: 'Token inválido' }) }
})

export default router
