// src/modals/BuyManagerModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useModal } from './ModalContext'
import InsufficientFundsModal from './InsufficientFundsModal'

/**
 * Modal para compra de Gestor Comercial.
 *
 * Props:
 *  - onResolve: function
 *      • {action:'BUY', qty:number, unitHire:number, unitExpense:number,
 *         totalHire:number, totalExpense:number, cost:number, total:number,
 *         // deltas para o painel:
 *         cashDelta:number, expenseDelta:number, role:'MANAGER'}
 *      • {action:'SKIP'}
 *  - unitHire?: number     (custo de contratação por gestor — padrão 5000)
 *  - unitExpense?: number  (despesa mensal por gestor — padrão 3000)
 *  - managesUpTo?: number  (qtd. colaboradores por gestor — padrão 7, informativo)
 *  - currentCash?: number  (saldo atual do jogador para validação)
 */
export default function BuyManagerModal({
  onResolve,
  unitHire = 5000,
  unitExpense = 3000,
  managesUpTo = 7,
  currentCash = 0,
}) {
  const closeRef = useRef(null)
  const inputRef = useRef(null)
  // ✅ CORREÇÃO: Usa onResolve que é injetado pelo ModalContext
  const { pushModal, awaitTop } = useModal()

  const [qty, setQty] = useState('')

  const priceHire = Number(unitHire || 0)
  const monthly   = Number(unitExpense || 0)
  const cashNow   = Number(currentCash || 0)

  const qtyNum = useMemo(() => {
    const n = Math.floor(Number(qty))
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [qty])

  const maxQtyByCash = useMemo(() => {
    if (priceHire <= 0) return 0
    return Math.max(0, Math.floor(cashNow / priceHire))
  }, [cashNow, priceHire])

  const totalHire    = qtyNum * priceHire
  const totalExpense = qtyNum * monthly
  const canBuy       = qtyNum > 0

  const setBoundedQty = (val) => {
    const n = Math.floor(Number(val) || 0)
    const bounded = Math.max(0, Math.min(n, 1_000_000))
    setQty(String(bounded))
  }

  // ✅ CORREÇÃO: Usa onResolve diretamente (injetado pelo ModalContext)
  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }

  const handleBuy = async () => {
    if (!canBuy) return
    if (cashNow < totalHire) {
      pushModal(
        <InsufficientFundsModal
          requiredAmount={totalHire}
          currentCash={cashNow}
          title="Saldo insuficiente para contratar Gestores"
          message="Você não possui saldo suficiente para concluir esta contratação."
          okLabel="Entendi"
        />
      )
      await awaitTop()
      return
    }

    // ✅ CORREÇÃO: Usa onResolve diretamente
    onResolve?.({
      action: 'BUY',
      role: 'MANAGER',
      qty: qtyNum,
      headcount: qtyNum,            // compat extra
      gestoresDelta: qtyNum,        // <- faz o painel somar Gestores

      unitHire: priceHire,
      unitExpense: monthly,

      totalHire,
      totalExpense,

      // compat com fluxos que leem 'cost'/'total'
      cost: totalHire,
      total: totalHire,

      // deltas explícitos para o painel:
      cashDelta: -totalHire,
      expenseDelta: totalExpense,

      // dica opcional p/ HUD
      hudUpdate: { category: 'Gestores Comerciais', addQty: qtyNum },
    })
  }

  // UX: trava scroll, foca, Enter confirma
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t1 = setTimeout(() => closeRef.current?.focus?.(), 0)
    const t2 = setTimeout(() => inputRef.current?.focus?.(), 60)

    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleBuy()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKeyDown)
      clearTimeout(t1); clearTimeout(t2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      style={styles.wrap}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation() }}
    >
      <div style={styles.card} onMouseDown={(e) => e.stopPropagation()}>
        <button
          ref={closeRef}
          type="button"
          style={styles.close}
          onClick={handleClose}
          aria-label="Fechar"
        >✕</button>

        <h2 style={styles.title}>
          Você pode escolher quantos <b>Gestores</b> quer comprar,
          <br/>Digite o número de gestores:
        </h2>

        <div style={styles.inlineInfo}>
          <div>Saldo disponível: <b>$ {cashNow.toLocaleString()}</b></div>
          <div>Máximo por saldo: <b>{maxQtyByCash}</b></div>
        </div>

        <div style={styles.qtyRow}>
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Digite o número de Gestores"
            value={qty}
            onChange={(e) => setBoundedQty(e.target.value)}
            style={styles.input}
          />
          <div style={styles.quickBtns}>
            <button type="button" style={styles.qbtn} onClick={() => setBoundedQty(qtyNum + 1)}>+1</button>
            <button type="button" style={styles.qbtn} onClick={() => setBoundedQty(qtyNum + 5)}>+5</button>
            <button type="button" style={styles.qbtn} onClick={() => setBoundedQty(qtyNum + 10)}>+10</button>
            <button
              type="button"
              style={styles.qbtn}
              onClick={() => setBoundedQty(maxQtyByCash)}
              title="Comprar o máximo possível com o saldo atual"
            >
              Máx
            </button>
          </div>
        </div>

        <div style={styles.infoBox}>
          <div style={{fontWeight:800, marginBottom:6}}>GESTOR COMERCIAL</div>
          <div style={{opacity:.9, marginBottom:8}}>
            Base para cálculo de despesa: <b>x quantidade de Gestores</b>.<br/>
            Cada Gestor gerencia até <b>{managesUpTo}</b> colaboradores.
          </div>
          <div style={styles.table}>
            <div style={styles.trHead}>
              <div style={styles.th}>Certificação</div>
              <div style={styles.th}>Contratação</div>
              <div style={styles.th}>Despesa</div>
              <div style={styles.th}>Efeito</div>
            </div>
            <Row label="Sem Certificado"    hire={5000} expense={3000} revenue="potencializa colaboradores em 20%" />
            <Row label="Com 1 certificado"  hire="-"   expense={3500} revenue="potencializa colaboradores em 30%" />
            <Row label="Com 2 certificados" hire="-"   expense={4000} revenue="potencializa colaboradores em 40%" />
            <Row label="Com 3 certificados" hire="-"   expense={4500} revenue="potencializa colaboradores em 60%" />
          </div>
        </div>

        <div style={styles.summary}>
          <div>Custo de contratação: <b>$ {Number(unitHire).toLocaleString()}</b> / gestor</div>
          <div>Despesa mensal: <b>$ {Number(unitExpense).toLocaleString()}</b> / gestor</div>
        </div>

        <div style={styles.summaryStrong}>
          <div>Total contratar: <b>$ {Number(totalHire).toLocaleString()}</b></div>
          <div>Despesa mensal total: <b>$ {Number(totalExpense).toLocaleString()}</b></div>
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            style={{ ...styles.bigBtn, background:'#666', color:'#fff' }}
            onClick={handleClose}
          >
            Não comprar
          </button>
          <button
            type="button"
            style={{ ...styles.bigBtn, background: canBuy ? '#3fbf49' : '#2f5d33', color:'#09110f' }}
            onClick={handleBuy}
            disabled={!canBuy}
            title={!canBuy ? 'Informe uma quantidade válida' : (cashNow < totalHire ? 'Saldo insuficiente' : undefined)}
          >
            Comprar {canBuy ? `(${qtyNum})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, hire, expense, revenue }) {
  const fmt = (v) => (typeof v === 'number' ? `$ ${Number(v).toLocaleString()}` : v)
  return (
    <div style={styles.tr}>
      <div style={styles.td}>{label}</div>
      <div style={styles.td}>{fmt(hire)}</div>
      <div style={styles.td}>{fmt(expense)}</div>
      <div style={styles.td}>{revenue}</div>
    </div>
  )
}

const styles = {
  wrap: {
    position:'fixed', inset:0, background:'rgba(0,0,0,.55)',
    display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
  },
  card: {
    width:'min(880px, 92vw)', maxWidth:880, background:'#1b1f2a',
    color:'#e9ecf1', borderRadius:16, padding:'20px 20px 16px',
    boxShadow:'0 10px 40px rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.12)',
    position:'relative'
  },
  close: {
    position:'absolute', right:10, top:10, width:36, height:36,
    borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b',
    color:'#fff', cursor:'pointer'
  },
  title: { margin:'6px 0 12px', fontWeight:800, lineHeight:1.3 },
  inlineInfo: {
    display:'flex', justifyContent:'space-between', gap:10,
    margin:'0 0 8px', opacity:.95, fontWeight:700, flexWrap:'wrap'
  },
  qtyRow: { display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap' },
  input: {
    flex:'1 1 260px', height:42, borderRadius:10, padding:'0 12px',
    border:'1px solid rgba(255,255,255,.18)', background:'#0f1320', color:'#fff',
    outline:'none'
  },
  quickBtns: { display:'flex', gap:6, flexWrap:'wrap' },
  qbtn: {
    height:42, padding:'0 12px', borderRadius:10, border:'1px solid rgba(255,255,255,.18)',
    background:'#2a2f3b', color:'#fff', cursor:'pointer', fontWeight:800
  },
  infoBox: {
    border:'1px solid rgba(255,255,255,.12)', borderRadius:12,
    padding:'12px', background:'#101522', marginBottom:12
  },
  table: { border:'1px solid rgba(255,255,255,.12)', borderRadius:10, overflow:'hidden' },
  trHead: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 3fr', background:'#121621' },
  th: { padding:'10px 12px', fontWeight:800, borderLeft:'1px solid rgba(255,255,255,.06)' },
  tr: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 3fr', background:'#0f1320' },
  td: { padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,.06)', borderLeft:'1px solid rgba(255,255,255,.06)' },

  summary: {
    display:'flex', justifyContent:'space-between',
    border:'1px dashed rgba(255,255,255,.2)', borderRadius:10, padding:'8px 12px',
    marginTop:10, flexWrap:'wrap', gap:10
  },
  summaryStrong: {
    display:'flex', justifyContent:'space-between',
    border:'1px solid rgba(255,255,255,.25)', borderRadius:10, padding:'10px 12px',
    marginTop:8, fontWeight:800, flexWrap:'wrap', gap:10
  },
  actions: { display:'flex', gap:12, justifyContent:'center', marginTop:12, flexWrap:'wrap' },
  bigBtn: {
    minWidth:180, padding:'12px 18px', borderRadius:12, border:'none',
    fontWeight:900, cursor:'pointer'
  },
}
