// src/modals/InsufficientFundsModal.jsx
import React, { useEffect, useMemo, useRef } from 'react'

/**
 * Modal genérica de Saldo Insuficiente.
 *
 * Props:
 *  - onResolve: function(payload)
 *      • { action: 'ACK' }   // usuário leu/confirmou
 *      • { action: 'SKIP' }  // usuário fechou
 *  - requiredAmount: number  (quanto precisa)
 *  - currentCash: number     (saldo atual)
 *  - title?: string          (padrão: "Saldo insuficiente")
 *  - message?: string        (mensagem adicional)
 *  - okLabel?: string        (padrão: "OK")
 */
export default function InsufficientFundsModal({
  onResolve,
  requiredAmount = 0,
  currentCash = 0,
  title = 'Saldo insuficiente',
  message = 'Seu saldo atual não é suficiente para concluir esta compra.',
  okLabel = 'OK',
}) {
  const closeRef = useRef(null)

  const missing = useMemo(
    () => Math.max(0, Number(requiredAmount || 0) - Number(currentCash || 0)),
    [requiredAmount, currentCash]
  )

  const fmt = (n) => `$ ${Number(n || 0).toLocaleString()}`

  const handleOk = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'ACK' })
  }

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }

  // Bloqueia scroll e foca no botão primário (ESC NÃO fecha)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      style={S.wrap}
      role="dialog"
      aria-modal="true"
      // não permite fechar clicando fora
      onMouseDown={(e) => { if (e.target === e.currentTarget) e.stopPropagation() }}
    >
      <div
        style={S.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          style={S.close}
          onClick={handleClose}
          aria-label="Fechar"
        >
          ✕
        </button>

        <div style={S.icon}>⚠️</div>
        <h2 style={S.title}>{title}</h2>
        <p style={S.msg}>{message}</p>

        <div style={S.grid}>
          <div style={S.row}><span>Necessário:</span><b>{fmt(requiredAmount)}</b></div>
          <div style={S.row}><span>Seu saldo:</span><b>{fmt(currentCash)}</b></div>
          <div style={{...S.row, color:'#fca5a5'}}><span>Faltam:</span><b>{fmt(missing)}</b></div>
        </div>

        <div style={S.actions}>
          <button
            ref={closeRef}
            type="button"
            style={{ ...S.btn, background:'#6b7280', color:'#fff' }}
            onClick={handleOk}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const S = {
  wrap: {
    position:'fixed', inset:0, background:'rgba(0,0,0,.55)',
    display:'grid', placeItems:'center', zIndex:1100
  },
  card: {
    width:'min(440px, 92vw)', background:'#1f2330', color:'#e9ecf1',
    borderRadius:16, padding:'18px 18px 16px',
    border:'1px solid rgba(255,255,255,.12)',
    boxShadow:'0 18px 50px rgba(0,0,0,.5)', position:'relative'
  },
  close: {
    position:'absolute', right:10, top:10, width:34, height:34,
    borderRadius:10, border:'1px solid rgba(255,255,255,.15)',
    background:'#2a2f3b', color:'#fff', cursor:'pointer'
  },
  icon:{ fontSize:28, lineHeight:1, marginBottom:6 },
  title:{ margin:'2px 0 6px', fontWeight:900, fontSize:20 },
  msg:{ opacity:.95, margin:'0 0 10px' },
  grid:{
    border:'1px solid rgba(255,255,255,.15)', borderRadius:12,
    padding:'10px 12px', marginBottom:12, background:'#171b26'
  },
  row:{ display:'flex', justifyContent:'space-between', padding:'4px 0' },
  actions:{ display:'flex', justifyContent:'center', marginTop:6 },
  btn:{
    minWidth:120, padding:'10px 16px', borderRadius:10, border:'none',
    fontWeight:900, cursor:'pointer'
  },
}
