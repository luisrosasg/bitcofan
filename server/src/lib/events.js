// Simple user→socket registry for targeted WebSocket messages
const userSockets = new Map() // userId → Set of WebSocket connections

export function registerSocket(userId, ws) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set())
  userSockets.get(userId).add(ws)
  ws.on('close', () => {
    userSockets.get(userId)?.delete(ws)
    if (userSockets.get(userId)?.size === 0) userSockets.delete(userId)
  })
}

export function emitToUser(userId, data) {
  const sockets = userSockets.get(userId)
  if (!sockets) return
  const msg = JSON.stringify(data)
  sockets.forEach(ws => {
    try { if (ws.readyState === 1) ws.send(msg) } catch {}
  })
}

// ── Broadcast to all connected clients (optionally exclude one userId) ──
let _wss = null
export function setWss(wss) { _wss = wss }

export function broadcastAll(data, excludeUserId = null) {
  if (!_wss) return
  const msg = JSON.stringify(data)
  _wss.clients.forEach(ws => {
    try {
      // Skip the excluded user's sockets
      if (excludeUserId) {
        const userSet = userSockets.get(excludeUserId)
        if (userSet?.has(ws)) return
      }
      if (ws.readyState === 1) ws.send(msg)
    } catch {}
  })
}
