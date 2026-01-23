// src/components/Controls.jsx
import React, { useEffect } from 'react'

const DEBUG_LOGS = import.meta.env.DEV && localStorage.getItem('SG_DEBUG_LOGS') === '1'

export default function Controls({
  onAction,
  current,
  // IMPORTANT: default false para não abrir janela de corrida antes de hidratar turno autoritativo
  isMyTurn = false,
  // Guards extras (opcionais) — não mudam schema, só bloqueiam ações concorrentes.
  myUid,
  turnPlayerId,
  turnLock = false,
  lockOwner = null,
  modalLocks = 0,
  gameOver = false,
}) {

  // AJUSTE: bloqueia tudo se o jogador atual estiver falido
  const isBankrupt = !!current?.bankrupt
  // ✅ OBJ 2: fonte única de turno: turnPlayerId === myUid (sem fallback por prop)
  const isMyTurnExact = (turnPlayerId != null && myUid != null) && (String(turnPlayerId) === String(myUid))
  const canRoll =
    !!turnPlayerId &&
    isMyTurnExact &&
    turnLock === false &&
    (Number(modalLocks || 0) === 0) &&
    gameOver !== true &&
    !isBankrupt

  useEffect(() => {
    if (!DEBUG_LOGS) return
    console.log('[CAN_ROLL_CHECK]', {
      myUid,
      turnPlayerId,
      isMyTurn: isMyTurnExact,
      turnLock,
      modalLocks,
      gameOver,
      bankrupt: isBankrupt,
      result: canRoll,
    })
  }, [myUid, turnPlayerId, isMyTurnExact, turnLock, modalLocks, gameOver, isBankrupt, canRoll])

  const roll = () => {
    if (DEBUG_LOGS) console.log('[Controls] click => Rolar Dado & Andar (canRoll=%s)', canRoll)
    if (!canRoll) return

    // Hard guard (UI): mesmo se o botão estiver habilitado por bug, bloqueia aqui.
    if (turnPlayerId != null && myUid != null && String(turnPlayerId) !== String(myUid)) {
      console.warn('[ROLL_BLOCK][Controls] not my turn', { turnPlayerId, myUid })
      return
    }
    if (turnLock) return

    const steps = Math.floor(Math.random() * 6) + 1

    // 🔒 Nada de bônus/penalidade aqui.
    const cashDelta = 0
    const note = `Dado: ${steps}`

    if (DEBUG_LOGS) console.log('[Controls] onAction ROLL => steps=%d cashDelta=%d note=%s', steps, cashDelta, note)
    onAction?.({ type: 'ROLL', steps, cashDelta, note })
  }

  const onRecoveryClick = async () => {
    // AJUSTE: se falido, não pode abrir/usar recuperação
    if (isBankrupt) return

    if (DEBUG_LOGS) console.log('[Controls] click => Recuperação Financeira')
    // Envia ação para o useTurnEngine que gerencia as modais corretamente
    onAction?.({ type: 'RECOVERY_MODAL' })
  }

  const onBankruptClick = async () => {
    // AJUSTE: se já está falido, não faz nada
    if (isBankrupt) return

    if (DEBUG_LOGS) console.log('[Controls] click => Declarar Falência')
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
