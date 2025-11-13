// src/game/useTurnEngine.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Pista
import { TRACK_LEN } from '../data/track'

// Modal system
import { useModal } from '../modals/ModalContext'

// ✅ CORREÇÃO: Removidos imports estáticos de modais para quebrar ciclos de importação
// Modais serão carregadas dinamicamente quando necessário

// Regras & helpers puros
import {
  applyDeltas,
  applyTrainingPurchase,
  crossedTile,
  countManagerCerts,
  hasBlue,
  hasPurple,
  hasYellow,
  capacityAndAttendance, // (importado caso queira usar para depurar HUD)
  computeDespesasFor,
  computeFaturamentoFor,
  countAlivePlayers,
  findNextAliveIdx,
  deriveRound, // ✅ CORREÇÃO: Função para calcular round baseado em laps
  advanceTile, // ✅ CORREÇÃO: Função para calcular movimento e incremento de lap
} from './gameMath'

/**
 * Hook do motor de turnos.
 * Recebe estados do App e devolve handlers (advanceAndMaybeLap, onAction, nextTurn).
 */
export function useTurnEngine({
  players, setPlayers,
  round, setRound,
  turnIdx, setTurnIdx,
  roundFlags, setRoundFlags,
  isMyTurn,
  isMine,
  myUid, meId,
  myCash,
  current,
  broadcastState,
  appendLog,
  turnLock,
  setTurnLockBroadcast,
  gameOver, setGameOver,
  winner, setWinner,
  setShowBankruptOverlay,
  phase, // Adicionado para controle condicional dentro do hook
  gameJustStarted, // ✅ CORREÇÃO: Flag para prevenir mudança de turno imediata após início
  myName, // ✅ CORREÇÃO: Adicionado para verificação de owner por nome
}) {
  // ===== Helpers =====
  // ✅ CORREÇÃO: Helper para verificar se o owner é este jogador (por ID ou nome)
  const isOwnerMe = useCallback((owner, myUid, myName) => {
    return !!owner && (
      (owner.id && String(owner.id) === String(myUid)) ||
      (owner.name && myName && owner.name.toLowerCase() === myName.toLowerCase())
    )
  }, [])

  // ✅ CORREÇÃO: "É minha vez?" usando ID estável do jogador
  // Garante que comparamos ID estável, não posição no array
  const myPlayer = useMemo(() => players.find(isMine) || {}, [players, isMine])
  const myPlayerId = useMemo(() => myPlayer?.id || myPlayer?.pid || myUid || meId, [myPlayer, myUid, meId])
  const itsMe = useMemo(() => {
    const currentPlayer = players?.[turnIdx]
    if (!currentPlayer) return false
    // Compara por ID estável (id ou pid)
    const isMatch = currentPlayer?.id === myPlayerId || currentPlayer?.pid === myPlayerId
    if (isMatch && !isMyTurn) {
      console.log('[useTurnEngine] ⚠️ itsMe=true mas isMyTurn=false - turnIdx:', turnIdx, 'myPlayerId:', myPlayerId, 'currentPlayer.id:', currentPlayer?.id)
    }
    return isMatch
  }, [players, turnIdx, myPlayerId, isMyTurn])

  // ===== Modais =====
  const modalContext = useModal()
  const { pushModal, awaitTop, resolveTop, closeTop, closeAllModals, stackLength } = modalContext || {}
  // ✅ CORREÇÃO: Mantém referência ao modalContext para usar stackLength atualizado
  const modalContextRef = useRef(modalContext)
  useEffect(() => { modalContextRef.current = modalContext }, [modalContext])

  // 🔒 dono do cadeado de turno (garante que só o iniciador destrava)
  // ✅ PATCH 1: Movido para cima para evitar "Cannot access 'lockOwner' before initialization"
  const [lockOwner, setLockOwner] = useState(null)
  const lockOwnerRef = useRef(null)
  useEffect(() => { lockOwnerRef.current = lockOwner }, [lockOwner])

  // 🔒 contagem de modais abertas (para saber quando destravar turno)
  const [modalLocks, setModalLocks] = useState(0)
  const modalLocksRef = useRef(0)
  useEffect(() => { modalLocksRef.current = modalLocks }, [modalLocks])

  // 🔄 Sincronização de modalLocks entre jogadores
  useEffect(() => {
    if (isMyTurn) {
      // Só o jogador da vez pode ter modais abertas
      console.log('[DEBUG] modalLocks sync - isMyTurn:', isMyTurn, 'modalLocks:', modalLocks, 'stackLength:', stackLength)
    } else {
      // Outros jogadores devem ter modalLocks = 0
      if (modalLocks > 0) {
        console.log('[DEBUG] modalLocks sync - resetando modalLocks para 0 (não é minha vez)')
        setModalLocks(0)
      }
      // ✅ CORREÇÃO CRÍTICA: Só fecha modais se eu tiver sido o dono do lockOwner anteriormente
      // Isso previne que modais sejam fechadas prematuramente quando o turno muda
      // O lockOwner só deve ser limpo quando o jogador anterior terminar sua ação
      const currentLockOwner = lockOwnerRef.current
      const wasMyLock = String(currentLockOwner || '') === String(myUid)
      
      // ✅ CORREÇÃO: Fecha TODAS as modais quando não é mais minha vez E eu era o dono do lock
      // Isso garante que quando o turno muda, o próximo jogador não tenha modais abertas
      // Mas só fecha se eu era o dono do lock (para não fechar modais de outros jogadores)
      if (stackLength > 0 && wasMyLock) {
        console.log('[DEBUG] modalLocks sync - fechando todas as modais (não é mais minha vez e eu era o dono), stackLength:', stackLength, 'lockOwner:', currentLockOwner)
        // ✅ CORREÇÃO: Usa closeAllModals para fechar todas as modais de uma vez
        // Isso é mais eficiente e garante que a stack seja limpa completamente
        if (closeAllModals) {
          console.log('[DEBUG] modalLocks sync - usando closeAllModals para fechar todas as modais')
          closeAllModals()
        } else if (resolveTop) {
          // Fallback: fecha modais uma por vez se closeAllModals não estiver disponível
          console.log('[DEBUG] modalLocks sync - closeAllModals não disponível, usando resolveTop')
          const currentContext = modalContextRef.current
          const closeRecursively = () => {
            const currentStackLength = currentContext?.stackLength || 0
            if (currentStackLength > 0 && currentContext?.resolveTop) {
              console.log('[DEBUG] modalLocks sync - fechando modal, stackLength restante:', currentStackLength)
              currentContext.resolveTop({ action: 'SKIP' })
              setTimeout(closeRecursively, 50)
            } else {
              console.log('[DEBUG] modalLocks sync - todas as modais foram fechadas')
            }
          }
          setTimeout(closeRecursively, 0)
        }
      } else if (stackLength > 0 && !wasMyLock) {
        console.log('[DEBUG] modalLocks sync - ⚠️ Há modais abertas mas não sou o dono do lock - não fechando (stackLength:', stackLength, 'lockOwner:', currentLockOwner, 'myUid:', myUid, ')')
      }
    }
  }, [isMyTurn, modalLocks, stackLength, closeAllModals, resolveTop, lockOwner, myUid])

  // 🔄 dados do próximo turno (para evitar stale closure)
  const pendingTurnDataRef = useRef(null)

  // Efeito para controlar a ativação/desativação do motor de turnos com base na fase
  useEffect(() => {
    if (phase !== 'game') {
      console.log('[USE_TURN_ENGINE] Desativando motor de turnos (fase:', phase, ')');
      setModalLocks(0);
      setTurnLockBroadcast(false); // Resetar lock interno
      pendingTurnDataRef.current = null; // Limpar dados de turno pendentes
      setLockOwner(null); // ✅ CORREÇÃO: Limpa lockOwner quando sai da fase de jogo
    } else {
      console.log('[USE_TURN_ENGINE] Ativando motor de turnos (fase: game)');
      // ✅ CORREÇÃO: Garante que pendingTurnDataRef seja limpo quando a fase muda para 'game'
      // Isso previne que dados de turno pendentes de uma partida anterior causem mudança de turno imediata
      if (gameJustStarted) {
        console.log('[USE_TURN_ENGINE] Jogo acabou de começar - limpando pendingTurnDataRef')
        pendingTurnDataRef.current = null
        setLockOwner(null)
      }
    }
  }, [phase, gameJustStarted, setTurnLockBroadcast]); // ✅ CORREÇÃO: Adiciona gameJustStarted como dependência

  // ✅ CORREÇÃO CRÍTICA: Helper para abrir modal travando o turno até resolver
  // Trava o turno quando abre a modal e só destrava quando a modal resolve
  const openModalWithTurnLock = useCallback(async (element) => {
    const playerName = players[turnIdx]?.name || 'Jogador'
    
    console.log(`[🔒 MODAL] ${playerName} - Abrindo modal com lock de turno`)
    console.log(`[🔒 MODAL] ${playerName} - pushModal:`, typeof pushModal, 'awaitTop:', typeof awaitTop)
    
    if (!pushModal) {
      console.error(`[🔒 MODAL] ❌ ${playerName} - pushModal não está disponível!`)
      return null
    }
    if (!awaitTop) {
      console.error(`[🔒 MODAL] ❌ ${playerName} - awaitTop não está disponível!`)
      return null
    }
    if (!isMyTurn) {
      console.error(`[🔒 MODAL] ❌ ${playerName} - Não é minha vez! isMyTurn:`, isMyTurn)
      return null
    }
    
    // ✅ CORREÇÃO: Trava o turno ANTES de abrir a modal
    console.log(`[🔒 MODAL] ${playerName} - TRAVANDO turno (setTurnLockBroadcast(true))`)
    setTurnLockBroadcast(true)
    
    // ✅ CORREÇÃO: Incrementa modalLocks para rastrear modais abertas
    console.log(`[🔒 MODAL] ${playerName} - ABRINDO modal, modalLocks: ${modalLocks} → ${modalLocks + 1}`)
    setModalLocks(c => c + 1)
    
    try {
      // Abre a modal
      pushModal(element)
      console.log(`[🔒 MODAL] ${playerName} - Modal aberta, aguardando resolução...`)
      
      // ✅ CORREÇÃO: Espera a resolução da modal (só sai daqui ao fechar/confirmar/skip)
      const payload = await awaitTop()
      console.log(`[🔒 MODAL] ${playerName} - Modal resolvida, payload:`, payload)
      
      return payload
    } catch (error) {
      console.error(`[🔒 MODAL] ❌ ${playerName} - Erro ao abrir/fechar modal:`, error)
      return null
    } finally {
      // ✅ CORREÇÃO: Destrava o turno DEPOIS de resolver a modal
      console.log(`[🔒 MODAL] ${playerName} - DESTRAVANDO turno (setTurnLockBroadcast(false))`)
      setTurnLockBroadcast(false)
      
      // ✅ CORREÇÃO: Decrementa modalLocks
      console.log(`[🔒 MODAL] ${playerName} - FECHANDO modal, modalLocks: ${modalLocks} → ${Math.max(0, modalLocks - 1)}`)
      setModalLocks(c => Math.max(0, c - 1))
    }
  }, [pushModal, awaitTop, isMyTurn, players, turnIdx, modalLocks, setModalLocks, setTurnLockBroadcast])

  // Mantém compatibilidade com código existente (deprecated)
  const openModalAndWait = openModalWithTurnLock

  // ✅ CORREÇÃO CRÍTICA: Função única para avançar turno que sempre faz broadcast
  // Garante que o turno seja atualizado localmente ANTES do broadcast
  // playersUpdate é opcional: se fornecido, usa esses players; caso contrário, usa players atual
  const advanceTurn = useCallback((playersUpdate = null) => {
    if (gameOver || !players.length) {
      console.log('[advanceTurn] ❌ Jogo acabou ou não há jogadores - não avançando turno')
      return
    }
    
    const playersToUse = playersUpdate || players
    const total = playersToUse.length
    const cur = turnIdx
    const next = findNextAliveIdx(playersToUse, cur)
    const nextRound = next === 0 ? (round + 1) : round
    
    console.log('[advanceTurn] ✅ Avançando turno - atual:', cur, 'próximo:', next, 'round:', round, 'próximo round:', nextRound)
    
    // ✅ CORREÇÃO: Atualiza players se fornecido
    if (playersUpdate && JSON.stringify(playersUpdate) !== JSON.stringify(players)) {
      console.log('[advanceTurn] ✅ Atualizando players antes de avançar turno')
      setPlayers(playersUpdate)
    }
    
    // ✅ CORREÇÃO: Atualiza localmente ANTES do broadcast
    setTurnIdx(next)
    if (nextRound !== round) {
      setRound(nextRound)
    }
    
    // ✅ CORREÇÃO: IMPORTANTE: não envie flags locais (turnLock/hasModalOpen)
    // Se playersUpdate foi fornecido, usa-o; caso contrário, usa players atual
    // players=null significa que só atualiza turnIdx/round, não os players
    const playersForBroadcast = playersUpdate || null
    broadcastState(playersForBroadcast, next, nextRound)
    
    // ✅ CORREÇÃO: Libera o lock do jogador que acabou de jogar
    setTurnLockBroadcast(false)
    
    console.log('[advanceTurn] ✅ Turno avançado - próximo jogador:', playersToUse[next]?.name, 'turnIdx:', next)
  }, [broadcastState, gameOver, players, round, setRound, setTurnIdx, setPlayers, turnIdx, setTurnLockBroadcast])

  // Mantém compatibilidade com código existente
  const nextTurn = advanceTurn

  // ✅ CORREÇÃO: Avança turno calculando próximo índice/rodada e emite broadcast com o array de players fornecido.
  const endTurnWith = useCallback((updPlayers) => {
    const total = updPlayers?.length ?? players.length
    const nextIdx = findNextAliveIdx(updPlayers ?? players, turnIdx)
    // ✅ CORREÇÃO: Usa deriveRound para calcular round baseado nos laps dos jogadores
    const nextRnd = deriveRound(updPlayers ?? players, TRACK_LEN)
    
    console.log('[endTurnWith] ✅ Avançando turno - atual:', turnIdx, 'próximo:', nextIdx, 'round:', round, 'próximo round:', nextRnd)
    
    // Atualiza players se fornecido
    if (updPlayers && JSON.stringify(updPlayers) !== JSON.stringify(players)) {
      setPlayers(updPlayers)
    }
    
    // Atualiza turno e rodada
    setTurnIdx(nextIdx)
    if (nextRnd !== round) {
      setRound(nextRnd)
    }
    
    // Faz broadcast
    broadcastState(updPlayers ?? null, nextIdx, nextRnd)
    
    console.log('[endTurnWith] ✅ Turno avançado - próximo jogador:', (updPlayers ?? players)[nextIdx]?.name, 'turnIdx:', nextIdx)
  }, [players, turnIdx, round, setPlayers, setTurnIdx, setRound, broadcastState, findNextAliveIdx, deriveRound, TRACK_LEN])

  // ✅ CORREÇÃO: Finaliza turno quando a modal foi fechada sem compra, ou quando faltou saldo.
  const finishTurnNoBuy = useCallback(() => {
    try {
      // nada a atualizar em players; só avança o turno
      endTurnWith(players)
    } finally {
      setTurnLockBroadcast(false)
    }
  }, [players, endTurnWith, setTurnLockBroadcast])

  // ========= regras auxiliares de saldo =========
  const canPay = useCallback((idx, amount) => {
    const p = players[idx]
    const amt = Math.max(0, Number(amount || 0))
    return (Number(p?.cash || 0) >= amt)
  }, [players])

  const requireFunds = useCallback((idx, amount, reason) => {
    const ok = canPay(idx, amount)
    if (!ok) {
      appendLog(`Saldo insuficiente${reason ? ' para ' + reason : ''}. Use RECUPERAÇÃO (demitir / emprestar / reduzir) ou declare FALÊNCIA.`)
    }
    return ok
  }, [canPay, appendLog])

  // ========= fim de jogo =========
  const maybeFinishGame = useCallback((nextPlayers, nextRound) => {
    if (nextRound <= 5) return
    
    // Filtra apenas jogadores vivos (não falidos) para determinar o vencedor
    const alivePlayers = nextPlayers.filter(p => !p?.bankrupt)
    if (alivePlayers.length === 0) {
      console.log('[DEBUG] 🏁 FIM DE JOGO - Nenhum jogador vivo restante')
      setWinner(null)
      setGameOver(true)
      appendLog('Fim de jogo! Todos os jogadores falidos.')
      setTurnLockBroadcast(false)
      return
    }
    
    const ranked = alivePlayers.map(p => ({
      ...p,
      patrimonio: (p.cash || 0) + (p.bens || 0)
    })).sort((a,b) => b.patrimonio - a.patrimonio)
    
    console.log('[DEBUG] 🏆 VENCEDOR - Jogadores vivos:', alivePlayers.map(p => p.name), 'Vencedor:', ranked[0]?.name)
    setWinner(ranked[0] || null)
    setGameOver(true)
    appendLog('Fim de jogo! 5 rodadas completas.')
    setTurnLockBroadcast(false)
  }, [appendLog, setGameOver, setTurnLockBroadcast, setWinner])

  // ========= ação de andar no tabuleiro (inclui TODA a lógica de casas/modais) =========
  const advanceAndMaybeLap = useCallback((steps, deltaCash, note) => {
    const playerName = players[turnIdx]?.name || 'Jogador'
    console.group(`[🎯 MOVIMENTO] ${playerName} - advanceAndMaybeLap INICIADO`)
    console.log('Parâmetros:')
    console.log('  - steps:', steps)
    console.log('  - deltaCash:', deltaCash)
    console.log('  - note:', note)
    console.log('Estado atual:')
    console.log('  - phase:', phase)
    console.log('  - gameOver:', gameOver)
    console.log('  - players.length:', players.length)
    console.log('  - turnIdx:', turnIdx)
    console.log('  - isMyTurn:', isMyTurn)
    console.log('  - myUid:', myUid)
    console.log('  - lockOwner ANTES:', lockOwner)
    console.log('  - turnLock ANTES:', turnLock)
    
    if (phase !== 'game') {
      console.warn('❌ BLOQUEADO - Tentativa de ação fora da fase de jogo')
      console.groupEnd()
      return;
    }
    if (gameOver || !players.length) {
      console.warn('❌ BLOQUEADO - Jogo terminou ou sem jogadores')
      console.groupEnd()
      return
    }

    // Bloqueia os próximos jogadores até esta ação (e todas as modais) terminar
    console.log('🔒 ATIVANDO LOCK - Bloqueando turno para outros jogadores')
    console.log('  - setTurnLockBroadcast(true)')
    console.log('  - setLockOwner(String(myUid)) =', String(myUid))
    setTurnLockBroadcast(true)
    setLockOwner(String(myUid))

    const curIdx = turnIdx
    const cur = players[curIdx]
    if (!cur) { setTurnLockBroadcast(false); return }
    
    console.log('[DEBUG] 📍 POSIÇÃO INICIAL - Jogador:', cur.name, 'Posição:', cur.pos, 'Saldo:', cur.cash)

    // ========= função recursiva para lidar com saldo insuficiente =========
    // ✅ CORREÇÃO CRÍTICA: Captura variáveis do escopo para evitar TDZ
    const capturedCurIdx = curIdx
    const capturedTurnIdx = turnIdx
    const capturedRound = round
    const handleInsufficientFunds = async (requiredAmount, context, action, currentPlayers = players) => {
      const currentCash = Number(currentPlayers[capturedCurIdx]?.cash || 0)
      
      if (currentCash >= requiredAmount) {
        // Processa o pagamento já que tem saldo suficiente
        console.log('[DEBUG] ✅ Saldo suficiente! Processando pagamento de:', requiredAmount)
        const updatedPlayers = currentPlayers.map((p, i) => 
          i !== capturedCurIdx ? p : { ...p, cash: Math.max(0, (p.cash || 0) - requiredAmount) }
        )
        setPlayers(updatedPlayers)
        broadcastState(updatedPlayers, capturedTurnIdx, capturedRound)
        return true // Tem saldo suficiente e pagou
      }

      // Mostra modal de saldo insuficiente
      // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
      const { default: InsufficientFundsModal } = await import('../modals/InsufficientFundsModal.jsx')
      const recoveryRes = await openModalAndWait(
        <InsufficientFundsModal
          requiredAmount={requiredAmount}
          currentCash={currentCash}
          title={`Saldo insuficiente para ${action} ${context}`}
          message={`Você precisa ${action} R$ ${requiredAmount.toLocaleString()} mas possui apenas R$ ${currentCash.toLocaleString()}.`}
          showRecoveryOptions={true}
        />
      )
      
      if (!recoveryRes) {
        setTurnLockBroadcast(false)
        return false
      }
      
      if (recoveryRes.action === 'RECOVERY') {
        // Abre modal de recuperação financeira (não pode ser fechada)
        console.log('[DEBUG] Abrindo RecoveryModal para jogador:', currentPlayers[capturedCurIdx])
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: RecoveryModal } = await import('../modals/RecoveryModal.jsx')
        const recoveryModalRes = await openModalAndWait(<RecoveryModal currentPlayer={currentPlayers[capturedCurIdx]} canClose={false} />)
        console.log('[DEBUG] RecoveryModal retornou:', recoveryModalRes)
        if (recoveryModalRes) {
          // Processa a ação de recuperação
          console.log('[DEBUG] recoveryModalRes existe, tipo:', recoveryModalRes.type, 'action:', recoveryModalRes.action)
          let updatedPlayers = currentPlayers
          
          if (recoveryModalRes.type === 'FIRE') {
            console.log('[DEBUG] ✅ Condição FIRE atendida! Processando demissões:', recoveryModalRes)
            const deltas = {
              cashDelta: Number(recoveryModalRes.amount || 0),
              vendedoresComunsDelta: -Number(recoveryModalRes.items?.comum || 0),
              fieldSalesDelta: -Number(recoveryModalRes.items?.field || 0),
              insideSalesDelta: -Number(recoveryModalRes.items?.inside || 0),
              gestoresDelta: -Number(recoveryModalRes.items?.gestor || 0),
            }
            console.log('[DEBUG] Deltas de demissão:', deltas)
            updatedPlayers = currentPlayers.map((p, i) => (i !== capturedCurIdx ? p : applyDeltas(p, deltas)))
            console.log('[DEBUG] Novo saldo após demissões:', updatedPlayers[capturedCurIdx]?.cash)
            setPlayers(updatedPlayers)
            broadcastState(updatedPlayers, capturedTurnIdx, capturedRound)
          } else if (recoveryModalRes.type === 'LOAN') {
            console.log('[DEBUG] ✅ Condição LOAN atendida! Processando empréstimo:', recoveryModalRes)
            
            // Verifica se o jogador já tem um empréstimo pendente
            const currentLoan = currentPlayers[capturedCurIdx]?.loanPending
            if (currentLoan && Number(currentLoan.amount) > 0) {
              console.log('[DEBUG] ❌ Jogador já possui empréstimo pendente:', currentLoan)
              // Mostra modal informando que já tem empréstimo - NÃO PODE FECHAR
              // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
              const { default: InsufficientFundsModal } = await import('../modals/InsufficientFundsModal.jsx')
              const loanModalRes = await openModalAndWait(
                <InsufficientFundsModal
                  requiredAmount={requiredAmount}
                  currentCash={currentPlayers[capturedCurIdx]?.cash || 0}
                  title="Empréstimo já realizado"
                  message={`Você já possui um empréstimo pendente de R$ ${Number(currentLoan.amount).toLocaleString()}. Cada jogador só pode ter um empréstimo por vez.`}
                  showRecoveryOptions={false}
                  canClose={false} // NÃO PODE FECHAR
                />
              )
              // Força o jogador a declarar falência se já tem empréstimo
              if (!loanModalRes || loanModalRes.action !== 'BANKRUPT') {
                setTurnLockBroadcast(false)
                return false
              }
              // Processa falência
              const updatedPlayers = currentPlayers.map((p, i) => (i === capturedCurIdx ? { ...p, bankrupt: true } : p))
              const alive = countAlivePlayers(updatedPlayers)
              if (alive <= 1) {
                const winnerIdx = updatedPlayers.findIndex(p => !p?.bankrupt)
                setWinner(winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
                setPlayers(updatedPlayers)
                setGameOver(true)
                setTurnLockBroadcast(false)
                broadcastState(updatedPlayers, capturedTurnIdx, capturedRound, true, winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
                return false
              }
              const nextIdx = findNextAliveIdx(updatedPlayers, capturedCurIdx)
              setPlayers(updatedPlayers)
              setTurnIdx(nextIdx)
              setTurnLockBroadcast(false)
              broadcastState(updatedPlayers, nextIdx, capturedRound)
              return false
            }
            
            const amt = Number(recoveryModalRes.amount || 0)
            console.log('[DEBUG] Valor do empréstimo:', amt)
            console.log('[DEBUG] Saldo atual do jogador:', currentPlayers[capturedCurIdx]?.cash)
            updatedPlayers = currentPlayers.map((p, i) =>
              i !== capturedCurIdx ? p : {
                ...p,
                cash: (Number(p.cash) || 0) + amt,
                loanPending: { amount: amt, dueRound: capturedRound + 1, charged: false },
              }
            )
            console.log('[DEBUG] Novo saldo do jogador:', updatedPlayers[capturedCurIdx]?.cash)
            console.log('[DEBUG] Novo loanPending:', updatedPlayers[capturedCurIdx]?.loanPending)
            setPlayers(updatedPlayers)
            broadcastState(updatedPlayers, capturedTurnIdx, capturedRound)
          } else if (recoveryModalRes.type === 'REDUCE') {
            console.log('[DEBUG] ✅ Condição REDUCE atendida! Processando redução:', recoveryModalRes)
            const selections = recoveryModalRes.items || []
            let totalCredit = 0
            console.log('[DEBUG] Seleções para reduzir:', selections)
            updatedPlayers = currentPlayers.map((p, i) => {
              if (i !== capturedCurIdx) return p
              let next = { ...p }
              for (const sel of selections) {
                if (sel.selected) {
                  totalCredit += Number(sel.credit || 0)
                  if (sel.group === 'MIX') {
                    next.mixOwned = { ...(next.mixOwned || {}), [sel.level]: false }
                  } else if (sel.group === 'ERP') {
                    next.erpOwned = { ...(next.erpOwned || {}), [sel.level]: false }
                  }
                }
              }
              next.cash = (Number(next.cash) || 0) + totalCredit
              return next
            })
            console.log('[DEBUG] Total de crédito da redução:', totalCredit)
            console.log('[DEBUG] Novo saldo após redução:', updatedPlayers[capturedCurIdx]?.cash)
            setPlayers(updatedPlayers)
            broadcastState(updatedPlayers, capturedTurnIdx, capturedRound)
          } else {
            console.log('[DEBUG] ❌ Nenhuma condição foi atendida! Tipo:', recoveryModalRes.type, 'Action:', recoveryModalRes.action)
          }
          
          // Verifica se agora tem saldo suficiente após a recuperação
          const newCash = Number(updatedPlayers[capturedCurIdx]?.cash || 0)
          console.log('[DEBUG] Verificando saldo após recuperação - Novo saldo:', newCash, 'Necessário:', requiredAmount)
          
          if (newCash >= requiredAmount) {
            console.log('[DEBUG] ✅ Saldo suficiente após recuperação! Processando pagamento de:', requiredAmount)
            // Processa o pagamento já que tem saldo suficiente
            const finalPlayers = updatedPlayers.map((p, i) => 
              i !== capturedCurIdx ? p : { ...p, cash: Math.max(0, (p.cash || 0) - requiredAmount) }
            )
            console.log('[DEBUG] 💰 PAGAMENTO - Saldo antes:', updatedPlayers[capturedCurIdx]?.cash, 'Valor a pagar:', requiredAmount, 'Saldo após:', finalPlayers[capturedCurIdx]?.cash)
            setPlayers(finalPlayers)
            broadcastState(finalPlayers, capturedTurnIdx, capturedRound)
            return true
          } else {
            console.log('[DEBUG] ❌ Saldo ainda insuficiente após recuperação. Continuando recursão...')
            // Recursivamente verifica se agora tem saldo suficiente com o estado atualizado
            return await handleInsufficientFunds(requiredAmount, context, action, updatedPlayers)
          }
        } else {
          setTurnLockBroadcast(false)
          return false
        }
      } else if (recoveryRes.action === 'BANKRUPT') {
        // Processa falência
        const updatedPlayers = currentPlayers.map((p, i) => (i === capturedCurIdx ? { ...p, bankrupt: true } : p))
        const alive = countAlivePlayers(updatedPlayers)
        if (alive <= 1) {
          const winnerIdx = updatedPlayers.findIndex(p => !p?.bankrupt)
          setWinner(winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
          setPlayers(updatedPlayers)
          setGameOver(true)
          setTurnLockBroadcast(false)
          broadcastState(updatedPlayers, capturedTurnIdx, capturedRound, true, winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
          return false
        }
        const nextIdx = findNextAliveIdx(updatedPlayers, capturedCurIdx)
        setPlayers(updatedPlayers)
        setTurnIdx(nextIdx)
        setTurnLockBroadcast(false)
        broadcastState(updatedPlayers, nextIdx, capturedRound)
        return false
      } else {
        setTurnLockBroadcast(false)
        return false
      }
    }

    // ✅ CORREÇÃO: Usa advanceTile para calcular movimento e lap corretamente
    const oldTile = cur.tile ?? cur.pos ?? 0
    const { newTile, lapInc } = advanceTile(oldTile, steps, TRACK_LEN)

    console.log('[DEBUG] 🚶 MOVIMENTO - De posição:', oldTile, 'Para posição:', newTile, 'Steps:', steps, 'Lap incremento:', lapInc)

    // aplica movimento + eventual cashDelta imediato (sem permitir negativo)
    // ✅ CORREÇÃO: Usa applyDeltas com steps para calcular tile e lap automaticamente
    const nextPlayers = players.map((p, i) => {
      if (i !== curIdx) {
        // Garante que todos os jogadores tenham lap inicializado
        return { ...p, lap: p.lap ?? 0 }
      }
      const nextCash = (p.cash || 0) + (deltaCash || 0)
      const oldLap = p.lap ?? 0
      const newLap = oldLap + lapInc
      return { 
        ...p, 
        tile: newTile,
        pos: newTile, // mantém compatibilidade
        lap: newLap,
        cash: Math.max(0, nextCash) 
      }
    })
    
    console.log('[DEBUG] 📍 APÓS MOVIMENTO - Jogador:', nextPlayers[curIdx]?.name, 'Posição:', nextPlayers[curIdx]?.tile ?? nextPlayers[curIdx]?.pos, 'Lap:', nextPlayers[curIdx]?.lap, 'Saldo:', nextPlayers[curIdx]?.cash)

    // ✅ CORREÇÃO: Usa deriveRound para calcular round baseado nos laps de todos os jogadores
    const nextRound = deriveRound(nextPlayers, TRACK_LEN)
    
    if (nextRound !== round) {
      console.log('[DEBUG] 🔄 RODADA INCREMENTADA - Nova rodada:', nextRound, '(todos os jogadores têm lap >=', nextRound - 1, ')')
    }
    
    // ✅ CORREÇÃO CRÍTICA: Garante que nextRound seja uma constante após todas as reatribuições
    // Isso previne problemas de TDZ (Temporal Dead Zone) em funções assíncronas
    const finalNextRound = nextRound
    
    // ✅ CORREÇÃO: Não usa mais roundFlags, pois round é derivado de lap
    // Mantém compatibilidade removendo uso de roundFlags

    // >>> pular jogadores falidos ao decidir o próximo turno
    const nextTurnIdx = findNextAliveIdx(nextPlayers, curIdx)

    if (deltaCash) appendLog(`${cur.name} ${deltaCash>0? 'ganhou' : 'pagou'} $${(Math.abs(deltaCash)).toLocaleString()}`)
    if (note) appendLog(note)

    setPlayers(nextPlayers)
    setRound(finalNextRound)
    
    // 🔚 Encerramento por rodada: quando round passar de 5, encerramos
    // ✅ CORREÇÃO: Round é derivado de laps, não incrementado por turno
    if (finalNextRound > 5) {
      console.log('[DEBUG] 🏁 FIM DE JOGO - 5 rodadas completas')
      maybeFinishGame(nextPlayers, finalNextRound)
      setTurnLockBroadcast(false)
      return
    }
    
    // ✅ CORREÇÃO CRÍTICA: Verifica se há tiles de modal antes de definir pendingTurnDataRef
    // Isso previne que o tick mude o turno antes das modais serem abertas
    const landedOneBased = newTile + 1
    const crossedStart1 = crossedTile(oldTile, newTile, 0)
    const crossedExpenses23 = crossedTile(oldTile, newTile, 22)
    const hasModalTile = 
      (landedOneBased === 6 || landedOneBased === 16 || landedOneBased === 32 || landedOneBased === 49) || // ERP
      (landedOneBased === 2 || landedOneBased === 11 || landedOneBased === 19 || landedOneBased === 47) || // Training
      (landedOneBased === 5 || landedOneBased === 10 || landedOneBased === 43) || // DirectBuy
      (landedOneBased === 12 || landedOneBased === 21 || landedOneBased === 30 || landedOneBased === 42 || landedOneBased === 53) || // InsideSales
      [4,8,15,17,20,27,34,36,39,46,52,55].includes(landedOneBased) || // Clientes
      [3,14,22,26,35,41,48,54].includes(landedOneBased) || // Sorte & Revés
      crossedStart1 || // Start
      crossedExpenses23 // Despesas
    
    // ✅ CORREÇÃO CRÍTICA: Só define pendingTurnDataRef se NÃO houver tiles de modal
    // Se houver tiles de modal, o pendingTurnDataRef será definido DEPOIS que todas as modais forem fechadas
    // Isso garante que o tick não mude o turno antes das modais serem abertas
    if (!hasModalTile || !itsMe || !pushModal || !awaitTop) {
      // Armazena os dados do próximo turno para uso na função tick
      pendingTurnDataRef.current = {
        nextPlayers,
        nextTurnIdx,
        nextRound: finalNextRound
      }
      console.log('[DEBUG] ✅ pendingTurnDataRef definido (sem tiles de modal ou condições não atendidas)')
    } else {
      console.log('[DEBUG] ⚠️ pendingTurnDataRef NÃO definido ainda (há tiles de modal que serão abertos)')
    }
    
    // NÃO muda o turno aqui - aguarda todas as modais serem fechadas
    // O turno será mudado na função tick() quando modalLocks === 0

    // ✅ CORREÇÃO: landedOneBased, crossedStart1 e crossedExpenses23 já foram definidos acima (para verificar hasModalTile)

    console.log('🏠 TILES DETECTADOS APÓS MOVIMENTO:')
    console.log('  - landedOneBased (posição 1-based):', landedOneBased)
    console.log('  - Cruzou Start (pos 0):', crossedStart1)
    console.log('  - Cruzou Despesas (pos 22):', crossedExpenses23)
    console.log('  - Condições para modais:')
    console.log('    - itsMe:', itsMe, itsMe ? '✅' : '❌')
    console.log('    - pushModal:', typeof pushModal, pushModal ? '✅' : '❌')
    console.log('    - awaitTop:', typeof awaitTop, awaitTop ? '✅' : '❌')
    console.log('    - turnIdx:', turnIdx, 'myUid:', myUid, 'owner.id:', players[turnIdx]?.id)
    console.log('    - lockOwner:', lockOwner, 'turnLock:', turnLock)

    // ================== Regras por casas (modais) ==================

    // ERP
    const isErpTile = (landedOneBased === 6 || landedOneBased === 16 || landedOneBased === 32 || landedOneBased === 49)
    if (isErpTile) {
      console.group(`[🏠 TILE] ${cur.name} - ERP Tile (posição ${landedOneBased})`)
      console.log('Condições para abrir modal:')
      console.log('  - isErpTile:', isErpTile, '✅')
      console.log('  - isMyTurn:', isMyTurn, isMyTurn ? '✅' : '❌')
      console.log('  - pushModal:', typeof pushModal, pushModal ? '✅' : '❌')
      console.log('  - awaitTop:', typeof awaitTop, awaitTop ? '✅' : '❌')
      
    if (isErpTile && itsMe && pushModal && awaitTop) {
      console.log('✅ TODAS AS CONDIÇÕES ATENDIDAS - Abrindo modal ERP')
    } else {
      console.warn('❌ BLOQUEADO - Alguma condição não foi atendida')
      if (!itsMe) console.warn('  - Não é minha vez! (itsMe:', itsMe, 'myPlayerId:', myPlayerId, 'currentPlayer.id:', players[turnIdx]?.id, ')')
      if (!pushModal) console.warn('  - pushModal não está disponível!')
      if (!awaitTop) console.warn('  - awaitTop não está disponível!')
    }
    console.groupEnd()
    }
    if (isErpTile && itsMe && pushModal && awaitTop) {
      ;(async () => {
        const currentErpLevel = players[curIdx]?.erpLevel || null
        console.log('[ERP] Abrindo modal ERP para:', cur?.name)
        
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: ERPSystemsModal } = await import('../modals/ERPSystemsModal.jsx')
        
        // ✅ CORREÇÃO: Usa openModalWithTurnLock para travar o turno até resolver
        const res = await openModalWithTurnLock(<ERPSystemsModal 
          currentCash={players[curIdx]?.cash ?? myCash}
          currentLevel={currentErpLevel}
        />)
        
        // ✅ CORREÇÃO: Se não comprou, finaliza turno sem compra
        if (!res || res.action !== 'BUY') return finishTurnNoBuy()
        
        // ✅ CORREÇÃO: Processa compra se houver
        const price = Number(res.values?.compra || 0)
        if (!requireFunds(curIdx, price, 'comprar ERP')) return finishTurnNoBuy()
        
        console.log('[ERP] Processando compra, price:', price, 'level:', res.level)
        const updatedPlayers = players.map((p, i) =>
          i !== curIdx ? p : applyDeltas(p, { cashDelta: -price, erpLevelSet: res.level })
        )
        
        // ✅ CORREÇÃO: Atualiza players e avança turno
        setPlayers(updatedPlayers)
        endTurnWith(updatedPlayers)
        setTurnLockBroadcast(false)
      })()
    }

    // Treinamento
    const isTrainingTile = (landedOneBased === 2 || landedOneBased === 11 || landedOneBased === 19 || landedOneBased === 47)
    if (isTrainingTile && itsMe && pushModal && awaitTop) {
      ;(async () => {
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        
        // ✅ CORREÇÃO CRÍTICA: Define pendingTurnDataRef DEPOIS de abrir a modal
        // Isso garante que o tick não mude o turno antes da modal ser fechada
        if (!pendingTurnDataRef.current) {
          pendingTurnDataRef.current = {
            nextPlayers: capturedNextPlayers,
            nextTurnIdx: capturedNextTurnIdx,
            nextRound: capturedNextRound
          }
          console.log('[DEBUG] ✅ pendingTurnDataRef definido (após abrir modal Treinamento)')
        }
        const ownerForTraining = players.find(isMine) || capturedNextPlayers[curIdx]
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: TrainingModal } = await import('../modals/TrainingModal.jsx')
        const res = await openModalAndWait(<TrainingModal
          canTrain={{
            comum:  Number(ownerForTraining?.vendedoresComuns) || 0,
            field:  Number(ownerForTraining?.fieldSales) || 0,
            inside: Number(ownerForTraining?.insideSales) || 0,
            gestor: Number(ownerForTraining?.gestores ?? ownerForTraining?.gestoresComerciais ?? ownerForTraining?.managers) || 0
          }}
          ownedByType={{
            comum: ownerForTraining?.trainingsByVendor?.comum || [],
            field: ownerForTraining?.trainingsByVendor?.field || [],
            inside: ownerForTraining?.trainingsByVendor?.inside || [],
            gestor: ownerForTraining?.trainingsByVendor?.gestor || []
          }}
        />)
        if (!res || res.action !== 'BUY') return finishTurnNoBuy()
        const trainCost = Number(res.grandTotal || 0)
        if (!requireFunds(curIdx, trainCost, 'comprar Treinamento')) return finishTurnNoBuy()
        
        const updatedPlayers = players.map((p, i) =>
          i !== curIdx ? p : applyTrainingPurchase(p, res)
        )
        setPlayers(updatedPlayers)
        endTurnWith(updatedPlayers)
        setTurnLockBroadcast(false)
      })()
    }

    // Compra direta (menu)
    const isDirectBuyTile = (landedOneBased === 5 || landedOneBased === 10 || landedOneBased === 43)
    if (isDirectBuyTile) {
      console.group(`[🏠 TILE] ${cur.name} - Compra Direta Tile (posição ${landedOneBased})`)
      console.log('Condições para abrir modal:')
      console.log('  - isDirectBuyTile:', isDirectBuyTile, '✅')
      console.log('  - isMyTurn:', isMyTurn, isMyTurn ? '✅' : '❌')
      console.log('  - pushModal:', typeof pushModal, pushModal ? '✅' : '❌')
      console.log('  - awaitTop:', typeof awaitTop, awaitTop ? '✅' : '❌')
      
      if (isDirectBuyTile && itsMe && pushModal && awaitTop) {
        console.log('✅ TODAS AS CONDIÇÕES ATENDIDAS - Abrindo modal Compra Direta')
      } else {
        console.warn('❌ BLOQUEADO - Alguma condição não foi atendida')
        if (!itsMe) console.warn('  - Não é minha vez! (itsMe:', itsMe, ')')
        if (!pushModal) console.warn('  - pushModal não está disponível!')
        if (!awaitTop) console.warn('  - awaitTop não está disponível!')
      }
      console.groupEnd()
    }
    if (isDirectBuyTile && itsMe && pushModal && awaitTop) {
      ;(async () => {
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        
        // ✅ CORREÇÃO CRÍTICA: Define pendingTurnDataRef DEPOIS de abrir a modal
        // Isso garante que o tick não mude o turno antes da modal ser fechada
        if (!pendingTurnDataRef.current) {
          pendingTurnDataRef.current = {
            nextPlayers: capturedNextPlayers,
            nextTurnIdx: capturedNextTurnIdx,
            nextRound: capturedNextRound
          }
          console.log('[DEBUG] ✅ pendingTurnDataRef definido (após abrir modal Compra Direta)')
        }
        const cashNow = capturedNextPlayers[curIdx]?.cash ?? myCash
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: DirectBuyModal } = await import('../modals/DirectBuyModal.jsx')
        const res = await openModalAndWait(<DirectBuyModal currentCash={cashNow} />)
        if (!res) return finishTurnNoBuy()

        if (res.action === 'OPEN') {
          const open = String(res.open || '').toUpperCase()

          if (open === 'MIX') {
            const currentMixLevel = players[curIdx]?.mixProdutos || null
            // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
            const { default: MixProductsModal } = await import('../modals/MixProductsModal.jsx')
            const r2 = await openModalAndWait(<MixProductsModal 
              currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash}
              currentLevel={currentMixLevel}
            />)
            if (!r2 || r2.action !== 'BUY') return finishTurnNoBuy()
            
            const price = Number(r2.compra || 0)
            const level = String(r2.level || 'D')
            if (!requireFunds(curIdx, price, 'comprar MIX')) return finishTurnNoBuy()
            
            const updatedPlayers = players.map((p,i)=>
              i!==curIdx ? p : applyDeltas(p, {
                cashDelta: -price,
                mixProdutosSet: level,
                mixBaseSet: {
                  despesaPorCliente: Number(r2.despesa || 0),
                  faturamentoPorCliente: Number(r2.faturamento || 0),
                }
              })
            )
            setPlayers(updatedPlayers)
            endTurnWith(updatedPlayers)
            setTurnLockBroadcast(false)
            return
          }

          if (open === 'MANAGER') {
            // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
            const { default: ManagerModal } = await import('../modals/BuyManagerModal.jsx')
            const r2 = await openModalAndWait(<ManagerModal currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash} />)
            if (!r2 || (r2.action !== 'BUY' && r2.action !== 'HIRE')) return finishTurnNoBuy()
            
            const qty  = Number(r2.headcount ?? r2.qty ?? r2.managersQty ?? 1)
            const cashDelta = Number(
              (typeof r2.cashDelta !== 'undefined'
                ? r2.cashDelta
                : -(Number(r2.cost ?? r2.total ?? r2.totalHire ?? 0)))
            )
            const payAbs = cashDelta < 0 ? -cashDelta : 0
            if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Gestor')) return finishTurnNoBuy()
            
            const mexp = Number(r2.expenseDelta ?? r2.totalExpense ?? r2.maintenanceDelta ?? 0)
            const updatedPlayers = players.map((p,i)=> i!==curIdx ? p : applyDeltas(p, {
              cashDelta,
              gestoresDelta: qty,
              manutencaoDelta: mexp
            }))
            setPlayers(updatedPlayers)
            endTurnWith(updatedPlayers)
            setTurnLockBroadcast(false)
            return
          }

          if (open === 'INSIDE') {
            // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
            const { default: InsideSalesModal } = await import('../modals/InsideSalesModal.jsx')
            const r2 = await openModalAndWait(<InsideSalesModal currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash} />)
            if (!r2 || (r2.action !== 'BUY' && r2.action !== 'HIRE')) return finishTurnNoBuy()
            
            const cost = Number(r2.cost ?? r2.total ?? 0)
            if (!requireFunds(curIdx, cost, 'contratar Inside Sales')) return finishTurnNoBuy()
            
            const qty  = Number(r2.headcount ?? r2.qty ?? 1)
            const updatedPlayers = players.map((p,i)=> i!==curIdx ? p : applyDeltas(p, { cashDelta: -cost, insideSalesDelta: qty }))
            setPlayers(updatedPlayers)
            endTurnWith(updatedPlayers)
            setTurnLockBroadcast(false)
            return
          }

          if (open === 'FIELD') {
            // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
            const { default: FieldSalesModal } = await import('../modals/BuyFieldSalesModal.jsx')
            const r2 = await openModalAndWait(<FieldSalesModal currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash} />)
            if (!r2 || (r2.action !== 'HIRE' && r2.action !== 'BUY')) return finishTurnNoBuy()
            
            const qty = Number(r2.headcount ?? r2.qty ?? 1)
            const deltas = {
              cashDelta: Number(r2.cashDelta ?? -(Number(r2.totalHire ?? r2.total ?? r2.cost ?? 0))),
              manutencaoDelta: Number(r2.expenseDelta ?? r2.totalExpense ?? 0),
              revenueDelta: Number(r2.revenueDelta ?? 0),
              fieldSalesDelta: qty,
            }
            const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
            if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Field Sales')) return finishTurnNoBuy()
            
            const updatedPlayers = players.map((p,i)=> i!==curIdx ? p : applyDeltas(p, deltas))
            setPlayers(updatedPlayers)
            endTurnWith(updatedPlayers)
            setTurnLockBroadcast(false)
            return
          }

          if (open === 'COMMON') {
            // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
            const { default: BuyCommonSellersModal } = await import('../modals/BuyCommonSellersModal.jsx')
            const r2 = await openModalAndWait(<BuyCommonSellersModal currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash} />)
            if (!r2 || r2.action !== 'BUY') return finishTurnNoBuy()
            
            const qty  = Number(r2.headcount ?? r2.qty ?? 0)
            const deltas = {
              cashDelta: Number(r2.cashDelta ?? -(Number(r2.totalHire ?? r2.total ?? r2.cost ?? 0))),
              vendedoresComunsDelta: qty,
              manutencaoDelta: Number(r2.expenseDelta ?? r2.totalExpense ?? 0),
              revenueDelta: Number(r2.revenueDelta ?? 0),
            }
            const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
            if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Vendedores Comuns')) return finishTurnNoBuy()
            
            const updatedPlayers = players.map((p,i)=> i!==curIdx ? p : applyDeltas(p, deltas))
            setPlayers(updatedPlayers)
            endTurnWith(updatedPlayers)
            setTurnLockBroadcast(false)
            return
          }

          if (open === 'ERP') {
            const currentErpLevel = players[curIdx]?.erpLevel || null
            // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
            const { default: ERPSystemsModal } = await import('../modals/ERPSystemsModal.jsx')
            const r2 = await openModalAndWait(<ERPSystemsModal 
              currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash}
              currentLevel={currentErpLevel}
            />)
            if (!r2 || r2.action !== 'BUY') return finishTurnNoBuy()
            
            const price = Number(r2.values?.compra || 0)
            if (!requireFunds(curIdx, price, 'comprar ERP')) return finishTurnNoBuy()
            
            const updatedPlayers = players.map((p,i)=> i!==curIdx ? p : applyDeltas(p, { cashDelta: -price, erpLevelSet: r2.level }))
            setPlayers(updatedPlayers)
            endTurnWith(updatedPlayers)
            setTurnLockBroadcast(false)
            return
          }

          if (open === 'CLIENTS') {
            // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
            const { default: ClientsModal } = await import('../modals/BuyClientsModal.jsx')
            const r2 = await openModalAndWait(<ClientsModal currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash} />)
            if (!r2 || r2.action !== 'BUY') return finishTurnNoBuy()
            
            const cost  = Number(r2.totalCost || 0)
            if (!requireFunds(curIdx, cost, 'comprar Clientes')) return finishTurnNoBuy()
            
            const qty   = Number(r2.qty || 0)
            const mAdd  = Number(r2.maintenanceDelta || 0)
            const bensD = Number(r2.bensDelta || cost)
            const updatedPlayers = players.map((p,i)=> i!==curIdx ? p : applyDeltas(p, {
              cashDelta: -cost,
              clientsDelta: qty,
              manutencaoDelta: mAdd,
              bensDelta: bensD
            }))
            setPlayers(updatedPlayers)
            endTurnWith(updatedPlayers)
            setTurnLockBroadcast(false)
            return
          }

          if (open === 'TRAINING') {
            const ownerForTraining = players.find(isMine) || capturedNextPlayers[curIdx]
            // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
            const { default: TrainingModal } = await import('../modals/TrainingModal.jsx')
            const r2 = await openModalAndWait(<TrainingModal
              canTrain={{
                comum:  Number(ownerForTraining?.vendedoresComuns) || 0,
                field:  Number(ownerForTraining?.fieldSales) || 0,
                inside: Number(ownerForTraining?.insideSales) || 0,
                gestor: Number(ownerForTraining?.gestores ?? ownerForTraining?.gestoresComerciais ?? ownerForTraining?.managers) || 0
              }}
              ownedByType={{
                comum: ownerForTraining?.trainingsByVendor?.comum || [],
                field: ownerForTraining?.trainingsByVendor?.field || [],
                inside: ownerForTraining?.trainingsByVendor?.inside || [],
                gestor: ownerForTraining?.trainingsByVendor?.gestor || []
              }}
            />)
            if (!r2 || r2.action !== 'BUY') return finishTurnNoBuy()
            
            const trainCost = Number(r2.grandTotal || 0)
            if (!requireFunds(curIdx, trainCost, 'comprar Treinamento')) return finishTurnNoBuy()
            
            const updatedPlayers = players.map((p,i)=> i!==curIdx ? p : applyTrainingPurchase(p, r2))
            setPlayers(updatedPlayers)
            endTurnWith(updatedPlayers)
            setTurnLockBroadcast(false)
            return
          }
        }

        // Fallback: BUY direto
        if (res.action === 'BUY') {
          const isClientsBuy =
            res.kind === 'CLIENTS' ||
            res.modal === 'CLIENTS' ||
            typeof res.clientsQty !== 'undefined' ||
            typeof res.numClients !== 'undefined' ||
            typeof res.totalCost !== 'undefined' ||
            typeof res.maintenanceDelta !== 'undefined'

          if (isClientsBuy) {
            const cost  = Number(res.totalCost ?? res.total ?? res.amount ?? 0)
            if (!requireFunds(curIdx, cost, 'comprar Clientes')) return finishTurnNoBuy()
            
            const qty   = Number(res.clientsQty ?? res.numClients ?? res.qty ?? 0)
            const mAdd  = Number(res.maintenanceDelta ?? res.maintenance ?? res.mexp ?? 0)
            const bensD = Number(res.bensDelta ?? cost)

            const updatedPlayers = players.map((p, i) =>
              i !== curIdx
                ? p
                : applyDeltas(p, {
                    cashDelta: -cost,
                    clientsDelta: qty,
                    manutencaoDelta: mAdd,
                    bensDelta: bensD
                  })
            )
            setPlayers(updatedPlayers)
            endTurnWith(updatedPlayers)
            setTurnLockBroadcast(false)
            return
          }

          const total = Number(res.total ?? res.amount ?? 0)
          if (!requireFunds(curIdx, total, 'esta compra')) return finishTurnNoBuy()
          
          const updatedPlayers = players.map((p, i) =>
            i !== curIdx
              ? p
              : applyDeltas(p, {
                  cashDelta: -total,
                  directBuysPush: [ (res.item || { total }) ]
                })
          )
          setPlayers(updatedPlayers)
          endTurnWith(updatedPlayers)
          setTurnLockBroadcast(false)
          return
        }
        
        return finishTurnNoBuy()
      })()
    }

    // Inside Sales (casa específica)
    const isInsideTile = (landedOneBased === 12 || landedOneBased === 21 || landedOneBased === 30 || landedOneBased === 42 || landedOneBased === 53)
    if (isInsideTile && itsMe && pushModal && awaitTop) {
      ;(async () => {
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        
        // ✅ CORREÇÃO CRÍTICA: Define pendingTurnDataRef DEPOIS de abrir a modal
        // Isso garante que o tick não mude o turno antes da modal ser fechada
        if (!pendingTurnDataRef.current) {
          pendingTurnDataRef.current = {
            nextPlayers: capturedNextPlayers,
            nextTurnIdx: capturedNextTurnIdx,
            nextRound: capturedNextRound
          }
          console.log('[DEBUG] ✅ pendingTurnDataRef definido (após abrir modal Inside Sales)')
        }
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: InsideSalesModal } = await import('../modals/InsideSalesModal.jsx')
        const res = await openModalAndWait(<InsideSalesModal currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash} />)
        if (!res || (res.action !== 'HIRE' && res.action !== 'BUY')) return finishTurnNoBuy()
        
        const cost = Number(res.cost ?? res.total ?? 0)
        if (!requireFunds(curIdx, cost, 'contratar Inside Sales')) return finishTurnNoBuy()
        
        const qty  = Number(res.headcount ?? res.qty ?? 1)
        const updatedPlayers = players.map((p, i) =>
          i !== curIdx ? p : applyDeltas(p, { cashDelta: -cost, insideSalesDelta: qty })
        )
        setPlayers(updatedPlayers)
        endTurnWith(updatedPlayers)
        setTurnLockBroadcast(false)
      })()
    }

    // Clientes
    const isClientsTile = [4,8,15,17,20,27,34,36,39,46,52,55].includes(landedOneBased)
    if (isClientsTile) {
      console.group(`[🏠 TILE] ${cur.name} - Clientes Tile (posição ${landedOneBased})`)
      console.log('Condições para abrir modal:')
      console.log('  - isClientsTile:', isClientsTile, '✅')
      console.log('  - isMyTurn:', isMyTurn, isMyTurn ? '✅' : '❌')
      console.log('  - pushModal:', typeof pushModal, pushModal ? '✅' : '❌')
      console.log('  - awaitTop:', typeof awaitTop, awaitTop ? '✅' : '❌')
      
      if (isClientsTile && itsMe && pushModal && awaitTop) {
        console.log('✅ TODAS AS CONDIÇÕES ATENDIDAS - Abrindo modal Clientes')
      } else {
        console.warn('❌ BLOQUEADO - Alguma condição não foi atendida')
        if (!itsMe) console.warn('  - Não é minha vez! (itsMe:', itsMe, ')')
        if (!pushModal) console.warn('  - pushModal não está disponível!')
        if (!awaitTop) console.warn('  - awaitTop não está disponível!')
      }
      console.groupEnd()
    }
    if (isClientsTile && itsMe && pushModal && awaitTop) {
      ;(async () => {
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        
        // ✅ CORREÇÃO CRÍTICA: Define pendingTurnDataRef DEPOIS de abrir a modal
        // Isso garante que o tick não mude o turno antes da modal ser fechada
        if (!pendingTurnDataRef.current) {
          pendingTurnDataRef.current = {
            nextPlayers: capturedNextPlayers,
            nextTurnIdx: capturedNextTurnIdx,
            nextRound: capturedNextRound
          }
          console.log('[DEBUG] ✅ pendingTurnDataRef definido (após abrir modal Clientes)')
        }
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: ClientsModal } = await import('../modals/BuyClientsModal.jsx')
        const res = await openModalAndWait(<ClientsModal currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash} />)
        if (!res || res.action !== 'BUY') return finishTurnNoBuy()
        
        const cost  = Number(res.totalCost || 0)
        if (!requireFunds(curIdx, cost, 'comprar Clientes')) return finishTurnNoBuy()
        
        const qty   = Number(res.qty || 0)
        const mAdd  = Number(res.maintenanceDelta || 0)
        const bensD = Number(res.bensDelta || cost)
        const updatedPlayers = players.map((p, i) =>
          i !== curIdx
            ? p
            : applyDeltas(p, {
                cashDelta: -cost,
                clientsDelta: qty,
                manutencaoDelta: mAdd,
                bensDelta: bensD
              })
        )
        setPlayers(updatedPlayers)
        endTurnWith(updatedPlayers)
        setTurnLockBroadcast(false)
      })()
    }

    // Gestor
    const isManagerTile = [18,24,29,51].includes(landedOneBased)
    if (isManagerTile && itsMe && pushModal && awaitTop) {
      ;(async () => {
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: ManagerModal } = await import('../modals/BuyManagerModal.jsx')
        const res = await openModalAndWait(<ManagerModal currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash} />)
        if (!res || (res.action !== 'BUY' && res.action !== 'HIRE')) return finishTurnNoBuy()
        
        const qty  = Number(res.headcount ?? res.qty ?? res.managersQty ?? 1)
        const cashDelta = Number(
          (typeof res.cashDelta !== 'undefined'
            ? res.cashDelta
            : -(Number(res.cost ?? res.total ?? res.totalHire ?? 0)))
        )
        const payAbs = cashDelta < 0 ? -cashDelta : 0
        if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Gestor')) return finishTurnNoBuy()
        
        const mexp = Number(res.expenseDelta ?? res.totalExpense ?? res.maintenanceDelta ?? 0)
        const updatedPlayers = players.map((p, i) =>
          i !== curIdx ? p : applyDeltas(p, { cashDelta, gestoresDelta: qty, manutencaoDelta: mexp })
        )
        setPlayers(updatedPlayers)
        endTurnWith(updatedPlayers)
        setTurnLockBroadcast(false)
      })()
    }

    // Field Sales
    const isFieldTile = [13,25,33,38,50].includes(landedOneBased)
    if (isFieldTile && itsMe && pushModal && awaitTop) {
      ;(async () => {
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: FieldSalesModal } = await import('../modals/BuyFieldSalesModal.jsx')
        const res = await openModalAndWait(<FieldSalesModal currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash} />)
        if (!res || (res.action !== 'HIRE' && res.action !== 'BUY')) return finishTurnNoBuy()
        
        const qty = Number(res.headcount ?? res.qty ?? 1)
        const deltas = {
          cashDelta: Number(res.cashDelta ?? -(Number(res.totalHire ?? res.total ?? res.cost ?? 0))),
          manutencaoDelta: Number(res.expenseDelta ?? res.totalExpense ?? 0),
          revenueDelta: Number(res.revenueDelta ?? 0),
          fieldSalesDelta: qty,
        }
        const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
        if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Field Sales')) return finishTurnNoBuy()
        
        const updatedPlayers = players.map((p, i) =>
          i !== curIdx ? p : applyDeltas(p, deltas)
        )
        setPlayers(updatedPlayers)
        endTurnWith(updatedPlayers)
        setTurnLockBroadcast(false)
      })()
    }

    // Vendedores Comuns
    const isCommonSellersTile = [9,28,40,45].includes(landedOneBased)
    if (isCommonSellersTile && isMyTurn && pushModal && awaitTop) {
      ;(async () => {
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: BuyCommonSellersModal } = await import('../modals/BuyCommonSellersModal.jsx')
        const res = await openModalAndWait(<BuyCommonSellersModal currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash} />)
        if (!res || res.action !== 'BUY') return finishTurnNoBuy()
        
        const qty  = Number(res.headcount ?? res.qty ?? 0)
        const deltas = {
          cashDelta: Number(res.cashDelta ?? -(Number(res.totalHire ?? res.total ?? res.cost ?? 0))),
          vendedoresComunsDelta: qty,
          manutencaoDelta: Number(res.expenseDelta ?? res.totalExpense ?? 0),
          revenueDelta: Number(res.revenueDelta ?? 0),
        }
        const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
        if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Vendedores Comuns')) return finishTurnNoBuy()
        
        const updatedPlayers = players.map((p, i) =>
          i !== curIdx ? p : applyDeltas(p, deltas)
        )
        setPlayers(updatedPlayers)
        endTurnWith(updatedPlayers)
        setTurnLockBroadcast(false)
      })()
    }

    // Mix de Produtos
    const isMixTile = [7,31,44].includes(landedOneBased)
    if (isMixTile && itsMe && pushModal && awaitTop) {
      ;(async () => {
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        
        const currentMixLevel = players[curIdx]?.mixProdutos || null
        console.log('[DEBUG] MIX Modal - currentMixLevel:', currentMixLevel, 'player:', players[curIdx]?.name, 'mixProdutos:', players[curIdx]?.mixProdutos)
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: MixProductsModal } = await import('../modals/MixProductsModal.jsx')
        const res = await openModalAndWait(<MixProductsModal 
          currentCash={capturedNextPlayers[curIdx]?.cash ?? myCash}
          currentLevel={currentMixLevel}
        />)
        if (!res || res.action !== 'BUY') return finishTurnNoBuy()
        
        const price = Number(res.compra || 0)
        if (!requireFunds(curIdx, price, 'comprar MIX')) return finishTurnNoBuy()
        
        const level = String(res.level || 'D')
        const updatedPlayers = players.map((p, i) =>
          i !== curIdx
            ? p
            : applyDeltas(p, {
                cashDelta: -price,
                mixProdutosSet: level,
                mixBaseSet: {
                  despesaPorCliente: Number(res.despesa || 0),
                  faturamentoPorCliente: Number(res.faturamento || 0),
                },
              })
        )
        setPlayers(updatedPlayers)
        endTurnWith(updatedPlayers)
        setTurnLockBroadcast(false)
      })()
    }

    // Sorte & Revés
    const isLuckMisfortuneTile = [3,14,22,26,35,41,48,54].includes(landedOneBased)
    if (isLuckMisfortuneTile) {
      console.group(`[🏠 TILE] ${cur.name} - Sorte & Revés Tile (posição ${landedOneBased})`)
      console.log('Condições para abrir modal:')
      console.log('  - isLuckMisfortuneTile:', isLuckMisfortuneTile, '✅')
      console.log('  - isMyTurn:', isMyTurn, isMyTurn ? '✅' : '❌')
      console.log('  - pushModal:', typeof pushModal, pushModal ? '✅' : '❌')
      console.log('  - awaitTop:', typeof awaitTop, awaitTop ? '✅' : '❌')
      console.log('  - turnIdx:', turnIdx, 'myUid:', myUid, 'owner.id:', players[turnIdx]?.id)
      
      if (isLuckMisfortuneTile && itsMe && pushModal && awaitTop) {
        console.log('✅ TODAS AS CONDIÇÕES ATENDIDAS - Abrindo modal Sorte & Revés')
      } else {
        console.warn('❌ BLOQUEADO - Alguma condição não foi atendida')
        if (!isLuckMisfortuneTile) console.warn('  - Não é um tile de Sorte & Revés!')
        if (!itsMe) console.warn('  - Não é minha vez! (itsMe:', itsMe, ')')
        if (!pushModal) console.warn('  - pushModal não está disponível!')
        if (!awaitTop) console.warn('  - awaitTop não está disponível!')
      }
      console.groupEnd()
    }
    if (isLuckMisfortuneTile && itsMe && pushModal && awaitTop) {
      ;(async () => {
        console.log(`[🎲 MODAL] ${cur.name} - Tentando abrir modal Sorte & Revés`)
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        
        // ✅ CORREÇÃO CRÍTICA: Define pendingTurnDataRef DEPOIS de abrir a modal
        // Isso garante que o tick não mude o turno antes da modal ser fechada
        if (!pendingTurnDataRef.current) {
          pendingTurnDataRef.current = {
            nextPlayers: capturedNextPlayers,
            nextTurnIdx: capturedNextTurnIdx,
            nextRound: capturedNextRound
          }
          console.log('[DEBUG] ✅ pendingTurnDataRef definido (após abrir modal Sorte & Revés)')
        }
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: SorteRevesModal } = await import('../modals/SorteRevesModal.jsx')
        const res = await openModalAndWait(<SorteRevesModal />)
        if (!res || res.action !== 'APPLY_CARD') return finishTurnNoBuy()

        let cashDelta    = Number.isFinite(res.cashDelta)    ? Number(res.cashDelta)    : 0
        let clientsDelta = Number.isFinite(res.clientsDelta) ? Number(res.clientsDelta) : 0

        // O modal já calculou os efeitos baseados no estado do jogador
        // Não precisamos verificar novamente aqui

        if (cashDelta < 0) {
          const need = -cashDelta
          await handleInsufficientFunds(need, 'Sorte & Revés', 'pagar', capturedNextPlayers)
        }

        let updatedPlayers = players
        setPlayers(ps => {
          const upd = ps.map((p,i) => {
            if (i !== curIdx) return p
            let next = { ...p }
            if (cashDelta)    next.cash    = Math.max(0, (next.cash    ?? 0) + cashDelta)
            if (clientsDelta) {
              const oldClients = next.clients || 0
              next.clients = Math.max(0, oldClients + clientsDelta)
              console.log('[DEBUG] SorteReves - Clientes alterados:', oldClients, '->', next.clients, 'delta:', clientsDelta)
            }
            if (res.gainSpecialCell) {
              next.fieldSales = (next.fieldSales || 0) + (res.gainSpecialCell.fieldSales || 0)
              next.support    = (next.support    || 0) + (res.gainSpecialCell.support    || 0)
              next.gestores   = (next.gestores   || 0) + (res.gainSpecialCell.manager    || 0)
              next.gestoresComerciais = (next.gestoresComerciais || 0) + (res.gainSpecialCell.manager || 0)
              next.managers   = (next.managers   || 0) + (res.gainSpecialCell.manager    || 0)
            }
            if (res.id === 'casa_change_cert_blue') {
              next.az = (next.az || 0) + 1
              const curSet = new Set((next.trainingsByVendor?.comum || []))
              curSet.add('personalizado')
              next.trainingsByVendor = { ...(next.trainingsByVendor || {}), comum: Array.from(curSet) }
            }
            return next
          })

          const anyDerived = res.perClientBonus || res.perCertifiedManagerBonus || res.mixLevelBonusABOnly
          if (anyDerived) {
            const me2 = upd[curIdx] || {}
            let extra = 0
            if (res.perClientBonus)           extra += (Number(me2.clients) || 0) * Number(res.perClientBonus || 0)
            if (res.perCertifiedManagerBonus) extra += countManagerCerts(me2) * Number(res.perCertifiedManagerBonus || 0)
            if (res.mixLevelBonusABOnly) {
              const level = String(me2.mixProdutos || me2.mixProdutosSet || '').toUpperCase()
              if (level === 'A' || level === 'B') extra += Number(res.mixLevelBonusABOnly || 0)
            }
            if (extra) {
              upd[curIdx] = {
                ...me2,
                cash: (Number(me2.cash) || 0) + extra
              }
            }
          }

          updatedPlayers = upd
          return upd
        })

        endTurnWith(updatedPlayers)
        setTurnLockBroadcast(false)
      })()
    }

    // === AUTO-MODAIS (Faturamento / Despesas) ===
    if (crossedStart1 && itsMe && pushModal && awaitTop) {
      ;(async () => {
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        const capturedMeNow = capturedNextPlayers[curIdx] || {}
        
        // ✅ CORREÇÃO CRÍTICA: Calcula fat dentro da função assíncrona para evitar problemas de TDZ
        const fat = Math.max(0, Math.floor(computeFaturamentoFor(capturedMeNow)))
        
        // ✅ CORREÇÃO CRÍTICA: Define pendingTurnDataRef DEPOIS de abrir a modal
        // Isso garante que o tick não mude o turno antes da modal ser fechada
        if (!pendingTurnDataRef.current) {
          pendingTurnDataRef.current = {
            nextPlayers: capturedNextPlayers,
            nextTurnIdx: capturedNextTurnIdx,
            nextRound: capturedNextRound
          }
          console.log('[DEBUG] ✅ pendingTurnDataRef definido (após abrir modal Faturamento)')
        }
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: FaturamentoDoMesModal } = await import('../modals/FaturamentoMesModal.jsx')
        await openModalAndWait(<FaturamentoDoMesModal value={fat} />)
        setPlayers(ps => {
          const upd = ps.map((p,i)=> i!==curIdx ? p : { ...p, cash: (p.cash||0) + fat })
          broadcastState(upd, capturedNextTurnIdx, capturedNextRound); return upd
        })
        appendLog(`${capturedMeNow.name} recebeu faturamento do mês: +$${fat.toLocaleString()}`)
        try { setTimeout(() => closeTop?.({ action:'AUTO_CLOSE_BELOW' }), 0) } catch {}
      })()
    }

    if (crossedExpenses23 && itsMe && pushModal && awaitTop) {
      ;(async () => {
        // ✅ CORREÇÃO CRÍTICA: Captura as variáveis do escopo antes de usá-las
        const capturedNextPlayers = nextPlayers
        const capturedNextTurnIdx = nextTurnIdx
        const capturedNextRound = finalNextRound
        const capturedRound = round  // ✅ CORREÇÃO: Captura round para evitar TDZ
        const capturedMeNow = capturedNextPlayers[curIdx] || {}
        
        // ✅ CORREÇÃO CRÍTICA: Calcula todas as variáveis dentro da função assíncrona para evitar problemas de TDZ
        const expense = Math.max(0, Math.floor(computeDespesasFor(capturedMeNow)))
        const lp = capturedMeNow.loanPending || {}
        const shouldChargeLoan = Number(lp.amount) > 0 && !lp.charged && (capturedRound >= Math.max(1, Number(lp.dueRound || 0)))
        const loanCharge = shouldChargeLoan ? Math.max(0, Math.floor(Number(lp.amount))) : 0
        
        console.log('[DEBUG] 💰 DESPESAS OPERACIONAIS - Jogador:', capturedMeNow.name, 'Posição atual:', capturedMeNow.pos)
        console.log('[DEBUG] 💰 DESPESAS - Valor:', expense, 'Empréstimo a cobrar:', loanCharge, 'Total:', expense + loanCharge)
        console.log('[DEBUG] 💰 EMPRÉSTIMO - Detalhes:', {
          amount: Number(lp.amount),
          charged: lp.charged,
          dueRound: Number(lp.dueRound || 0),
          currentRound: capturedRound,
          shouldCharge: shouldChargeLoan
        })
        
        // ✅ CORREÇÃO CRÍTICA: Define pendingTurnDataRef DEPOIS de abrir a modal
        // Isso garante que o tick não mude o turno antes da modal ser fechada
        if (!pendingTurnDataRef.current) {
          pendingTurnDataRef.current = {
            nextPlayers: capturedNextPlayers,
            nextTurnIdx: capturedNextTurnIdx,
            nextRound: capturedNextRound
          }
          console.log('[DEBUG] ✅ pendingTurnDataRef definido (após abrir modal Despesas Operacionais)')
        }
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: DespesasOperacionaisModal } = await import('../modals/DespesasOperacionaisModal.jsx')
        await openModalAndWait(<DespesasOperacionaisModal expense={expense} loanCharge={loanCharge} />)
        const totalCharge = expense + loanCharge
        
        console.log('[DEBUG] 💰 ANTES handleInsufficientFunds - Saldo atual:', capturedNextPlayers[curIdx]?.cash, 'Total a pagar:', totalCharge)
        const canPayExpenses = await handleInsufficientFunds(totalCharge, 'Despesas Operacionais', 'pagar', capturedNextPlayers)
        console.log('[DEBUG] 💰 APÓS handleInsufficientFunds - canPayExpenses:', canPayExpenses)
        if (!canPayExpenses) {
          setTurnLockBroadcast(false)
          return
        }
        
        // O handleInsufficientFunds já processou o pagamento, não precisa duplicar
        // Apenas marca o empréstimo como cobrado se necessário
        if (shouldChargeLoan) {
          setPlayers(ps => {
            const upd = ps.map((p,i)=>{
              if (i!==curIdx) return p
              const next = { ...p }
              next.loanPending = { ...(p.loanPending||{}), charged:true, chargedAtRound: capturedNextRound }
              return next
            })
            broadcastState(upd, capturedNextTurnIdx, capturedNextRound); return upd
          })
        }
        appendLog(`${capturedMeNow.name} pagou despesas operacionais: -$${expense.toLocaleString()}`)
        if (loanCharge > 0) appendLog(`${capturedMeNow.name} teve empréstimo cobrado: -$${loanCharge.toLocaleString()}`)
        // Log do saldo final após o processamento
        setPlayers(ps => {
          console.log('[DEBUG] 💰 DESPESAS FINALIZADAS - Jogador:', ps[curIdx]?.name, 'Posição final:', ps[curIdx]?.pos, 'Saldo final:', ps[curIdx]?.cash)
          return ps
        })
        try { setTimeout(() => closeTop?.({ action:'AUTO_CLOSE_BELOW' }), 0) } catch {}
      })()
    }

    // fail-safe: solta o cadeado quando todas as modais fecharem
    const start = Date.now()
    const tick = () => {
      if (phase !== 'game') {
        // console.log('[DEBUG] tick - Não executando fora da fase de jogo.');
        return;
      }
      const currentModalLocks = modalLocksRef.current
      const currentLockOwner = lockOwnerRef.current
      const isLockOwner = String(currentLockOwner || '') === String(myUid)
      // ✅ CORREÇÃO CRÍTICA: Verifica também o stackLength do ModalContext
      // Isso garante que o tick não mude o turno se houver modais abertas
      const currentStackLength = modalContextRef.current?.stackLength || stackLength || 0
      
      console.log('[DEBUG] tick - modalLocks:', currentModalLocks, 'stackLength:', currentStackLength, 'lockOwner:', currentLockOwner, 'myUid:', myUid, 'isLockOwner:', isLockOwner)
      console.log('[DEBUG] tick - pendingTurnDataRef:', pendingTurnDataRef.current ? `nextTurnIdx=${pendingTurnDataRef.current.nextTurnIdx}, nextRound=${pendingTurnDataRef.current.nextRound}` : 'null')
      
      // ✅ CORREÇÃO CRÍTICA: Só muda o turno se não houver modais abertas (nem modalLocks nem stackLength)
      if (currentModalLocks === 0 && currentStackLength === 0) {
        // libera apenas se EU for o dono do cadeado
        if (isLockOwner) {
          console.log('[DEBUG] tick - ✅ Sou o lockOwner, verificando se posso mudar turno')
          // ✅ CORREÇÃO: Previne mudança de turno imediata após início do jogo
          // Se o jogo acabou de começar e o turnIdx é 0, não muda o turno mesmo que haja pendingTurnData
          if (gameJustStarted && turnIdx === 0) {
            console.log('[DEBUG] ⚠️ tick - Jogo acabou de começar (turnIdx=0) - ignorando pendingTurnData para prevenir mudança de turno imediata')
            // Limpa pendingTurnData para evitar que seja usado depois
            pendingTurnDataRef.current = null
            setTurnLockBroadcast(false)
            setLockOwner(null)
            return
          }
          
          // ✅ CORREÇÃO CRÍTICA: Verifica novamente o stackLength ANTES de mudar o turno
          // Isso previne que o turno mude se houver modais abertas
          // Usa o modalContextRef diretamente para garantir que estamos verificando o estado mais atual
          const finalStackLength = modalContextRef.current?.stackLength ?? stackLength ?? 0
          const finalModalLocks = modalLocksRef.current ?? modalLocks ?? 0
          
          console.log('[DEBUG] tick - ⚠️ Verificação final antes de mudar turno - stackLength:', finalStackLength, 'modalLocks:', finalModalLocks)
          
          if (finalStackLength > 0 || finalModalLocks > 0) {
            console.log('[DEBUG] tick - ⚠️ Há modais abertas (stackLength:', finalStackLength, 'modalLocks:', finalModalLocks, ') - não mudando turno ainda')
            return
          }
          
          // Agora muda o turno quando todas as modais são fechadas
          const turnData = pendingTurnDataRef.current
          console.log('[DEBUG] tick - turnData:', turnData ? `nextTurnIdx=${turnData.nextTurnIdx}, nextRound=${turnData.nextRound}` : 'null')
          if (turnData) {
            const currentPlayerName = players[turnIdx]?.name || 'Jogador'
            const nextPlayerName = turnData.nextPlayers[turnData.nextTurnIdx]?.name || 'Jogador'
            console.log(`[🎲 TURNO] ✅ MUDANDO TURNO - ${currentPlayerName} terminou → ${nextPlayerName} pode jogar`)
            console.log('[DEBUG] ✅ Mudando turno - de:', turnIdx, 'para:', turnData.nextTurnIdx)
            console.log('[DEBUG] ✅ Jogadores antes:', players.map(p => p.name), 'depois:', turnData.nextPlayers.map(p => p.name))
            
            // ✅ CORREÇÃO CRÍTICA: Limpa pendingTurnData ANTES de atualizar o estado para evitar condições de corrida
            console.log('🧹 LIMPANDO pendingTurnDataRef')
            pendingTurnDataRef.current = null
            
            // ✅ CORREÇÃO: Atualiza o estado local PRIMEIRO antes de fazer broadcast
            // Isso garante que o turnIdx seja atualizado antes da sincronização
            console.log('📝 ATUALIZANDO ESTADO LOCAL:')
            console.log('  - setTurnIdx(', turnData.nextTurnIdx, ') - ANTES:', turnIdx)
            console.log('  - setPlayers(', turnData.nextPlayers.length, 'jogadores)')
            console.log('  - setRound(', turnData.nextRound, ') - ANTES:', round)
            
            // ✅ CORREÇÃO CRÍTICA: Atualiza o estado local ANTES do broadcast
            // O broadcastState já atualiza o estado local, mas é melhor fazer explicitamente aqui também
            setTurnIdx(turnData.nextTurnIdx)
            setPlayers(turnData.nextPlayers)
            setRound(turnData.nextRound)
            
            // ✅ CORREÇÃO: Desativa o lock DEPOIS de atualizar o estado mas ANTES do broadcast
            // Isso garante que o próximo jogador pode receber o estado correto
            console.log('🔓 DESATIVANDO LOCK:')
            console.log('  - setTurnLockBroadcast(false)')
            console.log('  - setLockOwner(null)')
            setTurnLockBroadcast(false)
            // ✅ CORREÇÃO: Limpa o lockOwner para permitir que o próximo jogador defina seu próprio lockOwner
            setLockOwner(null)
            
            // ✅ CORREÇÃO: Faz broadcast DEPOIS de atualizar o estado local
            // Isso garante que a sincronização receba o estado correto
            console.log('📡 BROADCAST - Enviando mudança de turno:')
            console.log('  - turnIdx:', turnData.nextTurnIdx)
            console.log('  - round:', turnData.nextRound)
            console.log('  - players:', turnData.nextPlayers.length)
            broadcastState(turnData.nextPlayers, turnData.nextTurnIdx, turnData.nextRound)
            
            console.log('✅ TURNO MUDADO COM SUCESSO')
            console.groupEnd()
          } else {
            console.log('[DEBUG] ⚠️ tick - turnData é null, não mudando turno')
            console.log('[DEBUG] ⚠️ tick - Verificando por que turnData é null...')
            console.log('[DEBUG] ⚠️ tick - pendingTurnDataRef.current:', pendingTurnDataRef.current)
            console.log('[DEBUG] ⚠️ tick - Foi limpo prematuramente? Verificando...')
            // Se não há turnData mas há lock ativo, desativa o lock de qualquer forma
            // Mas só se não houver modais abertas (para evitar desbloqueio prematuro)
            if (currentStackLength === 0 && currentModalLocks === 0) {
              console.log('[DEBUG] ⚠️ tick - Desativando lock pois não há modais e não há turnData')
              setTurnLockBroadcast(false)
              setLockOwner(null)
            } else {
              console.log('[DEBUG] ⚠️ tick - Mantendo lock pois ainda há modais abertas (stackLength:', currentStackLength, 'modalLocks:', currentModalLocks, ')')
            }
          }
        } else {
          console.log('[DEBUG] ❌ tick - não sou o dono do cadeado, não mudando turno')
          console.log('[DEBUG] ❌ tick - lockOwner:', currentLockOwner, 'myUid:', myUid, 'isLockOwner:', isLockOwner)
          console.log('[DEBUG] ❌ tick - Isso significa que outro jogador iniciou a ação')
          console.log('[DEBUG] ❌ tick - Verificando se o lockOwner deveria ser eu...')
          // ✅ CORREÇÃO: Se não sou o lockOwner mas deveria ser (é minha vez), força atualização
          if (isMyTurn && String(currentLockOwner || '') !== String(myUid)) {
            console.log('[DEBUG] ⚠️ tick - É minha vez mas não sou lockOwner - forçando atualização do lockOwner')
            setLockOwner(String(myUid))
          }
          // ✅ CORREÇÃO: Continua verificando mesmo se não for o lockOwner, para garantir que o tick continue
          // O tick deve continuar executando até que o lockOwner resolva ou timeout
        }
        // ✅ CORREÇÃO CRÍTICA: NÃO retorna aqui - continua executando para verificar novamente
        // O tick deve continuar verificando até que o turno seja mudado ou timeout
      } else {
        // ✅ CORREÇÃO: Se ainda há modais abertas, continua verificando
        console.log('[DEBUG] tick - Ainda há modais abertas, continuando a verificar...')
        console.log('[DEBUG] tick - modalLocks:', currentModalLocks, 'stackLength:', currentStackLength)
      }
      
      if (Date.now() - start > 20000) {
        // força desbloqueio em caso extremo
        console.log('[DEBUG] ⏰ TIMEOUT - forçando desbloqueio após 20s')
        if (isLockOwner) {
          setTurnLockBroadcast(false)
        }
        return
      }
      
      // Continua verificando a cada 80ms
      setTimeout(tick, 80)
    }
    tick()
  }, [
    phase, players, round, turnIdx, roundFlags, isMyTurn, isMine,
    myUid, myCash, gameOver,
    appendLog, broadcastState,
    setPlayers, setRound, setTurnIdx, setRoundFlags,
    setTurnLockBroadcast, requireFunds, maybeFinishGame,
    pushModal, awaitTop, closeTop
  ])

  // ========= handlers menores =========

  const onAction = useCallback((act) => {
    if (phase !== 'game') {
      console.warn('[onAction] Tentativa de ação fora da fase de jogo.');
      return;
    }
    if (!act?.type || gameOver) return

    const playerName = players[turnIdx]?.name || 'Jogador'
    console.log(`[🎲 AÇÃO] ${playerName} - Executando ação:`, act.type)

    if (act.type === 'ROLL'){
      // ✅ CORREÇÃO: Logs detalhados para diagnosticar problemas
      console.log(`[🎲 DADO] ${playerName} - Tentando rolar dado`)
      console.log(`[🎲 DADO] ${playerName} - isMyTurn:`, isMyTurn, 'turnIdx:', turnIdx, 'myUid:', myUid)
      console.log(`[🎲 DADO] ${playerName} - owner.id:`, players[turnIdx]?.id)
      console.log(`[🎲 DADO] ${playerName} - pushModal:`, typeof pushModal, 'awaitTop:', typeof awaitTop)
      console.log(`[🎲 DADO] ${playerName} - turnLock:`, turnLock, 'lockOwner:', lockOwner)
      
      if (!isMyTurn) {
        console.log(`[🎲 DADO] ❌ ${playerName} tentou rolar dado mas não é sua vez - isMyTurn:`, isMyTurn, 'turnIdx:', turnIdx, 'myUid:', myUid, 'owner.id:', players[turnIdx]?.id)
        return
      }
      if (!pushModal || !awaitTop) {
        console.error(`[🎲 DADO] ❌ ${playerName} - pushModal ou awaitTop não estão disponíveis!`)
        return
      }
      if (turnLock && String(lockOwner || '') !== String(myUid)) {
        console.error(`[🎲 DADO] ❌ ${playerName} - turnLock está ativo mas não sou o dono! lockOwner:`, lockOwner, 'myUid:', myUid)
        return
      }
      console.log(`[🎲 DADO] ${playerName} - Rolou ${act.steps} passos`)
      advanceAndMaybeLap(act.steps, act.cashDelta, act.note)
      return
    }

    if (act.type === 'RECOVERY'){
      const recover = Math.floor(Math.random()*3000)+1000
      const cur = players.find(isMine)
      if (!cur) return
      const nextPlayers = players.map(p => (isMine(p) ? { ...p, cash: p.cash + recover } : p))
      appendLog(`${cur.name} ativou Recuperação Financeira (+$${recover})`)
      setPlayers(nextPlayers)
      broadcastState(nextPlayers, turnIdx, round)
      setTurnLockBroadcast(false)
      return
    }

    if (act.type === 'RECOVERY_CUSTOM'){
      const amount = Number(act.amount || 0)
      const cur = players.find(isMine)
      if (!cur) return
      const nextPlayers = players.map(p => (isMine(p) ? { ...p, cash: p.cash + amount } : p))
      appendLog(`${cur.name} recuperou +$${amount}`)
      setPlayers(nextPlayers)
      broadcastState(nextPlayers, turnIdx, round)
      setTurnLockBroadcast(false)
      return
    }

    if (act.type === 'RECOVERY_MODAL') {
      if (!isMyTurn || !pushModal || !awaitTop) return
      ;(async () => {
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: RecoveryModal } = await import('../modals/RecoveryModal.jsx')
        const res = await openModalAndWait(<RecoveryModal playerName={current?.name || 'Jogador'} currentPlayer={current} />)
        if (!res) return finishTurnNoBuy()

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

            // Seleção "principal" (o App.jsx usa sel/selection quando presente)
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
      })()
      return
    }

    if (act.type === 'BANKRUPT_MODAL') {
      if (!isMyTurn || !pushModal || !awaitTop) return
      ;(async () => {
        // ✅ CORREÇÃO: Import dinâmico para quebrar ciclo de importação
        const { default: BankruptcyModal } = await import('../modals/BankruptcyModal.jsx')
        const ok = await openModalAndWait(<BankruptcyModal playerName={current?.name || 'Jogador'} />)
        if (!ok) return finishTurnNoBuy()
        onAction?.({ type: 'BANKRUPT' })
      })()
      return
    }

    if (act.type === 'RECOVERY_FIRE') {
      const amount = Number(act.amount || 0);
      const items  = act.items || {};

      const deltas = {
        cashDelta: amount,
        vendedoresComunsDelta: -Number(items.comum  || 0),
        fieldSalesDelta:      -Number(items.field  || 0),
        insideSalesDelta:     -Number(items.inside || 0),
        gestoresDelta:        -Number(items.gestor || 0),
      };

      const curIdx = turnIdx;
      setPlayers(ps => {
        const upd = ps.map((p, i) => (i !== curIdx ? p : applyDeltas(p, deltas)));
        broadcastState(upd, turnIdx, round);
        return upd;
      });

      appendLog(`${players[curIdx]?.name || 'Jogador'}: ${act.note || 'Demissões'}`);
      setTurnLockBroadcast(false);
      return;
    }

    if (act.type === 'RECOVERY_LOAN') {
      const amt = Math.max(0, Number(act.amount || 0));
      if (!amt) { setTurnLockBroadcast(false); return; }

      const curIdx = turnIdx;
      const cur = players[curIdx];

      if (cur?.loanPending && !cur.loanPending.charged) {
        appendLog(`${cur?.name || 'Jogador'} já possui um empréstimo pendente.`);
        setTurnLockBroadcast(false);
        return;
      }

      const dueRound = round + 1;
      setPlayers(ps => {
        const upd = ps.map((p, i) =>
          i !== curIdx
            ? p
            : {
                ...p,
                cash: (Number(p.cash) || 0) + amt,
                loanPending: { amount: amt, dueRound, charged: false },
              }
        );
        broadcastState(upd, turnIdx, round);
        return upd;
      });

      appendLog(`${cur?.name || 'Jogador'} pegou empréstimo: +$${amt.toLocaleString()}`);
      setTurnLockBroadcast(false);
      return;
    }

    if (act.type === 'BUY_MIX' || act.kind === 'MIX_BUY' || act.type === 'DIRECT_BUY_MIX') {
      const level = String(act.level || '').toUpperCase();
      const price = Math.max(0, Number(act.price ?? 0));
      if (!['A','B','C','D'].includes(level)) { setTurnLockBroadcast(false); return; }

      const curIdx = turnIdx;
      if (!canPay(curIdx, price)) { appendLog('Saldo insuficiente para comprar MIX'); setTurnLockBroadcast(false); return }

      setPlayers(ps => {
        const upd = ps.map((p, i) => {
          if (i !== curIdx) return p;
          const mixOwned = { ...(p.mixOwned || p.mix || {}), D: true };
          mixOwned[level] = true;
          return {
            ...p,
            cash: Math.max(0, (Number(p.cash) || 0) - price),
            mixOwned,
            mix: mixOwned,
            mixLevel: level,
            mixProdutos: level
          };
        });
        broadcastState(upd, turnIdx, round);
        return upd;
      });

      appendLog(`${players[curIdx]?.name || 'Jogador'} comprou MIX nível ${level} por -$${price.toLocaleString()}`);
      setTurnLockBroadcast(false);
      return;
    }

    if (act.type === 'BUY_ERP' || act.kind === 'ERP_BUY' || act.type === 'DIRECT_BUY_ERP') {
      const level = String(act.level || '').toUpperCase();
      const price = Math.max(0, Number(act.price ?? 0));
      if (!['A','B','C','D'].includes(level)) { setTurnLockBroadcast(false); return; }

      const curIdx = turnIdx;
      if (!canPay(curIdx, price)) { appendLog('Saldo insuficiente para comprar ERP'); setTurnLockBroadcast(false); return }

      setPlayers(ps => {
        const upd = ps.map((p, i) => {
          if (i !== curIdx) return p;
          const erpOwned = { ...(p.erpOwned || p.erp || {}), D: true };
          erpOwned[level] = true;
          return {
            ...p,
            cash: Math.max(0, (Number(p.cash) || 0) - price),
            erpOwned,
            erp: erpOwned,
            erpLevel: level,
            erpSystems: { ...(p.erpSystems || {}), level }
          };
        });
        broadcastState(upd, turnIdx, round);
        return upd;
      });

      appendLog(`${players[curIdx]?.name || 'Jogador'} comprou ERP nível ${level} por -$${price.toLocaleString()}`);
      setTurnLockBroadcast(false);
      return;
    }

    if (act.type === 'RECOVERY_REDUCE') {
      const normLevel = (v) => String(v || '').toUpperCase();
      const normGroup = (v) => {
        const g = String(v || '').toUpperCase();
        if (g === 'MIX' || g === 'ERP') return g;
        if (g.includes('MIX')) return 'MIX';
        if (g.includes('ERP')) return 'ERP';
        return '';
      };

      const collectSelections = () => {
        if (Array.isArray(act.items) && act.items.length) {
          return act.items
            .filter(it => (it?.selected ?? true))
            .map(it => ({
              group: normGroup(it.group || it.kind),
              level: normLevel(it.level),
              credit: Math.max(0, Number(it.credit ?? it.amount ?? 0)),
            }))
            .filter(s => (s.group === 'MIX' || s.group === 'ERP') && ['A','B','C','D'].includes(s.level));
        }
        const one = act.selection || act.target || null;
        if (one) {
          const s = {
            group: normGroup(one.group || one.kind),
            level: normLevel(one.level),
            credit: Math.max(0, Number(one.credit ?? one.amount ?? act.amount ?? 0)),
          };
          if ((s.group === 'MIX' || s.group === 'ERP') && ['A','B','C','D'].includes(s.level)) {
            return [s];
          }
        }
        return [];
      };

      const selections = collectSelections();

      if (!selections.length) {
        const creditOnly = Math.max(0, Number(act.amount ?? 0));
        if (creditOnly > 0) {
          const curIdx = turnIdx;
          setPlayers(ps => {
            const upd = ps.map((p, i) =>
              i !== curIdx ? p : { ...p, cash: (Number(p.cash) || 0) + creditOnly }
            );
            broadcastState(upd, turnIdx, round);
            return upd;
          });
        }
        setTurnLockBroadcast(false);
        return;
      }

      const ensureOwnedFromLetter = (store, letter) => {
        const s = { A:false, B:false, C:false, D:false, ...(store || {}) };
        const L = normLevel(letter);
        if (!s.A && !s.B && !s.C && !s.D) {
          if (['A','B','C','D'].includes(L)) s[L] = true;
          else s.D = true;
        }
        return s;
      };
      const letterFromOwned = (s) => (s?.A ? 'A' : s?.B ? 'B' : s?.C ? 'C' : s?.D ? 'D' : '-');

      const curIdx = turnIdx;
      const cur = players[curIdx];

      setPlayers(ps => {
        const upd = ps.map((p, i) => {
          if (i !== curIdx) return p;

          let mixOwned = { A:false, B:false, C:false, D:false, ...(p.mixOwned || p.mix || {}) };
          let erpOwned = { A:false, B:false, C:false, D:false, ...(p.erpOwned || p.erp || {}) };

          mixOwned = ensureOwnedFromLetter(mixOwned, p.mixProdutos);
          erpOwned = ensureOwnedFromLetter(erpOwned, p.erpSistemas);

          let totalCredit = 0;
          for (const s of selections) {
            totalCredit += Math.max(0, Number(s.credit || 0));
            if (s.group === 'MIX')  mixOwned[s.level] = false;
            else                     erpOwned[s.level] = false;
          }

          const mixLetter = letterFromOwned(mixOwned);
          const erpLetter = letterFromOwned(erpOwned);

          return {
            ...p,
            cash: (Number(p.cash) || 0) + totalCredit,
            mixOwned, erpOwned,
            mix: mixOwned, erp: erpOwned,
            mixProdutos: mixLetter,
            erpSistemas: erpLetter,
          };
        });

        broadcastState(upd, turnIdx, round);
        return upd;
      });

      const total = selections.reduce((acc, s) => acc + Math.max(0, Number(s.credit || 0)), 0);
      if (selections.length === 1) {
        const s = selections[0];
        appendLog(`${cur?.name || 'Jogador'} reduziu ${s.group} nível ${s.level} e recebeu +$${total.toLocaleString()}`);
      } else {
        appendLog(`${cur?.name || 'Jogador'} reduziu ${selections.length} níveis e recebeu +$${total.toLocaleString()}`);
      }

      setTurnLockBroadcast(false);
      return;
    }

    if (act.type === 'BANKRUPT'){
      const curIdx = turnIdx
      try {
        const amI = String(players[curIdx]?.id) === String(myUid)
        if (amI) setShowBankruptOverlay?.(true)
      } catch {}

      const updatedPlayers = players.map((p, i) => (i === curIdx ? { ...p, bankrupt: true } : p))
      appendLog(`${players[curIdx]?.name || 'Jogador'} declarou FALÊNCIA.`)

      const alive = countAlivePlayers(updatedPlayers)
      if (alive <= 1) {
        const winnerIdx = updatedPlayers.findIndex(p => !p?.bankrupt)
        setWinner(winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
        setPlayers(updatedPlayers)
        setGameOver(true)
        setTurnLockBroadcast(false)
        broadcastState(updatedPlayers, turnIdx, round, true, winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
        return
      }

      const nextIdx = findNextAliveIdx(updatedPlayers, curIdx)
      setPlayers(updatedPlayers)
      setTurnIdx(nextIdx)
      setTurnLockBroadcast(false)
      broadcastState(updatedPlayers, nextIdx, round)
      const finalPlayer = updatedPlayers[nextIdx]
      console.log('🏁 advanceAndMaybeLap FINALIZADA (FALÊNCIA)')
      console.log('  - Jogador:', finalPlayer?.name)
      console.log('  - Posição final:', finalPlayer?.pos)
      console.log('  - Saldo final:', finalPlayer?.cash)
      console.log('  - Próximo jogador:', updatedPlayers[nextIdx]?.name)
      console.groupEnd()
      return
    }
    const finalPlayer = nextPlayers[curIdx]
    console.log('🏁 advanceAndMaybeLap FINALIZADA NORMALMENTE')
    console.log('  - Jogador:', finalPlayer?.name)
    console.log('  - Posição final:', finalPlayer?.pos)
    console.log('  - Saldo final:', finalPlayer?.cash)
    console.log('  - modalLocks:', modalLocks)
    console.log('  - turnLock:', turnLock)
    console.log('  - lockOwner:', lockOwner)
    console.log('  - pendingTurnData:', pendingTurnDataRef.current ? 'existe' : 'null')
    console.log('  - Aguardando fechamento de modais para mudar turno...')
    console.groupEnd()
  }, [
    phase, players, round, turnIdx, isMyTurn, isMine, myUid, myCash,
    gameOver, appendLog, broadcastState,
    setPlayers, setRound, setTurnIdx, setTurnLockBroadcast, setGameOver, setWinner,
    requireFunds, pushModal, awaitTop, closeTop, setShowBankruptOverlay
  ])

  // ====== efeitos de destrava automática ======

  // ✅ REMOVIDO: Este useEffect foi movido para depois do useEffect que desativa o lock
  // para garantir a ordem correta de execução

  // a) quando não houver modal aberta e ainda houver lock, tenta destravar
  useEffect(() => {
    if (modalLocks === 0 && turnLock) {
      if (String(lockOwner || '') === String(myUid)) {
        setTurnLockBroadcast(false)
      }
    }
  }, [modalLocks, turnLock, lockOwner, myUid, setTurnLockBroadcast])

  // b) quando virar "minha vez" e não houver modal, garanto unlock local
  useEffect(() => {
    if (isMyTurn && modalLocks === 0 && turnLock) {
      // ✅ CORREÇÃO: Quando é minha vez, sempre desativa o lock (não precisa verificar lockOwner)
      // Isso garante que quando o turno muda via sincronização, o novo jogador pode jogar
      console.log('[DEBUG] É minha vez e há lock ativo - desativando lock para permitir jogo')
      setTurnLockBroadcast(false)
      // Atualiza o lockOwner para o jogador atual
      setLockOwner(String(myUid))
    }
  }, [isMyTurn, modalLocks, turnLock, myUid, setTurnLockBroadcast])
  
  // c) quando virar "minha vez", sempre atualiza lockOwner e desativa turnLock se necessário
  useEffect(() => {
    if (isMyTurn && !gameOver) {
      console.log('[DEBUG] É minha vez - garantindo que lockOwner seja atualizado para:', myUid, 'turnLock:', turnLock)
      setLockOwner(String(myUid))
      // ✅ CORREÇÃO: Se é minha vez e não há modais abertas, sempre desativa o turnLock
      // Isso garante que quando o turno muda via sincronização, o novo jogador pode jogar imediatamente
      if (turnLock && modalLocks === 0) {
        console.log('[DEBUG] É minha vez e há lock ativo - desativando lock imediatamente')
        setTurnLockBroadcast(false)
      }
    }
  }, [isMyTurn, myUid, gameOver, turnLock, modalLocks, setTurnLockBroadcast])

  // ✅ CORREÇÃO CRÍTICA: Desbloqueia automaticamente quando "é minha vez"
  // Isso garante que o cliente que recebe a vez não fique preso com turnLocked/hasModalOpen residual
  useEffect(() => {
    const owner = players[turnIdx]
    const itsMe = isOwnerMe(owner, myUid, myName)
    
    if (itsMe && phase === 'game') {
      console.log('[DEBUG] ✅ É minha vez - desbloqueando locks locais')
      console.log('[DEBUG] ✅ Desbloqueando - turnLock antes:', turnLock, 'modalLocks antes:', modalLocks, 'stackLength antes:', stackLength)
      
      // Libera o botão removendo locks locais
      if (turnLock) {
        console.log('[DEBUG] ✅ Desbloqueando turnLock (era:', turnLock, ')')
        setTurnLockBroadcast(false)
      }
      
      // Garante que não há modais abertas pendentes
      if (modalLocks > 0) {
        console.log('[DEBUG] ✅ Resetando modalLocks (era:', modalLocks, ')')
        setModalLocks(0)
      }
      
      // Garante que o lockOwner está correto
      if (String(lockOwner || '') !== String(myUid)) {
        console.log('[DEBUG] ✅ Atualizando lockOwner (era:', lockOwner, ', agora:', myUid, ')')
        setLockOwner(String(myUid))
      }
      
      console.log('[DEBUG] ✅ Desbloqueio concluído - turnLock agora:', turnLock, 'modalLocks agora:', modalLocks)
    }
  }, [turnIdx, players, myUid, myName, phase, turnLock, modalLocks, stackLength, lockOwner, setTurnLockBroadcast, setModalLocks, setLockOwner, isOwnerMe])

  return {
    advanceAndMaybeLap,
    onAction,
    nextTurn,
    modalLocks,
    lockOwner,
  }
}
