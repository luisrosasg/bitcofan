import { useState, useEffect, useCallback } from 'react'

const ADMIN_KEY = () => localStorage.getItem('admin_key') || ''
const API = (path, opts = {}) => fetch(`/api/tournaments${path}`, {
  ...opts,
  headers: { 'Content-Type': 'application/json', 'x-admin-key': ADMIN_KEY(), ...(opts.headers || {}) },
  body: opts.body ? JSON.stringify(opts.body) : undefined,
}).then(r => r.json())

const fmtDate = (d) => d ? new Date(d).toLocaleString('es-CL') : '—'
const statusColor = { active: '#22ff88', finished: '#a78bfa', pending: '#fcd34d' }

export default function AdminPage() {
  const [authed, setAuthed]         = useState(!!localStorage.getItem('admin_key'))
  const [keyInput, setKeyInput]     = useState('')
  const [tournaments, setTournaments] = useState([])
  const [selected, setSelected]     = useState(null)
  const [leaderboard, setLeaderboard] = useState([])
  const [form, setForm]             = useState({ name: '', description: '', prize: '', type: 'streak', startAt: '', endAt: '' })
  const [editing, setEditing]       = useState(null)
  const [msg, setMsg]               = useState(null)
  const [tab, setTab]               = useState('dashboard') // dashboard | list | create
  const [stats, setStats]           = useState(null)

  const notify = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg(null), 3000) }

  const load = useCallback(async () => {
    const data = await API('/admin/all')
    if (data.error) { setAuthed(false); localStorage.removeItem('admin_key'); return }
    setTournaments(data.tournaments || [])
  }, [])

  const loadStats = useCallback(async () => {
    const data = await API('/admin/stats')
    if (!data.error) setStats(data)
  }, [])

  useEffect(() => { if (authed) { load(); loadStats() } }, [authed])

  const login = () => {
    localStorage.setItem('admin_key', keyInput)
    setAuthed(true)
  }

  const loadLeaderboard = async (t) => {
    setSelected(t)
    const data = await API(`/${t.id}/leaderboard`)
    setLeaderboard(data.leaderboard || [])
  }

  const createOrUpdate = async () => {
    if (editing) {
      const data = await API(`/admin/${editing}`, { method: 'PUT', body: form })
      if (data.error) return notify(data.error, false)
      notify('Torneo actualizado ✓')
    } else {
      const data = await API('/admin', { method: 'POST', body: form })
      if (data.error) return notify(data.error, false)
      notify('Torneo creado ✓')
    }
    setForm({ name: '', description: '', prize: '', type: 'streak', startAt: '', endAt: '' })
    setEditing(null); setTab('list'); load()
  }

  const deleteTournament = async (id) => {
    if (!confirm('¿Eliminar torneo?')) return
    await API(`/admin/${id}`, { method: 'DELETE' })
    notify('Eliminado'); load()
  }

  const finish = async (id) => {
    if (!confirm('¿Finalizar torneo y notificar ganador?')) return
    const data = await API(`/admin/${id}/finish`, { method: 'POST', body: {} })
    if (data.error) return notify(data.error, false)
    notify('Torneo finalizado · Ganador notificado por email ✓'); load()
  }

  const startEdit = (t) => {
    setForm({
      name: t.name, description: t.description || '',
      prize: t.prize, type: t.type,
      startAt: t.startAt?.slice(0, 16) || '',
      endAt:   t.endAt?.slice(0, 16) || '',
    })
    setEditing(t.id); setTab('create')
  }

  if (!authed) return (
    <div style={s.page}>
      <div style={s.loginCard}>
        <div style={s.logoTxt}>⚡ ADMIN BITCOFAN</div>
        <input style={s.input} type="password" placeholder="Admin key"
          value={keyInput} onChange={e => setKeyInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()} />
        <button style={s.btnPrimary} onClick={login}>ENTRAR</button>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.logoTxt}>⚡ PANEL ADMIN</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={tab === 'dashboard' ? s.tabActive : s.tab} onClick={() => setTab('dashboard')}>DASHBOARD</button>
            <button style={tab === 'list' ? s.tabActive : s.tab} onClick={() => { setTab('list'); setEditing(null) }}>TORNEOS</button>
            <button style={tab === 'create' ? s.tabActive : s.tab} onClick={() => { setTab('create'); setEditing(null); setForm({ name:'',description:'',prize:'',type:'streak',startAt:'',endAt:'' }) }}>+ NUEVO</button>
            <button style={{...s.tab, color:'#ff6b6b'}} onClick={() => { localStorage.removeItem('admin_key'); setAuthed(false) }}>SALIR</button>
          </div>
        </div>

        {msg && <div style={{ ...s.toast, background: msg.ok ? 'rgba(34,255,136,.15)' : 'rgba(255,51,85,.15)', color: msg.ok ? '#22ff88' : '#ff3355', border: `1px solid ${msg.ok ? 'rgba(34,255,136,.3)' : 'rgba(255,51,85,.3)'}` }}>{msg.text}</div>}

        {/* Dashboard */}
        {tab === 'dashboard' && stats && (
          <div>
            {/* Stats grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
              {[
                { label:'Usuarios totales', val: stats.users.total, sub: `+${stats.users.today} hoy · +${stats.users.month} este mes` },
                { label:'Ventas completadas', val: stats.orders.paid, sub: `+${stats.orders.today} hoy · +${stats.orders.month} este mes` },
                { label:'Ingresos totales', val: `$${stats.revenue.total.toLocaleString('es-CL')}`, sub: `$${stats.revenue.today.toLocaleString('es-CL')} hoy` },
              ].map(m => (
                <div key={m.label} style={s.card}>
                  <div style={{ fontSize:11, color:'#6d4aa8', marginBottom:4 }}>{m.label}</div>
                  <div style={{ fontSize:24, fontWeight:700, color:'#fcd34d' }}>{m.val}</div>
                  <div style={{ fontSize:11, color:'#4a1d8f', marginTop:4 }}>{m.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {/* Recent users */}
              <div style={s.card}>
                <div style={s.tName}>ÚLTIMOS USUARIOS</div>
                {stats.recentUsers.map(u => (
                  <div key={u.username} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(139,92,246,.1)', fontSize:13 }}>
                    <span>{u.avatar || '₿'} {u.username} <span style={{fontSize:11,color:'#6d4aa8'}}>Nvl {u.level}</span></span>
                    <span style={{color:'#6d4aa8',fontSize:11}}>{new Date(u.createdAt).toLocaleDateString('es-CL')}</span>
                  </div>
                ))}
              </div>

              {/* Recent orders */}
              <div style={s.card}>
                <div style={s.tName}>ÚLTIMAS VENTAS</div>
                {stats.recentOrders.map(o => (
                  <div key={o.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(139,92,246,.1)', fontSize:12 }}>
                    <div>
                      <div style={{color:'#fff'}}>{o.username || '—'}</div>
                      <div style={{color:'#6d4aa8',fontSize:11}}>{o.pack} stickers</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{color:'#fcd34d'}}>${(o.amount||0).toLocaleString('es-CL')}</div>
                      <span style={{...s.badge, background: o.status==='completed' ? 'rgba(34,255,136,.15)' : 'rgba(251,191,36,.15)', color: o.status==='completed' ? '#22ff88' : '#fbbf24'}}>
                        {o.status === 'completed' ? 'PAGADO' : 'PENDIENTE'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tournament list */}
        {tab === 'list' && (
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              {tournaments.length === 0 && <div style={s.empty}>No hay torneos creados aún.</div>}
              {tournaments.map(t => (
                <div key={t.id} style={{ ...s.card, borderColor: t.status === 'active' ? 'rgba(34,255,136,.3)' : 'rgba(139,92,246,.3)', cursor: 'pointer' }}
                  onClick={() => loadLeaderboard(t)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={s.tName}>{t.name}</div>
                      <div style={s.tPrize}>🏆 {t.prize}</div>
                      <div style={s.tMeta}>{t.type === 'streak' ? '🔥 Mejor racha' : '⭐ Más puntos'} · {fmtDate(t.startAt)} → {fmtDate(t.endAt)}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                      <span style={{ ...s.badge, background: `${statusColor[t.status]}22`, color: statusColor[t.status] }}>
                        {t.status.toUpperCase()}
                      </span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {t.status === 'active' && <button style={s.btnSm} onClick={e => { e.stopPropagation(); finish(t.id) }}>Finalizar</button>}
                        <button style={s.btnSm} onClick={e => { e.stopPropagation(); startEdit(t) }}>Editar</button>
                        <button style={{...s.btnSm, color:'#ff6b6b'}} onClick={e => { e.stopPropagation(); deleteTournament(t.id) }}>Eliminar</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Leaderboard panel */}
            {selected && (
              <div style={{ width: 320, ...s.card }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={s.tName}>🏆 {selected.name}</div>
                  <button style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 18 }} onClick={() => setSelected(null)}>✕</button>
                </div>
                {leaderboard.length === 0 && <div style={s.empty}>Sin participantes aún.</div>}
                {leaderboard.map((r, i) => (
                  <div key={r.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(139,92,246,.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: 'monospace', color: i === 0 ? '#fcd34d' : '#a78bfa', fontSize: 14, width: 20 }}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                      </span>
                      <span style={{ fontSize: 18 }}>{r.avatar || '₿'}</span>
                      <div>
                        <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{r.username}</div>
                        <div style={{ color: '#6d4aa8', fontSize: 11 }}>Nvl {r.level}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#fcd34d', fontSize: 14, fontWeight: 700 }}>
                        {selected.type === 'streak' ? `🔥 ${r.bestStreak}` : `⭐ ${r.totalPoints}`}
                      </div>
                      <div style={{ color: '#6d4aa8', fontSize: 10 }}>
                        {selected.type === 'streak' ? `${r.totalPoints} pts` : `🔥 ${r.bestStreak}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create / Edit form */}
        {tab === 'create' && (
          <div style={{ ...s.card, maxWidth: 560 }}>
            <div style={s.tName}>{editing ? 'EDITAR TORNEO' : 'NUEVO TORNEO'}</div>
            <div style={s.formGrid}>
              <label style={s.label}>Nombre *
                <input style={s.input} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Gran Premio Mensual" />
              </label>
              <label style={s.label}>Premio *
                <input style={s.input} value={form.prize} onChange={e => setForm(f => ({...f, prize: e.target.value}))} placeholder="$100.000 / PlayStation 5" />
              </label>
              <label style={s.label}>Descripción
                <input style={s.input} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Opcional" />
              </label>
              <label style={s.label}>Tipo de ranking
                <select style={s.input} value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                  <option value="streak">🔥 Mejor racha</option>
                  <option value="points">⭐ Más puntos</option>
                </select>
              </label>
              <label style={s.label}>Inicio *
                <input style={s.input} type="datetime-local" value={form.startAt} onChange={e => setForm(f => ({...f, startAt: e.target.value}))} />
              </label>
              <label style={s.label}>Término *
                <input style={s.input} type="datetime-local" value={form.endAt} onChange={e => setForm(f => ({...f, endAt: e.target.value}))} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={s.btnPrimary} onClick={createOrUpdate}>{editing ? 'GUARDAR CAMBIOS' : 'CREAR TORNEO'}</button>
              <button style={s.tab} onClick={() => { setTab('list'); setEditing(null) }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  page:       { minHeight: '100vh', background: '#07021a', padding: '24px 20px', color: '#fff' },
  wrap:       { maxWidth: 1100, margin: '0 auto' },
  loginCard:  { maxWidth: 360, margin: '100px auto', background: '#150732', border: '1.5px solid #4a1d8f', borderRadius: 16, padding: 32, display: 'flex', flexDirection: 'column', gap: 16 },
  header:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(139,92,246,.3)' },
  logoTxt:    { fontFamily: '"Press Start 2P", monospace', fontSize: 14, color: '#fcd34d' },
  card:       { background: 'rgba(21,7,50,.8)', border: '1.5px solid rgba(139,92,246,.3)', borderRadius: 14, padding: '16px 20px', marginBottom: 12 },
  tName:      { fontFamily: '"Press Start 2P", monospace', fontSize: 11, color: '#e9d5ff', marginBottom: 6 },
  tPrize:     { fontSize: 18, fontWeight: 800, color: '#fcd34d', marginBottom: 4 },
  tMeta:      { fontSize: 12, color: '#6d4aa8' },
  badge:      { fontSize: 9, fontFamily: 'monospace', padding: '3px 8px', borderRadius: 6 },
  empty:      { color: '#4a1d8f', fontSize: 13, padding: '20px 0', textAlign: 'center' },
  tab:        { background: 'rgba(139,92,246,.1)', border: '1px solid rgba(139,92,246,.3)', color: '#a78bfa', fontFamily: '"Press Start 2P", monospace', fontSize: 8, padding: '8px 12px', borderRadius: 8, cursor: 'pointer' },
  tabActive:  { background: 'rgba(139,92,246,.3)', border: '1px solid #a855f7', color: '#fff', fontFamily: '"Press Start 2P", monospace', fontSize: 8, padding: '8px 12px', borderRadius: 8, cursor: 'pointer' },
  btnPrimary: { background: 'linear-gradient(135deg,#a855f7,#8b5cf6)', border: 'none', color: '#fff', fontFamily: '"Press Start 2P", monospace', fontSize: 9, padding: '12px 20px', borderRadius: 10, cursor: 'pointer' },
  btnSm:      { background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.3)', color: '#a78bfa', fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer' },
  input:      { background: 'rgba(7,2,26,.8)', border: '1px solid rgba(139,92,246,.4)', color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box', marginTop: 4 },
  label:      { display: 'flex', flexDirection: 'column', fontSize: 11, color: '#a78bfa', fontFamily: 'system-ui,sans-serif' },
  formGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  toast:      { padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontFamily: 'system-ui,sans-serif' },
}
