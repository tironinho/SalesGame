// src/modals/RecoveryModal.jsx
import React, { useMemo, useState, useEffect } from 'react'
import { useModal } from './ModalContext'
import S from './recoveryStyles'

import RecoveryMenu from './RecoveryMenu'
import RecoveryLoan from './RecoveryLoan'
import RecoveryReduce from './RecoveryReduce'
import RecoveryFire from './RecoveryFire' // mesmo diretório

export default function RecoveryModal({ playerName = 'Jogador', bens = 0, currentPlayer, canClose = true }) {
  const { resolveTop, popModal } = useModal?.() || {}
  const [step, setStep] = useState('menu') // 'menu' | 'loan' | 'reduce' | 'fire'

  const close = () => {
    if (!canClose) return // Não permite fechar se canClose for false
    popModal ? popModal(false) : resolveTop?.(null)
  }

  // --- preços de compra (manual) -> crédito = 50% ---
  const MIX_PRICES = useMemo(() => ({ A: 12000, B: 6000, C: 3000, D: 1000 }), [])
  const ERP_PRICES = useMemo(() => ({ A: 10000, B: 4000, C: 1500, D: 500 }), [])

  // --------- helpers de normalização ---------
  const letterFrom = (v) => {
    if (v == null) return ''
    const s = String(v).trim().toUpperCase()
    if (['A','B','C','D'].includes(s)) return s
    const n = Number(s)
    if (n === 1) return 'A'
    if (n === 2) return 'B'
    if (n === 3) return 'C'
    if (n === 4) return 'D'
    return ''
  }

  const setFromOwned = (src) => {
    // aceita array ['A','C'], objeto {A:true}, string 'B', número 1..4
    if (!src) return new Set()
    if (Array.isArray(src)) return new Set(src.map(letterFrom).filter(Boolean))
    if (typeof src === 'object') {
      const out = new Set()
      ;['A','B','C','D'].forEach(k => { if (src[k]) out.add(k) })
      return out
    }
    const l = letterFrom(src)
    return l ? new Set([l]) : new Set()
  }

  // --------- snapshot do jogador ---------
  const snapshot = useMemo(() => {
    const p = currentPlayer || {}
    return {
      name: p.name ?? playerName,
      bens: Number(p.bens ?? bens ?? 0),
      vendedoresComuns: Number(p.vendedoresComuns ?? 0),
      fieldSales: Number(p.fieldSales ?? 0),
      insideSales: Number(p.insideSales ?? 0),
      gestores: Number(p.gestores ?? p.gestoresComerciais ?? 0),
      raw: p
    }
  }, [currentPlayer, playerName, bens])

  useEffect(() => {
    console.group('[RecoveryModal] mount snapshot')
    console.log('raw player =>', snapshot.raw)
    console.groupEnd()
  }, [snapshot.raw])

  // disponível para empréstimo (50% dos bens)
  const loanAvailable = useMemo(
    () => Math.max(0, Math.floor(snapshot.bens * 0.5)),
    [snapshot.bens]
  )

  // verifica se já tem empréstimo pendente
  const hasPendingLoan = useMemo(() => {
    const loanPending = snapshot.raw?.loanPending
    return loanPending && Number(loanPending.amount) > 0
  }, [snapshot.raw?.loanPending])

  // opções do menu (mantidas)
  const REDUCE_OPTIONS = useMemo(
    () => [
      { key:'mix', label:'MIX PRODUTOS', credit:1500 },
      { key:'erp', label:'ERP/SISTEMAS', credit:1500 },
    ],
    []
  )

  // Demissão (mantido)
  const ROLES = useMemo(() => ([
    { key:'comum',  label:'Vendedor Comum', unit:1500, owned: snapshot.vendedoresComuns },
    { key:'field',  label:'Field Sales',     unit:3000, owned: snapshot.fieldSales },
    { key:'inside', label:'Inside Sales',    unit:3000, owned: snapshot.insideSales },
    { key:'gestor', label:'Gestor',          unit:5000, owned: snapshot.gestores },
  ]), [snapshot])

  // --------- detectar níveis exibidos no painel (letras) ---------
  const mixLetter = useMemo(() => {
    const p = snapshot.raw || {}
    return letterFrom(
      p.mixProdutosLetter ??
      p.mixProdutos ??
      p.mixProducts ??
      p.mixLevelLetter ??
      p.mixLevel ??
      p.mix_level ??
      p.mix ??
      p['mix_produtos'] ??
      p['mix_products']
    )
  }, [snapshot.raw])

  const erpLetter = useMemo(() => {
    const p = snapshot.raw || {}
    return letterFrom(
      p.erpSistemasLetter ??
      p.erpSistemas ??
      p.erpSystems?.level ??
      p.erpSystemsLetter ??
      p.erpLevelLetter ??
      p.erpLevel ??
      p.erp_level ??
      p.erp ??
      p['erp_sistemas']
    )
  }, [snapshot.raw])

  // --------- conjunto de posses reais (D só se nada detectado) ---------
  const ownedMix = useMemo(() => {
    const p = snapshot.raw || {}
    const mixOwnedObj = p.mixOwned ?? p.mix ?? {}
    // ✅ CORREÇÃO: Só adiciona níveis que estão explicitamente true (não false ou undefined)
    const set = new Set()
    if (mixOwnedObj.A === true) set.add('A')
    if (mixOwnedObj.B === true) set.add('B')
    if (mixOwnedObj.C === true) set.add('C')
    if (mixOwnedObj.D === true) set.add('D')
    // Se não detectamos nada, considera o D como base inicial
    if (set.size === 0) set.add('D')
    return set
  }, [snapshot.raw])

  const ownedErp = useMemo(() => {
    const p = snapshot.raw || {}
    const erpOwnedObj = p.erpOwned ?? p.erp ?? {}
    // ✅ CORREÇÃO: Só adiciona níveis que estão explicitamente true (não false ou undefined)
    const set = new Set()
    if (erpOwnedObj.A === true) set.add('A')
    if (erpOwnedObj.B === true) set.add('B')
    if (erpOwnedObj.C === true) set.add('C')
    if (erpOwnedObj.D === true) set.add('D')
    // Se não detectamos nada, considera o D como base inicial
    if (set.size === 0) set.add('D')
    return set
  }, [snapshot.raw])

  useEffect(() => {
    console.group('[RecoveryModal] owned detect')
    console.log('mixLetter(panel):', mixLetter, ' -> ownedMix =', Object.fromEntries(['A','B','C','D'].map(k=>[k,ownedMix.has(k)])))
    console.log('erpLetter(panel):', erpLetter, ' -> ownedErp =', Object.fromEntries(['A','B','C','D'].map(k=>[k,ownedErp.has(k)])))
    console.groupEnd()
  }, [mixLetter, erpLetter, ownedMix, ownedErp])

  // ✅ CORREÇÃO: Verifica quais níveis já foram reduzidos
  const reducedLevels = useMemo(() => {
    const p = snapshot.raw || {}
    return {
      MIX: Array.isArray(p.reducedLevels?.MIX) ? p.reducedLevels.MIX : [],
      ERP: Array.isArray(p.reducedLevels?.ERP) ? p.reducedLevels.ERP : [],
    }
  }, [snapshot.raw])

  // --------- montar cartões (com crédito e flag owned) ---------
  const optionsMix = useMemo(
    () => ['A','B','C','D'].map(k => ({
      key:`mix-${k}`,
      group:'MIX',
      level:k,
      label:`Nível ${k}`,
      credit:(MIX_PRICES[k] || 0) / 2,
      owned: ownedMix.has(k),
      // ✅ CORREÇÃO: Marca se o nível já foi reduzido
      alreadyReduced: reducedLevels.MIX.includes(k),
    })),
    [ownedMix, MIX_PRICES, reducedLevels.MIX]
  )

  const optionsErp = useMemo(
    () => ['A','B','C','D'].map(k => ({
      key:`erp-${k}`,
      group:'ERP',
      level:k,
      label:`Nível ${k}`,
      credit:(ERP_PRICES[k] || 0) / 2,
      owned: ownedErp.has(k),
      // ✅ CORREÇÃO: Marca se o nível já foi reduzido
      alreadyReduced: reducedLevels.ERP.includes(k),
    })),
    [ownedErp, ERP_PRICES, reducedLevels.ERP]
  )

  // tabelas de crédito por nível (se a sub-tela quiser usar)
  const creditsTables = useMemo(() => ({
    MIX: { A:MIX_PRICES.A/2, B:MIX_PRICES.B/2, C:MIX_PRICES.C/2, D:MIX_PRICES.D/2 },
    ERP: { A:ERP_PRICES.A/2, B:ERP_PRICES.B/2, C:ERP_PRICES.C/2, D:ERP_PRICES.D/2 },
  }), [MIX_PRICES, ERP_PRICES])

  return (
    <div style={S.backdrop}>
      {/* forçar remount por step ajuda quando a sub-tela possui estado interno */}
      <div style={S.card} key={step}>
        <div style={S.header}>
          <div style={{ fontWeight:900, fontSize:22 }}>RECUPERAÇÃO FINANCEIRA</div>
          {canClose && (
            <button onClick={close} style={S.closeBtn}>×</button>
          )}
        </div>

        {step === 'menu' && (
          <RecoveryMenu
            playerName={snapshot.name}
            loanAvailable={loanAvailable}
            hasPendingLoan={hasPendingLoan}
            onGoLoan={() => setStep('loan')}
            onGoReduce={() => setStep('reduce')}
            onGoFire={() => setStep('fire')}
            onDeclareBankruptcy={() => resolveTop?.({ type: 'TRIGGER_BANKRUPTCY' })}
          />
        )}

        {step === 'loan' && (
          <RecoveryLoan
            loanAvailable={loanAvailable}
            onBack={() => setStep('menu')}
            onConfirm={(payload) => {
              // Passa o payload completo do RecoveryLoan
              console.log('[DEBUG] RecoveryModal recebeu payload do RecoveryLoan:', payload)
              console.log('[DEBUG] RecoveryModal chamando resolveTop com:', payload)
              const result = resolveTop?.(payload)
              console.log('[DEBUG] RecoveryModal resolveTop retornou:', result)
            }}
          />
        )}

        {step === 'reduce' && (
          <RecoveryReduce
            // retrocompatível
            options={REDUCE_OPTIONS}

            // nova API – arrays seguros com owned correto
            optionsMix={optionsMix}
            optionsErp={optionsErp}
            mixOwned={{ A:ownedMix.has('A'), B:ownedMix.has('B'), C:ownedMix.has('C'), D:ownedMix.has('D') }}
            erpOwned={{ A:ownedErp.has('A'), B:ownedErp.has('B'), C:ownedErp.has('C'), D:ownedErp.has('D') }}
            credits={creditsTables}
            snapshot={snapshot}

            onBack={() => setStep('menu')}

            onConfirm={(payload) => {
              // payload pode ser:
              // - { group, level, credit }
              // - { items: [{group,level,credit,selected:true}, ...], total }
              if (Array.isArray(payload?.items)) {
                const total = Number(
                  payload.total ??
                  payload.items.filter(i=>i.selected).reduce((s,i)=>s+Number(i.credit||0),0)
                )
                resolveTop?.({
                  type: 'REDUCE',
                  amount: total,
                  items: payload.items,
                  note: `Redução múltipla +R$ ${total.toLocaleString()}`
                })
                return
              }

              const amount = Number(payload?.credit || payload?.amount || 0)
              const selection = payload && payload.group && payload.level
                ? { group: String(payload.group).toUpperCase(), level: String(payload.level).toUpperCase(), credit: amount }
                : null

              resolveTop?.({
                type: 'REDUCE',
                amount,
                group: selection?.group,
                level: selection?.level,
                selection,
                note: selection
                  ? `Redução ${selection.group} nível ${selection.level} +R$ ${amount.toLocaleString()}`
                  : `Redução +R$ ${amount.toLocaleString()}`,
              })
            }}
          />
        )}

        {step === 'fire' && (
          <RecoveryFire
            roles={ROLES}
            onBack={() => setStep('menu')}
            onConfirm={(payload) => resolveTop?.(payload)}
          />
        )}
      </div>
    </div>
  )
}
