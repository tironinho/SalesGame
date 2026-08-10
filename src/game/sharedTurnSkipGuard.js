// Guard compartilhado entre auto-skip offline e auto-pass por timer.
// Impede double-skip do mesmo turnPlayerId|turnSeq.
//
// pending  = tentativa local iniciada (bloqueia double-fire no cliente)
// confirmed = CAS/remoto aplicado (bloqueia nova tentativa do mesmo turno)
// CAS fail  → release (libera para nova tentativa)

import { turnAttemptKey } from './turnTimerLogic.js'

let lastSkipKey = null
let pendingSkipKey = null
let inFlight = false

export function getSharedSkipInFlight() {
  return inFlight
}

export function setSharedSkipInFlight(value) {
  inFlight = !!value
}

export function getLastSharedSkipKey() {
  return lastSkipKey
}

export function getPendingSharedSkipKey() {
  return pendingSkipKey
}

/** Tentativa local — ainda não confirmada pelo CAS remoto. */
export function markPendingSharedSkipKey(turnPlayerId, turnSeq) {
  pendingSkipKey = turnAttemptKey(turnPlayerId, turnSeq)
  return pendingSkipKey
}

/**
 * CAS/remoto confirmado. Preferir sobre markSharedSkipKey em código novo.
 * Mantém markSharedSkipKey como alias de confirmação (testes legados).
 */
export function confirmSharedSkipKey(turnPlayerId, turnSeq) {
  const key = turnAttemptKey(turnPlayerId, turnSeq)
  lastSkipKey = key
  if (pendingSkipKey === key) pendingSkipKey = null
  return lastSkipKey
}

/** @deprecated use confirmSharedSkipKey — alias para confirmação explícita */
export function markSharedSkipKey(turnPlayerId, turnSeq) {
  return confirmSharedSkipKey(turnPlayerId, turnSeq)
}

/** CAS falhou / stale / conflict — libera pending e confirmed daquela chave. */
export function releaseSharedSkipKey(turnPlayerId, turnSeq) {
  const key = turnAttemptKey(turnPlayerId, turnSeq)
  if (pendingSkipKey === key) pendingSkipKey = null
  if (lastSkipKey === key) lastSkipKey = null
}

export function clearSharedSkipKeyIfStale(turnPlayerId, turnSeq) {
  const current = turnAttemptKey(turnPlayerId, turnSeq)
  if (lastSkipKey && lastSkipKey !== current) {
    lastSkipKey = null
  }
  if (pendingSkipKey && pendingSkipKey !== current) {
    // Turno mudou de verdade — pending antigo não deve bloquear o novo
    pendingSkipKey = null
  }
}

export function wasAlreadySkipped(turnPlayerId, turnSeq) {
  const key = turnAttemptKey(turnPlayerId, turnSeq)
  if (lastSkipKey != null && lastSkipKey === key) return true
  if (pendingSkipKey != null && pendingSkipKey === key) return true
  return false
}

/** Testes / reset */
export function __resetSharedTurnSkipGuardForTests() {
  lastSkipKey = null
  pendingSkipKey = null
  inFlight = false
}
