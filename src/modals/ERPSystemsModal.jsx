// src/modals/ERPSystemsModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useModal } from './ModalContext'
import InsufficientFundsModal from './InsufficientFundsModal'
import PurchaseImpactPreview from '../components/PurchaseImpactPreview.jsx'
import { ERP_RULES } from '../game/gameRules'
import {
  buildErpPurchaseDeltas,
  calculateErpReturn,
  countErpCollaborators,
} from '../game/erpPurchase.js'
import { previewPurchaseImpact } from '../game/purchasePreview.js'

const LEVELS = {
  A: { compra: 10000, despesa: ERP_RULES.A.desp, faturamento: ERP_RULES.A.fat, color:'#1d4ed8', pill:'NÍVEL A' },
  B: { compra: 4000,  despesa: ERP_RULES.B.desp, faturamento: ERP_RULES.B.fat, color:'#16a34a', pill:'NÍVEL B' },
  C: { compra: 1500,  despesa: ERP_RULES.C.desp, faturamento: ERP_RULES.C.fat, color:'#f59e0b', pill:'NÍVEL C' },
  D: { compra: 500,   despesa: ERP_RULES.D.desp, faturamento: ERP_RULES.D.fat, color:'#6b7280', pill:'NÍVEL D' } // agora comprável
}

/**
 * onResolve(payload)
 *  - {action:'BUY', level:'A'|'B'|'C'|'D', values:{...}}
 *  - {action:'SKIP'}
 *
 * Props:
 *  - currentCash?: number (saldo atual do jogador; usado para validar compra)
 *  - currentLevel?: string (nível atual do ERP: 'A', 'B', 'C', 'D' ou null)
 *  - erpOwned?: object (níveis possuídos: { A:boolean, B:boolean, C:boolean, D:boolean })
 *  - currentPlayer?: object (snapshot somente leitura para preview)
 */
