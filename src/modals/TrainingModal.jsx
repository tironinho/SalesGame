// src/modals/TrainingModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import PurchaseImpactPreview from '../components/PurchaseImpactPreview.jsx'
import { CERT_EFFECTS, MANAGER_BOOST_BY_CERT, MANAGER_BOOST_MAX_CERTS } from '../game/gameRules'
import { MANUAL_CONSTANTS } from '../game/manualConstants.js'
import { previewTrainingPurchaseImpact } from '../game/trainingPurchase.js'
import TileContextHint from './TileContextHint.jsx'

/**
 * TABELA DE TREINAMENTOS
 * - Cada item tem uma cor principal que corresponde ao certificado:
 *   • Azul    -> 'personalizado'
 *   • Amarelo -> 'fieldsales'
 *   • Roxo    -> 'imersaomultiplier'
 */
const TRAINING_PRICE = MANUAL_CONSTANTS.trainingPrice
const PRODUCTS = [
  {
    id: 'personalizado',
    label: 'Treinamento de venda personalizado\nCasagrande Consultores',
    shortLabel: 'Treinamento de venda personalizado',
    price: TRAINING_PRICE,
    cert: 'azul',
    colors: { bg: '#0f2848', border: '#3b82f6', pill: '#60a5fa' }, // AZUL
  },
  {
    id: 'fieldsales',
    label: 'Curso Field Sales Collab\nMultiplier Educação e\nCasagrande Consultores',
    shortLabel: 'Field Sales Collab',
    price: TRAINING_PRICE,
    cert: 'amarelo',
    colors: { bg: '#3a3202', border: '#facc15', pill: '#fde047' }, // AMARELO
  },
  {
    id: 'imersaomultiplier',
    label: 'Pacote Imersões\nMultiplier Educação',
    shortLabel: 'Pacote Imersões',
    price: TRAINING_PRICE,
    cert: 'roxo',
    colors: { bg: '#2b0840', border: '#a855f7', pill: '#c084fc' }, // ROXO
  },
]

const VENDOR_TYPE_META = [
  { id: 'comum',  label: 'Vendedor Comum', shortBtn: 'Vend. Comum' },
  { id: 'field',  label: 'Field Sales', shortBtn: 'Field Sales' },
  { id: 'inside', label: 'Inside Sales', shortBtn: 'Inside Sales' },
  { id: 'gestor', label: 'Gestor Comercial', shortBtn: 'Gestor' },
]

/**
 * Props:
 * - onResolve(payload)
 *      • { action:'BUY',
 *          purchases:[{vendorType:'comum'|'field'|'inside'|'gestor', items:[{id,label,price,cert}], total:number}],
 *          grandTotal:number,
 *          bensDelta:number,
 *          certsCount:{ azul:number, amarelo:number, roxo:number },
 *          ownedUpdate: { [vendorType]: string[] } }
 *      • { action:'SKIP' }
 * - ownedByType?: { [vendorType]: Set<string> | string[] }
 * - canTrain?: { comum?:boolean|number|string, field?:boolean|number|string, inside?:boolean|number|string, gestor?:boolean|number|string }
 * - currentCash?: number
 * - currentPlayer?: object (snapshot somente leitura para preview)
 */
