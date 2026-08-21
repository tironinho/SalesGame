/**
 * Decisões puras de segurança do turnLock / tick.
 * NÃO usa timeout de 30s como fim de jogada.
 */

/**
 * O watchdog só pode forçar unlock se NÃO houver evidência de jogada ativa.
 * locks>0 || opening || eventsInProgress || turnChangeInProgress || pendingTurnData
 * ⇒ operação real — apenas diagnóstico.
 */
export function decideTurnLockWatchdog({
  turnLock = false,
  isLockOwner = false,
  lockOwnerNull = false,
  modalLocks = 0,
  opening = false,
  eventsInProgress = false,
  turnChangeInProgress = false,
  hasPendingTurnData = false,
} = {}) {
  if (!turnLock) {
    return { forceUnlock: false, reason: 'not-locked' }
  }

  const locks = Math.max(0, Number(modalLocks) || 0)
  const pipelineActive =
    locks > 0 ||
    !!opening ||
    !!eventsInProgress ||
    !!turnChangeInProgress ||
    !!hasPendingTurnData

  if (pipelineActive) {
    return {
      forceUnlock: false,
      reason: 'pipeline-active',
      diagnostic: true,
    }
  }

  // Sem pipeline: lock órfão só se somos dono ou lockOwner sumiu.
  if (isLockOwner || lockOwnerNull) {
    return { forceUnlock: true, reason: 'orphan-lock', diagnostic: false }
  }

  return { forceUnlock: false, reason: 'not-owner', diagnostic: false }
}

/**
 * Timeout interno do tick NÃO pode apagar modal/evento real.
 */
export function decideTickForceUnlock({
  tickAttempts = 0,
  maxTickAttempts = 200,
  modalLocks = 0,
  opening = false,
  eventsInProgress = false,
  hasPendingTurnData = false,
} = {}) {
  if (tickAttempts <= maxTickAttempts) {
    return { forceUnlock: false, clearLocks: false, continueWaiting: false, reason: 'under-limit' }
  }

  const locks = Math.max(0, Number(modalLocks) || 0)
  const pipelineActive = locks > 0 || !!opening || !!eventsInProgress

  if (pipelineActive) {
    return {
      forceUnlock: false,
      clearLocks: false,
      continueWaiting: true,
      reason: 'pipeline-active',
    }
  }

  // Idle há tempo demais: libera só o turnLock; nunca zera locks de modal fantasma se pending ainda existe
  // (pending sem pipeline = tick deve handoff, não destruir estado).
  if (hasPendingTurnData) {
    return {
      forceUnlock: false,
      clearLocks: false,
      continueWaiting: true,
      reason: 'pending-handoff',
    }
  }

  return {
    forceUnlock: true,
    clearLocks: false,
    continueWaiting: false,
    reason: 'idle-timeout',
  }
}

/**
 * Handoff seguro: exige locks limpos E pipeline de eventos inativa.
 */
export function canSafelyHandoffTurn({
  modalLocks = 0,
  opening = false,
  eventsInProgress = false,
} = {}) {
  return (
    Math.max(0, Number(modalLocks) || 0) === 0 &&
    !opening &&
    !eventsInProgress
  )
}
