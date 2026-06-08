import { useState, useEffect, useRef, useCallback } from 'react'

export function useGameSocket() {
  const [price, setPrice]           = useState(null)
  const [prevPrice, setPrevPrice]   = useState(null)
  const [history, setHistory]       = useState([])
  const [live, setLive]             = useState(false)
  const [round, setRound]           = useState(null)
  const [lastResult, setLastResult]   = useState(null)
  const [shieldNotif, setShieldNotif]   = useState(null)
  const [top1Notif, setTop1Notif]         = useState(null)
  const [top1Alert, setTop1Alert]         = useState(null)

  const wsRef        = useRef(null)
  const reconnectRef = useRef(null)
  const mountedRef   = useRef(true)
  const startedAtRef = useRef(Date.now())

  const connect = useCallback(() => {
    // Don't connect if component is unmounted
    if (!mountedRef.current) return
    // Don't stack connections
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return

    try {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return }
        // Register for targeted messages
        const token = localStorage.getItem('cc_token')
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]))
            ws.send(JSON.stringify({ type: 'auth', userId: payload.userId }))
          } catch {}
        }
      }

      ws.onmessage = (e) => {
        if (!mountedRef.current) return
        try {
          const msg = JSON.parse(e.data)

          if (msg.type === 'init' || msg.type === 'price') {
            if (msg.price != null) {
              setPrevPrice(prev => prev ?? msg.price)
              setPrice(msg.price)
              setHistory(h => {
                const last = h[h.length - 1]
                if (last && Date.now() - last.t < 333) return h
                const next = [...h, { t: Date.now(), p: msg.price }]
                return next.length > 240 ? next.slice(-240) : next
              })
            }
            if (msg.live  !== undefined) setLive(msg.live)
            if (msg.round !== undefined) setRound(msg.round)
          }

          if (msg.type === 'round_start')    setRound(msg.round)
          if (msg.type === 'round_end')      { setLastResult(msg.result); setRound(null) }
          if (msg.type === 'connection')     setLive(msg.live)
          if (msg.type === 'shield_awarded') setShieldNotif(msg.referredUsername)
          if (msg.type === 'top1_reached')    setTop1Notif(msg)
          if (msg.type === 'top1_alert')      setTop1Alert(msg)
        } catch {}
      }

      ws.onerror = () => {
        // swallow — onclose will handle reconnect
      }

      ws.onclose = () => {
        if (!mountedRef.current) return
        setLive(false)
        // Reconnect after 3s
        reconnectRef.current = setTimeout(connect, 3000)
      }
    } catch {
      // If WebSocket constructor itself throws, retry later
      reconnectRef.current = setTimeout(connect, 3000)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    // Small delay so Vite proxy is ready on first load
    reconnectRef.current = setTimeout(connect, 300)

    return () => {
      mountedRef.current = false
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null   // prevent reconnect loop on unmount
        wsRef.current.close()
      }
    }
  }, [connect])

  return { price, prevPrice, history, live, round, lastResult, setLastResult, startedAt: startedAtRef.current, shieldNotif, setShieldNotif, top1Notif, setTop1Notif, top1Alert, setTop1Alert }
}
