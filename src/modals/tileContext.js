/**
 * Textos curtos: por que a casa importa (curva de entendimento).
 * Não altera regras — só copy de UI.
 */
export const TILE_CONTEXT = Object.freeze({
  CLIENTS:
    'Você parou na Carteira de Clientes: ampliar a base aumenta o potencial de faturamento — se a equipe tiver capacidade.',
  COMMON:
    'Casa de Vendedor Comum: contrate equipe de linha para atender mais clientes.',
  FIELD:
    'Casa de Field Sales: perfil externo — ticket mais alto e menos clientes por pessoa.',
  INSIDE:
    'Casa de Inside Sales: perfil interno — mais clientes por pessoa, com custo diferente do Field.',
  MANAGER:
    'Casa de Gestor Comercial: impulsiona a equipe apenas com certificado (sem cert = 0% de boost).',
  ERP:
    'Casa de ERP/Sistemas: o benefício cresce com o tamanho da equipe, não com o número de clientes.',
  MIX:
    'Casa de Mix de Produtos: redefine quanto cada cliente fatura e custa por ciclo.',
  TRAINING:
    'Casa de Treinamento: certificados mudam faturamento/despesa dos profissionais e ativam o boost do gestor.',
  DIRECT_BUY:
    'Direito de Compra: escolha um recurso agora; o impacto financeiro aparece antes de confirmar.',
  LUCK:
    'Sorte & Revés: a carta pode creditar ou debitar caixa conforme o estado da sua empresa.',
  REVENUE:
    'Ao cruzar o Início, você recebe o faturamento do mês calculado com a operação atual.',
  EXPENSES:
    'Ao cruzar Despesas, o caixa paga a manutenção do mês e eventuais cobranças de empréstimo.',
})

/** Uma linha no tabuleiro (desktop/mobile). Mais curta que o texto da modal. */
export const TILE_HINTS = Object.freeze({
  REVENUE: 'Início: ao passar, você recebe o faturamento do mês.',
  CLIENTS: 'Amplia a base de clientes e o potencial de faturamento.',
  ERP: 'Sistemas: o ganho cresce com o tamanho da equipe.',
  INSIDE: 'Vendas internas: atende mais clientes por pessoa.',
  MANAGER: 'Gestor: impulsiona a equipe se tiver certificado.',
  TRAINING: 'Certificados que mudam o desempenho da equipe.',
  FIELD: 'Vendas externas: ticket maior, menos clientes por pessoa.',
  DIRECT_BUY: 'Escolha um recurso e veja o impacto antes de confirmar.',
  LUCK: 'Carta aleatória: pode creditar ou debitar o caixa.',
  COMMON: 'Contrate vendedores de linha para atender mais clientes.',
  EXPENSES: 'Ao passar, você paga a manutenção do mês.',
  MIX: 'Define quanto cada cliente fatura e custa por ciclo.',
})

function hintKey(kind) {
  const key = String(kind || '').toUpperCase()
  if (key === 'START_REVENUE') return 'REVENUE'
  return key
}

export function getTileContext(kind) {
  const key = hintKey(kind)
  return TILE_CONTEXT[key] || ''
}

export function getTileHint(kind) {
  const key = hintKey(kind)
  return TILE_HINTS[key] || TILE_CONTEXT[key] || ''
}
