/**
 * Conteúdo do tour guiado — alinhado ao Manual e às regras do motor (gameRules).
 * Tabelas numéricas: ver tutorialGlossary.js (fonte única do glossário).
 * Não altera regras: só copy educacional.
 */

import { TOUR_GLOSSARY, MANUAL_CONSTANTS, MIX_PURCHASE_PRICES } from './tutorialGlossary.js'
import { VENDOR_RULES, ERP_RULES, MIX_RULES } from '../game/gameRules.js'

export { TOUR_GLOSSARY }

const money = (n) => `$ ${Number(n || 0).toLocaleString('pt-BR')}`

export const TOUR_WELCOME = {
  title: 'Bem-vindo ao Sales Game',
  subtitle: 'Tour guiado + glossário de valores',
  body: [
    'Em poucos minutos você entende o objetivo, as casas, o painel (HUD), a recuperação financeira e a falência.',
    'O glossário traz as tabelas oficiais de contratação, Mix, ERP, certificados, faturamento e despesas.',
    'Pode seguir o tour completo ou pular — o botão “Como jogar” reabre tudo quando quiser.',
  ],
}

/** Etapas do tour (ordem pedagógica). */
export const TOUR_STEPS = [
  {
    id: 'objetivo',
    title: 'Objetivo e vitória',
    icon: '🏆',
    body: [
      'Você administra uma operação comercial: equipe, clientes, mix, ERP e caixa.',
      'O vencedor é quem terminar com o maior PATRIMÔNIO.',
      'Patrimônio = Caixa + Bens.',
      'Em empate de patrimônio, desempata quem tiver maior caixa; se ainda empatar, pelo nome.',
    ],
    highlight: 'Vitória = maior (Caixa + Bens) ao fim das rodadas.',
  },
  {
    id: 'rodadas',
    title: 'Rodadas e duração',
    icon: '🔁',
    body: [
      'O host escolhe a duração da partida entre 1 e 5 rodadas (padrão: 5).',
      'Cada volta no tabuleiro passa pelo Faturamento do Mês e pelas Despesas — isso fecha o ciclo da rodada.',
      'A partida termina após o número de rodadas configurado, ou se restar apenas um jogador ativo.',
      `Início típico: Caixa ${money(MANUAL_CONSTANTS.startCash)}, Bens ${money(MANUAL_CONSTANTS.startBens)}, Mix D, ERP D, 1 Vendedor Comum e 1 cliente.`,
    ],
    highlight: 'Mais rodadas = mais tempo para investir e recuperar.',
  },
  {
    id: 'turno',
    title: 'Seu turno',
    icon: '🎲',
    body: [
      'Na sua vez, toque em “Rolar Dado & Andar”.',
      'O peão anda as casas sorteadas; resolva o que a casa pedir (comprar, pagar, carta etc.).',
      'Depois aguarde os outros jogadores — cada um joga na sua vez.',
      'No mobile, use “Ver resumo / placar” para abrir o painel completo de estatísticas.',
    ],
  },
  {
    id: 'casas',
    title: 'Casas do tabuleiro',
    icon: '🗺️',
    body: [
      'Toque numa casa no tabuleiro a qualquer momento para ver o que ela faz.',
      'Escolha um tipo abaixo para o resumo. Valores exatos estão no glossário do tour.',
    ],
    interactive: 'tiles',
  },
  {
    id: 'ciclo',
    title: 'Faturamento e despesas',
    icon: '💰',
    body: [
      'Faturamento do Mês: recebe a venda do ciclo (equipe × clientes em atendimento × mix × ERP). Cruzar esta casa fecha a volta.',
      'Despesas Operacionais: paga a manutenção do mês (equipe, clientes, Mix, ERP e carteira). Empréstimos também são cobrados aqui.',
      'Se os clientes forem mais que a capacidade da equipe, o excesso não gera receita naquele ciclo (mas continua na carteira e gera despesa).',
    ],
    highlight: 'Capacidade insuficiente = clientes ociosos sem receita.',
  },
  {
    id: 'glossario',
    title: 'Glossário — valores do jogo',
    icon: '📘',
    body: [
      'Tabelas oficiais usadas pelo motor: contratação, Mix, ERP, certificados, clientes, faturamento e despesas.',
      'Consulte sempre que for decidir um investimento.',
    ],
    interactive: 'glossary',
  },
  {
    id: 'hud',
    title: 'Painel (HUD) e placar',
    icon: '📊',
    body: [
      'O painel mostra a saúde da sua empresa. No celular landscape, abra pelo botão “Ver resumo / placar”.',
    ],
    interactive: 'hud',
  },
  {
    id: 'recuperacao',
    title: 'Recuperação financeira',
    icon: '🛠️',
    body: [
      'Use quando o caixa apertar — ou abra pelo botão “Recuperação Financeira”.',
      'Objetivo: recuperar saldo e evitar falência. Escolha uma opção abaixo:',
    ],
    interactive: 'recovery',
  },
  {
    id: 'falencia',
    title: 'Falência',
    icon: '⚠️',
    body: [
      'Se não houver como pagar obrigações e a recuperação não resolver, você pode declarar falência.',
      'Jogador falido sai da disputa ativa (não joga mais turnos de compra).',
      'Com vários jogadores, a partida pode continuar; com um só, a falência encerra a partida.',
      'Declarar falência também aparece na recuperação financeira e no botão “Declarar Falência”.',
    ],
    highlight: 'Falência = sair do jogo ativo. Prefira recuperar antes.',
  },
  {
    id: 'pronto',
    title: 'Pronto para jogar',
    icon: '🚀',
    body: [
      'Resumo: invista com inteligência, mantenha capacidade ≥ clientes, pague despesas e maximize patrimônio.',
      'Reabra este tour (e o glossário) a qualquer momento em “Como jogar”.',
      'Boa sorte — venda valor e entregue resultados!',
    ],
  },
]

