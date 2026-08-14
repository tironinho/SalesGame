/**
 * Glossário / manual numérico do Sales Game.
 * Valores derivados de gameRules (fonte do motor) + preços de compra usados nas modais.
 * Só conteúdo educacional — não altera regras.
 */

import {
  VENDOR_RULES,
  ERP_RULES,
  MIX_RULES,
  CERT_EFFECTS,
  MANAGER_BOOST_BY_CERT,
  MANAGER_MANAGES_UP_TO,
} from '../game/gameRules.js'
import { MIX_PURCHASE_PRICES, MANUAL_CONSTANTS } from '../game/manualConstants.js'

export { MIX_PURCHASE_PRICES, MANUAL_CONSTANTS }

const money = (n) => `$ ${Number(n || 0).toLocaleString('pt-BR')}`
const pct = (x) => `${Math.round(Number(x || 0) * 100)}%`

function vendorRow(key, label, hire) {
  const r = VENDOR_RULES[key]
  return [
    label,
    String(r.cap),
    money(hire ?? r.hire ?? 0),
    money(r.baseDesp),
    money(r.baseFat),
    `+${money(r.incFat)} / +${money(r.incDesp)}`,
  ]
}

/**
 * Seções do glossário (tabelas) para o tour / “Como jogar”.
 */
export function buildTourGlossary() {
  const c = MANUAL_CONSTANTS

  return [
    {
      id: 'inicio',
      title: 'Início da partida',
      note: 'Kit inicial padrão ao começar o jogo.',
      headers: ['Item', 'Valor'],
      rows: [
        ['Caixa inicial', money(c.startCash)],
        ['Bens iniciais', money(c.startBens)],
        ['Patrimônio inicial', money(c.startCash + c.startBens)],
        ['Mix inicial', 'D (5 produtos)'],
        ['ERP inicial', 'D'],
        ['Equipe inicial', '1 Vendedor Comum'],
        ['Clientes iniciais', '1'],
      ],
    },
    {
      id: 'equipe',
      title: 'Equipe — contratação, capacidade e bases',
      note: 'Fat/desp base por tipo. Certificados somam os incrementos (coluna Δ cert). Capacidade = clientes que a pessoa consegue atender.',
      headers: ['Tipo', 'Cap.', 'Contratação', 'Desp. base', 'Fat base', 'Δ cert (fat/desp)'],
      rows: [
        vendorRow('comum', 'Vendedor Comum', c.commonHire),
        vendorRow('field', 'Field Sales', VENDOR_RULES.field.hire),
        vendorRow('inside', 'Inside Sales', VENDOR_RULES.inside.hire),
        [
          'Gestor Comercial',
          '0*',
          money(c.managerHire),
          money(VENDOR_RULES.gestor.baseDesp),
          '—',
          `desp +${money(VENDOR_RULES.gestor.incDesp)} × certs`,
        ],
      ],
      footnotes: [
        `* Gestor não atende clientes; cobre até ${MANAGER_MANAGES_UP_TO} colaboradores.`,
      ],
    },
    {
      id: 'certs',
      title: 'Treinamento — certificados',
      note: `Cada certificado custa ${money(c.trainingPrice)}. Aplicam-se a Comum / Field / Inside (IDs únicos por tipo).`,
      headers: ['Cor', 'Efeito no fat', 'Efeito na desp'],
      rows: Object.values(CERT_EFFECTS).map((e) => [
        e.label,
        `× ${e.multFat} no incremento`,
        e.multDesp === 0 ? 'sem +desp' : `× ${e.multDesp} no incremento`,
      ]),
      footnotes: [
        'Fórmula: rate = baseFat + incFat × ΣmultFat; desp unitária = baseDesp + incDesp × ΣmultDesp.',
      ],
    },
    {
      id: 'gestor-boost',
      title: 'Boost do Gestor no faturamento da equipe',
      note: 'Percentual sobre o faturamento dos vendedores (não sobre Mix/ERP). Conta certificados do gestor.',
      headers: ['Certificados do gestor', 'Boost'],
      rows: MANAGER_BOOST_BY_CERT.map((b, i) => [String(i), pct(b)]),
    },
    {
      id: 'mix',
      title: 'Mix de Produtos (A–D, não cumulativo)',
      note: 'Fat usa clientes Em Atendimento; despesa do Mix usa todos os clientes da carteira.',
      headers: ['Nível', 'Compra', 'Fat / cliente', 'Desp / cliente'],
      rows: ['A', 'B', 'C', 'D'].map((L) => [
        L,
        money(MIX_PURCHASE_PRICES[L]),
        money(MIX_RULES[L].fatPerClient),
        money(MIX_RULES[L].despPerClient),
      ]),
    },
    {
      id: 'erp',
      title: 'ERP / Sistemas (A–D, não cumulativo)',
      note: 'Valores por colaborador (Comuns + Field + Inside + Gestores). Não escala por cliente.',
      headers: ['Nível', 'Compra', 'Fat / colab.', 'Desp / colab.'],
      rows: ['A', 'B', 'C', 'D'].map((L) => [
        L,
        money(ERP_RULES[L].price),
        money(ERP_RULES[L].fat),
        money(ERP_RULES[L].desp),
      ]),
    },
    {
      id: 'clientes',
      title: 'Clientes',
      headers: ['Item', 'Valor'],
      rows: [
        ['Aquisição (por cliente)', money(c.clientPrice)],
        ['Despesa de carteira (por cliente / ciclo)', money(c.clientPortfolioDesp)],
        ['Em Atendimento', 'min(clientes, capacidade da equipe)'],
      ],
      footnotes: [
        'Clientes acima da capacidade não geram faturamento da equipe/Mix naquele ciclo (permanecem na carteira e ainda geram despesa).',
      ],
    },
    {
      id: 'faturamento',
      title: 'Faturamento do Mês — como calcula',
      note: 'Ao cruzar a casa de Faturamento:',
      bullets: [
        'Equipe: potencial por tipo (cap × rate) × (emAtendimento / capacidade total), com boost do gestor se houver.',
        'Mix: fat/cliente × emAtendimento.',
        'ERP: fat/colaborador × quantidade de colaboradores.',
        'Soma arredondada para baixo (floor).',
      ],
    },
    {
      id: 'despesas',
      title: 'Despesas Operacionais — como calcula',
      note: 'Ao cruzar a casa de Despesas:',
      bullets: [
        'Manutenção da equipe (desp unitária × quantidade, com certificados).',
        'Gestor: base × qtd + incremento × certificados × qtd.',
        'Mix: desp/cliente × clientes totais.',
        'ERP: desp/colaborador × colaboradores.',
        `Carteira: ${money(c.clientPortfolioDesp)} × clientes totais.`,
        'Empréstimo pendente (se houver) é cobrado integralmente nesta casa.',
      ],
    },
    {
      id: 'recuperacao',
      title: 'Recuperação financeira — valores',
      headers: ['Opção', 'Regra'],
      rows: [
        ['Empréstimo', `Até ${pct(c.loanMaxBensRatio)} dos Bens; 1× por partida; cobrado nas Despesas`],
        ['Reduzir Mix/ERP', `Crédito de ~${pct(c.recoveryCreditRatio)} do preço do nível`],
        ['Demitir', `Crédito de ~${pct(c.recoveryCreditRatio)} do valor de contratação`],
        ['Falência', 'Sai da disputa ativa'],
      ],
    },
  ]
}

export const TOUR_GLOSSARY = buildTourGlossary()
