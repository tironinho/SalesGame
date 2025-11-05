// src/components/Controls.jsx
import React, { useEffect } from 'react'
import { useModal } from '../modals/ModalContext'

export default function Controls({ onAction, current, isMyTurn = true, turnLocked = false, myUid, myName }) {
  // ✅ CORREÇÃO: Verifica diretamente no ModalContext se há modais abertas
  const { stackLength } = useModal()
  const hasModalOpen = stackLength > 0

  // AJUSTE: bloqueia tudo se o jogador atual estiver falido
  const isBankrupt = !!current?.bankrupt
  
  // ✅ CORREÇÃO: Simplifica o cálculo do canRoll conforme sugestão
  // Verifica apenas: é minha vez, não está falido, não há modal aberta, não está turnLocked
  const canRoll = !!isMyTurn && !isBankrupt && !hasModalOpen && !turnLocked

  // Listener para detectar mudanças no estado do botão "rolar dados"
  useEffect(() => {
    const playerName = current?.name || 'Jogador'
    const playerId = current?.id || 'unknown'
    
    console.group(`[🎲 BOTÃO ROLAR DADOS] ${playerName} (${playerId})`)
    console.log('Status:', canRoll ? '✅ HABILITADO' : '❌ DESABILITADO')
    console.log('Detalhes:')
    console.log('  - isMyTurn:', isMyTurn, '(precisa ser true)')
    console.log('  - isBankrupt:', isBankrupt, '(precisa ser false)')
    console.log('  - hasModalOpen:', hasModalOpen, '(precisa ser false)')
    console.log('  - turnLocked:', turnLocked, '(precisa ser false)')
    console.log('  - stackLength:', stackLength)
    console.log('  - current player:', current)
    console.log('  - canRoll (cálculo):', `isMyTurn(${isMyTurn}) && !isBankrupt(${!isBankrupt}) && !hasModalOpen(${!hasModalOpen}) && !turnLocked(${!turnLocked}) = ${canRoll}`)
    
    if (canRoll) {
      console.log('✅ HABILITADO para', playerName, '- Pode jogar!')
    } else {
      const reasons = []
      if (!isMyTurn) reasons.push('não é sua vez')
      if (isBankrupt) reasons.push('está falido')
      if (hasModalOpen) reasons.push('há modal aberta')
      if (turnLocked) reasons.push('turno bloqueado')
      console.log('❌ DESABILITADO para', playerName, '- Motivos:', reasons.join(', '))
    }
    console.groupEnd()
  }, [canRoll, current?.name, current?.id, isMyTurn, isBankrupt, hasModalOpen, turnLocked, stackLength, current])

  useEffect(() => {
    console.groupCollapsed('[Controls] render')
    console.log('current player:', current)
    console.log('isMyTurn:', isMyTurn)
    console.log('isBankrupt:', isBankrupt)
    console.log('hasModalOpen:', hasModalOpen)
    console.log('turnLocked:', turnLocked)
    console.log('canRoll (final):', canRoll)
    console.groupEnd()
  }, [current?.id, current?.name, current?.bankrupt, isMyTurn, hasModalOpen, turnLocked, canRoll])

  const roll = () => {
    const playerName = current?.name || 'Jogador'
    console.group(`[🎲 CLIQUE BOTÃO] ${playerName} - Rolar Dado & Andar`)
    console.log('canRoll:', canRoll)
    console.log('isMyTurn:', isMyTurn)
    console.log('isBankrupt:', isBankrupt)
    console.log('hasModalOpen:', hasModalOpen)
    console.log('turnLocked:', turnLocked)
    console.log('onAction disponível:', typeof onAction === 'function')
    
    if (!canRoll) {
      console.warn('❌ BLOQUEADO - Botão não pode ser usado!')
      console.groupEnd()
      return
    }

    const steps = Math.floor(Math.random() * 6) + 1
    const cashDelta = 0
    const note = `Dado: ${steps}`

    console.log('✅ ENVIANDO AÇÃO ROLL')
    console.log('  - steps:', steps)
    console.log('  - cashDelta:', cashDelta)
    console.log('  - note:', note)
    console.log('  - action:', { type: 'ROLL', steps, cashDelta, note })
    console.groupEnd()
    
    onAction?.({ type: 'ROLL', steps, cashDelta, note })
  }

  const onRecoveryClick = async () => {
    // AJUSTE: se falido, não pode abrir/usar recuperação
    if (isBankrupt) return

    console.log('[Controls] click => Recuperação Financeira')
    // Envia ação para o useTurnEngine que gerencia as modais corretamente
    onAction?.({ type: 'RECOVERY_MODAL' })
  }

  const onBankruptClick = async () => {
    // AJUSTE: se já está falido, não faz nada
    if (isBankrupt) return

    console.log('[Controls] click => Declarar Falência')
    // Envia ação para o useTurnEngine que gerencia as modais corretamente
    onAction?.({ type: 'BANKRUPT_MODAL' })
  }

  return (
    <div className={`controls ${!canRoll ? 'is-wait' : ''} ${isBankrupt ? 'is-bankrupt' : ''}`}>
      <button className="btn primary" onClick={onRecoveryClick} disabled={isBankrupt} aria-disabled={isBankrupt}>
        RECUPERAÇÃO FINANCEIRA
      </button>

      <button className="btn dark" onClick={onBankruptClick} disabled={isBankrupt} aria-disabled={isBankrupt}>
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
