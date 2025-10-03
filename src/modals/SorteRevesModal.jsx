// src/modals/SorteRevesModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Modal "Sorte & Revés"
 *
 * Abre exibindo uma carta aleatória baseada no baralho abaixo.
 * Ao confirmar, resolve com um payload estruturado para a engine:
 *   {
 *     action: 'APPLY_CARD',
 *     kind: 'SORTE' | 'REVES',
 *     id: string,
 *     title?: string,
 *     text: string,
 *     cashDelta?: number,        // + recebe / - paga
 *     clientsDelta?: number,     // + ganha / - perde
 *     loseSellerLowestPay?: boolean,
 *     skipPassTurnRemover?: boolean, // "habeas corpus"
 *     infraLevelUp?: boolean,    // subir nível de infraestrutura
 *     infraRequiresAOrPay?: number, // exige nível A ou paga esse valor
 *     freeBuyNow?: boolean,      // compra livre
 *     gainSpecialCell?: { fieldSales?:1, support?:1, manager?:1 },
 *     perClientBonus?: number,   // bônus por cliente atual
 *     perCertifiedManagerBonus?: number, // bônus por gestor c/ certificado
 *     mixLevelBonusABOnly?: number // aporte se mix/infra nível A ou B
 *   }
 *
 * onResolve({ ...payload })
 */

