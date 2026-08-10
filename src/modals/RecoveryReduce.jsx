// src/modals/RecoveryReduce.jsx
import React, { useEffect, useMemo, useState } from 'react'
import './recoveryReduce.css'

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
    // ✅ CORREÇÃO: Verifica se o nível está realmente disponível (não zerado)
    if (!card.owned || card.owned === false) return
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
    // ✅ CORREÇÃO: Desabilita nível D, níveis zerados (não owned) e níveis já reduzidos
    const isLevelD = card.level === 'D'
    const isOwned = card.owned === true // ✅ CORREÇÃO: Verifica se está explicitamente true (não false ou undefined)
    const disabled = isLevelD || !isOwned || soldKeys.has(card.key) || card.alreadyReduced || confirming
    const pal = GROUP_PALETTE[card.group] || GROUP_PALETTE.MIX

    const statusLabel = isLevelD
      ? 'básico'
      : !isOwned
      ? 'zerado'
      : soldKeys.has(card.key)
      ? 'vendido'
      : card.alreadyReduced
      ? 'já reduzido'
      : 'adquirido'

    const className = [
      'rr-card',
      isSel ? 'is-selected' : '',
      disabled ? 'is-disabled' : '',
      isOwned ? 'is-owned' : '',
    ].filter(Boolean).join(' ')

    return (
      <button
        key={card.key}
        type="button"
        className={className}
        onClick={() => toggle(card)}
        disabled={disabled}
        aria-pressed={isSel}
        style={{
          '--rr-accent': pal.accent,
          '--rr-soft': pal.soft,
          '--rr-ring': pal.ring,
          '--rr-glow': pal.glow,
          '--rr-pill-bg': pal.pillBg,
          '--rr-pill-fg': pal.pillFg,
        }}
        title={
          isLevelD
            ? 'Nível D é o básico e não pode ser reduzido.'
            : !isOwned
            ? 'Este nível não está disponível. Compre o nível novamente para poder reduzir.'
            : soldKeys.has(card.key)
            ? 'Nível já reduzido nesta sessão.'
            : card.alreadyReduced
            ? 'Este nível já foi reduzido anteriormente. Compre o nível novamente para poder reduzir.'
            : ''
        }
        onMouseDown={(e) => !disabled && e.currentTarget.classList.add('is-pressed')}
        onMouseUp={(e) => e.currentTarget.classList.remove('is-pressed')}
        onMouseLeave={(e) => e.currentTarget.classList.remove('is-pressed')}
      >
        <span className="rr-badge">{statusLabel}</span>
        <div className="rr-card-title">{card.label}</div>
        <div className="rr-card-spacer" aria-hidden="true" />
        <div className="rr-card-credit">
          <div className="rr-card-credit-label">Crédito ao reduzir:</div>
          <div className="rr-card-credit-value">
            ${card.credit.toLocaleString?.() ?? card.credit}
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="rr-root">
      <h3 className="rr-title">REDUZIR NÍVEL MIX/ERP</h3>
      <p className="rr-lead">
        Baixa o nível de Mix ou ERP e recebe 50% do valor de volta ao caixa.
        Serve para recuperar saldo e evitar falência — sem alterar a regra de crédito.
      </p>

      <div className="rr-scroll">
        <div className="rr-columns">
          <section className="rr-group" aria-label="MIX PRODUTOS">
            <h4 className="rr-group-title">MIX PRODUTOS</h4>
            <div className="rr-levels">
              {mixCards.map(renderCard)}
            </div>
          </section>

          <section className="rr-group" aria-label="ERP/SISTEMAS">
            <h4 className="rr-group-title">ERP/SISTEMAS</h4>
            <div className="rr-levels">
              {erpCards.map(renderCard)}
            </div>
          </section>
        </div>
      </div>

      <div className="rr-footer">
        <div className="rr-summary">
          <div>
            Selecionados: <b>{selected.length}</b>
            {'  —  '}
            Total: <b>${total.toLocaleString()}</b>
          </div>
          <div className="rr-summary-hint">Só é possível selecionar níveis adquiridos.</div>
        </div>

        <div className="rr-actions">
          <button
            type="button"
            className="rr-btn-back"
            onClick={onBack}
            disabled={confirming}
          >
            ← Voltar
          </button>
          <button
            type="button"
            className="rr-btn-reduce"
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
    </div>
  )
}
