/**
 * Preview educativo da compra de treinamentos/certificações.
 * Usa exatamente applyTrainingPurchase (mesma função do engine).
 * Nunca muta o jogador original; nunca usa applyDeltas.
 */
import {
  applyTrainingPurchase,
  capacityAndAttendance,
  computeDespesasFor,
  computeFaturamentoFor,
} from './gameMath'

/**
 * Cópia explícita das estruturas que applyTrainingPurchase lê/escreve:
 * cash, bens, onboarding, az/am/rox, trainingsByVendor (arrays por tipo), trainings.
 */
export function clonePlayerForTrainingPreview(player = {}) {
  const src = player || {}
  const tbvSrc = src.trainingsByVendor || {}
  const trainingsByVendor = {}

  for (const [key, value] of Object.entries(tbvSrc)) {
    if (Array.isArray(value)) {
      trainingsByVendor[key] = [...value]
    } else if (value instanceof Set) {
      trainingsByVendor[key] = Array.from(value)
    } else if (value == null) {
      trainingsByVendor[key] = []
    } else {
      trainingsByVendor[key] = value
    }
  }

  return {
    ...src,
    cash: Number(src.cash || 0),
    bens: Number(src.bens || 0),
    az: Number(src.az || 0),
    am: Number(src.am || 0),
    rox: Number(src.rox || 0),
    onboarding: !!src.onboarding,
    trainingsByVendor,
    trainings: Array.isArray(src.trainings) ? [...src.trainings] : [],
  }
}

function snapshotMetrics(player = {}) {
  const cash = Number(player?.cash || 0)
  const bens = Number(player?.bens || 0)
  const { cap, inAtt } = capacityAndAttendance(player)

  return {
    cash,
    revenue: computeFaturamentoFor(player),
    expenses: computeDespesasFor(player),
    capacity: Number(cap || 0),
    attendance: Number(inAtt || 0),
    patrimonio: cash + bens,
  }
}

/**
 * Preview puro: aplica applyTrainingPurchase em cópia descartável.
 */
export function previewTrainingPurchaseImpact({ player, payload } = {}) {
  const currentPlayer = player || {}
  const safePayload = payload || {}
  const immediateCost = Number(safePayload.grandTotal || 0)

  const current = snapshotMetrics(currentPlayer)
  const playerCopy = clonePlayerForTrainingPreview(currentPlayer)
  const afterPlayer = applyTrainingPurchase(playerCopy, safePayload)
  const after = snapshotMetrics(afterPlayer)

  const revenueDiff = after.revenue - current.revenue
  const expensesDiff = after.expenses - current.expenses

  return {
    immediateCost,
    current,
    after,
    difference: {
      cash: after.cash - current.cash,
      revenue: revenueDiff,
      expenses: expensesDiff,
      capacity: after.capacity - current.capacity,
      attendance: after.attendance - current.attendance,
      patrimonio: after.patrimonio - current.patrimonio,
      monthlyNet: revenueDiff - expensesDiff,
    },
  }
}
