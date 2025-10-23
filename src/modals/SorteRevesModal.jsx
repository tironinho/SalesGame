// src/modals/SorteRevesModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Modal "Sorte & Revés"
 *
 * Ajustes:
 * - Removidas as cartas que não geram impacto financeiro direto (ex.: habeas
 *   corpus, “compra livre”, ganhar célula/gestor, subir infraestrutura sem custo).
 * - Cartas condicionais agora olham o estado do jogador (prop `player`) e
 *   recalculam os efeitos (ex.: se tiver certificado amarelo, “Cliente Chave em Risco”
 *   não aplica penalidade).
 * - Carta “Gestão de Mudanças Bem-sucedida” agora retorna um `certDelta` para
 *   o jogo creditar um certificado azul (az: +1) ao jogador.
 *
 * IMPORTANTE: Em App.jsx, ao aplicar o resultado da carta, some `certDelta.az`/`am`/`rox`
 * nos contadores do jogador, se existirem (ex.: next.az = (next.az||0) + certDelta.az).
 */

export default function SorteRevesModal({ onResolve, player = {} }) {
  const closeRef = useRef(null)

  // ===== helpers de leitura do jogador =====
  const get = (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d
  const hasYellowCert = (p) => get(p.am, 0) > 0
  const hasBlueCert   = (p) => get(p.az, 0) > 0
  const hasPurpleCert = (p) => get(p.rox, 0) > 0
  const erpLevelA     = (p) => String(p.erpLevel || p.erpSistemas || 'D').toUpperCase() === 'A'
  const mixIsAB       = (p) => {
    const lvl = String(p.mixProdutos || 'D').toUpperCase()
    return lvl === 'A' || lvl === 'B'
  }
  const managersCertCount = (p) => {
    // tenta ler certificações específicas de gestores (se existir no estado)
    const setSize = (obj) => {
      if (!obj) return 0
      try {
        const arr = Array.isArray(obj) ? obj : Object.values(obj)
        return new Set(arr).size
      } catch { return 0 }
    }
    if (p.trainingsByVendor?.gestor) {
      return setSize(p.trainingsByVendor.gestor)
    }
    // fallback: campo direto se existir
    return get(p.gestoresCertificados, 0)
  }
  const teamSize = (p) =>
    get(p.vendedoresComuns) +
    get(p.insideSales) +
    get(p.fieldSales) +
    get(p.gestores ?? p.gestoresComerciais ?? p.managers)

  // === BARALHO (só cartas com efeito financeiro direto + as 2 solicitadas) ===
  const CARDS = useMemo(() => [
    // ----- SORTE -----
    { id:'gov_fgts', kind:'SORTE', title:'Ação Governamental Positiva',
      text:'Liberação de FGTS aumentou o poder de compra. Receba 5 novos clientes (se tiver equipe para atender).',
      clientsDelta:+5 },

    { id:'referral_bonus', kind:'SORTE', title:'Indicação Lucrativa',
      text:'Um cliente indicou amigos e a primeira compra foi ótima. Receba R$ 800,00.',
      cashDelta:+800 },

    { id:'network_cert_mgr', kind:'SORTE', title:'Rede Estratégica',
      text:'Para cada gestor com certificado, receba R$ 5.000,00.',
      _compute:(p)=>({ cashDelta: 5000 * managersCertCount(p) }) },

    { id:'innovation_invest', kind:'SORTE', title:'Inovação Premiada',
      text:'Se tiver infraestrutura (mix/sistemas) nível A ou B, receba aporte de R$ 25.000,00.',
      _compute:(p)=>({ cashDelta: mixIsAB(p) ? 25000 : 0 }) },

    { id:'segmentation', kind:'SORTE', title:'Segmentação Inteligente',
      text:'Novo segmento lucrativo. Receba R$ 1.000,00.',
      cashDelta:+1000 },

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
      text:'Um vendedor generalista concluiu todos os treinamentos. Ganhe um certificado AZUL para esse vendedor.',
      _compute:()=>({ certDelta:{ az:1 } }) },

    { id:'training_roi_team', kind:'SORTE', title:'Treinamento Personalizado',
      text:'Receba R$ 500,00 por membro participante.',
      _compute:(p)=>({ cashDelta: 500 * Math.max(0, teamSize(p)) }) },

    { id:'purple_award_25k', kind:'SORTE', title:'Profissional do Ano (Roxo)',
      text:'Se houver pelo menos um colaborador com certificado roxo, receba R$ 25.000,00.',
      _compute:(p)=>({ cashDelta: hasPurpleCert(p) ? 25000 : 0 }) },

    { id:'reputation_1500', kind:'SORTE', title:'Reputação Impecável',
      text:'Ótimas avaliações elevam a confiança. Receba R$ 1.500,00.',
      cashDelta:+1500 },

    { id:'client_cheer_per_client', kind:'SORTE', title:'Cliente Promotor',
      text:'Ganhe R$ 500,00 por cada cliente atual.',
      _compute:(p)=>({ cashDelta: 500 * Math.max(0, get(p.clients)) }) },

    { id:'big_order_freight_save', kind:'SORTE', title:'Grande Pedido + Frete Econômico',
      text:'Receba R$ 1.500,00.',
      cashDelta:+1500 },

    { id:'sales_win_2k', kind:'SORTE', title:'Vitória de Vendas',
      text:'Venda aguardada foi fechada. Receba R$ 2.000,00.',
      cashDelta:+2000 },

    // ----- REVÉS -----
    { id:'missed_admission', kind:'REVES', title:'Admissão Não Reportada',
      text:'Multa governamental. Pague R$ 3.000,00.',
      cashDelta:-3000 },

    { id:'office_renovation', kind:'REVES', title:'Renovação Custosa',
      text:'Gastos de obra. Pague R$ 7.000,00.',
      cashDelta:-7000 },

    { id:'env_fine_20k', kind:'REVES', title:'Impacto Ambiental',
      text:'Multa ambiental. Pague R$ 20.000,00.',
      cashDelta:-20000 },

    { id:'key_client_at_risk', kind:'REVES', title:'Cliente Chave em Risco',
      text:'Sem certificado AMARELO: perca 1 cliente e pague R$ 2.000,00.',
      _compute:(p)=> hasYellowCert(p) ? { clientsDelta:0, cashDelta:0, _overrideText:'Você possui certificado amarelo. Nada acontece.' }
                                     : { clientsDelta:-1, cashDelta:-2000 } },

    { id:'social_crisis', kind:'REVES', title:'Crise nas Redes',
      text:'Pague R$ 400,00 e perca 2 clientes.',
      cashDelta:-400, clientsDelta:-2 },

    { id:'car_break', kind:'REVES', title:'Carro Quebrou',
      text:'Conserto urgente. Pague R$ 1.000,00.',
      cashDelta:-1000 },

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
      text:'Sem certificado AZUL: perca 4 clientes.',
      _compute:(p)=> hasBlueCert(p) ? { clientsDelta:0, _overrideText:'Você possui certificado azul. Nada acontece.' }
                                     : { clientsDelta:-4 } },

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
      text:'Se NÃO tiver sistemas nível A, pague R$ 7.000,00.',
      _compute:(p)=>({ cashDelta: erpLevelA(p) ? 0 : -7000 }) },

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
  ], []) // FIM BARALHO

  // Sorteia uma carta ao abrir
  const [card] = useState(() => CARDS[Math.floor(Math.random() * CARDS.length)])

  // Calcula efeito resolvido para EXIBIÇÃO e para o payload
  const resolved = useMemo(() => {
    const base = { action:'APPLY_CARD', kind: card.kind, id: card.id, title: card.title }
    if (typeof card._compute === 'function') {
      const dyn = card._compute(player || {})
      const { _overrideText, ...effect } = (dyn || {})
      return {
        text: _overrideText || card.text,
        payload: { ...base, ...effect }
      }
    }
    // efeito fixo da carta
    const fixed = {}
    if (Number.isFinite(card.cashDelta)) fixed.cashDelta = Number(card.cashDelta)
    if (Number.isFinite(card.clientsDelta)) fixed.clientsDelta = Number(card.clientsDelta)
    return { text: card.text, payload: { ...base, ...fixed } }
  }, [card, player])

  const resolve = () => onResolve?.(resolved.payload)
  const cancel = () => onResolve?.({ action:'SKIP' })

  // Trava o scroll do body e foca no botão de fechar
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
        <p style={S.text}>{resolved.text}</p>

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
