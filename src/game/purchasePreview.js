import {
  applyDeltas,
  capacityAndAttendance,
  computeDespesasFor,
  computeFaturamentoFor,
} from './gameMath'

function snapshotMetrics(player = {}) {
  const cash = Number(player?.cash || 0)
  const bens = Number(player?.bens || 0)
  const { cap } = capacityAndAttendance(player)

  return {
    cash,
    revenue: computeFaturamentoFor(player),
    expenses: computeDespesasFor(player),
    capacity: Number(cap || 0),
    patrimonio: cash + bens,
  }
}

/**
 * Preview puro de impacto de compra.
 * Nunca grava estado: aplica deltas em objeto temporário descartável.
 */
export function previewPurchaseImpact({ player, deltas, immediateCost } = {}) {
  const currentPlayer = player || {}
  const safeDeltas = deltas || {}
  const cost = Number(immediateCost || 0)

  const current = snapshotMetrics(currentPlayer)
  const afterPlayer = applyDeltas(currentPlayer, safeDeltas)
  const after = snapshotMetrics(afterPlayer)

  const revenueDiff = after.revenue - current.revenue
  const expensesDiff = after.expenses - current.expenses

  return {
    immediateCost: cost,
    current,
    after,
    difference: {
      cash: after.cash - current.cash,
      revenue: revenueDiff,
      expenses: expensesDiff,
      capacity: after.capacity - current.capacity,
      patrimonio: after.patrimonio - current.patrimonio,
      // Impacto mensal estimado: NÃO inclui o custo imediato (já refletido no caixa via applyDeltas).
      monthlyNet: revenueDiff - expensesDiff,
    },
  }
}
