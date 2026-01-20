// src/game/domain/movement.js
// ETAPA 1 — DOMAIN (puro)
// Matemática de movimento do peão (sem side-effects).

export function computeMove({ pos, steps, trackLen }) {
  const len = Number(trackLen)
  const p = Number(pos)
  const s = Number(steps)

  const safeLen = Number.isFinite(len) && len > 0 ? len : 1
  const safePos = Number.isFinite(p) ? p : 0
  const safeSteps = Number.isFinite(s) ? s : 0

  const raw = safePos + safeSteps
  const lapCount = raw >= 0 ? Math.floor(raw / safeLen) : 0
  const newPos = ((raw % safeLen) + safeLen) % safeLen
  const crossedStart = lapCount > 0

  return { newPos, crossedStart, lapCount }
}

