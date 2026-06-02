import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import AvatarPicker from '../components/AvatarPicker'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const [referralInfo, setReferralInfo] = useState(null)
  const [copied, setCopied] = useState(false)

  // Profile form
  const [profileForm, setProfileForm] = useState({ username: '', email: '', avatar: '₿' })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null) // { type: 'ok'|'err', text }

  // Password form
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  useEffect(() => {
    if (user) setProfileForm({ username: user.username ?? '', email: user.email ?? '', avatar: user.avatar ?? '₿' })
  }, [user])

  useEffect(() => {
    api.get('/referrals/link').then(setReferralInfo).catch(() => {})
  }, [])

  const copyLink = () => {
    const url = `${window.location.origin}/ref/${user?.username}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    setProfileMsg(null)
    setProfileLoading(true)
    try {
      const { user: u } = await api.post('/auth/update-profile', profileForm)
      updateUser(u)
      setProfileMsg({ type: 'ok', text: 'Perfil actualizado ✓' })
    } catch (err) {
      setProfileMsg({ type: 'err', text: err.message })
    } finally { setProfileLoading(false) }
  }

  const savePassword = async (e) => {
    e.preventDefault()
    setPwMsg(null)
    if (pwForm.next !== pwForm.confirm) return setPwMsg({ type: 'err', text: 'Las contraseñas no coinciden' })
    if (pwForm.next.length < 6) return setPwMsg({ type: 'err', text: 'Mínimo 6 caracteres' })
    setPwLoading(true)
    try {
      await api.post('/auth/change-password', { current: pwForm.current, next: pwForm.next })
      setPwMsg({ type: 'ok', text: 'Contraseña actualizada ✓' })
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      setPwMsg({ type: 'err', text: err.message })
    } finally { setPwLoading(false) }
  }

  return (
    <div className="profile-page">

      {/* ── Avatar grande ── */}
      <div className="profile-hero">
        <div className="profile-big-avatar">{user?.avatar ?? '₿'}</div>
        <div className="profile-hero-info">
          <div className="profile-hero-name">{user?.username}</div>
          <div className="profile-hero-level">NIVEL {user?.level ?? 1}</div>
          <div className="profile-hero-stats">
            <span>🏆 {(user?.points ?? 0).toLocaleString()} pts</span>
            <span>🔥 Mejor racha: {user?.bestStreak ?? 0}</span>
          </div>
        </div>
      </div>

      {/* ── Editar perfil ── */}
      <div className="card profile-section">
        <div className="profile-section-title">EDITAR PERFIL</div>
        <form onSubmit={saveProfile} className="profile-form">
          {profileMsg && (
            <div className={profileMsg.type === 'ok' ? 'settings-success' : 'settings-error'}>
              {profileMsg.text}
            </div>
          )}
          <label className="settings-label">Avatar</label>
          <AvatarPicker
            current={profileForm.avatar}
            onSelect={a => setProfileForm(f => ({ ...f, avatar: a }))}
          />
          <label className="settings-label">Username</label>
          <input className="input" type="text" placeholder="SatoshiHero"
            value={profileForm.username} minLength={3} maxLength={20}
            onChange={e => setProfileForm(f => ({ ...f, username: e.target.value }))} required />
          <label className="settings-label">Email</label>
          <input className="input" type="email" placeholder="tu@email.com"
            value={profileForm.email}
            onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} required />
          <button className="btn btn-purple" type="submit" disabled={profileLoading} style={{ marginTop: 4 }}>
            {profileLoading ? '...' : 'GUARDAR CAMBIOS'}
          </button>
        </form>
      </div>

      {/* ── Referidos ── */}
      <div className="card profile-section">
        <div className="profile-section-title">👥 REFERIDOS</div>
        <div className="referral-info">
          <p className="referral-desc">
            Comparte tu link. Cuando un amigo compra su primer pack, ganas un <strong style={{ color: 'var(--gold)' }}>🛡 Escudo Bitcoin</strong> — protege tu sticker en 1 ronda si fallas.
          </p>
          <div className="referral-link-box">
            <span className="referral-url">{window.location.origin}/ref/{user?.username}</span>
            <button className="btn btn-purple" onClick={copyLink} style={{ padding: '8px 16px', fontSize: 9, flexShrink: 0 }}>
              {copied ? '✓ COPIADO' : 'COPIAR'}
            </button>
          </div>
          {referralInfo && (
            <div className="referral-stats">
              <div className="ref-stat">
                <span className="ref-stat-val">{referralInfo.referrals}</span>
                <span className="ref-stat-label">Amigos referidos</span>
              </div>
              <div className="ref-stat">
                <span className="ref-stat-val">{referralInfo.rewarded}</span>
                <span className="ref-stat-label">Con primera compra</span>
              </div>
              <div className="ref-stat">
                <span className="ref-stat-val" style={{ color: 'var(--gold)' }}>🛡 {referralInfo.shields}</span>
                <span className="ref-stat-label">Escudos activos</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Cambiar contraseña ── */}
      <div className="card profile-section">
        <div className="profile-section-title">CAMBIAR CONTRASEÑA</div>
        <form onSubmit={savePassword} className="profile-form">
          {pwMsg && (
            <div className={pwMsg.type === 'ok' ? 'settings-success' : 'settings-error'}>
              {pwMsg.text}
            </div>
          )}
          <label className="settings-label">Contraseña actual</label>
          <input className="input" type="password" placeholder="••••••••"
            value={pwForm.current}
            onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} required />
          <label className="settings-label">Nueva contraseña</label>
          <input className="input" type="password" placeholder="Mínimo 6 caracteres"
            value={pwForm.next}
            onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} required />
          <label className="settings-label">Confirmar contraseña</label>
          <input className="input" type="password" placeholder="Repetir contraseña"
            value={pwForm.confirm}
            onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
          <button className="btn btn-purple" type="submit" disabled={pwLoading} style={{ marginTop: 4 }}>
            {pwLoading ? '...' : 'CAMBIAR CONTRASEÑA'}
          </button>
        </form>
      </div>

    </div>
  )
}
