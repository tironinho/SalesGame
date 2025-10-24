import React from 'react'
import S from './recoveryStyles'

export default function RecoveryMenu({ playerName, loanAvailable, hasPendingLoan, onGoLoan, onGoReduce, onGoFire }) {
  return (
    <div style={S.body}>
      <p style={S.lead}>
        Você está sem dinheiro, {playerName}. Escolha uma das opções:
      </p>

      {hasPendingLoan && (
        <div style={{...S.lead, color: '#ef4444', fontWeight: 'bold', marginBottom: '16px'}}>
          ⚠️ Você já possui um empréstimo pendente. Cada jogador só pode ter um empréstimo por vez.
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
            background: hasPendingLoan ? '#6b7280' : '#16a34a',
            cursor: hasPendingLoan ? 'not-allowed' : 'pointer'
          }} 
          onClick={hasPendingLoan ? undefined : onGoLoan}
          disabled={hasPendingLoan}
        >
          {hasPendingLoan ? 'EMPRÉSTIMO (JÁ REALIZADO)' : 'EMPRÉSTIMO'}
        </button>
      </div>
    </div>
  )
}