export default function ERPSystemsModal({ onResolve, currentCash = 0, currentLevel = null, erpOwned = null, allowBack = false, currentPlayer = null }) {
  const closeRef = useRef(null)
  const { pushModal, awaitTop } = useModal()
  const [selectedLevel, setSelectedLevel] = useState(null)

  const normLevel = (v) => { const L = String(v || '').toUpperCase(); return ['A', 'B', 'C', 'D'].includes(L) ? L : '' }
  const current = normLevel(currentLevel) || 'D'
  const cashNow = Number(currentCash || 0)
  const staffCount = countErpCollaborators(currentPlayer || { cash: cashNow })

  const draftPayload = useMemo(() => {
    const desired = normLevel(selectedLevel)
    if (!desired || desired === current) return null
    const values = LEVELS[desired]
    if (!values) return null
    return { action: 'BUY', level: desired, values }
  }, [selectedLevel, current])

  const purchaseImpact = useMemo(() => {
    if (!draftPayload) return null
    const playerSnapshot = {
      ...(currentPlayer || {}),
      cash: cashNow,
      erpLevel: current,
    }
    const deltas = buildErpPurchaseDeltas(draftPayload)
    return previewPurchaseImpact({
      player: playerSnapshot,
      deltas,
      immediateCost: draftPayload.values.compra,
    })
  }, [draftPayload, currentPlayer, cashNow, current])

  const erpReturn = useMemo(() => {
    if (!purchaseImpact) return null
    return calculateErpReturn({ impact: purchaseImpact, horizonRounds: 5 })
  }, [purchaseImpact])

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }
  const handleBack = (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); onResolve?.({ action:'BACK' }) }

  const handleSelect = (level) => {
    const desired = normLevel(level)
    if (!desired) return
    // ✅ Bloqueia só recompra do nível ATUAL
    if (desired === current) return
    setSelectedLevel(desired)
  }

  const handleBuy = async () => {
    if (!draftPayload) return

    const desired = draftPayload.level
    const values = draftPayload.values
    const need = Number(values?.compra || 0)

    if (cashNow < need) {
      pushModal(
        <InsufficientFundsModal
          requiredAmount={need}
          currentCash={cashNow}
          title="Saldo insuficiente para comprar ERP"
          message={`Você precisa de $ ${need.toLocaleString()} para o ERP nível ${desired}, mas possui $ ${cashNow.toLocaleString()}.`}
          okLabel="Entendi"
        />
      )
      await awaitTop()
      return
    }
    onResolve?.({ action: 'BUY', level: desired, values })
  }

  // UX: trava scroll e foca no X (ESC/backdrop não fecham)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  const formatMoneySigned = (n) => {
    const v = Number(n || 0)
    const abs = Math.abs(v).toLocaleString()
    if (v > 0) return `+ $ ${abs}`
    if (v < 0) return `- $ ${abs}`
    return `$ ${abs}`
  }

  const paybackLabel = (() => {
    if (!erpReturn) return null
    if (erpReturn.status === 'no_financial_return' || erpReturn.paybackRounds == null) {
      return 'Sem retorno financeiro estimado'
    }
    if (erpReturn.paybackRounds === 0) {
      return 'Retorno estimado: 0 rodadas'
    }
    const rounded = Math.ceil(erpReturn.paybackRounds * 10) / 10
    return `Retorno estimado: ${rounded} rodadas`
  })()

  return (
    <div style={S.wrap} role="dialog" aria-modal="true" aria-label="ERP/Sistemas">
      <div style={S.card}>
        <button ref={closeRef} type="button" style={S.close} onClick={handleClose} aria-label="Fechar">✕</button>

        <h2 style={S.title}>Escolha o nível de <b>ERP / Sistemas</b>:</h2>

        {/* Nota explicativa */}
        <div style={S.note}>
          <div style={{fontWeight:900, marginBottom:4}}>ERP / SISTEMAS</div>
          <div><b>Impacto mensal:</b> adiciona <b>Despesa</b> e <b>Faturamento</b> de acordo com o nível.</div>
          <div>O nível <b>D</b> também pode ser adquirido.</div>
        </div>

        <p className="purchasePreviewHint">
          O ERP gera faturamento e despesas por colaborador da equipe comercial
          (Vendedores Comuns, Inside Sales, Field Sales e Gestores Comerciais).
          Ele não escala diretamente com a quantidade de clientes, clientes atendidos
          ou certificações. Avalie o impacto líquido e o tempo estimado para recuperar
          o investimento antes de trocar de nível.
        </p>

        {/* Saldo disponível (ajuda visual) */}
        <div style={S.saldo}>Saldo disponível: <b>$ {cashNow.toLocaleString()}</b></div>

        {/* Tabela comparativa */}
        <div style={S.table}>
          <div style={S.trHead}>
            <div style={S.th}></div>
            <div style={{...S.th, background:'#10214d'}}>Nível A</div>
            <div style={{...S.th, background:'#0f3a1c'}}>Nível B</div>
            <div style={{...S.th, background:'#4a3705'}}>Nível C</div>
            <div style={{...S.th, background:'#2a2f3b'}}>Nível D</div>
          </div>
          <Row label="COMPRA"      fmt vA={LEVELS.A.compra} vB={LEVELS.B.compra} vC={LEVELS.C.compra} vD={LEVELS.D.compra} />
          <Row label="DESPESA"     fmt vA={LEVELS.A.despesa} vB={LEVELS.B.despesa} vC={LEVELS.C.despesa} vD={LEVELS.D.despesa} />
          <Row label="FATURAMENTO" fmt vA={LEVELS.A.faturamento} vB={LEVELS.B.faturamento} vC={LEVELS.C.faturamento} vD={LEVELS.D.faturamento} />
        </div>
        <div style={S.perStaffNote}>Valores de despesa e faturamento na tabela são <b>por colaborador</b>.</div>

        {/* Cards + botões */}
        <div style={S.cards}>
          {(['A','B','C','D']).map((k) => {
            const v = LEVELS[k]
            const isOwned = current === k  // ✅ apenas o atual
            const isDisabled = isOwned
            const isSelected = selectedLevel === k

            return (
              <div key={k} style={{
                ...S.cardItem, 
                borderColor: isOwned ? '#16a34a' : (isSelected ? '#2442f9' : 'rgba(255,255,255,.15)'),
                opacity: isDisabled ? 0.6 : 1
              }}>
                <div style={{
                  ...S.pill, 
                  background: isOwned ? '#16a34a' : '#fff', 
                  color: isOwned ? '#fff' : '#111'
                }}>
                  {isOwned ? '✓ ADQUIRIDO' : v.pill}
                </div>
                <div style={{...S.cardBadge, background:v.color}} />
                <ul style={S.lines}>
                  <li>Compra: <b>$ {v.compra.toLocaleString()}</b></li>
                  <li>Despesa: <b>$ {v.despesa.toLocaleString()}</b> / colab.</li>
                  <li>Faturamento: <b>$ {v.faturamento.toLocaleString()}</b> / colab.</li>
                </ul>
                <button
                  type="button"
                  style={{
                    ...S.buyBtn,
                    background: isDisabled ? '#6b7280' : (isSelected ? '#1d4ed8' : '#2442f9'),
                    cursor: isDisabled ? 'not-allowed' : 'pointer'
                  }}
                  onClick={() => handleSelect(k)}
                  disabled={isDisabled}
                  title={isDisabled ? `ERP nível ${k} já adquirido` : `Selecionar ERP nível ${k}`}
                >
                  {isDisabled ? 'Já Adquirido' : (isSelected ? `Selecionado ${k}` : `Selecionar ${k}`)}
                </button>
              </div>
            )
          })}
        </div>

        {purchaseImpact && (
          <>
            <PurchaseImpactPreview impact={purchaseImpact} />

            <div className="purchasePreviewExtra">
              <div className="purchasePreviewExtraTitle">Retorno do investimento (ERP)</div>
              <div className="purchasePreviewRow">
                <span>Impacto líquido incremental por rodada</span>
                <span>{formatMoneySigned(erpReturn?.incrementalNet)}</span>
              </div>
              <div className="purchasePreviewRow purchasePreviewRowStrong">
                <span>{paybackLabel}</span>
              </div>
              {staffCount <= 0 && (
                <div className="purchasePreviewAlert">
                  Sem colaboradores, o ERP não gera faturamento nem despesa operacional neste momento.
                </div>
              )}
              {erpReturn && !erpReturn.paysBackWithinHorizon && erpReturn.status !== 'no_cost' && (
                <div className="purchasePreviewAlert">
                  Este investimento não se recupera no horizonte atual de 5 rodadas.
                </div>
              )}
            </div>
          </>
        )}

        <div style={S.actions}>
          {allowBack && (
            <button type="button" style={{ ...S.bigBtn, background:'#2a2f3b', color:'#fff' }} onClick={handleBack}>
              Voltar
            </button>
          )}
          <button type="button" style={{ ...S.bigBtn, background:'#444', color:'#fff' }} onClick={handleClose}>
            Não comprar
          </button>
          <button
            type="button"
            style={{
              ...S.bigBtn,
              background: draftPayload ? '#75e16c' : '#365b31',
              color: '#0b120a',
              cursor: draftPayload ? 'pointer' : 'not-allowed',
            }}
            onClick={handleBuy}
            disabled={!draftPayload}
            title={!draftPayload ? 'Selecione um nível diferente do atual' : `Confirmar compra do nível ${draftPayload.level}`}
          >
            {draftPayload ? `Confirmar compra ${draftPayload.level}` : 'Confirmar compra'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, vA, vB, vC, vD, fmt }) {
  const f = (n) => fmt ? `$ ${Number(n).toLocaleString()}` : n
  return (
    <div style={S.tr}>
      <div style={{...S.td, fontWeight:700}}>{label}</div>
      <div style={S.td}>{f(vA)}</div>
      <div style={S.td}>{f(vB)}</div>
      <div style={S.td}>{f(vC)}</div>
      <div style={S.td}>{f(vD)}</div>
    </div>
  )
}

