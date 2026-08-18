/**
 * Auto-skip por ausência: espera extra na vez do jogador e nunca pula
 * com turnLock (dado 3D / movimento / modal).
 *
 * last_seen velho (GAME_OFFLINE_THRESHOLD_MS) só liga o status "waiting".
 * O avanço espera mais GAME_ABSENCE_SKIP_GRACE_MS — cobre animação do dado
 * e heartbeat atrasado no celular.
 */
import { turnAttemptKey } from './turnTimerLogic.js'

/** Tempo extra na vez, depois de detectar ausência, antes de pular. */
export const GAME_ABSENCE_SKIP_GRACE_MS = 15_000

export function shouldRejectAbsentTurnSkip({
  turnLock = false,
  lastRollTurnKey = null,
  expectedTurnSeq = 0,
} = {}) {
  if (turnLock) return { reject: true, reason: 'turn-locked' }
  if (
    lastRollTurnKey != null &&
    String(lastRollTurnKey) === String(expectedTurnSeq)
  ) {
    return { reject: true, reason: 'already-rolled' }
  }
  return { reject: false, reason: 'ok' }
}

/**
 * @returns {{ ok: boolean, reason: string, waitingSinceMs: number|null }}
 */
export function shouldAttemptPresenceAutoSkip({
  turnPresent = false,
  turnLock = false,
  gameOver = false,
  amCoordinator = false,
  turnPlayerId = '',
  turnSeq = 0,
  waitingSinceMs = null,
  now = Date.now(),
  graceMs = GAME_ABSENCE_SKIP_GRACE_MS,
  inFlight = false,
} = {}) {
  if (gameOver) {
    return { ok: false, reason: 'game-over', waitingSinceMs: null }
  }
  if (!turnPlayerId) {
    return { ok: false, reason: 'no-turn-player', waitingSinceMs: null }
  }

  // Dado/movimento/modal: não acumula graça e não pula.
  if (turnLock) {
    return { ok: false, reason: 'turn-locked', waitingSinceMs: null }
  }
  if (turnPresent) {
    return { ok: false, reason: 'present', waitingSinceMs: null }
  }

  const t = Number.isFinite(Number(now)) ? Number(now) : Date.now()
  const started = waitingSinceMs == null ? NaN : Number(waitingSinceMs)
  const nextWaiting = Number.isFinite(started) ? started : t
  const waitMs = Number.isFinite(Number(graceMs)) ? Number(graceMs) : GAME_ABSENCE_SKIP_GRACE_MS

  if (t - nextWaiting < waitMs) {
    return {
      ok: false,
      reason: 'waiting-grace',
      waitingSinceMs: nextWaiting,
      attemptKey: turnAttemptKey(turnPlayerId, turnSeq),
    }
  }

  if (inFlight) {
    return { ok: false, reason: 'in-flight', waitingSinceMs: nextWaiting }
  }
  if (!amCoordinator) {
    return { ok: false, reason: 'not-coordinator', waitingSinceMs: nextWaiting }
  }

  return {
    ok: true,
    reason: 'absent-grace-elapsed',
    waitingSinceMs: nextWaiting,
    attemptKey: turnAttemptKey(turnPlayerId, turnSeq),
  }
}
