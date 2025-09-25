// src/modals/BuyFieldSalesModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Modal de compra de Field Sales (Representantes Comerciais)
 *
 * Props:
 *  - onResolve: function(payload)
 *      • { action:'BUY', qty:number, unitHire:number, unitExpense:number,
 *          totalHire:number, totalExpense:number, role:'FIELD' }
 *      • { action:'SKIP' }
 *  - unitHire?: number     (custo de contratação por vendedor — padrão 3000)
 *  - unitExpense?: number  (despesa mensal por vendedor — padrão 2000, “s/ certificado”)
 *  - attendsUpTo?: number  (qtd. clientes atendidos por vendedor — infográfico)
 */
export default function BuyFieldSalesModal({
  onResolve,
  unitHire = 3000,
  unitExpense = 2000,
  attendsUpTo = 5
}) {
  const closeRef = useRef(null)
  const [qty, setQty] = useState('')

  const qtyNum = useMemo(() => {
    const n = Number(qty)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }, [qty])

  const totalHire = qtyNum * Number(unitHire || 0)
  const totalExpense = qtyNum * Number(unitExpense || 0)
  const canBuy = qtyNum > 0

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }

  const handleBuy = () => {
    if (!canBuy) return
    onResolve?.({
      action: 'BUY',
      qty: qtyNum,
      unitHire: Number(unitHire || 0),
      unitExpense: Number(unitExpense || 0),
      totalHire,
      totalExpense,
      role: 'FIELD',
    })
  }

  // UX: ESC fecha, foca no X e bloqueia o scroll do body
  useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape') handleClose(ev) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <div
      style={styles.wrap}
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        style={styles.card}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          style={styles.close}
          onClick={handleClose}
          aria-label="Fechar"
        >✕</button>

        <h2 style={styles.title}>
          Você pode escolher quantos <b>FieldSales</b> quer comprar,
          <br/>Digite o número de vendedores:
        </h2>

        <input
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="Digite o número de FieldSales"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={styles.input}
        />

        <div style={styles.infoBox}>
          <div style={{fontWeight:800, marginBottom:6}}>FIELD SALES (REPRESENTANTES COMERCIAIS)</div>
          <div style={{opacity:.9, marginBottom:8}}>
            Base para cálculo despesa: <b>x quantidade field sales</b>.<br/>
            Base para cálculo faturamento: <b>x quantidade máxima de clientes que cada vendedor pode atender</b>.<br/>
            Cada vendedor atende até <b>{attendsUpTo}</b> clientes.
          </div>

          {/* Tabela informativa (mesma visual das imagens) */}
          <div style={styles.table}>
            <div style={styles.trHead}>
              <div style={styles.th}>Certificação</div>
              <div style={styles.th}>Contratação</div>
              <div style={styles.th}>Despesa</div>
              <div style={styles.th}>Faturamento</div>
            </div>
            <Row label="S/ Certificado"  hire={3000} expense={2000} revenue="$ 1.500"/>
            <Row label="Com 1 certificado" hire="-" expense={2100} revenue="$ 2.000"/>
            <Row label="Com 2 certificados" hire="-" expense={2200} revenue="$ 2.500"/>
            <Row label="Com 3 certificados" hire="-" expense={2300} revenue="$ 3.000"/>
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
            style={{ ...styles.bigBtn, background: canBuy ? '#75e16c' : '#365b31', color:'#0b120a' }}
            onClick={handleBuy}
            disabled={!canBuy}
            title={!canBuy ? 'Informe uma quantidade válida' : undefined}
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
  input: {
    width:'100%', height:42, borderRadius:10, padding:'0 12px',
    border:'1px solid rgba(255,255,255,.18)', background:'#0f1320', color:'#fff',
    outline:'none', marginBottom:14
  },
  infoBox: {
    border:'1px solid rgba(255,255,255,.12)', borderRadius:12,
    padding:'12px', background:'#101522', marginBottom:12
  },
  table: { border:'1px solid rgba(255,255,255,.12)', borderRadius:10, overflow:'hidden' },
  trHead: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', background:'#121621' },
  th: { padding:'10px 12px', fontWeight:800, borderLeft:'1px solid rgba(255,255,255,.06)' },
  tr: { display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr', background:'#0f1320' },
  td: { padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,.06)', borderLeft:'1px solid rgba(255,255,255,.06)' },

  summary: {
    display:'flex', justifyContent:'space-between',
    border:'1px dashed rgba(255,255,255,.2)', borderRadius:10, padding:'8px 12px',
    marginTop:10
  },
  summaryStrong: {
    display:'flex', justifyContent:'space-between',
    border:'1px solid rgba(255,255,255,.25)', borderRadius:10, padding:'10px 12px',
    marginTop:8, fontWeight:800
  },
  actions: { display:'flex', gap:12, justifyContent:'center', marginTop:12 },
  bigBtn: {
    minWidth:180, padding:'12px 18px', borderRadius:12, border:'none',
    fontWeight:900, cursor:'pointer'
  },
}
