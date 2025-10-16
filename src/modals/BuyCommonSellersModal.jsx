// src/modals/BuyCommonSellersModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import InsufficientFundsModal from './InsufficientFundsModal'
import { useModal } from './ModalContext'

/**
 * Modal de compra de Vendedores Comuns (faz tudo)
 *
 * Resolve com:
 *  • { action:'BUY',
 *      role:'COMMON',
 *      qty:number, headcount:number,
 *      unitHire:number, unitExpense:number,
 *      totalHire:number, totalExpense:number,
 *      // compat extras
 *      total:number, cost:number,
 *      // >>> deltas p/ painel e saldo:
 *      cashDelta:number,        // negativo (debita contratação)
 *      expenseDelta:number,     // positivo (despesa mensal total)
 *      revenueDelta:number,     // positivo (receita mensal base)
 *      revenuePerSeller:number, // 600
 *      attendsUpTo:number,
 *      hudUpdate:{ category:'Vendedores Comuns', addQty:number }
 *    }
 *  • { action:'SKIP' }
 */
export default function BuyCommonSellersModal({
  onResolve,
  unitHire = 1500,
  unitExpense = 1000,
  attendsUpTo = 2,
  currentCash = 0,
}) {
  const [qty, setQty] = useState('')
  const closeRef = useRef(null)
  const inputRef = useRef(null)

  // >>> pega closeTop do contexto (é ele que resolve o awaitTop no App.jsx)
  const { pushModal, awaitTop, closeTop } = useModal()

  const priceHire = Number(unitHire || 0)
  const monthly   = Number(unitExpense || 0)
  const cashNow   = Number(currentCash || 0)

  // Receita base por vendedor (S/ Certificado) conforme tabela exibida
  const revenuePerSeller = 600

  const qtyNum = useMemo(() => {
    const n = Math.floor(Number(qty))
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [qty])

  const maxQtyByCash = useMemo(() => {
    if (priceHire <= 0) return 0
    return Math.max(0, Math.floor(cashNow / priceHire))
  }, [cashNow, priceHire])

  const totalHire    = useMemo(() => qtyNum * priceHire, [qtyNum, priceHire])
  const totalExpense = useMemo(() => qtyNum * monthly,   [qtyNum, monthly])

  const canBuy = qtyNum > 0

  const setBoundedQty = (val) => {
    const n = Math.floor(Number(val) || 0)
    const bounded = Math.max(0, Math.min(n, 1_000_000))
    setQty(String(bounded))
  }

  // helper para resolver (prioriza closeTop; mantém fallback p/ onResolve se existir)
  const resolve = (payload) => {
    if (typeof closeTop === 'function') return closeTop(payload)
    onResolve?.(payload)
  }

  const handleClose = (ev) => {
    ev?.stopPropagation?.()
    resolve({ action: 'SKIP' })
  }

  const handleBuy = async () => {
    if (!canBuy) return
    if (cashNow < totalHire) {
      pushModal(
        <InsufficientFundsModal
          requiredAmount={totalHire}
          currentCash={cashNow}
          title="Saldo insuficiente para contratar vendedores"
          message="Você não possui saldo suficiente para concluir esta contratação."
          okLabel="Entendi"
        />
      )
      await awaitTop()
      return
    }

    const payload = {
      action: 'BUY',
      role: 'COMMON',

      // quantidade
      qty: qtyNum,
      headcount: qtyNum,              // compat extra

      // custos/unidades
      unitHire: priceHire,
      unitExpense: monthly,

      // totais
      totalHire,
      totalExpense,

      // compat extras (alguns fluxos leem 'total' / 'cost')
      total: totalHire,
      cost:  totalHire,

      attendsUpTo,

      // >>> DELTAS para o painel/saldo:
      cashDelta: -totalHire,
      expenseDelta: totalExpense,
      revenueDelta: revenuePerSeller * qtyNum,
      revenuePerSeller,

      // dica para HUD/contador
      hudUpdate: { category: 'Vendedores Comuns', addQty: qtyNum },
    }

    resolve(payload)
  }

  // UX: bloqueia scroll, foca no X e no input; Enter confirma
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t1 = setTimeout(() => closeRef.current?.focus?.(), 0)
    const t2 = setTimeout(() => inputRef.current?.focus?.(), 50)
    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleBuy()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
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
      aria-label="Comprar Vendedores Comuns"
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
          Você pode escolher quantos <b>Vendedores Comuns</b> quer comprar,
          <br/>Digite o número de vendedores:
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
            placeholder="Digite o número de Vendedores Comuns"
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
          <div style={{fontWeight:800, marginBottom:6}}>VENDEDOR COMUM (FAZ TUDO)</div>
          <div style={{opacity:.9, marginBottom:8}}>
            Base para cálculo despesa: <b>x quantidade vendedor comum</b>.<br/>
            Base para cálculo faturamento: <b>x quantidade máxima de clientes que cada vendedor pode atender</b>.<br/>
            <b>Atende até {attendsUpTo} clientes</b>.
          </div>

          <div style={styles.table}>
            <div style={styles.trHead}>
              <div style={styles.th}>Certificação</div>
              <div style={styles.th}>Contratação</div>
              <div style={styles.th}>Despesa</div>
              <div style={styles.th}>Faturamento</div>
            </div>
            <Row label="S/ Certificado"    hire="$ 1.500" expense="$ 1.000" revenue="$ 600" />
            <Row label="Com 1 certificado" hire="-"       expense="$ 1.100" revenue="$ 700" />
            <Row label="Com 2 certificados"hire="-"       expense="$ 1.200" revenue="$ 800" />
            <Row label="Com 3 certificados"hire="-"       expense="$ 1.300" revenue="$ 900" />
          </div>
        </div>

        <div style={styles.summary}>
          <div>Custo de contratação: <b>$ {Number(unitHire).toLocaleString()}</b> / vendedor</div>
          <div>Despesa mensal: <b>$ {Number(unitExpense).toLocaleString()}</b> / vendedor</div>
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
            disabled={!canBuy}
            style={{
              ...styles.bigBtn,
              background: canBuy ? '#7cbe1a' : '#3a3f4a',
              color:'#0d1200',
              fontWeight:900
            }}
            onClick={handleBuy}
            title={!canBuy ? 'Informe uma quantidade válida' : (cashNow < totalHire ? 'Saldo insuficiente' : undefined)}
          >
            Comprar
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, hire, expense, revenue }) {
  return (
    <div style={styles.tr}>
      <div style={styles.td}>{label}</div>
      <div style={styles.td}>{hire}</div>
      <div style={styles.td}>{expense}</div>
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
    border:'1px solid rgba(255,255,255,.18)', background:'#111522',
    color:'#eef2f7', outline:'none'
  },
  quickBtns: { display:'flex', gap:6, flexWrap:'wrap' },
  qbtn: {
    height:42, padding:'0 12px', borderRadius:10, border:'1px solid rgba(255,255,255,.18)',
    background:'#2a2f3b', color:'#fff', cursor:'pointer', fontWeight:800
  },
  infoBox: {
    background:'#161a28', border:'1px solid rgba(255,255,255,.12)',
    borderRadius:14, padding:14, marginTop:6
  },
  table: { border:'1px solid rgba(255,255,255,.12)', borderRadius:12, overflow:'hidden', marginTop:8 },
  trHead: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', background:'#121621' },
  th: { padding:'10px 12px', fontWeight:800, borderLeft:'1px solid rgba(255,255,255,.06)' },
  tr: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', background:'#0f1320' },
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
