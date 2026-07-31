export const MIN_ROUNDS = 1
export const MAX_ROUNDS_LIMIT = 5
export const DEFAULT_MAX_ROUNDS = 5

/**
 * Normaliza a duração da partida para um inteiro em [MIN_ROUNDS, MAX_ROUNDS_LIMIT].
 * Valores ausentes/inválidos/fora do intervalo caem no fallback (padrão 5).
 */
export function normalizeMaxRounds(value, fallback = DEFAULT_MAX_ROUNDS) {
  const parsed = Math.trunc(Number(value))

  if (
    !Number.isFinite(parsed) ||
    parsed < MIN_ROUNDS ||
    parsed > MAX_ROUNDS_LIMIT
  ) {
    return fallback
  }

  return parsed
}
