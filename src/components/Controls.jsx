// src/components/Controls.jsx
import React, { useEffect } from 'react'
import { useModal } from '../modals/ModalContext'
import BankruptcyModal from '../modals/BankruptcyModal'
import RecoveryModal from '../modals/RecoveryModal'

export default function Controls({ onAction, current, isMyTurn = true }) {
  const { pushModal, awaitTop } = useModal?.() || {}
  const canRoll = !!isMyTurn

  useEffect(() => {
    console.groupCollapsed('[Controls] render')
    console.log('current player:', current)
    console.log('isMyTurn prop:', isMyTurn)
    console.log('canRoll (final):', canRoll)
    console.groupEnd()
  }, [current?.id, current?.name, isMyTurn, canRoll])

  const roll = () => {
    console.log('[Controls] click => Rolar Dado & Andar (canRoll=%s)', canRoll)
    if (!canRoll) return

    const steps = Math.floor(Math.random() * 6) + 1

    // 🔒 Nada de bônus/penalidade aqui.
    const cashDelta = 0
    const note = `Dado: ${steps}`

    console.log('[Controls] onAction ROLL => steps=%d cashDelta=%d note=%s', steps, cashDelta, note)
    onAction?.({ type: 'ROLL', steps, cashDelta, note })
  }

  const onRecoveryClick = async () => {
    console.log('[Controls] click => Recuperação Financeira (modal=%s)', !!(pushModal && awaitTop))
    if (pushModal && awaitTop) {
      pushModal(<RecoveryModal playerName={current?.name || 'Jogador'} currentPlayer={current} />)
      const res = await awaitTop()
      console.log('[Controls] RecoveryModal result:', res)
      if (!res) return

      switch (res.type) {
        case 'FIRE':
          onAction?.({
            type: 'RECOVERY_FIRE',
            items: res.items,
            amount: res.totalCredit ?? res.amount ?? 0,
            note: res.note,
            creditByRole: res.creditByRole
          })
          break

        case 'REDUCE': {
          // --- SUPORTE: seleção única ou múltipla ---
          const isMulti = Array.isArray(res.items) && res.items.length > 0

          // Se veio lista, marcamos selected=true para o App.jsx aceitar (ele usa o primeiro "selected")
          const items = isMulti
            ? res.items.map((i, idx) => ({
                ...i,
                // garante campos padronizados
                group: String(i.group || i.tipo || '').toUpperCase(),
                level: String(i.level || i.nivel || '').toUpperCase(),
                credit: Number(i.credit ?? i.amount ?? 0),
                selected: idx === 0 ? true : !!i.selected
              }))
            : undefined

          // Seleção “principal” (o App.jsx usa sel/selection quando presente)
          const first =
            (isMulti && items?.[0]) ||
            res.selection ||
            res.sel ||
            (res.group && res.level
              ? {
                  group: String(res.group).toUpperCase(),
                  level: String(res.level).toUpperCase(),
                  credit: Number(res.credit ?? res.amount ?? 0)
                }
              : null)

          // Valor total: total/totalCredit quando múltiplo; senão credit/amount
          const amount = Number(
            (isMulti ? (res.total ?? res.totalCredit) : undefined) ??
            first?.credit ??
            res.amount ??
            0
          )

          const note =
            res.note ||
            (isMulti
              ? `Redução múltipla +R$ ${amount.toLocaleString()}`
              : (first
                  ? `Redução ${first.group} nível ${first.level} +R$ ${amount.toLocaleString()}`
                  : `Redução +R$ ${amount.toLocaleString()}`))

          onAction?.({
            type: 'RECOVERY_REDUCE',
            // passa a lista completa para o App.jsx (ele já entende 'items' e usa o primeiro selecionado)
            items,
            selection: first || null,
            amount,
            note
          })
          break
        }

        case 'LOAN': {
          // Normaliza a resposta do empréstimo
          const pack = (typeof res.amount === 'object' && res.amount !== null)
            ? res.amount
            : {
                amount: Number(res.amount ?? 0),
                cashDelta: Number(res.cashDelta ?? res.amount ?? 0),
                loan: res.loan
              }

          const amount = Number(pack.amount ?? 0)
          const cashDelta = Number(pack.cashDelta ?? amount ?? 0)
          const loan = pack.loan ?? res.loan ?? {}

          onAction?.({
            type: 'RECOVERY_LOAN',
            amount,
            cashDelta,
            loan,
            note: res.note
          })
          break
        }

        default:
          if (res.amount > 0) {
            onAction?.({ type: 'RECOVERY_CUSTOM', amount: res.amount, note: res.note })
          }
      }
      return
    }

    // fallback sem modal
    const n = Number(prompt('Valor de recuperação (positivo):') || 0)
    if (n > 0) onAction?.({ type: 'RECOVERY_CUSTOM', amount: n, note: 'Recuperação Financeira' })
  }

  const onBankruptClick = async () => {
    console.log('[Controls] click => Declarar Falência (modal=%s)', !!(pushModal && awaitTop))
    if (pushModal && awaitTop) {
      pushModal(<BankruptcyModal playerName={current?.name || 'Jogador'} />)
      const ok = await awaitTop()
      console.log('[Controls] BankruptcyModal result:', ok)
      if (ok) onAction?.({ type: 'BANKRUPT' })
    } else {
      if (confirm('Tem certeza que deseja declarar falência?')) {
        onAction?.({ type: 'BANKRUPT' })
      }
    }
  }

  return (
    <div className={`controls ${!canRoll ? 'is-wait' : ''}`}>
      <button className="btn primary" onClick={onRecoveryClick}>
        RECUPERAÇÃO FINANCEIRA
      </button>

      <button className="btn dark" onClick={onBankruptClick}>
        DECLARAR FALÊNCIA
      </button>

      <div className="turnBox">
        <div>Vez de: <b>{current?.name}</b></div>
        <button
          className="btn go"
          onClick={roll}
          disabled={!canRoll}
          aria-disabled={!canRoll}
        >
          Rolar Dado &amp; Andar
        </button>
      </div>
    </div>
  )
}
