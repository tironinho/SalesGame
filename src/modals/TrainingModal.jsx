// src/modals/TrainingModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * TABELA DE TREINAMENTOS
 * - Cada item tem uma cor principal que corresponde ao certificado:
 *   • Azul    -> 'personalizado'
 *   • Amarelo -> 'fieldsales'
 *   • Roxo    -> 'imersaomultiplier'
 */
const PRODUCTS = [
  {
    id: 'personalizado',
    label: 'Treinamento de venda personalizado\nCasagrande Consultores',
    price: 500,
    cert: 'azul',
    colors: { bg: '#0f2848', border: '#3b82f6', pill: '#60a5fa' }, // AZUL
  },
  {
    id: 'fieldsales',
    label: 'Curso Field Sales Collab\nMultiplier Educação e\nCasagrande Consultores',
    price: 500,
    cert: 'amarelo',
    colors: { bg: '#3a3202', border: '#facc15', pill: '#fde047' }, // AMARELO
  },
  {
    id: 'imersaomultiplier',
    label: 'Pacote Imersões\nMultiplier Educação',
    price: 500,
    cert: 'roxo',
    colors: { bg: '#2b0840', border: '#a855f7', pill: '#c084fc' }, // ROXO
  },
]

/**
 * Props:
 * - onResolve(payload)
 *      • { action:'BUY',
 *          vendorType:'comum'|'field'|'inside'|'gestor',
 *          items:[{id,label,price,cert}],
 *          total:number,
 *          bensDelta:number,
 *          certsCount:{ azul:number, amarelo:number, roxo:number },
 *          ownedUpdate: { [vendorType]: string[] } }
 *      • { action:'SKIP' }
 * - ownedByType?: { [vendorType]: Set<string> | string[] }
 * - canTrain?: { comum?:boolean|number|string, field?:boolean|number|string, inside?:boolean|number|string, gestor?:boolean|number|string }
 */
