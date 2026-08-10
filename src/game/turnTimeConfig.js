export const MIN_TURN_TIME_SEC = 60
export const DEFAULT_TURN_TIME_SEC = 90
export const MAX_TURN_TIME_SEC = 180
export const TURN_TIME_PRESETS = Object.freeze([60, 90, 120, 180])

/**
 * Normaliza o tempo por jogada para um inteiro em [MIN, MAX].
 * Ausente/inválido/fora do intervalo → fallback (padrão 90).
 */
export function normalizeTurnTime(value, fallback = DEFAULT_TURN_TIME_SEC) {
  const parsed = Math.trunc(Number(value))
  const safeFallback = Math.trunc(Number(fallback))
  const resolvedFallback =
    Number.isFinite(safeFallback) &&
    safeFallback >= MIN_TURN_TIME_SEC &&
    safeFallback <= MAX_TURN_TIME_SEC
      ? safeFallback
      : DEFAULT_TURN_TIME_SEC

  if (
    !Number.isFinite(parsed) ||
    parsed < MIN_TURN_TIME_SEC ||
    parsed > MAX_TURN_TIME_SEC
  ) {
    return resolvedFallback
  }

  return parsed
}

/** Extrai turnTimeSec de rooms.state (partidas antigas sem campo → 90). */
export function resolveTurnTimeSecFromState(state, fallback = DEFAULT_TURN_TIME_SEC) {
  if (!state || typeof state !== 'object') {
    return normalizeTurnTime(undefined, fallback)
  }
  if (!Object.prototype.hasOwnProperty.call(state, 'turnTimeSec')) {
    return normalizeTurnTime(undefined, fallback)
  }
  return normalizeTurnTime(state.turnTimeSec, fallback)
}
