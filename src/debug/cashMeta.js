// src/debug/cashMeta.js
// Helper leve para padronizar meta do cash audit.

export function mkCashMeta({
  traceId = 'unknown',
  actionType = 'UNKNOWN',
  reason = 'UNKNOWN_CASH_CHANGE',
  origin = {},
  context = {},
} = {}) {
  return {
    traceId: traceId || 'unknown',
    actionType: actionType || 'UNKNOWN',
    reason: reason || 'UNKNOWN_CASH_CHANGE',
    origin: {
      file: origin.file,
      fn: origin.fn,
      modal: origin.modal,
      component: origin.component,
    },
    context: {
      round: context.round,
      pos: context.pos,
      tile: context.tile,
      debt: context.debt,
      loanPending: context.loanPending,
      opsExpense: context.opsExpense,
      revenue: context.revenue,
    },
  }
}

