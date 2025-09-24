import React from 'react'
import { useModal } from '../modals/ModalContext'
import BankruptcyModal from '../modals/BankruptcyModal'

export default function Controls({ onAction, current, isMyTurn = true }) {
  const { pushModal, awaitTop } = useModal?.() || {}
  const disabled = !isMyTurn

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

  const onRecovery = () => onAction?.({ type: 'RECOVERY' })

  const onBankruptClick = async () => {
    // Abre a modal; aguarda confirmação
    if (pushModal && awaitTop) {
      pushModal(<BankruptcyModal playerName={current?.name || 'Jogador'} />)
      const ok = await awaitTop()
      if (ok) onAction?.({ type: 'BANKRUPT' })
    } else {
      // fallback: se o sistema de modal não estiver disponível
      if (confirm('Tem certeza que deseja declarar falência?')) {
        onAction?.({ type: 'BANKRUPT' })
      }
    }
  }

  return (
    <div className={`controls ${disabled ? 'is-wait' : ''}`}>
      <button
        className="btn primary"
        onClick={onRecovery}
        disabled={disabled}
        aria-disabled={disabled}
      >
        RECUPERAÇÃO FINANCEIRA
      </button>

      <button
        className="btn dark"
        onClick={onBankruptClick}
        disabled={disabled}
        aria-disabled={disabled}
      >
        DECLARAR FALÊNCIA
      </button>

      <div className="turnBox">
        <div>Vez de: <b>{current?.name}</b></div>
        <button
          className="btn go"
          onClick={roll}
          disabled={disabled}
          aria-disabled={disabled}
        >
          Rolar Dado &amp; Andar
        </button>
      </div>
    </div>
  )
}
