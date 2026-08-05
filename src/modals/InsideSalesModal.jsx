// src/modals/InsideSalesModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useModal } from './ModalContext'
import InsufficientFundsModal from './InsufficientFundsModal'
import PurchaseImpactPreview from '../components/PurchaseImpactPreview.jsx'
import { VENDOR_RULES } from '../game/gameRules'
import { buildInsideSalesPurchaseDeltas } from '../game/insideSalesPurchase.js'
import { previewPurchaseImpact } from '../game/purchasePreview.js'

/**
 * onResolve(payload)
 *  - { action:'BUY',
 *      qty:number,
 *      headcount:number,
 *      unitHire:number,
 *      total:number,
 *      cost:number,
 *      totalCost:number,
 *      baseExpense:number,
 *      baseRevenue:number }
 *  - { action:'SKIP' }
 *
 * Props:
 *  - currentCash?: number (saldo atual do jogador)
 *  - currentPlayer?: object (snapshot somente leitura para preview)
 */
export default function InsideSalesModal({ onResolve, currentCash = 0, currentPlayer = null, allowBack = false }) {
  const closeRef = useRef(null)
  const [qty, setQty] = useState('')
  const { pushModal, awaitTop } = useModal()

  // Valores base (conforme regra centralizada; contratação é CAPEX e não faz parte do gameMath)
  const unitHire = 3000
  const baseExpense = VENDOR_RULES.inside.baseDesp
  const baseRevenue = VENDOR_RULES.inside.baseFat
  const attendsUpTo = VENDOR_RULES.inside.cap

  const money = (n) => `$ ${Number(n || 0).toLocaleString()}`
  const expenseAt = (certs) => VENDOR_RULES.inside.baseDesp + VENDOR_RULES.inside.incDesp * Math.max(0, certs)
  const revenueAt = (certs) => VENDOR_RULES.inside.baseFat + VENDOR_RULES.inside.incFat * Math.max(0, certs)

  const qtyNum = useMemo(() => {
    const n = Number(qty)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }, [qty])

  const totalCost = qtyNum * unitHire
  const canBuy = qtyNum > 0

  // Máximo por saldo (apenas ajuda visual/atalhos)
  const maxBySaldo = Math.max(0, Math.floor(Number(currentCash || 0) / unitHire))

  const purchaseImpact = useMemo(() => {
    const playerSnapshot = currentPlayer || { cash: Number(currentCash || 0) }
    const draftPayload = {
      action: 'BUY',
      qty: qtyNum,
      headcount: qtyNum,
      unitHire,
      total: totalCost,
      cost: totalCost,
      totalCost,
      baseExpense,
      baseRevenue,
    }
    const deltas = buildInsideSalesPurchaseDeltas(draftPayload)
    return previewPurchaseImpact({
      player: playerSnapshot,
      deltas,
      immediateCost: totalCost,
    })
  }, [currentPlayer, currentCash, qtyNum, unitHire, totalCost, baseExpense, baseRevenue])

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }
  const handleBack = (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); onResolve?.({ action:'BACK' }) }

  const bump = (n) => {
    const cur = Number(qty) || 0
    const next = Math.min(maxBySaldo || Infinity, cur + n)
    setQty(next || '')
  }
  const setMax = () => setQty(maxBySaldo || '')

  const handleBuy = async () => {
    if (!canBuy) return

    const cash = Number(currentCash || 0)
    const need = Number(totalCost || 0)

    if (cash < need) {
      // Alerta de saldo insuficiente (mantém esta modal aberta)
      pushModal(
        <InsufficientFundsModal
          requiredAmount={need}
          currentCash={cash}
          title="Saldo insuficiente para contratar Inside Sales"
          message={`Você precisa de $ ${need.toLocaleString()} mas possui $ ${cash.toLocaleString()}.`}
          okLabel="Entendi"
        />
      )
      await awaitTop()
      return
    }

    onResolve?.({
      action: 'BUY',
      qty: qtyNum,
      headcount: qtyNum,
      unitHire,
      total: totalCost,
      cost: totalCost,
      totalCost,
      baseExpense,
      baseRevenue,
    })
  }

  // UX: trava scroll do body e foca no botão de fechar
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div className="isWrap" role="dialog" aria-modal="true" aria-label="Inside Sales">
      <div className="isCard">
        <button
          ref={closeRef}
          type="button"
          style={S.close}
          onClick={handleClose}
          aria-label="Fechar"
        >✕</button>

        <h2 className="isTitle">Você pode escolher quantos <b>Inside Sales</b> quer comprar:</h2>

        <p className="purchasePreviewHint">
          O Inside Sales aumenta a capacidade de atendimento em {attendsUpTo} clientes,
          gera faturamento pelas regras atuais da equipe e adiciona despesas mensais.
          Treinamentos aumentam seu faturamento e suas despesas. Gestores certificados
          podem potencializar o faturamento dos vendedores.
        </p>

        {/* Aviso (texto do manual) */}
        <div style={S.note}>
          <div style={{fontWeight:900, marginBottom:4}}>INSIDE SALES (SDR/BDR + CLOSER + CS)</div>
          <div><b>Base para cálculo despesa:</b> × quantidade <b>field sales</b> ou <b>inside sales</b>.</div>
          <div><b>Base para cálculo faturamento:</b> × quantidade <b>máxima de clientes que cada vendedor pode atender</b>.</div>
        </div>

        {/* Linha de saldo e máximo por saldo */}
        <div className="isSaldoRow" style={S.saldoRow}>
          <div>Saldo disponível: <b>$ {Number(currentCash || 0).toLocaleString()}</b></div>
          <div>Máximo por saldo: <b>{maxBySaldo}</b></div>
        </div>

        {/* Input + atalhos rápidos */}
        <div className="isInputRow">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Digite o número de Inside Sales"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="isInput"
            style={S.input}
          />
          <div className="isQuickBtns">
            <button type="button" className="isQuickBtn" style={S.quickBtn} onClick={() => bump(1)}>+1</button>
            <button type="button" className="isQuickBtn" style={S.quickBtn} onClick={() => bump(5)}>+5</button>
            <button type="button" className="isQuickBtn" style={S.quickBtn} onClick={() => bump(10)}>+10</button>
            <button type="button" className="isQuickBtn" style={{...S.quickBtn, fontWeight:900}} onClick={setMax}>Máx</button>
          </div>
          <div className="isTotalBox" style={S.totalBox}>
            Total contratar: <b>$ {Number(totalCost).toLocaleString()}</b>
          </div>
        </div>

        {/* Cards coloridos ilustrativos (certificações) */}
        <div className="isCards">
          <Card
            title="Sem certificado"
            bg="#2a2f3b"
            pill="BASE"
            lines={[
              `Contratação: $ ${unitHire.toLocaleString()}`,
              `Despesa: ${money(expenseAt(0))}`,
              `Faturamento: ${money(revenueAt(0))}`
            ]}
          />
          <Card
            title="1 certificado"
            bg="#f1c40f"
            pill="NÍVEL 1"
            dark
            lines={[
              'Contratação: —',
              `Despesa: ${money(expenseAt(1))}`,
              `Faturamento: ${money(revenueAt(1))}`
            ]}
          />
          <Card
            title="2 certificados"
            bg="#a78bfa"
            pill="NÍVEL 2"
            dark
            lines={[
              'Contratação: —',
              `Despesa: ${money(expenseAt(2))}`,
              `Faturamento: ${money(revenueAt(2))}`
            ]}
          />
          <Card
            title="3 certificados"
            bg="#8b5cf6"
            pill="NÍVEL 3"
            dark
            lines={[
              'Contratação: —',
              `Despesa: ${money(expenseAt(3))}`,
              `Faturamento: ${money(revenueAt(3))}`
            ]}
          />
        </div>

        <PurchaseImpactPreview impact={purchaseImpact} />

        <div className="isActions" style={S.actions}>
          {allowBack && (
            <button type="button" className="isBigBtn" style={{ ...S.bigBtn, background:'#2a2f3b', color:'#fff' }} onClick={handleBack}>
              Voltar
            </button>
          )}
          <button type="button" className="isBigBtn" style={{ ...S.bigBtn, background:'#666', color:'#fff' }} onClick={handleClose}>
            Não comprar
          </button>
          <button
            type="button"
            className="isBigBtn"
            style={{ ...S.bigBtn, background: canBuy ? '#3fbf49' : '#2f5d33', color:'#09110f' }}
            onClick={handleBuy}
            disabled={!canBuy}
            title={!canBuy ? 'Informe uma quantidade válida' : undefined}
          >
            Comprar {canBuy ? `($ ${totalCost.toLocaleString()})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

function Card({ title, pill, lines, bg, dark=false }) {
  return (
    <div style={{...S.cardItem, background:bg, color: dark ? '#111' : '#fff', borderColor: 'rgba(255,255,255,.15)'}}>
      <div className="isCardHead" style={S.cardHeader}>
        <span className="isPill" style={{...S.pill, background: dark ? '#111' : '#fff', color: dark ? '#fff' : '#111'}}>{pill}</span>
        <div style={{fontWeight:900}}>{title}</div>
      </div>
      <ul style={S.lines}>
        {lines.map((ln,i)=><li key={i}>{ln}</li>)}
      </ul>
    </div>
  )
}

const S = {
  /* wrap, card, title, inputRow (grid), quickBtns (layout) e cards migraram
     para classes CSS responsivas (.isWrap, .isCard, .isTitle, .isInputRow,
     .isQuickBtns, .isCards em styles.css) */
  close: { position:'absolute', right:10, top:10, width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b', color:'#fff', cursor:'pointer' },

  note: {
    background:'#2a2f3b',
    border:'1px solid rgba(255,255,255,.15)',
    borderRadius:12,
    padding:'10px 12px',
    margin:'0 0 10px'
  },

  saldoRow: {
    display:'flex', justifyContent:'space-between', gap:12,
    padding:'8px 12px', border:'1px dashed rgba(255,255,255,.25)', borderRadius:10, marginBottom:8
  },

  input: {
    height:42, borderRadius:10, padding:'0 12px',
    border:'1px solid rgba(255,255,255,.18)', background:'#0f1320', color:'#fff',
    outline:'none'
  },

  /* min-width migrou para .isQuickBtn (zera no mobile) */
  quickBtn:{
    height:42, borderRadius:10, border:'1px solid rgba(255,255,255,.18)',
    background:'#2a2f3b', color:'#fff', fontWeight:800, cursor:'pointer', padding:'0 10px'
  },

  totalBox:{ padding:'8px 12px', borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#0f1320', fontWeight:900 },

  cardItem:{ border:'1px solid', borderRadius:14, padding:'14px' },
  cardHeader:{ display:'flex', alignItems:'center', gap:8, marginBottom:8 },
  pill:{ fontSize:12, fontWeight:900, padding:'4px 8px', borderRadius:999 },
  lines:{ margin:0, padding:'0 0 0 16px', lineHeight:1.35 },

  actions: { display:'flex', gap:12, justifyContent:'center', marginTop:8 },
  /* min-width migrou para .isBigBtn (largura total no mobile) */
  bigBtn: { padding:'12px 18px', borderRadius:12, border:'none', fontWeight:900, cursor:'pointer' },
}
