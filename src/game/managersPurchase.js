/**
 * Monta os deltas da contratação de Gestor Comercial
 * exatamente como o useTurnEngine já aplicava nos 4 caminhos.
 *
 * Fonte: payload do BuyManagerModal → applyDeltas
 * Campos aplicados: cashDelta, gestoresDelta, manutencaoDelta
 */
export function buildManagerPurchaseDeltas(res = {}) {
  const qty = Number(res.headcount ?? res.qty ?? res.managersQty ?? 1)
  const cashDelta = Number(
    typeof res.cashDelta !== 'undefined'
      ? res.cashDelta
      : -(Number(res.cost ?? res.total ?? res.totalHire ?? 0))
  )
  const manutencaoDelta = Number(
    res.expenseDelta ?? res.totalExpense ?? res.maintenanceDelta ?? 0
  )

  return {
    cashDelta,
    gestoresDelta: qty,
    manutencaoDelta,
  }
}