export const TOUR_TILES = [
  {
    key: 'CLIENTS',
    title: 'Carteira de Clientes',
    body: `Aquisição ${money(MANUAL_CONSTANTS.clientPrice)}/cliente. Despesa de carteira ${money(MANUAL_CONSTANTS.clientPortfolioDesp)}/cliente no ciclo. Sem capacidade, o excedente não fatura.`,
  },
  {
    key: 'COMMON',
    title: 'Vendedor Comum',
    body: `Capacidade ${VENDOR_RULES.comum.cap}. Contratação ${money(MANUAL_CONSTANTS.commonHire)}; desp. base ${money(VENDOR_RULES.comum.baseDesp)}; fat base ${money(VENDOR_RULES.comum.baseFat)}.`,
  },
  {
    key: 'FIELD',
    title: 'Field Sales',
    body: `Capacidade ${VENDOR_RULES.field.cap}. Contratação ${money(VENDOR_RULES.field.hire)}; desp. base ${money(VENDOR_RULES.field.baseDesp)}; fat base ${money(VENDOR_RULES.field.baseFat)}.`,
  },
  {
    key: 'INSIDE',
    title: 'Inside Sales',
    body: `Capacidade ${VENDOR_RULES.inside.cap}. Contratação ${money(VENDOR_RULES.inside.hire)}; desp. base ${money(VENDOR_RULES.inside.baseDesp)}; fat base ${money(VENDOR_RULES.inside.baseFat)}.`,
  },
  {
    key: 'MANAGER',
    title: 'Gestor Comercial',
    body: `Contratação ${money(MANUAL_CONSTANTS.managerHire)}; desp. base ${money(VENDOR_RULES.gestor.baseDesp)}. Não atende clientes; impulsiona o time conforme certificados (ver glossário).`,
  },
  {
    key: 'ERP',
    title: 'ERP / Sistemas',
    body: `Níveis A–D. Ex.: D compra ${money(ERP_RULES.D.price)} (fat ${money(ERP_RULES.D.fat)} / desp ${money(ERP_RULES.D.desp)} por colab.). Tabelas no glossário.`,
  },
  {
    key: 'MIX',
    title: 'Mix de Produtos',
    body: `Níveis A–D. Ex.: D compra ${money(MIX_PURCHASE_PRICES.D)} (fat ${money(MIX_RULES.D.fatPerClient)} / desp ${money(MIX_RULES.D.despPerClient)} por cliente). Tabelas no glossário.`,
  },
  {
    key: 'TRAINING',
    title: 'Treinamento',
    body: `Certificados Azul / Amarelo / Roxo a ${money(MANUAL_CONSTANTS.trainingPrice)} cada. Alteram fat/desp da equipe (e boost do gestor). Detalhes no glossário.`,
  },
  {
    key: 'DIRECT_BUY',
    title: 'Direito de Compra',
    body: 'Escolha exatamente um investimento livre agora (equipe, mix, ERP, treinamento ou clientes) — preços iguais às casas específicas.',
  },
  {
    key: 'LUCK',
    title: 'Sorte & Revés',
    body: 'Compre a carta do topo: ganho/isenção (sorte) ou multa/perda/queda de produtividade (revés).',
  },
  {
    key: 'REVENUE',
    title: 'Faturamento do Mês',
    body: 'Receba a venda do ciclo (equipe + Mix + ERP). Fórmulas e tabelas no glossário.',
  },
  {
    key: 'EXPENSES',
    title: 'Despesas Operacionais',
    body: 'Pague a manutenção do mês (equipe, Mix, ERP, carteira). Empréstimos também são quitados aqui.',
  },
]

export const TOUR_HUD = [
  {
    title: 'Financeiro',
    body: 'Faturamento (entrada do ciclo), Manutenção (custos), Empréstimos e Bens (ativos / garantia).',
  },
  {
    title: 'Estrutura comercial',
    body: 'Contagem de Vendedores Comuns, Field Sales, Inside Sales e Gestores.',
  },
  {
    title: 'Infraestrutura',
    body: 'Nível atual de Mix de Produtos e ERP/Sistemas (A–D).',
  },
  {
    title: 'Certificações',
    body: 'Quantidade de certificados Azul, Amarelo e Roxo obtidos em Treinamento.',
  },
  {
    title: 'Operação',
    body: 'Clientes, Capacidade da equipe e quantos estão Em Atendimento.',
  },
  {
    title: 'Placar',
    body: 'Caixa e Patrimônio (Caixa + Bens) de cada jogador — critério de vitória.',
  },
]

export const TOUR_RECOVERY = [
  {
    title: 'Empréstimo',
    body: `Aumenta o caixa agora (até ${Math.round(MANUAL_CONSTANTS.loanMaxBensRatio * 100)}% dos seus Bens). Único por partida; cobrado nas Despesas.`,
  },
  {
    title: 'Reduzir',
    body: `Baixa níveis de Mix ou ERP e recebe ~${Math.round(MANUAL_CONSTANTS.recoveryCreditRatio * 100)}% do valor pago de volta ao caixa.`,
  },
  {
    title: 'Demitir',
    body: `Remove colaboradores e recebe ~${Math.round(MANUAL_CONSTANTS.recoveryCreditRatio * 100)}% do valor de contratação — reduz equipe e custos futuros.`,
  },
  {
    title: 'Declarar falência',
    body: 'Último recurso: você sai da disputa ativa se não houver como continuar.',
  },
]
