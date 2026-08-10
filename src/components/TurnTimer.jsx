import React, { useEffect, useState } from 'react'
import { remainingTurnMs } from '../game/turnTimerLogic.js'
import { normalizeTurnTime } from '../game/turnTimeConfig.js'

function formatMmSs(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, '0')}`
}

/**
 * Cronômetro visual baseado em turnDeadlineAt autoritativo (rooms.state).
 * Não avança turno — só exibe remaining.
 */
export default function TurnTimer({
  turnDeadlineAt,
  turnTimeSec,
  turnPlayerId,
  turnSeq,
  turnLock = false,
  gameOver = false,
  paused = false,
}) {
  const [now, setNow] = useState(() => Date.now())
  const configured = normalizeTurnTime(turnTimeSec)

  useEffect(() => {
    if (gameOver) return undefined
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [gameOver, turnDeadlineAt, turnPlayerId, turnSeq])

  if (gameOver) return null

  const remaining = remainingTurnMs(turnDeadlineAt, now)
  const totalMs = configured * 1000
  const ratio = totalMs > 0 ? Math.min(1, remaining / totalMs) : 0
  const secLeft = Math.ceil(remaining / 1000)
  const urgent = secLeft <= 10
  const isPaused = !!(paused || turnLock)

  return (
    <div
      className={`turnTimer${urgent ? ' turnTimer--urgent' : ''}${isPaused ? ' turnTimer--paused' : ''}`}
      role="timer"
      aria-live="polite"
      aria-label={`Tempo restante do turno: ${formatMmSs(secLeft)}`}
      title={isPaused ? 'Cronômetro em pausa (ação em andamento)' : 'Tempo por jogada'}
    >
      <div className="turnTimerLabel">Tempo</div>
      <div className="turnTimerValue">{formatMmSs(secLeft)}</div>
      <div className="turnTimerTrack" aria-hidden="true">
        <div
          className="turnTimerFill"
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
        />
      </div>
      {isPaused && <div className="turnTimerPauseHint">Pausado</div>}
    </div>
  )
}
