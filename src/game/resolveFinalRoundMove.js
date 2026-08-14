/**
 * Resolve movimento + estacionamento na rodada final ao cruzar a casa 0 (Faturamento).
 * Puro / testável — usado por useTurnEngine.
 */

import { crossedTile } from './gameMath.js'

export { crossedTile }

/**
 * @param {object} args
 * @param {number} args.oldPos
 * @param {number} args.steps
 * @param {number} args.trackLen
 * @param {number} args.roundNow
 * @param {number} args.maxRounds
 * @param {number} args.aliveCount
 * @param {boolean} [args.prevWaitingAtRevenue]
 * @param {number} [args.prevLastRevenueRound]
 */
export function resolveFinalRoundMove({
  oldPos,
  steps,
  trackLen,
  roundNow,
  maxRounds,
  aliveCount,
  prevWaitingAtRevenue = false,
  prevLastRevenueRound = 0,
}) {
  const len = Math.max(1, Number(trackLen) || 1)
  const from = ((Math.trunc(Number(oldPos)) % len) + len) % len
  const nSteps = Math.max(0, Math.trunc(Number(steps)) || 0)
  const mathPos = (from + nSteps) % len
  const lap = mathPos < from
  const crossedStart = crossedTile(from, mathPos, 0) || lap

  const round = Number(roundNow) || 1
  const maxR = Number(maxRounds) || 1
  const alive = Math.max(0, Number(aliveCount) || 0)
  const prevWait = prevWaitingAtRevenue === true
  const prevRev = Number(prevLastRevenueRound) || 0

  let waitingAtRevenue = round === maxR ? prevWait : false
  let finalPos = waitingAtRevenue ? 0 : mathPos
  let lastRevenueRound = prevRev

  if (crossedStart) {
    lastRevenueRound = Math.max(prevRev, round)
    // Rodada final + 2+ vivos: estaciona na casa 0 (não continua além do faturamento)
    if (round === maxR && alive > 1) {
      waitingAtRevenue = true
      finalPos = 0
    }
  }

  const stopAtRevenue = waitingAtRevenue === true && crossedStart && finalPos === 0

  return {
    mathPos,
    finalPos,
    /** Posição efetiva para eventos da casa (pouso). */
    landPos: finalPos,
    crossedStart,
    lap,
    waitingAtRevenue,
    lastRevenueRound,
    /** Se true, não processar compra/sorte da casa além do 0 — só passagem/faturamento. */
    stopAtRevenue,
    processLandTile: !stopAtRevenue,
  }
}
