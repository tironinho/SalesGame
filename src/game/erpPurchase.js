/**
 * Deltas e helpers educativos da compra de ERP/Sistemas.
 * Fonte de preços/taxas: gameRules.ERP_RULES (única).
 */

import { ERP_RULES, getErpPrice } from './gameRules.js'
import { previewPurchaseImpact } from './purchasePreview.js'

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

/** Metadados de UI + regra financeira de um nível (fonte: ERP_RULES). */
export function getErpLevelView(level) {
  const L = String(level || '').toUpperCase()
  const rule = ERP_RULES[L]
  if (!rule) return null
  return {
    level: L,
    compra: Number(rule.price || 0),
    price: Number(rule.price || 0),
    despesa: Number(rule.desp || 0),
    faturamento: Number(rule.fat || 0),
    fat: Number(rule.fat || 0),
    desp: Number(rule.desp || 0),
  }
}

/**
 * Monta os deltas da compra de ERP exatamente como o engine aplica.
 * Preço: payload da modal, senão ERP_RULES (fonte única).
 */
export function buildErpPurchaseDeltas(res = {}) {
  const level = res?.level != null ? String(res.level).toUpperCase() : null
  const priceFromRules = level ? getErpPrice(level) : 0
  const price = Number(
    res?.values?.compra ??
    res?.values?.price ??
    res?.price ??
    res?.cost ??
    priceFromRules ??
    0
  )

  return {
    cashDelta: -price,
    erpLevelSet: res?.level,
  }
}

/**
 * Estimativa de retorno com base exclusiva no impacto de previewPurchaseImpact
 * (diferença líquida nível atual → nível selecionado via gameMath).
 */
export function calculateErpReturn({
  impact,
  horizonRounds = 5,
  staffCount = null,
} = {}) {
  const incrementalNet = Number(impact?.difference?.monthlyNet ?? 0)
  const revenueDelta = Number(impact?.difference?.revenue ?? 0)
  const expensesDelta = Number(impact?.difference?.expenses ?? 0)
  const immediateCost = Number(impact?.immediateCost ?? 0)
  const horizon = Number(horizonRounds ?? 5)
  const staff = staffCount == null ? null : Math.max(0, Number(staffCount) || 0)

  if (immediateCost <= 0) {
    return {
      staffCount: staff,
      revenueDelta,
      expensesDelta,
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
      staffCount: staff,
      revenueDelta,
      expensesDelta,
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
    staffCount: staff,
    revenueDelta,
    expensesDelta,
    incrementalNet,
    immediateCost,
    paybackRounds,
    horizonRounds: horizon,
    paysBackWithinHorizon: paybackRounds <= horizon,
    status: paybackRounds <= horizon ? 'pays_back_within_horizon' : 'beyond_horizon',
  }
}

/**
 * Preview completo D→alvo (ou atual→alvo) usando o mesmo caminho do motor.
 */
export function estimateErpPurchaseImpact({
  player,
  fromLevel,
  toLevel,
  horizonRounds = 5,
} = {}) {
  const current = String(fromLevel || player?.erpLevel || 'D').toUpperCase()
  const desired = String(toLevel || '').toUpperCase()
  const values = getErpLevelView(desired)
  if (!values || !['A', 'B', 'C', 'D'].includes(desired)) return null

  const playerSnapshot = {
    ...(player || {}),
    erpLevel: current,
  }
  const payload = { action: 'BUY', level: desired, values }
  const deltas = buildErpPurchaseDeltas(payload)
  const impact = previewPurchaseImpact({
    player: playerSnapshot,
    deltas,
    immediateCost: values.compra,
  })
  const staffCount = countErpCollaborators(playerSnapshot)
  const erpReturn = calculateErpReturn({
    impact,
    horizonRounds,
    staffCount,
  })

  return { values, deltas, impact, erpReturn, staffCount, fromLevel: current, toLevel: desired }
}
