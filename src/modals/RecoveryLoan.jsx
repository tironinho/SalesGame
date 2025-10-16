import React, { useMemo, useState } from 'react'
import S from './recoveryStyles'

/**
 * Props
 * - loanAvailable: number      -> limite calculado (50% dos bens)
 * - alreadyHasLoan?: boolean   -> se true, bloqueia novo empréstimo
 * - onBack(): void
 * - onConfirm(payload): void
 *
 * onConfirm(payload) envia um objeto pronto para o chamador aplicar:
 *   {
 *     type: 'LOAN',
 *     amount: <valor>,
 *     // aplique no jogador: cash += amount
 *     cashDelta: <valor>,
 *     // marque para cobrança na próxima "Despesas Operacionais"
 *     loan: { amount: <valor>, charged: false }
 *   }
 * Caso já exista um empréstimo, envia:
 *   { type:'LOAN_DENIED', reason:'ALREADY_TAKEN' }
 */
export default function RecoveryLoan({
  loanAvailable,
  alreadyHasLoan = false,
  onBack,
  onConfirm
}) {
  const [loanInput, setLoanInput] = useState('')

  const parsed = useMemo(
    () => Math.max(0, Math.floor(Number(loanInput) || 0)),
    [loanInput]
  )
  const canConfirm =
    !alreadyHasLoan && parsed > 0 && parsed <= Number(loanAvailable || 0)

  const confirm = () => {
    // Bloqueia se já houver empréstimo marcado
    if (alreadyHasLoan) {
      onConfirm?.({ type: 'LOAN_DENIED', reason: 'ALREADY_TAKEN' })
      return
    }

    const limit = Math.max(0, Math.floor(Number(loanAvailable) || 0))
    const val = Math.max(0, Math.min(limit, parsed))

    if (val > 0) {
      // Envia um payload autoexplicativo para o modal pai / App aplicar.
      onConfirm?.({
        type: 'LOAN',
        amount: val,
        cashDelta: val, // somar no saldo imediatamente
        loan: {
          amount: val,
          charged: false // será cobrado na próxima "Despesas Operacionais"
        }
      })
    } else {
      onConfirm?.({ type: 'LOAN_DENIED', reason: 'INVALID_AMOUNT' })
    }
  }

  return (
    <div style={S.body}>
      <div style={S.subHeader}>
        <b style={{ fontSize: 20 }}>EMPRÉSTIMO</b>
      </div>

      <p>
        Você pode realizar um empréstimo colocando <b>50% dos seus BENS</b> como
        garantia (pago na próxima “Despesas Operacionais”).
      </p>

      <div style={S.infoRow}>
        <span>Valor disponível:</span> <b>${Number(loanAvailable || 0)}</b>
      </div>
      <div style={S.infoRow}>
        <span>Valor garantia:</span> <b>${Number(loanAvailable || 0)}</b>
      </div>

      {alreadyHasLoan && (
        <div
          style={{
            ...S.infoRow,
            color: '#fca5a5',
            border: '1px solid rgba(255,0,0,.25)',
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(255,0,0,.06)'
          }}
        >
          Você já possui um empréstimo ativo. Não é possível pegar outro.
        </div>
      )}

      <input
        style={S.input}
        type="number"
        min={0}
        max={Math.max(0, Number(loanAvailable || 0))}
        placeholder="Digite o valor que quer emprestar"
        value={loanInput}
        onChange={(e) => setLoanInput(e.target.value)}
        disabled={alreadyHasLoan}
      />

      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
        Máx: ${Number(loanAvailable || 0)} — valor será somado ao seu saldo e
        cobrado na próxima “Despesas Operacionais”.
      </div>

      <div style={S.rowBtns}>
        <button style={S.back} onClick={onBack}>
          ← Voltar
        </button>
        <button
          style={{
            ...S.cta,
            background: '#16a34a',
            opacity: canConfirm ? 1 : 0.6,
            cursor: canConfirm ? 'pointer' : 'not-allowed'
          }}
          onClick={confirm}
          disabled={!canConfirm}
        >
          Pegar Empréstimo
        </button>
      </div>
    </div>
  )
}
