// src/modals/RecoveryReduce.jsx
import React, { useEffect, useMemo, useState } from 'react'
import S from './recoveryStyles'

/**
 * Props:
 * - options (legacy)
 * - optionsMix, optionsErp -> [{ key, group:'MIX'|'ERP', level:'A'|'B'|'C'|'D', label, credit, owned }]
 * - mixOwned, erpOwned -> { A:boolean, B:boolean, C:boolean, D:boolean }
 * - credits -> { MIX:{A,B,C,D}, ERP:{A,B,C,D} }
 * - snapshot
 * - onBack()
 * - onConfirm({ items:[card,...], total:number })
 */
export default function RecoveryReduce(props) {
  const {
    options = [],
    optionsMix,
    optionsErp,
    mixOwned,
    erpOwned,
    credits,
    snapshot,
    onBack,
    onConfirm,
  } = props

  const LOG = (...a) => console.log('[RecoveryReduce]', ...a)

  // Paleta para destacar os botões dos níveis (A/B/C/D)
  const GROUP_PALETTE = {
    MIX: {
      accent: '#06B6D4', soft: 'rgba(6,182,212,.14)', ring: 'rgba(6,182,212,.45)',
      glow: 'rgba(6,182,212,.35)', pillBg: 'rgba(6,182,212,.18)', pillFg: '#9FF1FF'
    },
    ERP: {
      accent: '#8B5CF6', soft: 'rgba(139,92,246,.14)', ring: 'rgba(139,92,246,.45)',
      glow: 'rgba(139,92,246,.35)', pillBg: 'rgba(139,92,246,.18)', pillFg: '#E9D5FF'
    }
  }

  // Fallback: montar cartões a partir de credits + owned
  const safeLevels = ['A', 'B', 'C', 'D']
  const buildFromCredits = (group, table, ownedObj) =>
    safeLevels.map((lv) => ({
      key: `${group}-${lv}`,
      group,
      level: lv,
      label: `Nível ${lv}`,
      credit: Number(table?.[lv] ?? 0),
      owned: !!ownedObj?.[lv],
    }))

  const mixCards = useMemo(() => {
    if (Array.isArray(optionsMix) && optionsMix.length) return optionsMix
    if (credits?.MIX) return buildFromCredits('MIX', credits.MIX, mixOwned)
    return buildFromCredits('MIX', { A: 0, B: 0, C: 0, D: 0 }, mixOwned)
  }, [optionsMix, credits, mixOwned])

  const erpCards = useMemo(() => {
    if (Array.isArray(optionsErp) && optionsErp.length) return optionsErp
    if (credits?.ERP) return buildFromCredits('ERP', credits.ERP, erpOwned)
    return buildFromCredits('ERP', { A: 0, B: 0, C: 0, D: 0 }, erpOwned)
  }, [optionsErp, credits, erpOwned])

  useEffect(() => {
    console.groupCollapsed('[RecoveryReduce] props snapshot')
    console.log('mixCards:', mixCards)
    console.log('erpCards:', erpCards)
    console.log('mixOwned:', mixOwned)
    console.log('erpOwned:', erpOwned)
    console.log('credits:', credits)
    console.groupEnd()
  }, [mixCards, erpCards, mixOwned, erpOwned, credits])

  // ===== multiseleção + bloqueio otimista após confirmar =====
  const [selected, setSelected] = useState([]) // [{key,group,level,label,credit,owned}]
  const [soldKeys, setSoldKeys]   = useState(new Set()) // chaves já vendidas durante esta sessão
  const [confirming, setConfirming] = useState(false)

  const toggle = (card) => {
    // ✅ CORREÇÃO: Não permite reduzir nível D (básico)
    if (card.level === 'D') return
    if (!card.owned) return
    if (soldKeys.has(card.key)) return
    // ✅ CORREÇÃO: Verifica se o nível já foi reduzido anteriormente
    if (card.alreadyReduced) return
    setSelected((old) => {
      const exists = old.some((c) => c.key === card.key)
      if (exists) return old.filter((c) => c.key !== card.key)
      return [...old, card]
    })
  }

  const total = useMemo(
    () => selected.reduce((acc, c) => acc + Number(c.credit || 0), 0),
    [selected]
  )

  const isSelected = (card) => selected.some((c) => c.key === card.key)

  const renderCard = (card) => {
    const isSel = isSelected(card)
    // ✅ CORREÇÃO: Desabilita nível D e níveis já reduzidos
    const isLevelD = card.level === 'D'
    const disabled = isLevelD || !card.owned || soldKeys.has(card.key) || card.alreadyReduced || confirming
    const pal = GROUP_PALETTE[card.group] || GROUP_PALETTE.MIX

    const cardStyle = {
      ...S.option,
      position: 'relative',
      borderRadius: 14,
      background: disabled ? 'rgba(148,163,184,.12)' : pal.soft,
      border: isSel ? `2.5px solid ${pal.accent}` : `1px solid rgba(148,163,184,.25)`,
      boxShadow: isSel ? `0 0 0 2px ${pal.ring}, 0 10px 24px ${pal.glow}` : 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? .35 : 1,
      transition: 'transform .06s ease-out, box-shadow .12s ease-out, border-color .12s',
    }

    const labelStyle = { fontWeight: 900, fontSize: 16, marginBottom: 8, color: disabled ? '#CBD5E1' : '#E5F9FF' }
    const creditStyle = { fontWeight: 700, marginTop: 2, color: disabled ? '#A1A1AA' : '#FFFFFF' }
    const pillStyle = {
      position: 'absolute', top: 8, right: 8, fontSize: 11, padding: '3px 8px', borderRadius: 999,
      background: disabled ? 'rgba(148,163,184,.22)' : pal.pillBg,
      color: disabled ? '#E5E7EB' : pal.pillFg, border: `1px solid ${disabled ? 'rgba(148,163,184,.35)' : pal.ring}`,
      letterSpacing: .2
    }

    return (
      <button
        key={card.key}
        onClick={() => toggle(card)}
        disabled={disabled}
        aria-pressed={isSel}
        style={cardStyle}
        title={
          isLevelD
            ? 'Nível D é o básico e não pode ser reduzido.'
            : soldKeys.has(card.key)
            ? 'Nível já reduzido nesta sessão.'
            : card.alreadyReduced
            ? 'Este nível já foi reduzido anteriormente.'
            : (card.owned ? '' : 'Só é possível selecionar níveis adquiridos.')
        }
        onMouseDown={(e) => !disabled && (e.currentTarget.style.transform = 'translateY(1px)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
      >
        <span style={pillStyle}>
          {isLevelD 
            ? 'básico' 
            : soldKeys.has(card.key) 
            ? 'vendido' 
            : card.alreadyReduced
            ? 'já reduzido'
            : (card.owned ? 'adquirido' : 'não adquirido')}
        </span>

        <div style={labelStyle}>{card.label}</div>
        <div style={{ color: disabled ? '#A1A1AA' : '#BFEFFF' }}>Crédito ao reduzir:</div>
        <div style={creditStyle}>${card.credit.toLocaleString?.() ?? card.credit}</div>
      </button>
    )
  }

  return (
    <div style={S.body}>
      <div style={S.subHeader}><b style={{fontSize:20}}>REDUZIR NÍVEL MIX/ERP</b></div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
        <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.05)'}}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>MIX PRODUTOS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
            {mixCards.map(renderCard)}
          </div>
        </div>

        <div style={{ padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.05)'}}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>ERP/SISTEMAS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12 }}>
            {erpCards.map(renderCard)}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, display:'flex', justifyContent:'space-between', alignItems:'center', opacity:.92 }}>
        <div>Selecionados: <b>{selected.length}</b>  —  Total: <b>${total.toLocaleString()}</b></div>
        <div style={{ fontSize: 12, opacity:.7 }}>Só é possível selecionar níveis adquiridos.</div>
      </div>

      <div style={S.rowBtns}>
        <button style={S.back} onClick={onBack} disabled={confirming}>← Voltar</button>
        <button
          style={{...S.cta, background:'#F59E0B', color:'#101010', fontWeight:900, opacity:selected.length && !confirming ? 1 : .55}}
          onClick={() => {
            if (!selected.length || confirming) return
            setConfirming(true)

            // bloqueio otimista: marca como vendidos e limpa seleção
            setSoldKeys(prev => {
              const next = new Set(prev)
              selected.forEach(c => next.add(c.key))
              return next
            })

            const payload = { items: selected.map(c => ({ ...c, selected: true })), total }
            LOG('confirm payload =>', payload)
            onConfirm?.(payload)

            // limpa seleção visual
            setSelected([])
            setConfirming(false)
          }}
          disabled={!selected.length || confirming}
        >
          REDUZIR
        </button>
      </div>
    </div>
  )
}
