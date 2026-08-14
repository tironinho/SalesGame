/**
 * Conteúdo do tour guiado — alinhado ao Manual, Orientações de Casa,
 * cartilha de casas e às regras atuais do Sales Game (motor/UI).
 * Não altera regras: só copy educacional.
 */

export const TOUR_WELCOME = {
  title: 'Bem-vindo ao Sales Game',
  subtitle: 'Tour guiado interativo',
  body: [
    'Em poucos minutos você entende o objetivo, as casas, o painel (HUD), a recuperação financeira e a falência.',
    'Pode seguir o tour completo ou pular e aprender jogando — o botão “Como jogar” reabre tudo quando quiser.',
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
      'Escolha um tipo abaixo para ver o resumo (valores de cartela no jogo digital seguem as regras do motor).',
    ],
    interactive: 'tiles',
  },
  {
    id: 'ciclo',
    title: 'Faturamento e despesas',
    icon: '💰',
    body: [
      'Faturamento do Mês: recebe a venda do ciclo (equipe × clientes atendidos × mix × ERP). Cruzar esta casa fecha a volta.',
      'Despesas Operacionais: paga a manutenção do mês (equipe, clientes, ativos). Empréstimos também são cobrados aqui.',
      'Se os clientes forem mais que a capacidade da equipe, o excesso (e a receita dele) é perdido no faturamento.',
    ],
    highlight: 'Capacidade insuficiente = clientes ociosos sem receita.',
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
      'Reabra este tour a qualquer momento em “Como jogar”.',
      'Boa sorte — venda valor e entregue resultados!',
    ],
  },
]

export const TOUR_TILES = [
  {
    key: 'CLIENTS',
    title: 'Carteira de Clientes',
    body: 'Prospecte clientes. Sem capacidade da equipe, o excesso é perdido no faturamento.',
  },
  {
    key: 'COMMON',
    title: 'Vendedor Comum',
    body: 'Faz-tudo: atende até 2 clientes. Contratação ~$1.500 e manutenção ~$1.000 (cartela).',
  },
  {
    key: 'FIELD',
    title: 'Field Sales',
    body: 'Externo: até 5 clientes, ticket maior. Contratação ~$3.000 e manutenção ~$2.000.',
  },
  {
    key: 'INSIDE',
    title: 'Inside Sales',
    body: 'Interno: até 5 clientes. Contratação ~$3.000 e manutenção ~$2.000.',
  },
  {
    key: 'MANAGER',
    title: 'Gestor Comercial',
    body: 'Gerencia até 7 colaboradores e impulsiona o time conforme certificados. Contratação ~$5.000 / manutenção ~$3.000.',
  },
  {
    key: 'ERP',
    title: 'ERP / Sistemas',
    body: 'Níveis A–D (não cumulativos). Custo e retorno por colaborador — cresce com a equipe.',
  },
  {
    key: 'MIX',
    title: 'Mix de Produtos',
    body: 'Níveis A–D. Multiplica faturamento e despesa conforme os clientes.',
  },
  {
    key: 'TRAINING',
    title: 'Treinamento',
    body: 'Certificados azul / amarelo / roxo para elevar performance dos profissionais e o efeito do gestor.',
  },
  {
    key: 'DIRECT_BUY',
    title: 'Direito de Compra',
    body: 'Escolha exatamente um investimento livre agora (equipe, mix, ERP, treinamento ou clientes).',
  },
  {
    key: 'LUCK',
    title: 'Sorte & Revés',
    body: 'Compre a carta do topo: ganho/isenção (sorte) ou multa/perda/queda de produtividade (revés).',
  },
  {
    key: 'REVENUE',
    title: 'Faturamento do Mês',
    body: 'Receba a venda do ciclo. Cruzar esta casa encerra a volta/rodada.',
  },
  {
    key: 'EXPENSES',
    title: 'Despesas Operacionais',
    body: 'Pague a manutenção do mês. Empréstimos também são quitados aqui.',
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
    body: 'Aumenta o caixa agora (até 50% dos seus Bens como garantia). Único por partida; cobrado nas despesas.',
  },
  {
    title: 'Reduzir',
    body: 'Baixa níveis de Mix ou ERP e recebe ~50% do valor pago de volta ao caixa.',
  },
  {
    title: 'Demitir',
    body: 'Remove colaboradores e recebe ~50% do valor — reduz equipe e custos futuros.',
  },
  {
    title: 'Declarar falência',
    body: 'Último recurso: você sai da disputa ativa se não houver como continuar.',
  },
]
