import React from 'react'
import S from './recoveryStyles'

export default function RecoveryMenu({
  playerName,
  loanAvailable,
  hasPendingLoan,
  hasTakenLoanInMatch,
  loanBlockedInMatch,
  onGoLoan,
  onGoReduce,
  onGoFire,
  onDeclareBankruptcy
}) {
  return (
    <div style={S.body}>
      <p style={S.lead}>
        Você está sem dinheiro, {playerName}. Escolha uma das opções:
      </p>

      {loanBlockedInMatch && (
        <div style={{...S.lead, color: '#ef4444', fontWeight: 'bold', marginBottom: '16px'}}>
          ⚠️ Cada jogador só pode pegar empréstimo uma única vez por partida.
        </div>
      )}

      <ul style={S.bullets}>
        <li>
          Pedir <b>empréstimo</b> único com 50% de juros garantido por 50% dos seus <b>BENS</b> (limite {`$ ${loanAvailable}`}).
        </li>
        <li>
          <b>Reduzir</b> níveis de <b>MIX de Produtos</b> ou <b>ERP/Sistemas</b> e receber 50% do valor pago.
        </li>
        <li>
          <b>Demitir</b> funcionários e receber 50% do valor total.
        </li>
      </ul>

      <div style={S.rowBtns}>
        <button style={{...S.cta, background:'#ef4444'}} onClick={onGoFire}>DEMITIR</button>
        <button style={{...S.cta, background:'#a16207'}} onClick={onGoReduce}>REDUZIR</button>
        <button 
          style={{
            ...S.cta, 
            background: loanBlockedInMatch ? '#6b7280' : '#16a34a',
            cursor: loanBlockedInMatch ? 'not-allowed' : 'pointer'
          }} 
          onClick={loanBlockedInMatch ? undefined : onGoLoan}
          disabled={loanBlockedInMatch}
        >
          {loanBlockedInMatch ? 'EMPRÉSTIMO (INDISPONÍVEL NESTA PARTIDA)' : 'EMPRÉSTIMO'}
        </button>
        <button 
          style={{
            ...S.cta, 
            background:'#d32f2f',
            fontWeight:'bold'
          }} 
          onClick={onDeclareBankruptcy}
        >
          DECLARAR FALÊNCIA
        </button>
      </div>
    </div>
  )
}
