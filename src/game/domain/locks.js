// src/game/domain/locks.js
// ETAPA 1 — DOMAIN (puro)
// Funções puras para decidir se uma ação pode acontecer e para modelar locks.
//
// IMPORTANTE:
// - Não chama commit/broadcast.
// - Não muda schema persistido: o "lockOwner" é um conceito local (pode existir só em memória).

export function isLockedByOther(state, myUid) {
  const lockOwner = state?.lockOwner ?? null
  const turnLock = !!state?.turnLock
  if (!turnLock) return false
  if (!lockOwner) return false
  return String(lockOwner) !== String(myUid)
}

export function canAct(state, myUid) {
  // Conservador: exige que seja o jogador da vez e que o lock não esteja com outro.
  const turnPlayerId = state?.turnPlayerId ?? null
  if (!turnPlayerId) return false
  if (String(turnPlayerId) !== String(myUid)) return false
  if (isLockedByOther(state, myUid)) return false
  return true
}

export function acquireTurnLock(state, myUid) {
  // Não decide "se pode"; só aplica lock de forma pura.
  return {
    ...state,
    turnLock: true,
    lockOwner: String(myUid),
  }
}

export function releaseTurnLock(state, myUid) {
  const lockOwner = state?.lockOwner ?? null
  if (lockOwner && String(lockOwner) !== String(myUid)) {
    // Outro dono: mantém como está (conservador).
    return state
  }
  return {
    ...state,
    turnLock: false,
    lockOwner: null,
  }
}

