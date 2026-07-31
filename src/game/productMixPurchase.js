/**
 * Deltas e helpers educativos da compra de Mix de Produtos.
 * Não altera balanceamento: espelha exatamente o apply atual do engine.
 */

/**
 * Monta os deltas da compra de Mix exatamente como os quatro caminhos de modal já aplicavam.
 * mixOwned / reducedLevels ficam a cargo de applyDeltas via mixProdutosSet.
 */
export function buildMixPurchaseDeltas(res = {}) {
  const price = Number(
    res?.compra ??
    res?.price ??
    res?.cost ??
    0
  )

  const level = String(res?.level ?? 'D').toUpperCase()

  return {
    cashDelta: -price,
    bensDelta: price,
    mixProdutosSet: level,
    mixBaseSet: {
      despesaPorCliente: Number(
        res?.despesa ??
        res?.despesaPorCliente ??
        0
      ),
      faturamentoPorCliente: Number(
        res?.faturamento ??
        res?.faturamentoPorCliente ??
        0
      ),
    },
  }
}

/**
 * Estimativa de retorno com base exclusiva no impacto de previewPurchaseImpact
 * (diferença líquida nível atual → nível selecionado).
 */
export function calculateMixReturn({ impact, horizonRounds = 5 } = {}) {
  const incrementalNet = Number(impact?.difference?.monthlyNet ?? 0)
  const immediateCost = Number(impact?.immediateCost ?? 0)
  const horizon = Number(horizonRounds ?? 5)

  if (immediateCost <= 0) {
    return {
      immediateCost,
      incrementalNet,
      paybackRounds: 0,
      horizonRounds: horizon,
      paysBackWithinHorizon: true,
      status: 'no_cost',
    }
  }

  if (incrementalNet <= 0) {
    return {
      immediateCost,
      incrementalNet,
      paybackRounds: null,
      horizonRounds: horizon,
      paysBackWithinHorizon: false,
      status: 'no_financial_return',
    }
  }

  const paybackRounds = immediateCost / incrementalNet

  return {
    immediateCost,
    incrementalNet,
    paybackRounds,
    horizonRounds: horizon,
    paysBackWithinHorizon: paybackRounds <= horizon,
    status: paybackRounds <= horizon ? 'pays_back_within_horizon' : 'beyond_horizon',
  }
}
