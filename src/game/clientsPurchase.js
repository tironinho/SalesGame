/**
 * Monta os deltas da compra de clientes exatamente como o engine já aplicava.
 * Fonte: payload do BuyClientsModal → applyDeltas.
 */
export function buildClientsPurchaseDeltas(res = {}) {
  const cost = Number(res.totalCost || 0)
  const qty = Number(res.qty || 0)
  const mAdd = Number(res.maintenanceDelta || 0)
  const bensD = Number(res.bensDelta || cost)

  return {
    cashDelta: -cost,
    clientsDelta: qty,
    manutencaoDelta: mAdd,
    bensDelta: bensD,
  }
}
