import { fmtPrice, fmtPts } from '../lib/gameHelpers'

export default function ResultModal({ result, onClose }) {
  if (!result) return null
  const { won, pointsAwarded, lockedAtPrice, endPrice, streakBefore, streakAfter } = result

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`card modal-card ${won ? 'win' : 'loss'}`} onClick={e => e.stopPropagation()}>
        <div className="modal-emoji">{won ? '🎉' : '💀'}</div>
        <div className={`modal-title ${won ? 'win' : 'loss'}`}>
          {won ? '¡ACERTASTE!' : 'FALLASTE'}
        </div>

        <div className="modal-stats">
          <div className="modal-stat">
            <span className="modal-stat-label">DIFERENCIA</span>
            <span className="modal-stat-value">{fmtPrice(Math.abs(endPrice - lockedAtPrice))}</span>
          </div>
          <div className="modal-stat">
            <span className="modal-stat-label">TU PREDICCIÓN</span>
            <span className="modal-stat-value" style={{ color: lockedAtPrice ? 'var(--green)' : 'var(--red)' }}>
              {result.prediction === 'UP' ? '↗ SUBE' : '↘ BAJA'}
            </span>
          </div>
        </div>

        <div className={`modal-points ${won ? 'win' : 'loss'}`}>
          {won ? `+${fmtPts(pointsAwarded)} PTS` : '0 PTS'}
        </div>

        <div className="modal-streak">
          {won
            ? `🔥 Racha: ${streakBefore} → ${streakAfter}`
            : `💔 Racha perdida (${streakBefore} → 0)`}
        </div>

        <button className="btn btn-purple" onClick={onClose} style={{ width: '100%' }}>
          {won ? 'SEGUIR JUGANDO' : 'INTENTAR DE NUEVO'}
        </button>
      </div>
    </div>
  )
}
