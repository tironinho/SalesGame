/**
 * Empréstimo + crédito de demissão (fonte única usada pelo motor e pelos testes).
 *
 * Manual:
 * - 1 empréstimo por partida
 * - teto/garantia = 50% do valor de compra dos bens
 * - quita na casa Despesas Operacionais da próxima rodada (principal + 50% de juros)
 * - sem caixa: patrimônio a 50% do valor de compra; se não bastar, falência
 *
 * Take → dueRound = rodada+1 → arm no REVENUE do jogador e/ou rodada global
 * → charge no EXPENSES → bloqueia 2ª.
 */
import { MANUAL_CONSTANTS } from './manualConstants.js'
import { VENDOR_RULES } from './gameRules.js'

export function makeLoanId(ownerId) {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `loan:${ownerId}:${crypto.randomUUID()}`
    }
  } catch {}
  return `loan:${ownerId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`
}

export function canTakeLoan(player = {}) {
  const lp = player.loanPending || null
  if (player.loanTakenInMatch) return false
  if (lp && Number(lp.amount) > 0 && lp.charged !== true) return false
  return true
}

export function loanDueRound(declaredAtRound) {
  const declared = Math.max(0, Math.floor(Number(declaredAtRound) || 0))
  return declared > 0 ? declared + 1 : 0
}

export function createLoanPending(amount, declaredAtRound) {
  const declared = Math.max(0, Math.floor(Number(declaredAtRound) || 0))
  return {
    amount: Math.max(0, Math.floor(Number(amount) || 0)),
    charged: false,
    waitingFullLap: true,
    eligibleOnExpenses: false,
    declaredAtRound: declared,
    dueRound: loanDueRound(declared),
  }
}

/** Limita o empréstimo a floor(bens × loanMaxBensRatio). */
export function clampLoanAmount(amount, bens) {
  const cap = Math.max(
    0,
    Math.floor(Number(bens || 0) * MANUAL_CONSTANTS.loanMaxBensRatio),
  )
  return Math.max(0, Math.min(Math.floor(Number(amount) || 0), cap))
}

export function applyLoanTake(player, amount, declaredAtRound) {
  if (!canTakeLoan(player)) {
    return { ok: false, player, reason: 'already-used' }
  }
  const amt = clampLoanAmount(amount, player.bens)
  if (!amt) return { ok: false, player, reason: 'zero-amount' }
  return {
    ok: true,
    player: {
      ...player,
      cash: (Number(player.cash) || 0) + amt,
      loanTakenInMatch: true,
      loanPending: createLoanPending(amt, declaredAtRound),
    },
  }
}

/** Após casa de faturamento (volta completa): libera cobrança nas próximas despesas. */
export function armLoanAfterRevenue(loanPending) {
  const lp = loanPending || null
  if (!lp || Number(lp.amount) <= 0 || lp.charged === true) return lp
  if (lp.eligibleOnExpenses === true) return lp
  return {
    ...lp,
    waitingFullLap: false,
    eligibleOnExpenses: true,
    stage: 'ARMED_FOR_NEXT_EXPENSES',
  }
}

export function ensureLoanId(loanPending, ownerId, makeId = makeLoanId) {
  const lp = loanPending || null
  if (!lp || Number(lp.amount) <= 0) return lp
  if (lp.loanId) return lp
  return { ...lp, loanId: makeId(ownerId) }
}

export function shouldChargeLoan({ loanPending, lastChargedLoanId, currentRound } = {}) {
  const lp = loanPending || null
  const loanId = String(lp?.loanId || '')
  if (!lp || Number(lp.amount) <= 0 || lp.charged === true) return false
  if (!loanId) return false
  if (String(lastChargedLoanId || '') === loanId) return false

  const due = Number(lp.dueRound) > 0
    ? Number(lp.dueRound)
    : loanDueRound(lp.declaredAtRound)
  const round = Number(currentRound)
  if (due > 0 && Number.isFinite(round) && round >= due) return true

  const stage = String(
    lp.stage ||
      (lp.eligibleOnExpenses === true && lp.waitingFullLap !== true
        ? 'ARMED_FOR_NEXT_EXPENSES'
        : 'WAITING_FULL_LAP'),
  ).toUpperCase()
  return stage === 'ARMED_FOR_NEXT_EXPENSES'
}

