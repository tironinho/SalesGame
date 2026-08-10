// Guard compartilhado entre auto-skip offline e auto-pass por timer.
// Impede double-skip do mesmo turnPlayerId|turnSeq.

import { turnAttemptKey } from './turnTimerLogic.js'

let lastSkipKey = null
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

export function markSharedSkipKey(turnPlayerId, turnSeq) {
  lastSkipKey = turnAttemptKey(turnPlayerId, turnSeq)
  return lastSkipKey
}

export function clearSharedSkipKeyIfStale(turnPlayerId, turnSeq) {
  const current = turnAttemptKey(turnPlayerId, turnSeq)
  if (lastSkipKey && lastSkipKey !== current) {
    // Turno já mudou — libera a chave antiga para o novo turno
    lastSkipKey = null
  }
}

export function wasAlreadySkipped(turnPlayerId, turnSeq) {
  return lastSkipKey != null && lastSkipKey === turnAttemptKey(turnPlayerId, turnSeq)
}

/** Testes / reset */
export function __resetSharedTurnSkipGuardForTests() {
  lastSkipKey = null
  inFlight = false
}