export default function TrainingModal({
  onResolve,
  ownedByType = {},
  canTrain = {},
  allowBack = false,
  currentCash = null,
  currentPlayer = null,
}) {
  // Normaliza: aceita 0/1, números em string, booleanos
  const toNum = (v) => (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v)
  const hasRole = (v) => {
    const val = toNum(v)
    return typeof val === 'number' ? val > 0 : !!val
  }

  const cashNow = Number(currentCash != null ? currentCash : (currentPlayer?.cash ?? 0))

  // NÃO usar default true; só mostra se tiver pelo menos 1 daquele tipo
  const canMap = useMemo(() => ({
    comum:  hasRole(canTrain.comum),
    field:  hasRole(canTrain.field),
    inside: hasRole(canTrain.inside),
    gestor: hasRole(canTrain.gestor),
  }), [canTrain])

  // Tipos disponíveis (precisa ter profissional e ainda ter algo a comprar)
  const ALL_IDS = PRODUCTS.map(p => p.id)
  const typeList = useMemo(() => (
    VENDOR_TYPE_META
      .filter(t => canMap[t.id]) // tem profissional do tipo
      .filter(t => {
        const owned = ownedByType[t.id] instanceof Set
          ? ownedByType[t.id]
          : new Set(ownedByType[t.id] || [])
        return ALL_IDS.some(id => !owned.has(id)) // ainda há certificado para comprar
      })
  ), [ownedByType, canMap])

  // Estado para seleção múltipla de tipos de vendedores e treinamentos únicos
  const [selectedVendorTypes, setSelectedVendorTypes] = useState(() => new Set())
  const [selectedTrainings, setSelectedTrainings] = useState(() => new Set()) // Set<trainingId> - aplicado a todos os tipos
  
  // Inicializa com o primeiro tipo disponível se não houver seleção
  useEffect(() => {
    if (selectedVendorTypes.size === 0 && typeList.length > 0) {
      setSelectedVendorTypes(new Set([typeList[0].id]))
    }
  }, [typeList, selectedVendorTypes.size])

  const closeRef = useRef(null)

  // Calcula totais: só itens ainda não possuídos por cada tipo selecionado
  const purchases = useMemo(() => {
    const result = []
    const selectedItems = Array.from(selectedTrainings)
      .map(id => PRODUCTS.find(p => p.id === id))
      .filter(Boolean)

    selectedVendorTypes.forEach((vendorType) => {
      const owned = ownedByType[vendorType] instanceof Set
        ? ownedByType[vendorType]
        : new Set(ownedByType[vendorType] || [])

      const items = selectedItems.filter(item => !owned.has(item.id))
      if (items.length === 0) return

      const total = items.reduce(
        (acc, item) => acc + Number(item?.price || 0),
        0
      )

      result.push({ vendorType, items, total })
    })

    return result
  }, [selectedVendorTypes, selectedTrainings, ownedByType])

  const grandTotal = useMemo(() => 
    purchases.reduce((acc, p) => acc + p.total, 0), 
    [purchases]
  )

  const certsCount = useMemo(() => {
    const counts = { azul: 0, amarelo: 0, roxo: 0 }
    purchases.forEach((purchase) => {
      ;(purchase.items || []).forEach((item) => {
        if (!item?.cert) return
        counts[item.cert] = (counts[item.cert] || 0) + 1
      })
    })
    return counts
  }, [purchases])

  const ownedUpdate = useMemo(() => {
    const result = {}
    purchases.forEach((purchase) => {
      result[purchase.vendorType] = (purchase.items || []).map(item => item.id)
    })
    return result
  }, [purchases])

  const draftPayload = useMemo(() => {
    if (purchases.length === 0) return null
    return {
      action: 'BUY',
      purchases,
      grandTotal,
      bensDelta: grandTotal,
      certsCount,
      ownedUpdate,
    }
  }, [purchases, grandTotal, certsCount, ownedUpdate])

  const purchaseImpact = useMemo(() => {
    if (!draftPayload) return null
    const playerSnapshot = {
      ...(currentPlayer || {}),
      cash: cashNow,
    }
    return previewTrainingPurchaseImpact({
      player: playerSnapshot,
      payload: draftPayload,
    })
  }, [draftPayload, currentPlayer, cashNow])

  const selectedTypeLabels = useMemo(() => {
    return Array.from(selectedVendorTypes).map((id) => {
      const meta = VENDOR_TYPE_META.find(t => t.id === id)
      return meta?.label || id
    })
  }, [selectedVendorTypes])

  const trainsGestor = purchases.some((p) => p.vendorType === 'gestor')

  const gestorBoostHint = useMemo(() => {
    const maxAvailableCerts = Math.min(
      PRODUCTS.length,
      MANAGER_BOOST_MAX_CERTS,
    )
    const ladder = Array.from(
      { length: maxAvailableCerts },
      (_, index) => index + 1
    )
      .map((certCount) => {
        const ratio = MANAGER_BOOST_BY_CERT?.[certCount]
        const pct = Math.round(Number(ratio || 0) * 100)
        return `${certCount} cert.: ${pct}%`
      })
      .join(' · ')
    return ladder
  }, [])

  const toggleVendorType = (vendorType) => {
    setSelectedVendorTypes(prev => {
      const next = new Set(prev)
      if (next.has(vendorType)) {
        next.delete(vendorType)
      } else {
        next.add(vendorType)
      }
      return next
    })
  }

  const toggleTraining = (trainingId) => {
    // Verifica se algum dos tipos selecionados já tem este treinamento
    const isOwnedByAnySelected = Array.from(selectedVendorTypes).some(vendorType => {
      const owned = ownedByType[vendorType] instanceof Set
        ? ownedByType[vendorType]
        : new Set(ownedByType[vendorType] || [])
      return owned.has(trainingId)
    })
    
    if (isOwnedByAnySelected) return // já comprado para algum tipo selecionado

    setSelectedTrainings(prev => {
      const next = new Set(prev)
      if (next.has(trainingId)) {
        next.delete(trainingId)
      } else {
        next.add(trainingId)
      }
      return next
    })
  }

  const handleBuy = () => {
    if (!draftPayload) return
    onResolve?.(draftPayload)
  }

  const clearAll = () => {
    setSelectedVendorTypes(new Set())
    setSelectedTrainings(new Set())
  }

  const handleClose = (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    onResolve?.({ action: 'SKIP' })
  }
  const handleBack = (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); onResolve?.({ action:'BACK' }) }

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

        <h2 style={S.title}>Escolha os vendedores e treinamentos que deseja comprar:</h2>

        <TileContextHint kind="TRAINING" />

        <p className="purchasePreviewHint">
          Cada cor tem efeito financeiro diferente no profissional treinado (exceto Gestor,
          cujo boost depende só da quantidade). Treinamentos não aumentam a capacidade
          de atendimento e não contratam novos profissionais. Cores também entram em Sorte/Revés.
        </p>
        <p className="purchasePreviewHint">
          Azul: 100% fat / 100% desp · Amarelo: 100% fat / 0% desp · Roxo: 120% fat / 150% desp
          (sobre o incremento do tipo). Preço: $500 cada.
        </p>

        <div style={S.saldo}>Saldo disponível: <b>$ {cashNow.toLocaleString()}</b></div>

        {noTypesLeft ? (
          <>
            <div style={S.allDoneBox}>
              {noProfessionAvailable
                ? 'Nenhum profissional disponível para treinar no momento.'
                : 'Todos os treinamentos já foram comprados para os profissionais disponíveis.'}
            </div>
            {allowBack && (
              <div style={S.btnRow}>
                <button type="button" style={{ ...S.bigBtn, background:'#2a2f3b', color:'#fff' }} onClick={handleBack}>Voltar</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{marginBottom: '16px'}}>
              <p style={{margin: '0 0 8px', opacity: 0.9, fontSize: '14px'}}>
                Selecione os tipos de profissionais que deseja treinar
                (Vendedor Comum, Inside Sales, Field Sales ou Gestor Comercial):
              </p>
              <div className="trainingVendorRow">
                {typeList.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => toggleVendorType(v.id)}
                    style={{
                      ...S.vendorBtn,
                      background: selectedVendorTypes.has(v.id) ? '#6f5bd6' : '#2a2f3b',
                      borderColor: selectedVendorTypes.has(v.id) ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.15)'
                    }}
                  >
                    {v.shortBtn}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {!noTypesLeft && selectedVendorTypes.size > 0 && (
          <>
            <p style={{margin:'10px 2px 14px', opacity:.9}}>
              Escolha os treinamentos que serão aplicados a todos os tipos selecionados:
            </p>

            <div style={{marginBottom: '16px'}}>
              <div style={{marginBottom: '12px', padding: '8px 12px', background: '#2a2f3b', borderRadius: '8px', border: '1px solid rgba(255,255,255,.15)'}}>
                <div style={{fontWeight: 'bold', marginBottom: '4px'}}>Tipos selecionados:</div>
                <div style={{fontSize: '14px', opacity: 0.9}}>
                  {selectedTypeLabels.join(', ')}
                </div>
              </div>
              
              <div className="trainingProducts">
                {PRODUCTS.map(p => {
                  const active = selectedTrainings.has(p.id)
                  const isOwnedByAnySelected = Array.from(selectedVendorTypes).some(vendorType => {
                    const owned = ownedByType[vendorType] instanceof Set
                      ? ownedByType[vendorType]
                      : new Set(ownedByType[vendorType] || [])
                    return owned.has(p.id)
                  })
                  const receivingLabels = Array.from(selectedVendorTypes)
                    .filter((vendorType) => {
                      const owned = ownedByType[vendorType] instanceof Set
                        ? ownedByType[vendorType]
                        : new Set(ownedByType[vendorType] || [])
                      return !owned.has(p.id)
                    })
                    .map((id) => VENDOR_TYPE_META.find(t => t.id === id)?.label || id)
                  const appliedLine = receivingLabels.length > 0
                    ? `${p.shortLabel} — aplicado em ${receivingLabels.join(', ')}`
                    : `${p.shortLabel} — já adquirido para os tipos selecionados`
                  
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleTraining(p.id)}
                      disabled={isOwnedByAnySelected}
                      style={{
                        ...S.productCard,
                        background: p.colors.bg,
                        borderColor: p.colors.border,
                        boxShadow: active ? `0 0 0 3px ${p.colors.pill}` : 'none',
                        opacity: isOwnedByAnySelected ? .45 : 1,
                        cursor: isOwnedByAnySelected ? 'not-allowed' : 'pointer'
                      }}
                      title={isOwnedByAnySelected ? 'Já adquirido para algum tipo selecionado' : undefined}
                    >
                      <div style={S.pill(p.colors.pill)}>
                        Certificado {p.cert === 'azul' ? 'Azul' : p.cert === 'amarelo' ? 'Amarelo' : 'Roxo'}
                      </div>
                      <div style={{whiteSpace:'pre-line', fontWeight:800, marginBottom:8}}>{p.label}</div>
                      <div className="trainingAppliedLine">{appliedLine}</div>
                      <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 6 }}>
                        {(() => {
                          const fx = CERT_EFFECTS[p.id]
                          if (!fx) return null
                          return `Efeito: ${Math.round(fx.multFat * 100)}% fat · ${Math.round(fx.multDesp * 100)}% desp`
                        })()}
                      </div>
                      <div style={{fontSize:22, fontWeight:900}}>$ {p.price.toLocaleString()}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="trainingActionsRow">
              <button
                type="button"
                style={{...S.smallBtn, background:'#3a4152'}}
                onClick={clearAll}
              >
                Limpar Tudo
              </button>
              <div style={{flex:1}} />
              <div style={{fontWeight:900}}>
                Total: $ {grandTotal.toLocaleString()} 
                {selectedVendorTypes.size > 1 && (
                  <span style={{fontSize: '12px', opacity: 0.8, marginLeft: '8px'}}>
                    ({selectedTrainings.size} treinamentos × {selectedVendorTypes.size} tipos)
                  </span>
                )}
              </div>
            </div>

            {trainsGestor && (
              <div className="purchasePreviewExtra">
                <div className="purchasePreviewExtraTitle">Gestor Comercial</div>
                <p className="purchasePreviewHint" style={{ marginBottom: gestorBoostHint ? 8 : 0 }}>
                  Gestores sem certificação não aumentam o faturamento dos vendedores.
                  As certificações liberam e ampliam esse benefício, mas também aumentam as despesas do gestor.
                </p>
                {gestorBoostHint ? (
                  <div className="purchasePreviewRow">
                    <span>Boost por quantidade de certificações do gestor</span>
                    <span>{gestorBoostHint}</span>
                  </div>
                ) : null}
              </div>
            )}

            {purchaseImpact && (
              <PurchaseImpactPreview impact={purchaseImpact} />
            )}

            <div style={S.btnRow}>
              {allowBack && (
                <button type="button" style={{ ...S.bigBtn, background:'#2a2f3b', color:'#fff' }} onClick={handleBack}>Voltar</button>
              )}
              <button type="button" style={{ ...S.bigBtn, background:'#444', color:'#fff' }} onClick={handleClose}>Não comprar</button>
              <button
                type="button"
                disabled={purchases.length === 0}
                style={{ ...S.bigBtn, background: purchases.length > 0 ? '#6f5bd6' : '#3a3a3a', opacity: purchases.length > 0 ? 1 : .6, cursor: purchases.length > 0 ? 'pointer' : 'not-allowed' }}
                onClick={handleBuy}
              >
                Comprar ({purchases.length} tipo{purchases.length !== 1 ? 's' : ''})
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
  card: {
    width:'min(980px, 94vw)', maxWidth:980, maxHeight:'92vh', overflowY:'auto',
    background:'#1b1f2a', color:'#e9ecf1', borderRadius:16, padding:'20px',
    boxShadow:'0 10px 40px rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.12)', position:'relative'
  },
  close: { position:'absolute', right:10, top:10, width:36, height:36, borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'#2a2f3b', color:'#fff', cursor:'pointer' },
  title:{ margin:'6px 0 12px', fontWeight:900 },
  saldo:{ margin:'0 0 12px', padding:'8px 12px', border:'1px dashed rgba(255,255,255,.25)', borderRadius:10 },
  allDoneBox: { background:'#0f1320', border:'1px solid rgba(255,255,255,.15)', borderRadius:12, padding:'14px', fontWeight:800, textAlign:'center' },

  /* vendorRow, products e actionsRow migraram para classes CSS responsivas
     (.trainingVendorRow, .trainingProducts, .trainingActionsRow em styles.css) */
  vendorBtn: { padding:'10px 12px', borderRadius:10, border:'1px solid', color:'#fff', fontWeight:800, cursor:'pointer' },

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

  smallBtn: { padding:'10px 14px', borderRadius:10, border:'none', color:'#fff', fontWeight:800, cursor:'pointer' },
  btnRow: { display:'flex', gap:12, justifyContent:'flex-end', marginTop:12, flexWrap:'wrap' },
  bigBtn: { minWidth:160, padding:'14px 18px', borderRadius:12, border:'none', color:'#fff', fontWeight:900, cursor:'pointer' },
}
