// src/modals/ERPSystemsModal.jsx
import React, { useEffect, useRef } from 'react'

const LEVELS = {
  A: { compra: 10000, despesa: 400, faturamento: 1000 },
  B: { compra: 4000,  despesa: 200, faturamento: 500  },
  C: { compra: 1500,  despesa: 100, faturamento: 200  },
  D: { compra: 500,   despesa: 50,  faturamento: 70   }, // base / default
}

/**
 * onResolve(payload)
 *  - {action:'BUY', level:'A'|'B'|'C', values:{...}}
 *  - {action:'SKIP'}
 */
export default function ERPSystemsModal({ onResolve }) {
  const closeRef = useRef(null)

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }

  const handleBackdrop = (e) => {
    // fecha apenas se o clique foi realmente no backdrop
    if (e.target === e.currentTarget) handleClose(e)
  }

  const handleBuy = (level) => {
    onResolve?.({ action: 'BUY', level, values: LEVELS[level] })
  }

  // Esc fecha, foca no X e bloqueia scroll de fundo
  useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape') handleClose(ev) }
    document.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // foco no X
    setTimeout(() => closeRef.current?.focus?.(), 0)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div
      style={styles.wrap}
      role="dialog"
      aria-modal="true"
      onMouseDown={handleBackdrop}
      onClick={handleBackdrop}
    >
      <div
        style={styles.card}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
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

        <h2 style={styles.title}>Escolha o nível de ERP/Sistemas que quer adquirir:</h2>

        <div style={styles.table}>
          <div style={styles.trHead}>
            <div style={styles.th}></div>
            <div style={styles.th}>Nível A</div>
            <div style={styles.th}>Nível B</div>
            <div style={styles.th}>Nível C</div>
            <div style={styles.th}>Nível D</div>
          </div>
          <Row label="COMPRA"      fmt vA={LEVELS.A.compra} vB={LEVELS.B.compra} vC={LEVELS.C.compra} vD={LEVELS.D.compra} />
          <Row label="DESPESA"     fmt vA={LEVELS.A.despesa} vB={LEVELS.B.despesa} vC={LEVELS.C.despesa} vD={LEVELS.D.despesa} />
          <Row label="FATURAMENTO" fmt vA={LEVELS.A.faturamento} vB={LEVELS.B.faturamento} vC={LEVELS.C.faturamento} vD={LEVELS.D.faturamento} />
        </div>

        <div style={styles.btnRow}>
          {(['A','B','C']).map(l => (
            <button
              key={l}
              type="button"
              style={{ ...styles.bigBtn, background:'#2442f9' }}
              onClick={() => handleBuy(l)}
            >
              {l}
            </button>
          ))}
          <button
            type="button"
            style={{ ...styles.bigBtn, background:'#444' }}
            onClick={handleClose}  // “Não comprar” também fecha
          >
            Não comprar
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, vA, vB, vC, vD, fmt }) {
  const f = (n) => fmt ? `$ ${Number(n).toLocaleString()}` : n
  return (
    <div style={styles.tr}>
      <div style={{...styles.td, fontWeight:700}}>{label}</div>
      <div style={styles.td}>{f(vA)}</div>
      <div style={styles.td}>{f(vB)}</div>
      <div style={styles.td}>{f(vC)}</div>
      <div style={styles.td}>{f(vD)}</div>
    </div>
  )
}

const styles = {
  wrap: {
    position:'fixed', inset:0, background:'rgba(0,0,0,.55)',
    display:'flex', alignItems:'center', justifyContent:'center',
    zIndex: 1000
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
  title: { margin:'6px 0 16px', fontWeight:800 },
  table: { border:'1px solid rgba(255,255,255,.12)', borderRadius:12, overflow:'hidden', marginBottom:16 },
  trHead: { display:'grid', gridTemplateColumns:'1fr repeat(4, 1fr)', background:'#121621' },
  th: { padding:'10px 12px', fontWeight:800, borderLeft:'1px solid rgba(255,255,255,.06)' },
  tr: { display:'grid', gridTemplateColumns:'1fr repeat(4, 1fr)', background:'#0f1320' },
  td: { padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,.06)', borderLeft:'1px solid rgba(255,255,255,.06)' },
  btnRow: { display:'flex', gap:12, justifyContent:'center', marginTop:14 },
  bigBtn: {
    minWidth:160, padding:'14px 18px', borderRadius:12, border:'none', color:'#fff',
    fontWeight:900, cursor:'pointer'
  },
}
