// src/game/gameRules.js
// Single source of truth para regras numéricas do jogo (custos/receitas por tipo/nível).
//
// IMPORTANTE:
// - Não altera shape do estado (players/rooms) — apenas centraliza números.
// - Correção A: Vendedor Comum (comum) baseDesp = 1000 (era 100 no gameMath; modal já exibia 1000).
// - Correção B: Gestor com 0 certificados deve ter boost = 0%.

export const VENDOR_RULES = {
  // Observação: `cap` (capacidade de atendimento) já existia no gameMath e é uma regra numérica.
  // Mantemos aqui para evitar divergência futura, sem mudar o schema do estado.
  comum:  { cap: 2, baseFat:  600, incFat: 100, baseDesp: 1000, incDesp: 100 },
  inside: { cap: 5, baseFat: 1500, incFat: 500, baseDesp: 2000, incDesp: 100 },
  field:  { cap: 5, baseFat: 1500, incFat: 500, baseDesp: 2000, incDesp: 100 },

  // Gestor não gera faturamento direto; ele afeta o faturamento dos colaboradores via boost.
  // Mantemos os campos por consistência e para uso no cálculo de despesas.
  gestor: { cap: 0, baseFat: 0, incFat: 0, baseDesp: 3000, incDesp: 500 },
}

// ERP: valores por colaborador (colaboradores + gestores) — mantém exatamente os valores atuais do gameMath.
export const ERP_RULES = {
  A: { fat: 1000, desp: 400 },
  B: { fat:  500, desp: 200 },
  C: { fat:  200, desp: 100 },
  D: { fat:   70, desp:  50 },
}

// MIX: valores por cliente — mantém exatamente os valores atuais do gameMath.
export const MIX_RULES = {
  A: { fatPerClient: 1200, despPerClient: 700 },
  B: { fatPerClient:  600, despPerClient: 400 },
  C: { fatPerClient:  300, despPerClient: 200 },
  D: { fatPerClient:  100, despPerClient:  50 },
}

// Boost do Gestor por quantidade de certificados do tipo 'gestor'.
// Regra exigida: índice 0 deve ser 0 (0 certificados => 0%).
export const MANAGER_BOOST_BY_CERT = [0, 0.20, 0.30, 0.40, 0.60]

// Quantos colaboradores um Gestor cobre (regra usada no cálculo de cobertura).
export const MANAGER_MANAGES_UP_TO = 7

