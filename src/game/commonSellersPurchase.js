/**
 * Monta os deltas da contratação de Vendedor Comum
 * exatamente como o useTurnEngine já aplicava nos 4 caminhos.
 *
 * Fonte: payload do BuyCommonSellersModal → applyDeltas
 * Campos aplicados: cashDelta, vendedoresComunsDelta, manutencaoDelta, revenueDelta
 */
export function buildCommonSellersPurchaseDeltas(res = {}) {
  const cost = Number(
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
    0
  )

  const manutencaoDelta = Number(
    res.expenseDelta ??
    res.totalExpense ??
    res.maintenanceDelta ??
    0
  )

  const revenueDelta = Number(
    res.revenueDelta ??
    0
  )

  return {
    cashDelta,
    vendedoresComunsDelta: qty,
    manutencaoDelta,
    revenueDelta,
  }
}
