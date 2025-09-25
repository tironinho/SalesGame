// src/modals/InsideSalesModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * onResolve(payload)
 *  - {action:'BUY', qty:number, unitHire:number, totalCost:number, baseExpense:number, baseRevenue:number}
 *  - {action:'SKIP'}
 *
 * Obs:
 *  • Contratação por vendedor: $3000
 *  • Despesa base (s/ certificado): $2000
 *  • Faturamento base (s/ certificado): $1500
 *  • Certificados/treinamentos podem ajustar depois no fluxo de Treinamento.
 */
export default function InsideSalesModal({ onResolve }) {
  const closeRef = useRef(null)
  const [qty, setQty] = useState('')

  const unitHire = 3000
  const baseExpense = 2000
  const baseRevenue = 1500

  const qtyNum = useMemo(() => {
    const n = Number(qty)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }, [qty])

  const totalCost = qtyNum * unitHire
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
      unitHire,
      totalCost,
      baseExpense,
      baseRevenue,
    })
  }

  // Acessibilidade + UX: Esc fecha, foco no X, trava scroll do body
  useEffect(() => {
    const onKey = ev => { if (ev.key === 'Escape') handleClose(ev) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [])

  return (
    <div
      style={styles.wrap}
      role="dialog"
      aria-modal="true"
      onClick={handleClose}                 // clique no fundo fecha
    >
      <div
        style={styles.card}
        onClick={e => e.stopPropagation()}  // evita fechar ao clicar dentro
      >
        <button
          ref={closeRef}
          type="button"
          style={styles.close}
          onClick={handleClose}
          aria-label="Fechar"
        >
          ✕
        </button>

        <h2 style={styles.title}>
          Você pode escolher quantos Inside Sales quer comprar.<br />
          <small style={{ fontWeight:400, opacity:.9 }}>
            Digite o número de vendedores:
          </small>
        </h2>

        <input
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="Digite o número de Inside Sales"
          value={qty}
          onChange={e => setQty(e.target.value)}
          style={styles.input}
        />

        {/* Tabela ilustrativa (valores base) */}
        <div style={styles.table}>
          <div style={styles.trHead}>
            <div style={styles.th}></div>
            <div style={styles.th}>Contratação</div>
            <div style={styles.th}>Despesa</div>
            <div style={styles.th}>Faturamento</div>
          </div>
          <Row label="Sem certificado" v1={`$ ${unitHire.toLocaleString()}`} v2={`$ ${baseExpense.toLocaleString()}`} v3={`$ ${baseRevenue.toLocaleString()}`} />
          <Row label="1 certificado"   v1="—" v2="$ 2.100" v3="$ 2.000" />
          <Row label="2 certificados"  v1="—" v2="$ 2.200" v3="$ 2.500" />
          <Row label="3 certificados"  v1="—" v2="$ 2.300" v3="$ 3.000" />
        </div>

        <div style={styles.actions}>
          <button type="button" style={{ ...styles.bigBtn, background:'#666', color:'#fff' }} onClick={handleClose}>
            Não comprar
          </button>
          <button
            type="button"
            style={{ ...styles.bigBtn, background: canBuy ? '#3fbf49' : '#2f5d33', color:'#09110f' }}
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

function Row({ label, v1, v2, v3 }) {
  return (
    <div style={styles.tr}>
      <div style={{...styles.td, fontWeight:700}}>{label}</div>
      <div style={styles.td}>{v1}</div>
      <div style={styles.td}>{v2}</div>
      <div style={styles.td}>{v3}</div>
    </div>
  )
}

const styles = {
  wrap: {
    position:'fixed', inset:0, background:'rgba(0,0,0,.55)',
    display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
  },
  card: {
    width:'min(920px, 92vw)', maxWidth:920, background:'#1b1f2a',
    color:'#e9ecf1', borderRadius:16, padding:'20px 20px 16px',
    boxShadow:'0 10px 40px rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.12)',
    position:'relative'
  },
  close: {
    position:'absolute', right:10, top:10, width:36, height:36,
    borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b',
    color:'#fff', cursor:'pointer'
  },
  title: { margin:'6px 0 16px', fontWeight:800, lineHeight:1.35 },
  input: {
    width:'100%', height:42, borderRadius:10, padding:'0 12px',
    border:'1px solid rgba(255,255,255,.18)', background:'#0f1320', color:'#fff',
    outline:'none', margin:'6px 0 16px'
  },
  table: { border:'1px solid rgba(255,255,255,.12)', borderRadius:12, overflow:'hidden', marginBottom:16 },
  trHead: { display:'grid', gridTemplateColumns:'2fr repeat(3, 1fr)', background:'#121621' },
  th: { padding:'10px 12px', fontWeight:800, borderLeft:'1px solid rgba(255,255,255,.06)' },
  tr: { display:'grid', gridTemplateColumns:'2fr repeat(3, 1fr)', background:'#0f1320' },
  td: { padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,.06)', borderLeft:'1px solid rgba(255,255,255,.06)' },
  actions: { display:'flex', gap:12, justifyContent:'center', marginTop:14 },
  bigBtn: {
    minWidth:180, padding:'12px 18px', borderRadius:12, border:'none',
    fontWeight:900, cursor:'pointer'
  },
}
