/**
 * Monta os deltas da contratação de Inside Sales
 * exatamente como o useTurnEngine já aplicava nos 4 caminhos.
 *
 * Fonte: payload do InsideSalesModal → applyDeltas
 * Campos aplicados: cashDelta, insideSalesDelta
 * (sem manutencaoDelta / revenueDelta — o motor atual não os aplica)
 */
export function buildInsideSalesPurchaseDeltas(res = {}) {
  const cost = Number(
    res.totalCost ??
    res.totalHire ??
    res.total ??
    res.cost ??
    0
  )

  const cashDelta =
    typeof res.cashDelta !== 'undefined'
      ? Number(res.cashDelta)
      : -cost

  const qty = Number(
    res.headcount ??
    res.qty ??
    res.insideSalesQty ??
    0
  )

  return {
    cashDelta,
    insideSalesDelta: qty,
  }
}
