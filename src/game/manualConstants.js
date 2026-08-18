/**
 * Constantes de manual / preços de compra usados nas modais
 * (não estão todos em gameRules ainda — Mix compra, comum/gestor hire, etc.).
 */
export const MIX_PURCHASE_PRICES = Object.freeze({
  A: 12000,
  B: 6000,
  C: 3000,
  D: 1000,
})

export const MANUAL_CONSTANTS = Object.freeze({
  startCash: 18000,
  startBens: 4000,
  commonHire: 2000,
  managerHire: 5000,
  clientPrice: 1000,
  trainingPrice: 500,
  clientPortfolioDesp: 50,
  recoveryCreditRatio: 0.5,
  loanMaxBensRatio: 0.5,
  // Juros cobrados na quitação (Despesas da próxima rodada): principal + 50%.
  loanInterestRatio: 0.5,
})