const S = {
  wrap: { position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  card: {
    width:'min(980px, 94vw)', maxHeight:'92vh', overflowY:'auto', background:'#1b1f2a', color:'#e9ecf1',
    borderRadius:16, padding:'20px', boxShadow:'0 10px 40px rgba(0,0,0,.4)',
    border:'1px solid rgba(255,255,255,.12)', position:'relative'
  },
  close: { position:'absolute', right:10, top:10, width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b', color:'#fff', cursor:'pointer' },
  title:{ margin:'6px 0 12px', fontWeight:900 },

  note: {
    background:'#2a2f3b',
    border:'1px solid rgba(255,255,255,.15)',
    borderRadius:12,
    padding:'10px 12px',
    margin:'0 0 10px'
  },

  saldo:{ margin:'0 0 10px', padding:'8px 12px', border:'1px dashed rgba(255,255,255,.25)', borderRadius:10 },
  perStaffNote: { margin:'0 0 10px', fontSize:13, opacity:0.9 },

  table: { border:'1px solid rgba(255,255,255,.12)', borderRadius:12, overflow:'hidden', marginBottom:8 },
  trHead: { display:'grid', gridTemplateColumns:'1fr repeat(4, 1fr)', background:'#121621' },
  th: { padding:'10px 12px', fontWeight:800, borderLeft:'1px solid rgba(255,255,255,.06)' },
  tr: { display:'grid', gridTemplateColumns:'1fr repeat(4, 1fr)', background:'#0f1320' },
  td: { padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,.06)', borderLeft:'1px solid rgba(255,255,255,.06)' },

  cards:{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:12, marginTop:8, marginBottom:12 },
  cardItem:{ background:'#0f1320', border:'1px solid', borderRadius:14, padding:'12px', display:'flex', flexDirection:'column', gap:8 },
  cardBadge:{ width:'100%', height:6, borderRadius:999, opacity:.9 },
  pill:{ alignSelf:'flex-start', fontSize:12, fontWeight:900, padding:'4px 8px', borderRadius:999, color:'#111' },
  lines:{ margin:0, padding:'0 0 0 16px', lineHeight:1.35 },

  buyBtn:{ marginTop:'auto', padding:'10px 12px', borderRadius:10, border:'none', fontWeight:900, cursor:'pointer', background:'#2442f9', color:'#fff' },

  actions: { display:'flex', gap:12, justifyContent:'center', marginTop:14, flexWrap:'wrap' },
  bigBtn: { minWidth:160, padding:'14px 18px', borderRadius:12, border:'none', color:'#fff', fontWeight:900, cursor:'pointer' },
}
