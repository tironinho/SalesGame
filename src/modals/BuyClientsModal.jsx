// src/modals/BuyClientsModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Modal para compra de clientes.
 *
 * Props:
 *  - onResolve: function
 *      • {action:'BUY', qty:number, unitAcquisition:number, totalCost:number}
 *      • {action:'SKIP'}
 *  - unitAcquisition?: number  (preço por cliente, padrão 1000)
 */
export default function BuyClientsModal({ onResolve, unitAcquisition = 1000 }) {
  const closeRef = useRef(null)
  const [qty, setQty] = useState('')

  const qtyNum = useMemo(() => {
    const n = Number(qty)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  }, [qty])

  const totalCost = qtyNum * Number(unitAcquisition || 0)
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
      unitAcquisition: Number(unitAcquisition || 0),
      totalCost
    })
  }

  // UX: Esc fecha, foco no X e trava o scroll do body
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
      onClick={handleClose}                 // clique no backdrop fecha
    >
      <div
        style={styles.card}
        onClick={(e) => e.stopPropagation()} // impede fechar ao clicar dentro
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
          Você pode escolher quantos clientes quer comprar,
          <br />Digite o número de clientes:
        </h2>

        <p style={styles.warn}>
          <b>Mas cuidado com a capacidade de atendimento da sua equipe!</b><br />
          Se o jogador adquirir mais clientes do que os vendedores podem atender,
          assim que passar na casa <i>Faturamento do Mês</i> não receberá o faturamento
          dos clientes excedentes e perderá o(s) cliente(s) que não foram atendidos.
        </p>

        <input
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="Digite o número de Clientes"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={styles.input}
        />

        <div style={styles.summary}>
          <div>Preço por cliente: <b>$ {Number(unitAcquisition).toLocaleString()}</b></div>
          <div>Total: <b>$ {Number(totalCost).toLocaleString()}</b></div>
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

const styles = {
  wrap: {
    position:'fixed', inset:0, background:'rgba(0,0,0,.55)',
    display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
  },
  card: {
    width:'min(820px, 92vw)', maxWidth:820, background:'#1b1f2a',
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
  warn: {
    background:'#271c12', border:'1px solid rgba(255,180,0,.35)',
    color:'#ffd489', borderRadius:10, padding:'10px 12px', margin:'0 0 12px'
  },
  input: {
    width:'100%', height:42, borderRadius:10, padding:'0 12px',
    border:'1px solid rgba(255,255,255,.18)', background:'#0f1320', color:'#fff',
    outline:'none', marginBottom:12
  },
  summary: {
    display:'flex', justifyContent:'space-between',
    border:'1px dashed rgba(255,255,255,.2)', borderRadius:10, padding:'8px 12px',
    marginBottom:12, fontWeight:700
  },
  actions: { display:'flex', gap:12, justifyContent:'center', marginTop:4 },
  bigBtn: {
    minWidth:180, padding:'12px 18px', borderRadius:12, border:'none',
    fontWeight:900, cursor:'pointer'
  },
}
