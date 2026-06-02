const BASE = '/api'

function getToken() {
  return localStorage.getItem('cc_token')
}

function headers(extra = {}) {
  const tok = getToken()
  return {
    'Content-Type': 'application/json',
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    ...extra,
  }
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error de red')
  return data
}

export const api = {
  get:  (path)       => req('GET',    path),
  post: (path, body) => req('POST',   path, body),
  put:  (path, body) => req('PUT',    path, body),

  auth: {
    register: (body) => req('POST', '/auth/register', body),
    login:    (body) => req('POST', '/auth/login', body),
    me:       ()     => req('GET',  '/auth/me'),
  },
  game: {
    round:    ()           => req('GET',  '/game/round'),
    placeBet: (prediction) => req('POST', '/game/bet', { prediction }),
    buyStickers:   (pack) => req('POST', '/game/stickers/buy', { pack }),
    checkout:      (pack) => req('POST', '/game/stickers/checkout', { pack }),
    paymentResult: (buyOrder, status) => req('GET', `/game/stickers/payment-result?buy_order=${buyOrder}&status=${status}`),
    history:  ()           => req('GET',  '/game/history'),
  },
  ranking: {
    daily:   () => req('GET', '/ranking/daily'),
    monthly: () => req('GET', '/ranking/monthly'),
    prizes:  () => req('GET', '/ranking/prizes'),
  },
}