export function loanChargeAmount(loanPending) {
  const principal = Math.max(0, Math.floor(Number(loanPending?.amount || 0)))
  const interest = Math.floor(principal * Number(MANUAL_CONSTANTS.loanInterestRatio || 0))
  return principal + Math.max(0, interest)
}

/** Após o caixa já ter sido debitado (despesas+loan): limpa pending. */
export function clearLoanAfterCharge(player, loanId) {
  return {
    ...player,
    loanPending: null,
    lastChargedLoanId: String(loanId || player.lastChargedLoanId || ''),
  }
}

export function applyLoanCharge(player, makeIdOrOpts = makeLoanId, maybeOpts = {}) {
  const makeId = typeof makeIdOrOpts === 'function' ? makeIdOrOpts : makeLoanId
  const opts = typeof makeIdOrOpts === 'function'
    ? (maybeOpts || {})
    : (makeIdOrOpts || {})
  const currentRound = opts.currentRound
  const lp = ensureLoanId(player.loanPending, player.id, makeId)
  if (!shouldChargeLoan({
    loanPending: lp,
    lastChargedLoanId: player.lastChargedLoanId,
    currentRound,
  })) {
    return { charged: false, amount: 0, player: { ...player, loanPending: lp } }
  }
  const amount = loanChargeAmount(lp)
  return {
    charged: true,
    amount,
    player: {
      ...clearLoanAfterCharge(player, lp.loanId),
      cash: (Number(player.cash) || 0) - amount,
      loanPending: null,
    },
  }
}

const FIRE_HIRE = Object.freeze({
  comum: () => MANUAL_CONSTANTS.commonHire,
  field: () => VENDOR_RULES.field.hire,
  inside: () => VENDOR_RULES.inside.hire,
  gestor: () => MANUAL_CONSTANTS.managerHire,
})

/** Quantidades de demissão limitadas ao que o jogador possui. */
export function clampFireItems(player = {}, items = {}) {
  const owned = {
    comum: Math.max(0, Number(player.vendedoresComuns || 0)),
    field: Math.max(0, Number(player.fieldSales || 0)),
    inside: Math.max(0, Number(player.insideSales || 0)),
    gestor: Math.max(
      0,
      Number(player.gestores ?? player.gestoresComerciais ?? player.managers ?? 0),
    ),
  }
  const out = {}
  for (const key of Object.keys(FIRE_HIRE)) {
    const q = Math.max(0, Math.floor(Number(items[key] || 0)))
    out[key] = Math.min(q, owned[key])
  }
  return out
}

/** Crédito de demissão recalculado no motor (não confia no payload da modal). */
export function computeRecoveryFireCredit(items = {}) {
  const ratio = MANUAL_CONSTANTS.recoveryCreditRatio
  let total = 0
  for (const [key, hireFn] of Object.entries(FIRE_HIRE)) {
    const q = Math.max(0, Math.floor(Number(items[key] || 0)))
    total += Math.floor(Number(hireFn()) * ratio) * q
  }
  return total
}

export function buildRecoveryFireDeltas(player, items = {}) {
  const clamped = clampFireItems(player, items)
  const credit = computeRecoveryFireCredit(clamped)
  return {
    items: clamped,
    credit,
    deltas: {
      cashDelta: credit,
      vendedoresComunsDelta: -clamped.comum,
      fieldSalesDelta: -clamped.field,
      insideSalesDelta: -clamped.inside,
      gestoresDelta: -clamped.gestor,
    },
  }
}
