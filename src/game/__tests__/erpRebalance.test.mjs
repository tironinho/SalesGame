/**
 * Testes do rebalanceamento ERP (node:test).
 * Executar: node --test src/game/__tests__/erpRebalance.test.mjs
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ERP_RULES, getErpPrice } from '../gameRules.js'
import {
  buildErpPurchaseDeltas,
  calculateErpReturn,
  countErpCollaborators,
  estimateErpPurchaseImpact,
  getErpLevelView,
} from '../erpPurchase.js'
import { applyDeltas, computeFaturamentoFor, computeDespesasFor } from '../gameMath.js'

const STARTER_CASH = 18000

const basePlayer = (overrides = {}) => ({
  cash: STARTER_CASH,
  clients: 1,
  vendedoresComuns: 1,
  insideSales: 0,
  fieldSales: 0,
  gestores: 0,
  mixProdutos: 'D',
  erpLevel: 'D',
  ...overrides,
})

/** Crédito recovery = 50% do preço centralizado (mesma regra do RecoveryModal). */
function erpRecoveryCredit(level) {
  return getErpPrice(level) / 2
}

describe('ERP_RULES preços centralizados', () => {
  it('hierarquia D < C < B < A e taxas preservadas', () => {
    assert.equal(ERP_RULES.D.price, 200)
    assert.equal(ERP_RULES.C.price, 400)
    assert.equal(ERP_RULES.B.price, 1200)
    assert.equal(ERP_RULES.A.price, 2500)
    assert.ok(ERP_RULES.D.price < ERP_RULES.C.price)
    assert.ok(ERP_RULES.C.price < ERP_RULES.B.price)
    assert.ok(ERP_RULES.B.price < ERP_RULES.A.price)
    assert.equal(ERP_RULES.A.fat, 1000)
    assert.equal(ERP_RULES.A.desp, 400)
    assert.equal(ERP_RULES.B.fat, 500)
    assert.equal(ERP_RULES.B.desp, 200)
    assert.equal(ERP_RULES.C.fat, 200)
    assert.equal(ERP_RULES.C.desp, 100)
    assert.equal(ERP_RULES.D.fat, 70)
    assert.equal(ERP_RULES.D.desp, 50)
  })

  it('getErpPrice / getErpLevelView leem a mesma fonte', () => {
    assert.equal(getErpPrice('D'), 200)
    assert.equal(getErpPrice('C'), 400)
    assert.equal(getErpLevelView('D').compra, 200)
    assert.equal(getErpLevelView('B').compra, 1200)
  })
})

describe('starter D sem cobrança', () => {
  it('jogador começa com erpLevel D e caixa inicial intacto', () => {
    const p = basePlayer()
    assert.equal(p.erpLevel, 'D')
    assert.equal(p.cash, STARTER_CASH)
    // apply starter-like deltas não deve debitar preço de D
    const next = applyDeltas(p, {})
    assert.equal(next.cash, STARTER_CASH)
    assert.equal(next.erpLevel, 'D')
  })
})

describe('recovery D deriva do preço centralizado', () => {
  it('crédito 50% de D = 100 (via getErpPrice, sem hardcode)', () => {
    assert.equal(erpRecoveryCredit('D'), ERP_RULES.D.price / 2)
    assert.equal(erpRecoveryCredit('D'), 100)
    assert.equal(erpRecoveryCredit('C'), 200)
    assert.equal(erpRecoveryCredit('B'), 600)
    assert.equal(erpRecoveryCredit('A'), 1250)
  })
})

