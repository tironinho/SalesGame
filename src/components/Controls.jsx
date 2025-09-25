// src/components/Controls.jsx
import React from 'react'
import { useModal } from '../modals/ModalContext'
import BankruptcyModal from '../modals/BankruptcyModal'
import RecoveryModal from '../modals/RecoveryModal'

export default function Controls({ onAction, current, isMyTurn = true }) {
  const { pushModal, awaitTop } = useModal?.() || {}

  const canRoll = !!isMyTurn

  const roll = () => {
    const steps = Math.floor(Math.random() * 6) + 1
    const sorteReves = [
      { note: 'SORTE: Cliente fechou contrato! +$3000', cashDelta: 3000 },
      { note: 'REVÉS: Despesa inesperada. -$1500', cashDelta: -1500 },
      { note: 'SORTE: Upgrade de ERP reduziu custo! +$1200', cashDelta: 1200 },
      { note: 'REVÉS: Turnover de vendedor. -$800', cashDelta: -800 },
    ]
    let cashDelta = 0, note = `Dado: ${steps}`
    if (Math.random() < 0.30) {
      const ev = sorteReves[Math.floor(Math.random() * sorteReves.length)]
      cashDelta = ev.cashDelta
      note = ev.note + ` (Dado: ${steps})`
    }
    onAction?.({ type: 'ROLL', steps, cashDelta, note })
  }

  const onRecoveryClick = async () => {
    // Abre a modal estilizada. Fallback para prompt se o sistema de modal não estiver ativo.
    if (pushModal && awaitTop) {
      pushModal(<RecoveryModal playerName={current?.name || 'Jogador'} />)
      const res = await awaitTop()
      // res pode vir como { type: 'LOAN'|'REDUCE'|'FIRE', amount, note }
      if (res && res.amount > 0) {
        onAction?.({ type: 'RECOVERY_CUSTOM', amount: res.amount, note: res.note })
      }
      return
    }
    const n = Number(prompt('Valor de recuperação (positivo):') || 0)
    if (n > 0) onAction?.({ type: 'RECOVERY_CUSTOM', amount: n, note: 'Recuperação Financeira' })
  }

  const onBankruptClick = async () => {
    if (pushModal && awaitTop) {
      pushModal(<BankruptcyModal playerName={current?.name || 'Jogador'} />)
      const ok = await awaitTop()
      if (ok) onAction?.({ type: 'BANKRUPT' })
    } else {
      if (confirm('Tem certeza que deseja declarar falência?')) {
        onAction?.({ type: 'BANKRUPT' })
      }
    }
  }

  return (
    <div className={`controls ${!canRoll ? 'is-wait' : ''}`}>
      {/* SEMPRE HABILITADOS */}
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
