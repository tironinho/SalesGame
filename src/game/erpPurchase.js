/**
 * Deltas e helpers educativos da compra de ERP/Sistemas.
 * Não altera balanceamento: espelha exatamente o apply atual do engine.
 */

/**
 * Conta colaboradores usados pelo ERP (mesmo conjunto de computeFaturamentoFor).
 * Não inclui clientes nem certificações.
 */
export function countErpCollaborators(player = {}) {
  const num = (v) => Number(v || 0)
  const qComum = num(player.vendedoresComuns)
  const qInside = num(player.insideSales)
  const qField = num(player.fieldSales)
  const qGestor = num(player.gestores ?? player.gestoresComerciais ?? player.managers)
  return qComum + qInside + qField + qGestor
}

/**
 * Monta os deltas da compra de ERP exatamente como os quatro caminhos de modal já aplicavam.
 * erpOwned / reducedLevels ficam a cargo de applyDeltas via erpLevelSet.
 */
export function buildErpPurchaseDeltas(res = {}) {
  const price = Number(
    res?.values?.compra ??
    res?.price ??
    res?.cost ??
    0
  )

  return {
    cashDelta: -price,
    erpLevelSet: res?.level,
  }
}

/**
 * Estimativa de retorno com base exclusiva no impacto de previewPurchaseImpact
 * (diferença líquida nível atual → nível selecionado).
 */
export function calculateErpReturn({ impact, horizonRounds = 5 } = {}) {
  const incrementalNet = Number(impact?.difference?.monthlyNet ?? 0)
  const immediateCost = Number(impact?.immediateCost ?? 0)
  const horizon = Number(horizonRounds ?? 5)

  if (immediateCost <= 0) {
    return {
      incrementalNet,
      immediateCost,
      paybackRounds: 0,
      horizonRounds: horizon,
      paysBackWithinHorizon: true,
      status: 'no_cost',
    }
  }

  if (incrementalNet <= 0) {
    return {
      incrementalNet,
      immediateCost,
      paybackRounds: null,
      horizonRounds: horizon,
      paysBackWithinHorizon: false,
      status: 'no_financial_return',
    }
  }

  const paybackRounds = immediateCost / incrementalNet

  return {
    incrementalNet,
    immediateCost,
    paybackRounds,
    horizonRounds: horizon,
    paysBackWithinHorizon: paybackRounds <= horizon,
    status: paybackRounds <= horizon ? 'pays_back_within_horizon' : 'beyond_horizon',
  }
}
