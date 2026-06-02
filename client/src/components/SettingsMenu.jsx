import { useState, useRef, useEffect } from 'react'
import AvatarPicker from './AvatarPicker'
import { api } from '../lib/api'

export default function SettingsMenu({ user, onLogout, onUserUpdate }) {
  const [open, setOpen]         = useState(false)
  const [view, setView]         = useState('menu')   // 'menu' | 'password' | 'profile'
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')
  const menuRef                 = useRef(null)

  // Password form
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  // Profile form  
  const [profileForm, setProfileForm] = useState({ username: user?.username ?? '', email: user?.email ?? '', avatar: user?.avatar ?? '₿' })

  // Sync form when user prop updates
  useEffect(() => {
    setProfileForm({ username: user?.username ?? '', email: user?.email ?? '', avatar: user?.avatar ?? '₿' })
  }, [user?.username, user?.email, user?.avatar])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Reset on open
  useEffect(() => {
    if (open) { setView('menu'); setError(''); setSuccess('') }
  }, [open])

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    if (pwForm.next !== pwForm.confirm) return setError('Las contraseñas no coinciden')
    if (pwForm.next.length < 6) return setError('Mínimo 6 caracteres')
    setLoading(true)
    try {
      await api.post('/auth/change-password', { current: pwForm.current, next: pwForm.next })
      setSuccess('Contraseña actualizada ✓')
      setPwForm({ current: '', next: '', confirm: '' })
      setTimeout(() => setView('menu'), 1500)
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    setLoading(true)
    try {
      const { user: u } = await api.post('/auth/update-profile', profileForm)
      onUserUpdate(u)
      setSuccess('Perfil actualizado ✓')
      setTimeout(() => setView('menu'), 1500)
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div className="settings-wrap" ref={menuRef}>
      <button className="header-btn" onClick={() => setOpen(o => !o)} title="Configuración">⚙</button>

      {open && (
        <div className="settings-dropdown">

          {/* ── Menu principal ── */}
          {view === 'menu' && (
            <>
              <div className="settings-header">CONFIGURACIÓN</div>

              <div className="settings-user-card">
                <div className="settings-avatar">₿</div>
                <div>
                  <div className="settings-username">{user?.username}</div>
                  <div className="settings-email">{user?.email}</div>
                </div>
              </div>

              <div className="settings-divider" />

              <button className="settings-item" onClick={() => { setView('password'); setError(''); setSuccess('') }}>
                <span className="settings-item-icon">🔑</span>
                <span>Cambiar contraseña</span>
                <span className="settings-item-arrow">›</span>
              </button>


            </>
          )}

          {/* ── Cambiar contraseña ── */}
          {view === 'password' && (
            <>
              <div className="settings-header">
                <button className="settings-back" onClick={() => setView('menu')}>‹</button>
                CAMBIAR CONTRASEÑA
              </div>
              <form className="settings-form" onSubmit={handlePasswordChange}>
                {error   && <div className="settings-error">{error}</div>}
                {success && <div className="settings-success">{success}</div>}
                <label className="settings-label">Contraseña actual</label>
                <input className="input" type="password" placeholder="••••••••"
                  value={pwForm.current}
                  onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} required />
                <label className="settings-label">Nueva contraseña</label>
                <input className="input" type="password" placeholder="Mínimo 6 caracteres"
                  value={pwForm.next}
                  onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} required />
                <label className="settings-label">Confirmar nueva contraseña</label>
                <input className="input" type="password" placeholder="Repetir contraseña"
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
                <button className="btn btn-purple" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                  {loading ? '...' : 'GUARDAR'}
                </button>
              </form>
            </>
          )}

          {/* ── Editar perfil ── */}
          {view === 'profile' && (
            <>
              <div className="settings-header">
                <button className="settings-back" onClick={() => setView('menu')}>‹</button>
                EDITAR PERFIL
              </div>
              <form className="settings-form" onSubmit={handleProfileSave}>
                {error   && <div className="settings-error">{error}</div>}
                {success && <div className="settings-success">{success}</div>}
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
                <button className="btn btn-purple" type="submit" disabled={loading} style={{ width: '100%', marginTop: 8 }}>
                  {loading ? '...' : 'GUARDAR'}
                </button>
              </form>
            </>
          )}

        </div>
      )}
    </div>
  )
}