export default function TrainingModal({ onResolve, ownedByType = {}, canTrain = {} }) {
  // Normaliza: aceita 0/1, números em string, booleanos
  const toNum = (v) => (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v)
  const hasRole = (v) => {
    const val = toNum(v)
    return typeof val === 'number' ? val > 0 : !!val
  }

  // NÃO usar default true; só mostra se tiver pelo menos 1 daquele tipo
  const canMap = useMemo(() => ({
    comum:  hasRole(canTrain.comum),
    field:  hasRole(canTrain.field),
    inside: hasRole(canTrain.inside),
    gestor: hasRole(canTrain.gestor),
  }), [canTrain])

  // Tipos disponíveis (precisa ter profissional e ainda ter algo a comprar)
  const ALL_IDS = PRODUCTS.map(p => p.id)
  const typeList = useMemo(() => ([
    { id: 'comum',  label: 'Vend. Comum' },
    { id: 'field',  label: 'Field Sales' },
    { id: 'inside', label: 'Inside Sales' },
    { id: 'gestor', label: 'Gestor' },
  ])
    .filter(t => canMap[t.id]) // tem profissional do tipo
    .filter(t => {
      const owned = ownedByType[t.id] instanceof Set
        ? ownedByType[t.id]
        : new Set(ownedByType[t.id] || [])
      return ALL_IDS.some(id => !owned.has(id)) // ainda há certificado para comprar
    })
  , [ownedByType, canMap])

  // Seleciona automaticamente o primeiro tipo habilitado
  const [vendorType, setVendorType] = useState(() => typeList[0]?.id || 'comum')
  const [selected, setSelected] = useState(() => new Set())
  useEffect(() => {
    if (!typeList.find(t => t.id === vendorType)) {
      setVendorType(typeList[0]?.id)   // se o atual sumiu (sem profissional/completo), troca
      setSelected(new Set())           // e limpa a seleção
    }
  }, [typeList, vendorType])

  const closeRef = useRef(null)

  const disabledIdsForType = useMemo(() => {
    const owned = ownedByType[vendorType] instanceof Set
      ? ownedByType[vendorType]
      : new Set(ownedByType[vendorType] || [])
    return owned
  }, [ownedByType, vendorType])

  const total = useMemo(
    () => Array.from(selected).reduce((acc, id) => {
      const p = PRODUCTS.find(x => x.id === id)
      return acc + (p?.price || 0)
    }, 0),
    [selected]
  )

  const toggle = (id) =>
    setSelected(s => {
      if (disabledIdsForType.has(id)) return s // já comprado para este tipo
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })

  const handleBuy = () => {
    if (!selected.size || !vendorType) return
    const items = Array.from(selected).map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean)

    const certsCount = items.reduce((acc, it) => {
      acc[it.cert] = (acc[it.cert] || 0) + 1
      return acc
    }, { azul:0, amarelo:0, roxo:0 })

    const ownedUpdate = { [vendorType]: items.map(it => it.id) }

    onResolve?.({
      action: 'BUY',
      vendorType,
      items,
      total,
      bensDelta: total,
      certsCount,
      ownedUpdate,
    })
  }

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }

  // Trava o scroll e foca no X
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => closeRef.current?.focus?.(), 0)
    return () => { document.body.style.overflow = prevOverflow }
  }, [])

  const noTypesLeft = typeList.length === 0
  const noProfessionAvailable = !Object.values(canMap).some(Boolean)

  return (
    <div style={S.wrap} role="dialog" aria-modal="true">
      <div style={S.card}>
        <button ref={closeRef} type="button" style={S.close} onClick={handleClose} aria-label="Fechar">✕</button>

        <h2 style={S.title}>Escolha para qual vendedor quer atribuir o treinamento:</h2>

        {noTypesLeft ? (
          <div style={S.allDoneBox}>
            {noProfessionAvailable
              ? 'Nenhum profissional disponível para treinar no momento.'
              : 'Todos os treinamentos já foram comprados para os profissionais disponíveis.'}
          </div>
        ) : (
          <div style={{
            ...S.vendorRow,
            gridTemplateColumns: `repeat(${typeList.length}, minmax(0,1fr))`
          }}>
            {typeList.map(v => (
              <button
                key={v.id}
                type="button"
                onClick={()=>{ setVendorType(v.id); setSelected(new Set()) }}
                style={{
                  ...S.vendorBtn,
                  background: vendorType === v.id ? '#6f5bd6' : '#2a2f3b',
                  borderColor: vendorType === v.id ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.15)'
                }}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {!noTypesLeft && (
          <>
            <p style={{margin:'10px 2px 14px', opacity:.9}}>
              Escolha abaixo qual nível/treinamento quer adquirir
            </p>

            <div style={S.products}>
              {PRODUCTS.map(p => {
                const active = selected.has(p.id)
                const disabled = disabledIdsForType.has(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={()=>toggle(p.id)}
                    disabled={disabled}
                    style={{
                      ...S.productCard,
                      background: p.colors.bg,
                      borderColor: p.colors.border,
                      boxShadow: active ? `0 0 0 3px ${p.colors.pill}` : 'none',
                      opacity: disabled ? .45 : 1,
                      cursor: disabled ? 'not-allowed' : 'pointer'
                    }}
                    title={disabled ? 'Já adquirido para este tipo de vendedor' : undefined}
                  >
                    <div style={S.pill(p.colors.pill)}>
                      Certificado {p.cert === 'azul' ? 'Azul' : p.cert === 'amarelo' ? 'Amarelo' : 'Roxo'}
                    </div>
                    <div style={{whiteSpace:'pre-line', fontWeight:800, marginBottom:10}}>{p.label}</div>
                    <div style={{fontSize:22, fontWeight:900}}>$ {p.price.toLocaleString()}</div>
                  </button>
                )
              })}
            </div>

            <div style={S.actionsRow}>
              <button
                type="button"
                style={{...S.smallBtn, background:'#3a4152'}}
                onClick={()=>setSelected(new Set())}
              >
                Limpar
              </button>
              <div style={{flex:1}} />
              <div style={{fontWeight:900}}>Total: $ {total.toLocaleString()}</div>
            </div>

            <div style={S.btnRow}>
              <button type="button" style={{ ...S.bigBtn, background:'#444' }} onClick={handleClose}>Não comprar</button>
              <button
                type="button"
                disabled={!selected.size}
                style={{ ...S.bigBtn, background: selected.size ? '#6f5bd6' : '#3a3a3a', opacity: selected.size ? 1 : .6, cursor: selected.size ? 'pointer' : 'not-allowed' }}
                onClick={handleBuy}
              >
                Comprar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const S = {
  wrap: { position:'fixed', inset:0, background:'rgba(0,0,0,.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  card: { width:'min(980px, 94vw)', maxWidth:980, background:'#1b1f2a', color:'#e9ecf1', borderRadius:16, padding:'20px', boxShadow:'0 10px 40px rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.12)', position:'relative' },
  close: { position:'absolute', right:10, top:10, width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b', color:'#fff', cursor:'pointer' },
  title:{ margin:'6px 0 12px', fontWeight:900 },
  allDoneBox: { background:'#0f1320', border:'1px solid rgba(255,255,255,.15)', borderRadius:12, padding:'14px', fontWeight:800, textAlign:'center' },

  vendorRow: { display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:10, marginBottom:12 },
  vendorBtn: { padding:'10px 12px', borderRadius:10, border:'1px solid', color:'#fff', fontWeight:800, cursor:'pointer' },

  products: { display:'grid', gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:12, margin:'4px 0 10px' },
  productCard: { textAlign:'center', padding:'16px 14px', borderRadius:14, border:'2px solid', color:'#fff' },
  pill: (bg) => ({
    display:'inline-block',
    background:bg,
    color:'#111',
    fontWeight:900,
    padding:'4px 8px',
    borderRadius:999,
    marginBottom:8
  }),

  actionsRow: { display:'flex', alignItems:'center', gap:12, margin:'6px 0 6px' },
  smallBtn: { padding:'10px 14px', borderRadius:10, border:'none', color:'#fff', fontWeight:800, cursor:'pointer' },
  btnRow: { display:'flex', gap:12, justifyContent:'flex-end', marginTop:12 },
  bigBtn: { minWidth:160, padding:'14px 18px', borderRadius:12, border:'none', color:'#fff', fontWeight:900, cursor:'pointer' },
}
