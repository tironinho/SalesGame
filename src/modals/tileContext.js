/**
 * Textos das casas — baseados no Manual, Orientações Casa e cartilha de casas.
 * Não altera regras do motor — só copy de UI (modal + hint no tabuleiro).
 */
export const TILE_CONTEXT = Object.freeze({
  CLIENTS:
    'Carteira de Clientes: prospecte novos clientes. Se o número passar da capacidade da equipe no Faturamento, o excesso (e a receita dele) é perdido.',
  COMMON:
    'Vendedor Comum (faz-tudo): atende até 2 clientes. Contratação + manutenção mensal; certificados melhoram despesa e faturamento.',
  FIELD:
    'Field Sales: perfil externo (até 5 clientes). Ticket maior; contratação e manutenção mensal conforme a cartela.',
  INSIDE:
    'Inside Sales: perfil interno (até 5 clientes). Mais atendimento por pessoa, com custo diferente do Field.',
  MANAGER:
    'Gestor Comercial: gerencia até 7 colaboradores. Impulsiona o faturamento da equipe conforme os certificados.',
  ERP:
    'ERP/Sistemas: níveis A–D (não cumulativos). Valores por colaborador — o retorno cresce com o tamanho da equipe.',
  MIX:
    'Mix de Produtos: níveis A–D (não cumulativos). Multiplica faturamento e despesa pelo total de clientes.',
  TRAINING:
    'Treinamento: compre certificados (azul/amarelo/roxo) para elevar a performance dos profissionais e o efeito do gestor.',
  DIRECT_BUY:
    'Direito de Compra: escolha exatamente um investimento livre — patrimônio, colaborador, treinamento ou clientes.',
  LUCK:
    'Sorte & Revés: compre a carta do topo. Sorte pode gerar ganho ou isenção; revés pode cobrar, multar ou reduzir produtividade.',
  REVENUE:
    'Faturamento do Mês: receba a venda do ciclo (equipe × clientes × mix × ERP). Cruzar esta casa encerra a volta/rodada.',
  EXPENSES:
    'Despesas Operacionais: pague a manutenção do mês (equipe, clientes e ativos). Empréstimos também são quitados aqui.',
})

/** Texto no tabuleiro (desktop/mobile): função da casa em 1–2 frases. */
export const TILE_HINTS = Object.freeze({
  REVENUE:
    'Início/Faturamento: ao passar, receba a venda do mês (equipe, clientes, mix e ERP). Esta casa fecha a volta.',
  CLIENTS:
    'Carteira de Clientes: compre clientes para faturar mais. Sem capacidade da equipe, o excesso é perdido no faturamento.',
  ERP:
    'ERP/Sistemas: compre um nível (A–D). Ganho e custo são por colaborador, não pela quantidade de clientes.',
  INSIDE:
    'Inside Sales: contrate vendedores internos. Cada um atende até 5 clientes, com custo diferente do Field.',
  MANAGER:
    'Gestor Comercial: gerencia até 7 pessoas e aumenta o faturamento da equipe conforme os certificados.',
  TRAINING:
    'Treinamento: compre certificados (azul, amarelo ou roxo) para melhorar a performance da equipe e o gestor.',
  FIELD:
    'Field Sales: contrate vendedores externos. Atendem até 5 clientes, com ticket maior e manutenção mensal.',
  DIRECT_BUY:
    'Direito de Compra: escolha exatamente um investimento agora — equipe, mix, ERP, treinamento ou clientes.',
  LUCK:
    'Sorte & Revés: tire a carta do topo. Pode creditar o caixa, isentar custos, ou aplicar multa e perdas.',
  COMMON:
    'Vendedor Comum: o faz-tudo da equipe. Atende até 2 clientes; tem contratação e manutenção mensal.',
  EXPENSES:
    'Despesas: pague a manutenção do mês (equipe, clientes e ativos). Empréstimos também são cobrados aqui.',
  MIX:
    'Mix de Produtos: compre um nível (A–D). Define quanto cada cliente fatura e custa por ciclo.',
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