describe('incrementais @1 colaborador (D → alvo)', () => {
  it('D→C = +80 líquido; payback = 5', () => {
    const est = estimateErpPurchaseImpact({
      player: basePlayer(),
      fromLevel: 'D',
      toLevel: 'C',
      horizonRounds: 5,
    })
    assert.equal(est.staffCount, 1)
    assert.equal(est.erpReturn.revenueDelta, 130)
    assert.equal(est.erpReturn.expensesDelta, 50)
    assert.equal(est.erpReturn.incrementalNet, 80)
    assert.equal(est.erpReturn.immediateCost, 400)
    assert.equal(est.erpReturn.paybackRounds, 5)
    assert.equal(est.deltas.cashDelta, -400)
  })

  it('D→B = +280 líquido; payback ≈ 4.2857', () => {
    const est = estimateErpPurchaseImpact({
      player: basePlayer(),
      fromLevel: 'D',
      toLevel: 'B',
    })
    assert.equal(est.erpReturn.incrementalNet, 280)
    assert.equal(est.erpReturn.immediateCost, 1200)
    assert.ok(Math.abs(est.erpReturn.paybackRounds - (1200 / 280)) < 1e-9)
  })

  it('D→A = +580 líquido; payback ≈ 4.3103', () => {
    const est = estimateErpPurchaseImpact({
      player: basePlayer(),
      fromLevel: 'D',
      toLevel: 'A',
    })
    assert.equal(est.erpReturn.incrementalNet, 580)
    assert.equal(est.erpReturn.immediateCost, 2500)
    assert.ok(Math.abs(est.erpReturn.paybackRounds - (2500 / 580)) < 1e-9)
  })
})

describe('escala com colaboradores, não com clientes', () => {
  it('5 colaboradores multiplicam o incremental ×5', () => {
    const est = estimateErpPurchaseImpact({
      player: basePlayer({ vendedoresComuns: 5 }),
      fromLevel: 'D',
      toLevel: 'C',
    })
    assert.equal(est.staffCount, 5)
    assert.equal(est.erpReturn.incrementalNet, 80 * 5)
    assert.equal(est.erpReturn.revenueDelta, 130 * 5)
    assert.equal(est.erpReturn.expensesDelta, 50 * 5)
  })

  it('alterar só clients não muda retorno ERP', () => {
    const a = estimateErpPurchaseImpact({
      player: basePlayer({ clients: 1 }),
      fromLevel: 'D',
      toLevel: 'C',
    })
    const b = estimateErpPurchaseImpact({
      player: basePlayer({ clients: 50 }),
      fromLevel: 'D',
      toLevel: 'C',
    })
    assert.equal(a.erpReturn.incrementalNet, b.erpReturn.incrementalNet)
    assert.equal(a.erpReturn.revenueDelta, b.erpReturn.revenueDelta)
    assert.equal(countErpCollaborators(basePlayer({ clients: 50 })), 1)
  })
})

describe('preview = motor (gameMath)', () => {
  it('deltas de fat/desp batem com compute*For', () => {
    const p0 = basePlayer({ erpLevel: 'D' })
    const p1 = { ...p0, erpLevel: 'C' }
    const dFat = computeFaturamentoFor(p1) - computeFaturamentoFor(p0)
    const dDesp = computeDespesasFor(p1) - computeDespesasFor(p0)
    const est = estimateErpPurchaseImpact({
      player: p0,
      fromLevel: 'D',
      toLevel: 'C',
    })
    assert.equal(est.erpReturn.revenueDelta, dFat)
    assert.equal(est.erpReturn.expensesDelta, dDesp)
    assert.equal(est.erpReturn.incrementalNet, dFat - dDesp)
  })
})

describe('upgrade preço cheio', () => {
  it('C→B cobra preço cheio de B (1200), não diferença', () => {
    const deltas = buildErpPurchaseDeltas({
      level: 'B',
      values: getErpLevelView('B'),
    })
    assert.equal(deltas.cashDelta, -1200)
    assert.equal(deltas.erpLevelSet, 'B')
  })

  it('compra D usa preço centralizado 200', () => {
    const deltas = buildErpPurchaseDeltas({ level: 'D' })
    assert.equal(deltas.cashDelta, -200)
  })

  it('buildErpPurchaseDeltas sem values usa ERP_RULES', () => {
    const deltas = buildErpPurchaseDeltas({ level: 'A' })
    assert.equal(deltas.cashDelta, -2500)
  })
})

describe('calculateErpReturn só com ganho > 0', () => {
  it('ganho ≤ 0 → sem payback numérico', () => {
    const r = calculateErpReturn({
      impact: {
        immediateCost: 400,
        difference: { monthlyNet: 0, revenue: 0, expenses: 0 },
      },
    })
    assert.equal(r.paybackRounds, null)
    assert.equal(r.status, 'no_financial_return')
  })
})
