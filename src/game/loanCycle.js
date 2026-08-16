/**
 * Máquina de estados do empréstimo (espelha useTurnEngine).
 * Take → waitingFullLap → arm no REVENUE → charge no EXPENSES → bloqueia 2ª.
 */
export function canTakeLoan(player = {}) {
  const lp = player.loanPending || null
  if (player.loanTakenInMatch) return false
  if (lp && Number(lp.amount) > 0 && lp.charged !== true) return false
  return true
}

export function createLoanPending(amount, declaredAtRound) {
  return {
    amount: Math.max(0, Math.floor(Number(amount) || 0)),
    charged: false,
    waitingFullLap: true,
    eligibleOnExpenses: false,
    declaredAtRound: Number(declaredAtRound) || 0,
  }
}

export function applyLoanTake(player, amount, declaredAtRound) {
  if (!canTakeLoan(player)) {
    return { ok: false, player, reason: 'already-used' }
  }
  const amt = Math.max(0, Math.floor(Number(amount) || 0))
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

export function ensureLoanId(loanPending, ownerId, makeId) {
  const lp = loanPending || null
  if (!lp || Number(lp.amount) <= 0) return lp
  if (lp.loanId) return lp
  return { ...lp, loanId: makeId(ownerId) }
}

export function shouldChargeLoan({ loanPending, lastChargedLoanId }) {
  const lp = loanPending || null
  const loanId = String(lp?.loanId || '')
  if (!lp || Number(lp.amount) <= 0 || lp.charged === true) return false
  if (!loanId) return false
  if (String(lastChargedLoanId || '') === loanId) return false
  const stage = String(
    lp.stage ||
      (lp.eligibleOnExpenses === true && lp.waitingFullLap !== true
        ? 'ARMED_FOR_NEXT_EXPENSES'
        : 'WAITING_FULL_LAP'),
  ).toUpperCase()
  return stage === 'ARMED_FOR_NEXT_EXPENSES'
}

export function applyLoanCharge(player) {
  const lp = ensureLoanId(player.loanPending, player.id, (id) => `loan:${id}:1`)
  if (!shouldChargeLoan({ loanPending: lp, lastChargedLoanId: player.lastChargedLoanId })) {
    return { charged: false, amount: 0, player: { ...player, loanPending: lp } }
  }
  const amount = Math.max(0, Math.floor(Number(lp.amount) || 0))
  return {
    charged: true,
    amount,
    player: {
      ...player,
      cash: (Number(player.cash) || 0) - amount,
      loanPending: null,
      lastChargedLoanId: String(lp.loanId),
    },
  }
}
