// src/modals/TrainingModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'

const PRODUCTS = [
  {
    id: 'personalizado',
    label: 'Treinamento de Venda personalizado\nCasagrande Consultores',
    price: 500,
  },
  {
    id: 'fieldsales',
    label: 'Curso Field Sales Collab\nMultiplier Educação e\nCasagrandes Consultores',
    price: 500,
  },
  {
    id: 'imersaomultiplier',
    label: 'Pacote Imersões\nMultiplier Educação',
    price: 500,
  },
]

/**
 * onResolve(payload)
 *  - { action:'BUY', vendorType:'comum'|'field'|'inside'|'gestor', items:[{id,label,price}], total:number }
 *  - { action:'SKIP' }
 */
export default function TrainingModal({ onResolve }) {
  const [vendorType, setVendorType] = useState('comum') // “Vend. Comum” por padrão
  const [selected, setSelected] = useState(() => new Set())
  const closeRef = useRef(null)

  const total = useMemo(
    () => Array.from(selected).reduce((acc, id) => {
      const p = PRODUCTS.find(x => x.id === id)
      return acc + (p?.price || 0)
    }, 0),
    [selected]
  )

  const toggle = (id) =>
    setSelected(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const handleBuy = () => {
    const items = Array.from(selected).map(id => PRODUCTS.find(p => p.id === id))
    if (!items.length) return
    onResolve?.({
      action: 'BUY',
      vendorType,
      items,
      total,
    })
  }

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) handleClose(e)
  }

  // Esc fecha, foca no X e bloqueia scroll de fundo
  useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape') handleClose(ev) }
    document.addEventListener('keydown', onKey)

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div style={styles.wrap} role="dialog" aria-modal="true" onMouseDown={handleBackdrop} onClick={handleBackdrop}>
      <div style={styles.card} onMouseDown={(e)=>e.stopPropagation()} onClick={(e)=>e.stopPropagation()}>
        <button ref={closeRef} type="button" style={styles.close} onClick={handleClose} aria-label="Fechar">✕</button>

        <h2 style={styles.title}>Escolha para qual vendedor quer atribuir o treinamento:</h2>

        {/* Seletor simples de tipo de vendedor (padrão: Vend. Comum) */}
        <div style={styles.vendorRow}>
          {[
            {id:'comum', label:'Vend. Comum'},
            {id:'field', label:'Field Sales'},
            {id:'inside', label:'Inside Sales'},
            {id:'gestor', label:'Gestor'},
          ].map(v => (
            <button
              key={v.id}
              type="button"
              onClick={()=>setVendorType(v.id)}
              style={{
                ...styles.vendorBtn,
                background: vendorType === v.id ? '#6f5bd6' : '#2a2f3b',
                borderColor: vendorType === v.id ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.15)'
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        <p style={{margin:'10px 2px 14px', opacity:.9}}>
          Escolha abaixo qual nível/treinamento quer adquirir
        </p>

        <div style={styles.products}>
          {PRODUCTS.map(p => {
            const active = selected.has(p.id)
            return (
              <button
                key={p.id}
                type="button"
                onClick={()=>toggle(p.id)}
                style={{
                  ...styles.productCard,
                  boxShadow: active ? '0 0 0 3px #6f5bd6' : 'none',
                  borderColor: active ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.15)'
                }}
              >
                <div style={{whiteSpace:'pre-line', fontWeight:800, marginBottom:8}}>{p.label}</div>
                <div style={{fontSize:22, fontWeight:900}}>$ {p.price.toLocaleString()}</div>
              </button>
            )
          })}
        </div>

        <div style={styles.actionsRow}>
          <button type="button" style={{...styles.smallBtn, background:'#3a4152'}} onClick={()=>setSelected(new Set())}>Limpar</button>
          <div style={{flex:1}} />
          <div style={{fontWeight:900}}>Total: $ {total.toLocaleString()}</div>
        </div>

        <div style={styles.btnRow}>
          <button type="button" style={{ ...styles.bigBtn, background:'#444' }} onClick={handleClose}>Não comprar</button>
          <button
            type="button"
            disabled={!selected.size}
            style={{ ...styles.bigBtn, background: selected.size ? '#6f5bd6' : '#3a3a3a', opacity: selected.size ? 1 : .6, cursor: selected.size ? 'pointer' : 'not-allowed' }}
            onClick={handleBuy}
          >
            Comprar
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  wrap: { position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  card: { width:'min(920px, 92vw)', maxWidth:920, background:'#1b1f2a', color:'#e9ecf1', borderRadius:16, padding:'20px', boxShadow:'0 10px 40px rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.12)', position:'relative' },
  close: { position:'absolute', right:10, top:10, width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b', color:'#fff', cursor:'pointer' },
  title:{ margin:'6px 0 12px', fontWeight:900 },
  vendorRow: { display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:10, marginBottom:12 },
  vendorBtn: { padding:'10px 12px', borderRadius:10, border:'1px solid', color:'#fff', fontWeight:800, cursor:'pointer' },
  products: { display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12, margin:'4px 0 10px' },
  productCard: { textAlign:'center', padding:'16px 14px', borderRadius:14, border:'1px solid', background:'#2a2f3b', color:'#fff', cursor:'pointer' },
  actionsRow: { display:'flex', alignItems:'center', gap:12, margin:'6px 0 6px' },
  smallBtn: { padding:'10px 14px', borderRadius:10, border:'none', color:'#fff', fontWeight:800, cursor:'pointer' },
  btnRow: { display:'flex', gap:12, justifyContent:'flex-end', marginTop:12 },
  bigBtn: { minWidth:160, padding:'14px 18px', borderRadius:12, border:'none', color:'#fff', fontWeight:900, cursor:'pointer' },
}