export default function SorteRevesModal({ onResolve }) {
  const closeRef = useRef(null)

  // === BARALHO (transcrito do .docx) ===
  const CARDS = useMemo(() => [
    // ----- SORTE -----
    { id:'gov_fgts', kind:'SORTE', title:'Ação Governamental Positiva',
      text:'Liberação de FGTS aumentou o poder de compra. Receba 5 novos clientes (se tiver equipe para atender).',
      clientsDelta: +5 },
    { id:'referral_bonus', kind:'SORTE', title:'Indicação Lucrativa',
      text:'Um cliente indicou amigos e a primeira compra foi ótima. Receba R$ 800,00.',
      cashDelta:+800 },
    { id:'network_cert_mgr', kind:'SORTE', title:'Rede Estratégica',
      text:'Para cada gestor com certificado, receba R$ 5.000,00.',
      perCertifiedManagerBonus: 5000 },
    { id:'innovation_invest', kind:'SORTE', title:'Inovação Premiada',
      text:'Se tiver infraestrutura nível A ou B, receba aporte de R$ 25.000,00.',
      mixLevelBonusABOnly: 25000 },
    { id:'segmentation', kind:'SORTE', title:'Segmentação Inteligente',
      text:'Novo segmento lucrativo. Receba R$ 1.000,00.',
      cashDelta:+1000 },
    { id:'hc_card', kind:'SORTE', title:'Habeas Corpus',
      text:'Guarde este cartão para cancelar um “passar a vez” no futuro.',
      skipPassTurnRemover:true },
    { id:'casa_full_pack', kind:'SORTE', title:'Consultoria Full da Casagrande',
      text:'Ganhe 1 célula de vendas especializadas, 1 suporte e 1 gestor.',
      gainSpecialCell:{ fieldSales:1, support:1, manager:1 } },
    { id:'casa_bonus_10k', kind:'SORTE', title:'Casagrande Insights',
      text:'Implementação bem-sucedida. Receba R$ 10.000,00.',
      cashDelta:+10000 },
    { id:'casa_network_7k', kind:'SORTE', title:'Rede de Contatos Valiosa',
      text:'Parceria estratégica. Ganhe R$ 7.000,00.',
      cashDelta:+7000 },
    { id:'casa_strategy_5k', kind:'SORTE', title:'Estratégia Personalizada',
      text:'Processos melhorados. Receba R$ 5.000,00.',
      cashDelta:+5000 },
    { id:'casa_best_practices_8k', kind:'SORTE', title:'Melhores Práticas',
      text:'Eficiência aumentada. Receba R$ 8.000,00.',
      cashDelta:+8000 },
    { id:'casa_start_6k', kind:'SORTE', title:'Satisfação do Cliente em Alta',
      text:'Fidelidade e vendas sobem. Receba R$ 6.000,00.',
      cashDelta:+6000 },
    { id:'casa_change_cert_blue', kind:'SORTE', title:'Gestão de Mudanças Bem-sucedida',
      text:'Um vendedor generalista concluiu todos os treinamentos. Ganhe um certificado azul para esse vendedor.',
    },
    { id:'training_roi_team', kind:'SORTE', title:'Treinamento Personalizado',
      text:'Receba R$ 500,00 por membro participante.',
    },
    { id:'purple_award_25k', kind:'SORTE', title:'Profissional do Ano (Roxo)',
      text:'Se tiver colaborador com certificado roxo premiado, receba R$ 25.000,00.',
      cashDelta:+25000 },
    { id:'free_buy_from_player', kind:'SORTE', title:'Compra Livre de Outro Jogador',
      text:'Adquira um funcionário de outro jogador pelo valor do salário — ele deve aceitar. Use agora.',
      freeBuyNow:true },
    { id:'reputation_1500', kind:'SORTE', title:'Reputação Impecável',
      text:'Ótimas avaliações elevam a confiança. Receba R$ 1.500,00.',
      cashDelta:+1500 },
    { id:'client_cheer_per_client', kind:'SORTE', title:'Cliente Promotor',
      text:'Ganhe R$ 500,00 por cada cliente atual.',
      perClientBonus:500 },
    { id:'big_order_freight_save', kind:'SORTE', title:'Grande Pedido + Frete Econômico',
      text:'Receba R$ 1.500,00.',
      cashDelta:+1500 },
    { id:'infra_discount', kind:'SORTE', title:'Desconto de TI',
      text:'Suba 1 nível de infraestrutura.',
      infraLevelUp:true },
    { id:'free_buy_anything', kind:'SORTE', title:'Compra Livre',
      text:'Contrate ou compre o que for necessário. Use agora.',
      freeBuyNow:true },
    { id:'sales_win_2k', kind:'SORTE', title:'Vitória de Vendas',
      text:'Venda aguardada foi fechada. Receba R$ 2.000,00.',
      cashDelta:+2000 },

    // ----- REVÉS -----
    { id:'thirteenth_bonus', kind:'REVES', title:'Bônus Natalino Excessivo',
      text:'Pague 1,5 salário para cada membro da equipe.' },
    { id:'missed_admission', kind:'REVES', title:'Admissão Não Reportada',
      text:'Multa governamental. Pague R$ 3.000,00.',
      cashDelta:-3000 },
    { id:'lose_lowest_paid_seller', kind:'REVES', title:'Perda de Talento',
      text:'Concorrente levou seu vendedor de menor salário.',
      loseSellerLowestPay:true },
    { id:'office_renovation', kind:'REVES', title:'Renovação Custosa',
      text:'Gastos de obra. Pague R$ 7.000,00.',
      cashDelta:-7000 },
    { id:'env_fine_20k', kind:'REVES', title:'Impacto Ambiental',
      text:'Multa ambiental. Pague R$ 20.000,00.',
      cashDelta:-20000 },
    { id:'key_client_at_risk', kind:'REVES', title:'Cliente Chave em Risco',
      text:'Sem certificado amarelo: perca 1 cliente e pague R$ 2.000,00.',
      cashDelta:-2000, clientsDelta:-1 },
    { id:'social_crisis', kind:'REVES', title:'Crise nas Redes',
      text:'Pague R$ 400,00 e perca 2 clientes.',
      cashDelta:-400, clientsDelta:-2 },
    { id:'car_break', kind:'REVES', title:'Carro Quebrou',
      text:'Conserto urgente. Pague R$ 1.000,00.',
      cashDelta:-1000 },
    { id:'best_seller_crash', kind:'REVES', title:'Melhor Vendedor Acidentado',
      text:'Sem seguro; fica 1 mês parado. Pague o valor equivalente ao recebimento do seu maior vendedor nesta rodada.' },
    { id:'service_improvement_1k', kind:'REVES', title:'Aprimoramentos de Serviço',
      text:'Pague R$ 1.000,00.',
      cashDelta:-1000 },
    { id:'recovery_failed_5k', kind:'REVES', title:'Recuperação Mal Sucedida',
      text:'Cancele grande pedido. Pague R$ 5.000,00.',
      cashDelta:-5000 },
    { id:'discount_pressure_1k', kind:'REVES', title:'Descontos Forçados',
      text:'Sem certificado verde: perca R$ 1.000,00 de lucro.',
      cashDelta:-1000 },
    { id:'domino_2k', kind:'REVES', title:'Efeito Dominó',
      text:'Cancelamentos em cadeia. Perca R$ 2.000,00.',
      cashDelta:-2000 },
    { id:'needs_change_lose4', kind:'REVES', title:'Necessidades Mudaram',
      text:'Sem Certificado Azul: perca 4 clientes.',
      clientsDelta:-4 },
    { id:'payroll_error_1k', kind:'REVES', title:'Erro na Folha',
      text:'Corrigir problema. Pague R$ 1.000,00.',
      cashDelta:-1000 },
    { id:'strike_lose5', kind:'REVES', title:'Greve Inesperada',
      text:'Atrasos e perdas. Perca 5 clientes.',
      clientsDelta:-5 },
    { id:'customs_hold_3k', kind:'REVES', title:'Alfândega',
      text:'Pague R$ 3.000,00.',
      cashDelta:-3000 },
    { id:'cyber_breach_7k_or_A', kind:'REVES', title:'Falha de Segurança',
      text:'Adquira nível A de infraestrutura ou pague R$ 7.000,00.',
      infraRequiresAOrPay:7000 },
    { id:'supplier_issue_2k', kind:'REVES', title:'Fornecedor em Crise',
      text:'Expedição expressa. Pague R$ 2.000,00.',
      cashDelta:-2000 },
    { id:'reg_change_30k', kind:'REVES', title:'Regulamentação Nova',
      text:'Adequação de processos. Pague R$ 30.000,00.',
      cashDelta:-30000 },
    { id:'bad_mix_2500', kind:'REVES', title:'Mix de Produtos Desequilibrado',
      text:'Descontos e liquidações. Pague R$ 2.500,00.',
      cashDelta:-2500 },
    { id:'quality_crisis', kind:'REVES', title:'Crise de Qualidade',
      text:'Perca 1 cliente e pague R$ 1.000,00.',
      cashDelta:-1000, clientsDelta:-1 },
  ], [])

  // Sorteia uma carta ao abrir
  const [card] = useState(() => CARDS[Math.floor(Math.random() * CARDS.length)])

  const resolve = () => {
    onResolve?.({
      action: 'APPLY_CARD',
      ...card,
    })
  }
  const cancel = () => onResolve?.({ action:'SKIP' })

  // Trava o scroll do body e foca no botão de fechar
  // (ESC e clique no backdrop NÃO fecham)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div style={S.wrap} role="dialog" aria-modal="true" aria-label="Sorte e Revés">
      <div style={S.card}>
        <button ref={closeRef} style={S.close} onClick={cancel} aria-label="Fechar">✕</button>

        <div style={S.badge(card.kind)}>{card.kind === 'SORTE' ? 'SORTE' : 'REVÉS'}</div>
        {card.title && <h2 style={S.title}>{card.title}</h2>}
        <p style={S.text}>{card.text}</p>

        <div style={S.footer}>
          <button type="button" style={S.okBtn} onClick={resolve}>OK</button>
        </div>
      </div>
    </div>
  )
}

const S = {
  wrap: { position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  card: { width:'min(760px, 92vw)', background:'#1b1f2a', color:'#e9ecf1', borderRadius:18, padding:'22px', border:'1px solid rgba(255,255,255,.12)', boxShadow:'0 10px 40px rgba(0,0,0,.4)', position:'relative' },
  close:{ position:'absolute', right:10, top:10, width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b', color:'#fff', cursor:'pointer' },
  badge:(kind)=>({
    display:'inline-block', padding:'6px 12px', borderRadius:999, fontWeight:900, marginBottom:8,
    background: kind==='SORTE' ? '#22c55e' : '#ef4444', color:'#111'
  }),
  title:{ margin:'2px 0 6px', fontWeight:900 },
  text:{ fontSize:18, lineHeight:1.5, opacity:.95, margin:'6px 0 14px' },
  footer:{ display:'flex', justifyContent:'center' },
  okBtn:{ minWidth:140, padding:'12px 18px', borderRadius:12, border:'none', fontWeight:900, cursor:'pointer', background:'#fff', color:'#111' },
}
