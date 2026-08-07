// Avanço de turno por ausência — reutiliza a mesma regra de “próximo vivo”
// do motor normal, sem movimento/dado/eventos/rodada por casa.

import { findNextAliveIdx } from './gameMath.js'

/**
 * Planeja um auto-skip seguro do jogador da vez (offline).
 * - NÃO altera players (cash/pos/bens/etc.)
 * - Incrementa turnSeq exatamente +1 (como o tick normal)
 *
 * Rodada: no motor normal, round NÃO sobe no wrap C→A do roster.
 * Sobe só quando o jogador que Joga cruza a casa 0 e
 * todos os vivos têm lastRevenueRound >= round atual
 * (advanceAndMaybeLap → allAliveDone). Skip sem movimento
 * portanto mantém a mesma rodada — espelha o fim de turno
 * sem cruzar faturamento.
 */
export function planOfflineTurnSkip({
  players,
  turnPlayerId,
  turnSeq,
  round,
  maxRounds,
} = {}) {
  const list = Array.isArray(players) ? players : []
  const curId = turnPlayerId != null ? String(turnPlayerId) : ''
  if (!curId || list.length === 0) return null

  const curIdx = list.findIndex((p) => String(p?.id) === curId)
  if (curIdx < 0) return null

  let nextTurnIdx = findNextAliveIdx(list, curIdx)

  // Mesma regra do advanceAndMaybeLap na rodada final: pula waitingAtRevenue
  const maxR = Number(maxRounds) || 0
  if (maxR > 0 && Number(round) === maxR) {
    let guard = 0
    while (guard < list.length) {
      const p = list[nextTurnIdx]
      if (p && !p.bankrupt && p.waitingAtRevenue !== true) break
      nextTurnIdx = (nextTurnIdx + 1) % list.length
      guard++
    }
  }

  const nextPlayer = list[nextTurnIdx]
  const nextTurnPlayerId =
    nextPlayer?.id != null ? String(nextPlayer.id) : null
  if (!nextTurnPlayerId || nextTurnPlayerId === curId) return null

  const baseTurnSeq = Number(turnSeq) || 0
  return {
    fromTurnPlayerId: curId,
    fromTurnSeq: baseTurnSeq,
    nextTurnIdx,
    nextTurnPlayerId,
    nextTurnSeq: baseTurnSeq + 1,
    nextRound: Number(round) || 1,
  }
}
