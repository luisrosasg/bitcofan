# CriptoCrush 🚀

Juego de predicción de Bitcoin en tiempo real. Predecí si el precio sube o baja en 60 segundos, acumulá puntos y competí por premios diarios.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite + CSS puro (pixel-art) |
| Backend | Node.js + Express |
| Base de datos | SQLite vía sql.js (puro JS, sin compilación) |
| Auth | JWT + bcrypt |
| Tiempo real | WebSocket (ws) — relay de Binance |
| Precio live | Binance WebSocket `btcusdt@trade` + fallback simulado |

## Estructura

```
cryptocrush/
├── server/
│   ├── src/
│   │   ├── index.js              ← Entry point, WS, round engine
│   │   ├── lib/
│   │   │   ├── db.js             ← sql.js DAOs (Users, Rounds, Bets, DailyScores)
│   │   │   └── gameLogic.js      ← Fórmulas canónicas (multiplier, scoring)
│   │   ├── middleware/
│   │   │   └── auth.js           ← JWT middleware
│   │   ├── routes/
│   │   │   ├── auth.js           ← /api/auth/register, login, me
│   │   │   ├── game.js           ← /api/game/round, bet, stickers
│   │   │   └── ranking.js        ← /api/ranking/daily, monthly
│   │   └── services/
│   │       └── roundService.js   ← Round lifecycle + settlement server-side
│   ├── .env
│   └── package.json
│
└── client/
    ├── src/
    │   ├── App.jsx               ← Router + rutas públicas/protegidas
    │   ├── context/
    │   │   └── AuthContext.jsx   ← Estado global de usuario
    │   ├── hooks/
    │   │   └── useGameSocket.js  ← WebSocket → precio, ronda, resultados
    │   ├── lib/
    │   │   ├── api.js            ← Fetch helpers con JWT
    │   │   └── gameHelpers.js    ← Multiplicador, formato, preview puntos
    │   ├── components/
    │   │   ├── PriceChart.jsx    ← Canvas chart con rocket, lock line
    │   │   ├── ResultModal.jsx   ← Modal win/loss
    │   │   └── Toast.jsx         ← Notificación flotante
    │   └── pages/
    │       ├── LoginPage.jsx
    │       ├── RegisterPage.jsx
    │       └── GamePage.jsx      ← Pantalla principal del juego
    └── package.json
```

## Setup rápido

### 1. Instalar dependencias

```bash
# Desde la raíz del proyecto
cd server && npm install
cd ../client && npm install
```

### 2. Configurar variables de entorno

El archivo `server/.env` ya viene con valores por defecto para desarrollo:

```env
DATABASE_URL="file:./dev.db.json"
JWT_SECRET="cryptocrush-super-secret-change-in-production"
PORT=3001
CLIENT_URL="http://localhost:5173"
ROUND_DURATION_SECONDS=60
```

**En producción:** cambiá `JWT_SECRET` por algo seguro.

### 3. Correr en desarrollo

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

Luego abrí **http://localhost:5173**

### Alternativamente, desde la raíz (requiere instalar concurrently):
```bash
npm install
npm run dev
```

## Cómo juega

1. **Registrate** con email, username y password (mínimo 6 caracteres)
2. Cada cuenta empieza con **3 stickers grátis**
3. En cada ronda de 60s: elegís **SUBE** o **BAJA**
4. Si acertás: ganás puntos = `|endPrice - lockedPrice| × multiplicador`
5. El multiplicador sube con la racha de aciertos (hasta ×3.0 con 11+ seguidos)
6. El ranking diario se resetea a medianoche UTC

## Mecánica de puntos

| Racha | Multiplicador |
|-------|---------------|
| 0–2   | ×1.0 |
| 3–4   | ×1.5 |
| 5–7   | ×2.0 |
| 8–10  | ×2.5 |
| 11+   | ×3.0 |

## Precio en vivo

El servidor se conecta a `wss://stream.binance.com:9443/ws/btcusdt@trade`. Si la conexión falla (firewall, etc.), activa automáticamente un simulador de precio con random walk.

**Importante:** el resultado de cada ronda se determina **en el servidor**, nunca en el cliente.

## Próximos pasos

- [ ] Integrar Mercado Pago / Stripe para compra real de stickers
- [ ] Screens de Ranking completo, Tienda, Misiones, Perfil
- [ ] Migrar a Postgres (solo cambiar `DATABASE_URL` y ajustar sql.js → pg)
- [ ] KYC / verificación de identidad para premios en efectivo
- [ ] Rate limiting por IP en `/api/game/bet`
- [ ] Reset diario automático con cron job
