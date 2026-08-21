/**
 * Gate de locks de modal (puro) — evita deadlock pós-Recuperação Financeira.
 *
 * modalLocksRef é a fonte autoritativa de “modal ativa”.
 * openingModalRef significa apenas “modal sendo aberta” (não “modal aberta”).
 * Portanto locks>0 && opening===false é o estado NORMAL enquanto o usuário interage.
 */

export const MODAL_LOCK_POLL_MS = 30
/** Só diagnóstico: NÃO zera lock nem libera pipeline. */
export const MODAL_LOCK_DIAGNOSTIC_MS = 10000

/** Incremento seguro (nunca NaN). */
export function bumpModalLockCount(current = 0) {
  return Math.max(0, Number(current) || 0) + 1
}

/** Decremento seguro (piso 0). */
export function releaseModalLockCount(current = 0) {
  return Math.max(0, (Number(current) || 0) - 1)
}

/**
 * Simula open → close de uma modal (lifecycle correto do contador).
 * Retorna o histórico de contagem: deve ser 0 → 1 → 0 (ou sequências empilhadas).
 */
export function simulateModalLockLifecycle(steps = ['open', 'close']) {
  let locks = 0
  const history = [0]
  for (const step of steps) {
    if (step === 'open') locks = bumpModalLockCount(locks)
    else if (step === 'close') locks = releaseModalLockCount(locks)
    history.push(locks)
  }
  return { locks, history }
}

/**
 * Decisão de waitForLocksClear a cada poll.
 *
 * NUNCA reconcilia/zera locks por tempo.
 * locks>0 && opening===false = modal real aguardando usuário (não é stale).
 */
export function decideModalLockClearWait({
  locks = 0,
  opening = false,
  elapsedMs = 0,
  diagnosticMs = MODAL_LOCK_DIAGNOSTIC_MS,
} = {}) {
  const lockCount = Math.max(0, Number(locks) || 0)
  const isOpening = !!opening
  const elapsed = Math.max(0, Number(elapsedMs) || 0)
  const diagAfter = Math.max(0, Number(diagnosticMs) || 0)

  if (lockCount === 0 && !isOpening) {
    return {
      clear: true,
      reconcile: false,
      shouldLog: false,
      reason: 'clear',
    }
  }

  if (diagAfter > 0 && elapsed >= diagAfter) {
    return {
      clear: false,
      reconcile: false,
      shouldLog: true,
      reason: 'diagnostic-wait',
    }
  }

  return {
    clear: false,
    reconcile: false,
    shouldLog: false,
    reason: isOpening ? 'opening' : 'modal-active',
  }
}

/**
 * Pipeline pós-recovery com lifecycle correto:
 * a modal libera o lock (0) → waitForLocksClear resolve → eventsInProgress pode ir a false.
 *
 * NÃO depende de lock “stale” artificialmente zerado por timeout.
 */
export function simulatePostRecoveryPipeline({
  /** Contagem após o finally correto da última modal (deve ser 0 no happy path). */
  locksAfterRecovery = 0,
  opening = false,
  pollMs = MODAL_LOCK_POLL_MS,
  diagnosticMs = MODAL_LOCK_DIAGNOSTIC_MS,
  maxPolls = 50,
} = {}) {
  let locks = Math.max(0, Number(locksAfterRecovery) || 0)
  let isOpening = !!opening
  let elapsed = 0
  let eventsInProgress = true
  let diagnosticLogs = 0
  const steps = []

  for (let i = 0; i < maxPolls; i++) {
    const decision = decideModalLockClearWait({
      locks,
      opening: isOpening,
      elapsedMs: elapsed,
      diagnosticMs,
    })
    steps.push({ elapsed, locks, opening: isOpening, decision })

    if (decision.shouldLog) diagnosticLogs += 1

    // Invariante: nunca reconciliar por tempo
    if (decision.reconcile) {
      return {
        eventsInProgress: true,
        locks,
        opening: isOpening,
        diagnosticLogs,
        elapsed,
        steps,
        pipelineReleased: false,
        error: 'unexpected-reconcile',
      }
    }

    if (decision.clear) {
      eventsInProgress = false
      break
    }

    elapsed += pollMs
  }

  return {
    eventsInProgress,
    locks,
    opening: isOpening,
    diagnosticLogs,
    elapsed,
    steps,
    pipelineReleased: eventsInProgress === false && locks === 0 && !isOpening,
  }
}

/**
 * Invariantes após última modal da recuperação / fila.
 */
export function recoveryFlowLockInvariants({
  modalLocks = 0,
  openingModal = false,
  eventsInProgress = false,
} = {}) {
  return {
    locksClear: Math.max(0, Number(modalLocks) || 0) === 0,
    notOpening: !openingModal,
    queueIdle: !eventsInProgress,
    ok:
      Math.max(0, Number(modalLocks) || 0) === 0 &&
      !openingModal &&
      !eventsInProgress,
  }
}
