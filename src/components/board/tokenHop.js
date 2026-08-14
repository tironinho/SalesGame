/**
 * Planejamento visual do peão: exatamente as casas do dado (1–6), nunca mais.
 * Distância maior = sync/stale → snap (sem animar a volta do anel).
 */

export const TOKEN_HOP_STEP_MS = 320
/** Máximo do dado — a animação nunca ultrapassa isso. */
export const TOKEN_HOP_MAX_STEPS = 6

export function normalizeBoardPos(value, trackLen) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  const len = Math.max(1, Number(trackLen) || 1)
  return ((Math.trunc(number) % len) + len) % len
}

export function forwardBoardDistance(from, to, trackLen) {
  const len = Math.max(1, Number(trackLen) || 1)
  const a = normalizeBoardPos(from, len)
  const b = normalizeBoardPos(to, len)
  return (b - a + len) % len
}

/**
 * @returns {{ mode: 'snap', target: number } | { mode: 'hop', path: number[], target: number }}
 */
export function planTokenHop(from, to, trackLen, maxSteps = TOKEN_HOP_MAX_STEPS) {
  const len = Math.max(1, Number(trackLen) || 1)
  const cap = Math.max(1, Math.min(6, Number(maxSteps) || TOKEN_HOP_MAX_STEPS))
  const start = normalizeBoardPos(from, len)
  const target = normalizeBoardPos(to, len)
  const distance = forwardBoardDistance(start, target, len)

  if (distance === 0 || distance > cap) {
    return { mode: 'snap', target }
  }

  const path = []
  let cursor = start
  for (let i = 0; i < distance; i += 1) {
    cursor = (cursor + 1) % len
    path.push(cursor)
  }

  // Cinto de segurança: nunca mais que o máximo do dado.
  if (path.length > cap) {
    return { mode: 'snap', target }
  }

  return { mode: 'hop', path, target }
}
