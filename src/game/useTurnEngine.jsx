// src/game/useTurnEngine.jsx
import React from 'react'

// Pista
import { TRACK_LEN } from '../data/track'

// ✅ CORREÇÃO: Constante para máximo de rodadas
const MAX_ROUNDS = 5

// Modal system
import { useModal } from '../modals/ModalContext'

// Modais de jogo
import ERPSystemsModal from '../modals/ERPSystemsModal'
import TrainingModal from '../modals/TrainingModal'
import DirectBuyModal from '../modals/DirectBuyModal'
import InsideSalesModal from '../modals/InsideSalesModal'
import ClientsModal from '../modals/BuyClientsModal'
import ManagerModal from '../modals/BuyManagerModal'
import FieldSalesModal from '../modals/BuyFieldSalesModal'
import BuyCommonSellersModal from '../modals/BuyCommonSellersModal'
import MixProductsModal from '../modals/MixProductsModal'
import SorteRevesModal from '../modals/SorteRevesModal'
import FaturamentoDoMesModal from '../modals/FaturamentoMesModal'
import DespesasOperacionaisModal from '../modals/DespesasOperacionaisModal'
import InsufficientFundsModal from '../modals/InsufficientFundsModal'
import RecoveryModal from '../modals/RecoveryModal'
import BankruptcyModal from '../modals/BankruptcyModal'

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
} from './gameMath'

// ===== Engine V2 (refactor incremental) =====
// IMPORTANTE:
// - Mantém contrato externo de `useTurnEngine` intacto.
// - Por padrão, ENGINE_V2 fica DESLIGADO (fallback total para lógica atual).
// - Objetivo: migrar por etapas, reduzindo risco no multiplayer.
import { reduceGame } from './engine/gameReducer'
import { runEvents } from './engine/gameEffects'

const ENGINE_V2 = false

/**
 * Hook do motor de turnos.
 * Recebe estados do App e devolve handlers (advanceAndMaybeLap, onAction, nextTurn).
 */
export function useTurnEngine({
  players, setPlayers,
  round, setRound,
  turnIdx, setTurnIdx,
  turnPlayerId, setTurnPlayerId,
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
}) {
  // ===== Modais =====
  const { pushModal, awaitTop, closeTop } = useModal?.() || {}

  // 🔒 contagem de modais abertas (para saber quando destravar turno)
  const [modalLocks, setModalLocks] = React.useState(0)
  const modalLocksRef = React.useRef(0)
  React.useEffect(() => { modalLocksRef.current = modalLocks }, [modalLocks])
  
  // ✅ CORREÇÃO: Flag para indicar que uma modal está sendo aberta (evita race condition)
  const openingModalRef = React.useRef(false)
  
  // ✅ MULTIPLAYER/TURNO: fila única para serializar eventos/modais por ROLL (evita IIFEs concorrentes)
  const eventsInProgressRef = React.useRef(false)
  const actionQueueRef = React.useRef(Promise.resolve())
  const enqueueAction = React.useCallback((job) => {
    const wrapped = async () => {
      eventsInProgressRef.current = true
      try {
        return await job()
      } finally {
        eventsInProgressRef.current = false
      }
    }
    const p = actionQueueRef.current.then(wrapped, wrapped)
    // mantém a cadeia viva mesmo se der erro
    actionQueueRef.current = p.catch((err) => {
      console.error('[DEBUG] actionQueue error:', err)
    })
    return p
  }, [])
  
  // ✅ CORREÇÃO: Ref para rastrear se há uma mudança de turno em progresso
  const turnChangeInProgressRef = React.useRef(false)

  // ✅ Evita duplicação: quando advanceAndMaybeLap agenda retry por causa de modais abertas,
  // múltiplos cliques/entradas não podem agendar múltiplos retries (o que duplicaria Sorte & Revés).
  const advanceRetryTimerRef = React.useRef(null)
  const pendingAdvanceArgsRef = React.useRef(null)
  
  // ✅ CORREÇÃO: Ref para timeout de segurança do turnLock
  const turnLockTimeoutRef = React.useRef(null)
  
  // ✅ CORREÇÃO: Ref para rastrear quando a última modal foi fechada
  // Isso garante que há um delay antes de mudar o turno, dando tempo para todas as modais serem fechadas
  const lastModalClosedTimeRef = React.useRef(null)
  
  // ✅ CORREÇÃO OBRIGATÓRIA 1: Fila de modais para serializar chamadas (evitar modalLocks > 1)
  // Garante que apenas uma modal aguarda por vez, evitando sobrescrita de resolverRef no ModalContext
  const modalQueueRef = React.useRef(Promise.resolve())

  // ✅ CORREÇÃO: Normaliza players para garantir ordem consistente
  // Seat é IMUTÁVEL após atribuído no start - nunca reatribui seat existente
  const normalizePlayers = React.useCallback((players) => {
    if (!Array.isArray(players) || players.length === 0) return players
    
    // Cria cópia para não mutar o original
    const arr = [...players].filter(Boolean)
    
    // Verifica se TODOS possuem seat válido
    const hasSeat = arr.every(p => Number.isInteger(p.seat))
    
    // Ordena: se todos têm seat, ordena por seat; senão, ordena por id
    let ordered = hasSeat 
      ? arr.sort((a, b) => a.seat - b.seat)
      : arr.sort((a, b) => String(a?.id ?? a?.player_id ?? '').localeCompare(String(b?.id ?? b?.player_id ?? '')))
    
    // Preenche seats faltantes SEM alterar os existentes
    let nextSeat = 0
    const used = new Set(ordered.filter(p => Number.isInteger(p.seat)).map(p => p.seat))
    
    ordered = ordered.map(p => {
      if (Number.isInteger(p.seat)) {
        return p // Preserva seat existente
      }
      // Atribui próximo seat disponível
      while (used.has(nextSeat)) nextSeat++
      used.add(nextSeat)
      return { ...p, seat: nextSeat++ }
    })
    
    // Reordena por seat após preencher faltantes
    ordered = ordered.sort((a, b) => a.seat - b.seat)
    
    return ordered
  }, [])

  // ✅ CORREÇÃO: Players ordenados (memoizado) para uso em toda a lógica
  const playersOrdered = React.useMemo(() => normalizePlayers(players), [players, normalizePlayers])

  // Helpers por ID (evita bugs por índice quando players é reordenado)
  const idxById = React.useCallback((arr, id) => (arr || []).findIndex(p => String(p?.id) === String(id)), [])
  const getById = React.useCallback((arr, id) => (arr || []).find(p => String(p?.id) === String(id)), [])
  const mapById = React.useCallback((arr, id, fn) => (arr || []).map(p => (String(p?.id) === String(id) ? fn(p) : p)), [])

  // 🔄 Sincronização de modalLocks entre jogadores
  React.useEffect(() => {
    if (isMyTurn) {
      // Só o jogador da vez pode ter modais abertas
      console.log('[DEBUG] modalLocks sync - isMyTurn:', isMyTurn, 'modalLocks:', modalLocks)
    } else {
      // Outros jogadores devem ter modalLocks = 0
      if (modalLocks > 0) {
        console.log('[DEBUG] modalLocks sync - resetando modalLocks para 0 (não é minha vez)')
        setModalLocks(0)
        modalLocksRef.current = 0
        openingModalRef.current = false
      }
    }
  }, [isMyTurn, modalLocks])
  
  // ✅ CORREÇÃO: Timeout de segurança para turnLock (evita travamento infinito)
  React.useEffect(() => {
    if (turnLock) {
      // Limpa timeout anterior se existir
      if (turnLockTimeoutRef.current) {
        clearTimeout(turnLockTimeoutRef.current)
      }
      
      // Define timeout de segurança (30 segundos)
      turnLockTimeoutRef.current = setTimeout(() => {
        const currentLockOwner = lockOwnerRef.current
        const isLockOwner = String(currentLockOwner || '') === String(myUid)
        const currentModalLocks = modalLocksRef.current
        const currentOpening = openingModalRef.current
        
        console.warn('[DEBUG] ⚠️ TIMEOUT DE SEGURANÇA - turnLock ativo há mais de 30s', {
          isLockOwner,
          currentModalLocks,
          currentOpening,
          lockOwner: currentLockOwner
        })
        
        // ✅ CORREÇÃO D: Se sou o dono do lock e não há modais, força liberação
        // OU se lockOwner é null por muito tempo, também libera
        const shouldForceUnlock = (isLockOwner && currentModalLocks === 0 && !currentOpening) || 
                                   (currentLockOwner == null && currentModalLocks === 0 && !currentOpening)
        if (shouldForceUnlock) {
          console.warn('[DEBUG] 🔓 FORÇANDO LIBERAÇÃO DO TURNLOCK (timeout de segurança)', {
            isLockOwner,
            lockOwner: currentLockOwner,
            modalLocks: currentModalLocks,
            opening: currentOpening
          })
          setTurnLockBroadcast(false)
          turnChangeInProgressRef.current = false
        }
      }, 30000) // 30 segundos
    } else {
      // Limpa timeout quando turnLock é liberado
      if (turnLockTimeoutRef.current) {
        clearTimeout(turnLockTimeoutRef.current)
        turnLockTimeoutRef.current = null
      }
    }
    
    return () => {
      if (turnLockTimeoutRef.current) {
        clearTimeout(turnLockTimeoutRef.current)
        turnLockTimeoutRef.current = null
      }
    }
  }, [turnLock, myUid, setTurnLockBroadcast])

  // 🔒 dono do cadeado de turno (garante que só o iniciador destrava)
  // ✅ CORREÇÃO: Declarado ANTES do useEffect que o usa
  const [lockOwner, setLockOwner] = React.useState(null)
  const lockOwnerRef = React.useRef(null)
  React.useEffect(() => { lockOwnerRef.current = lockOwner }, [lockOwner])

  // 🔄 dados do próximo turno (para evitar stale closure)
  // ✅ CORREÇÃO: Declarado ANTES do useEffect que o usa
  const pendingTurnDataRef = React.useRef(null)
  
  // ✅ CORREÇÃO CRÍTICA: Ref para pegar valor atualizado de round (evita stale closure)
  const currentRoundRef = React.useRef(round)
  React.useEffect(() => { 
    currentRoundRef.current = round
    console.log('[DEBUG] 🔄 currentRoundRef atualizado para:', round)
  }, [round])

  // ✅ refs do estado mais recente (evita stale no tick / winner)
  const playersRef = React.useRef(players)
  React.useEffect(() => { playersRef.current = players }, [players])

  const turnIdxRef = React.useRef(turnIdx)
  React.useEffect(() => { turnIdxRef.current = turnIdx }, [turnIdx])

  const gameOverRef = React.useRef(gameOver)
  React.useEffect(() => { gameOverRef.current = gameOver }, [gameOver])

  // ✅ ENDGAME: pendente + idempotência
  const endGamePendingRef = React.useRef(false)
  const endGameFinalizedRef = React.useRef(false)

  // ✅ CORREÇÃO: Atualiza lockOwner quando turnIdx muda (incluindo via SYNC)
  React.useEffect(() => {
    const currentPlayer = players[turnIdx]
    if (currentPlayer && String(currentPlayer.id) === String(myUid)) {
      // Se é minha vez, atualiza lockOwner para permitir que eu mude o turno
      console.log('[DEBUG] É minha vez - atualizando lockOwner para:', myUid, 'turnIdx:', turnIdx)
      setLockOwner(String(myUid))
      // ✅ CORREÇÃO: NÃO limpa pendingTurnDataRef aqui se há dados pendentes para um turno futuro
      // O tick precisa usar esses dados para mudar o turno
      // Só limpa se os dados pendentes são para o turno atual (já foi processado)
      if (pendingTurnDataRef.current) {
        if (pendingTurnDataRef.current.nextTurnIdx === turnIdx) {
          // Se os dados pendentes são para o turno atual, limpa (já foi processado)
          console.log('[DEBUG] Limpando pendingTurnDataRef - turno já foi processado (nextTurnIdx === turnIdx)')
          pendingTurnDataRef.current = null
        } else {
          // Se os dados pendentes são para um turno futuro, mantém (tick ainda precisa usar)
          console.log('[DEBUG] Mantendo pendingTurnDataRef - próximo turno:', pendingTurnDataRef.current.nextTurnIdx, 'turno atual:', turnIdx)
        }
      }
    } else {
      // Se não é minha vez, limpa lockOwner e pendingTurnDataRef
      if (lockOwner === String(myUid)) {
        console.log('[DEBUG] Não é mais minha vez - limpando lockOwner')
        setLockOwner(null)
      }
      // ✅ CORREÇÃO: Só limpa pendingTurnDataRef se não há dados pendentes para o próximo turno
      // (pode ser que o turno esteja mudando e o tick ainda precise dos dados)
      if (pendingTurnDataRef.current && pendingTurnDataRef.current.nextTurnIdx !== turnIdx) {
        // Se os dados pendentes não são para o turno atual, pode limpar
        console.log('[DEBUG] Limpando pendingTurnDataRef - não é minha vez e dados não são para turno atual')
        pendingTurnDataRef.current = null
      }
    }
  }, [turnIdx, players, myUid, lockOwner])

  // helper: abrir modal e "travar"/"destravar" o contador
  // ✅ CORREÇÃO OBRIGATÓRIA 1: Serialização via fila + decremento único no finally
  const openModalAndWait = React.useCallback((element) => {
    if (!pushModal || !awaitTop) return Promise.resolve(null)

    const job = async () => {
      let modalResolved = false

      try {
        openingModalRef.current = true

        setModalLocks(prev => {
          const next = prev + 1
          modalLocksRef.current = next
          lastModalClosedTimeRef.current = null // ✅ CORREÇÃO: Reseta timestamp quando abre modal
          console.log('[DEBUG] openModalAndWait - ABRINDO modal, modalLocks:', prev, '->', next, 'openingModalRef:', openingModalRef.current)
          return next
        })

        pushModal(element)
        
        // ✅ CORREÇÃO: Pequeno delay para garantir que a modal foi renderizada
        await new Promise(resolve => setTimeout(resolve, 100))
        openingModalRef.current = false
        console.log('[DEBUG] openModalAndWait - Modal renderizada, openingModalRef:', openingModalRef.current)

        // ✅ CORREÇÃO: Timeout de segurança (15s) para evitar travamentos
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Modal timeout')), 15000)
        )
        
        const payload = await Promise.race([awaitTop(), timeoutPromise])
        modalResolved = true
        
        // ✅ CORREÇÃO: Pequeno delay após resolver para garantir que a modal foi completamente fechada
        await new Promise(resolve => setTimeout(resolve, 50))
        return payload ?? null
      } catch (err) {
        console.error('[DEBUG] openModalAndWait - erro aguardando modal:', err)
        
        // ✅ CORREÇÃO: Se timeout, força fechamento
        if (err.message === 'Modal timeout') {
          console.warn('[WARN] modal timeout -> auto-close')
          try {
            closeTop?.({ action: 'SKIP' })
          } catch {}
        }
        
        // ✅ CORREÇÃO OBRIGATÓRIA 1: NUNCA decrementar no catch - apenas marcar para finally decrementar
        modalResolved = true // garante decremento no finally
        return null
      } finally {
        openingModalRef.current = false

        // ✅ CORREÇÃO OBRIGATÓRIA 1: Decrementa UMA ÚNICA VEZ apenas no finally, se modalResolved === true
        if (modalResolved) {
          setModalLocks(prev => {
            const next = Math.max(0, prev - 1)
            modalLocksRef.current = next
            if (next === 0) {
              lastModalClosedTimeRef.current = Date.now()
              console.log('[DEBUG] openModalAndWait - ÚLTIMA MODAL FECHADA - timestamp:', lastModalClosedTimeRef.current)
            }
            console.log('[DEBUG] openModalAndWait - FECHANDO modal, modalLocks:', prev, '->', next)
            return next
          })
        }
      }
    }

    // ✅ CORREÇÃO OBRIGATÓRIA 1: Serialização via fila de promises
    const p = modalQueueRef.current.then(job, job)
    modalQueueRef.current = p.catch(() => {})
    return p
  }, [pushModal, awaitTop, closeTop])


  // ========= regras auxiliares de saldo =========
  const canPay = React.useCallback((idx, amount) => {
    const p = players[idx]
    const amt = Math.max(0, Number(amount || 0))
    return (Number(p?.cash || 0) >= amt)
  }, [players])

  const requireFunds = React.useCallback((idx, amount, reason) => {
    const ok = canPay(idx, amount)
    if (!ok) {
      appendLog(`Saldo insuficiente${reason ? ' para ' + reason : ''}. Use RECUPERAÇÃO (demitir / emprestar / reduzir) ou declare FALÊNCIA.`)
    }
    return ok
  }, [canPay, appendLog])

  // ========= fim de jogo =========
  // ✅ CORREÇÃO: Retorna objeto com { finished, winner, finalRound } em vez de apenas boolean
  const maybeFinishGame = React.useCallback((finalPlayers, nextRound, finalTurnIdx) => {
    // ✅ CORREÇÃO: Usa MAX_ROUNDS em vez de hardcode 5
    // Se nextRound > MAX_ROUNDS, significa que a última rodada (MAX_ROUNDS) terminou agora
    if (nextRound <= MAX_ROUNDS) {
      return { finished: false, winner: null, finalRound: nextRound }
    }

    const alivePlayers = (finalPlayers || []).filter(p => !p?.bankrupt)

    // caso extremo: ninguém vivo
    if (alivePlayers.length === 0) {
      console.log('[DEBUG] 🏁 FIM DE JOGO - Nenhum jogador vivo restante')
      return { finished: true, winner: null, finalRound: MAX_ROUNDS }
    }

    // vencedor: maior patrimônio (cash + bens). Desempate: cash, depois nome.
    const ranked = alivePlayers
      .map(p => ({
        player: p,
        patrimonio: (p.cash || 0) + (p.bens || 0),
        cash: (p.cash || 0),
      }))
      .sort((a, b) =>
        (b.patrimonio - a.patrimonio) ||
        (b.cash - a.cash) ||
        String(a.player?.name || '').localeCompare(String(b.player?.name || ''))
      )

    const champ = ranked[0]?.player || null

    console.log("[ENDGAME] finalizando: vencedor=", champ?.name || "N/A", ", round=", MAX_ROUNDS)

    return { finished: true, winner: champ, finalRound: MAX_ROUNDS }
  }, [])

  // ========= ação de andar no tabuleiro (inclui TODA a lógica de casas/modais) =========
  const advanceAndMaybeLap = React.useCallback((steps, deltaCash, note) => {
    console.log('[DEBUG] 🎯 advanceAndMaybeLap chamada - steps:', steps, 'deltaCash:', deltaCash, 'note:', note)
    if (gameOverRef.current || endGamePendingRef.current || endGameFinalizedRef.current || !players.length) return

    // ✅ CORREÇÃO: Verifica se já há uma mudança de turno em progresso
    if (turnChangeInProgressRef.current) {
      console.warn('[DEBUG] ⚠️ advanceAndMaybeLap - mudança de turno já em progresso, ignorando')
      return
    }

    // ✅ CORREÇÃO: Verifica se há modais abertas antes de iniciar
    if (modalLocksRef.current > 0 || openingModalRef.current) {
      console.warn('[DEBUG] ⚠️ advanceAndMaybeLap - há modais abertas, aguardando...', {
        modalLocks: modalLocksRef.current,
        opening: openingModalRef.current
      })
      // ✅ Evita duplicação: consolida retries (vários cliques não podem agendar vários retries)
      pendingAdvanceArgsRef.current = { steps, deltaCash, note }
      if (advanceRetryTimerRef.current) return
      advanceRetryTimerRef.current = setTimeout(() => {
        advanceRetryTimerRef.current = null
        const args = pendingAdvanceArgsRef.current
        pendingAdvanceArgsRef.current = null
        if (!args) return
        if (modalLocksRef.current === 0 && !openingModalRef.current) {
          advanceAndMaybeLap(args.steps, args.deltaCash, args.note)
        }
      }, 200)
      return
    }

    // ✅ BUG 2 FIX: try/finally para garantir liberação de turnLock em caso de erro
    // Bloqueia os próximos jogadores até esta ação (e todas as modais) terminar
    turnChangeInProgressRef.current = true
    setTurnLockBroadcast(true)
    setLockOwner(String(myUid))
    
    try {
    // ✅ CORREÇÃO: Usa playersOrdered para garantir ordem consistente e obtém ID do jogador da vez
    const curIdx = turnIdx
    const cur = playersOrdered[curIdx]
    if (!cur) { 
      setTurnLockBroadcast(false)
      turnChangeInProgressRef.current = false
      return 
    }
    
    // ✅ CORREÇÃO: Obtém ID do jogador da vez para atualizações por ID (não por índice)
    const ownerId = String(cur.id)
    
    console.log('[DEBUG] 📍 POSIÇÃO INICIAL - Jogador:', cur.name, 'Posição:', cur.pos, 'Saldo:', cur.cash)

    // ========= função recursiva para lidar com saldo insuficiente =========
    const handleInsufficientFunds = async (requiredAmount, context, action, currentPlayers = players) => {
      const curById = getById(currentPlayers, ownerId) || {}
      const currentCash = Number(curById?.cash || 0)
      
      if (currentCash >= requiredAmount) {
        // Processa o pagamento já que tem saldo suficiente
        console.log('[DEBUG] ✅ Saldo suficiente! Processando pagamento de:', requiredAmount)
        // ✅ CORREÇÃO: Atualiza jogador por ID, não por índice
        const updatedPlayers = normalizePlayers(currentPlayers).map((p) => 
          String(p.id) !== ownerId ? p : { ...p, cash: Math.max(0, (p.cash || 0) - requiredAmount), pos: p.pos }
        )
        setPlayers(updatedPlayers)
        broadcastState(updatedPlayers, turnIdx, currentRoundRef.current)
        return true // Tem saldo suficiente e pagou
      }

      // ✅ CORREÇÃO: Marca que uma modal será aberta ANTES de abrir
      openingModalRef.current = true
      // Mostra modal de saldo insuficiente
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
        console.log('[DEBUG] Abrindo RecoveryModal para jogador:', curById)
        const recoveryModalRes = await openModalAndWait(<RecoveryModal currentPlayer={curById} canClose={false} />)
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
            // ✅ CORREÇÃO: Preserva a posição do jogador ao atualizar
            updatedPlayers = mapById(currentPlayers, ownerId, (p) => {
              const updated = applyDeltas(p, deltas)
              return { ...updated, pos: p.pos }
            })
            console.log('[DEBUG] Novo saldo após demissões:', getById(updatedPlayers, ownerId)?.cash)
            setPlayers(updatedPlayers)
            broadcastState(updatedPlayers, turnIdx, currentRoundRef.current)
          } else if (recoveryModalRes.type === 'LOAN') {
            console.log('[DEBUG] ✅ Condição LOAN atendida! Processando empréstimo:', recoveryModalRes)
            
            // Verifica se o jogador já tem um empréstimo pendente
            const currentLoan = (getById(currentPlayers, ownerId) || {}).loanPending
            if (currentLoan && Number(currentLoan.amount) > 0) {
              console.log('[DEBUG] ❌ Jogador já possui empréstimo pendente:', currentLoan)
              // Mostra modal informando que já tem empréstimo - NÃO PODE FECHAR
              const loanModalRes = await openModalAndWait(
                <InsufficientFundsModal
                  requiredAmount={requiredAmount}
                  currentCash={Number((getById(currentPlayers, ownerId) || {}).cash || 0)}
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
              const updatedPlayers = mapById(currentPlayers, ownerId, (p) => ({ ...p, bankrupt: true }))
              const alive = countAlivePlayers(updatedPlayers)
              if (alive <= 1) {
                const winnerIdx = updatedPlayers.findIndex(p => !p?.bankrupt)
                setWinner(winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
                setPlayers(updatedPlayers)
                setGameOver(true)
                setTurnLockBroadcast(false)
                broadcastState(updatedPlayers, turnIdx, round, true, winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
                return false
              }
              const ownerIdx = idxById(updatedPlayers, ownerId)
              const nextIdx = findNextAliveIdx(updatedPlayers, ownerIdx >= 0 ? ownerIdx : curIdx)
              // ✅ CORREÇÃO MULTIPLAYER: Calcula turnPlayerId do próximo jogador
              const nextPlayer = updatedPlayers[nextIdx]
              const nextTurnPlayerId = nextPlayer?.id ? String(nextPlayer.id) : null
              setPlayers(updatedPlayers)
              setTurnIdx(nextIdx)
              if (setTurnPlayerId) setTurnPlayerId(nextTurnPlayerId)
              setTurnLockBroadcast(false)
              broadcastState(updatedPlayers, nextIdx, currentRoundRef.current, false, null, {
                turnPlayerId: nextTurnPlayerId // ✅ CORREÇÃO: turnPlayerId autoritativo
              })
              return false
            }
            
            const amt = Number(recoveryModalRes.amount || 0)
            console.log('[DEBUG] Valor do empréstimo:', amt)
            console.log('[DEBUG] Saldo atual do jogador:', Number((getById(currentPlayers, ownerId) || {}).cash || 0))
            // ✅ CORREÇÃO: Preserva a posição do jogador ao atualizar
            // ✅ CORREÇÃO: Empréstimo será cobrado na próxima vez que passar pela casa de despesas operacionais
            // Não usa dueRound baseado em rodada, mas sim uma flag para indicar que deve ser cobrado na próxima passagem
            updatedPlayers = mapById(currentPlayers, ownerId, (p) => ({
                ...p,
                cash: (Number(p.cash) || 0) + amt,
                loanPending: { 
                  amount: amt, 
                  charged: false,
                shouldChargeOnNextExpenses: true,
              },
              pos: p.pos
            }))
            console.log('[DEBUG] Novo saldo do jogador:', getById(updatedPlayers, ownerId)?.cash)
            console.log('[DEBUG] Novo loanPending:', getById(updatedPlayers, ownerId)?.loanPending)
            setPlayers(updatedPlayers)
            broadcastState(updatedPlayers, turnIdx, currentRoundRef.current)
          } else if (recoveryModalRes.type === 'REDUCE') {
            console.log('[DEBUG] ✅ Condição REDUCE atendida! Processando redução:', recoveryModalRes)
            const selections = recoveryModalRes.items || []
            let totalCredit = 0
            console.log('[DEBUG] Seleções para reduzir:', selections)
            
            // ✅ CORREÇÃO: Helper para calcular nível atual baseado em owned
            const letterFromOwned = (owned) => {
              if (owned?.A === true) return 'A'
              if (owned?.B === true) return 'B'
              if (owned?.C === true) return 'C'
              return 'D'
            }
            
            // ✅ CORREÇÃO: Preserva a posição do jogador ao atualizar
            updatedPlayers = mapById(currentPlayers, ownerId, (p0) => {
              let next = { ...p0 }
              
              // Inicializa mixOwned e erpOwned se não existirem
              let mixOwned = { A: false, B: false, C: false, D: false, ...(next.mixOwned || next.mix || {}) }
              let erpOwned = { A: false, B: false, C: false, D: false, ...(next.erpOwned || next.erp || {}) }
              
              // ✅ CORREÇÃO: Se owned estiver vazio, infere de mixProdutos/erpLevel
              const currentMixLevel = String(next.mixProdutos || 'D').toUpperCase()
              const currentErpLevel = String(next.erpLevel || next.erpSistemas || 'D').toUpperCase()
              
              // Se mixOwned está vazio mas tem mixProdutos, infere
              if (!mixOwned.A && !mixOwned.B && !mixOwned.C && !mixOwned.D && currentMixLevel) {
                if (currentMixLevel === 'A') {
                  mixOwned = { A: true, B: true, C: true, D: true }
                } else if (currentMixLevel === 'B') {
                  mixOwned = { A: false, B: true, C: true, D: true }
                } else if (currentMixLevel === 'C') {
                  mixOwned = { A: false, B: false, C: true, D: true }
                } else {
                  mixOwned = { A: false, B: false, C: false, D: true }
                }
              }
              
              // Se erpOwned está vazio mas tem erpLevel, infere
              if (!erpOwned.A && !erpOwned.B && !erpOwned.C && !erpOwned.D && currentErpLevel) {
                if (currentErpLevel === 'A') {
                  erpOwned = { A: true, B: true, C: true, D: true }
                } else if (currentErpLevel === 'B') {
                  erpOwned = { A: false, B: true, C: true, D: true }
                } else if (currentErpLevel === 'C') {
                  erpOwned = { A: false, B: false, C: true, D: true }
                } else {
                  erpOwned = { A: false, B: false, C: false, D: true }
                }
              }
              
              let currentMixLevelAfter = currentMixLevel
              let currentErpLevelAfter = currentErpLevel
              
              for (const sel of selections) {
                if (sel.selected) {
                  totalCredit += Number(sel.credit || 0)
                  if (sel.group === 'MIX') {
                    // Remove o nível do owned
                    mixOwned[sel.level] = false
                    // ✅ CORREÇÃO: Se está reduzindo o nível atual, faz downgrade
                    if (sel.level === currentMixLevelAfter) {
                      const levels = ['A', 'B', 'C', 'D']
                      const currentIdx = levels.indexOf(currentMixLevelAfter)
                      // Vai para o próximo nível disponível
                      for (let idx = currentIdx + 1; idx < levels.length; idx++) {
                        const nextLevel = levels[idx]
                        if (mixOwned[nextLevel] || nextLevel === 'D') {
                          currentMixLevelAfter = nextLevel
                          break
                        }
                      }
                    }
                  } else if (sel.group === 'ERP') {
                    // Remove o nível do owned
                    erpOwned[sel.level] = false
                    // ✅ CORREÇÃO: Se está reduzindo o nível atual, faz downgrade
                    if (sel.level === currentErpLevelAfter) {
                      const levels = ['A', 'B', 'C', 'D']
                      const currentIdx = levels.indexOf(currentErpLevelAfter)
                      // Vai para o próximo nível disponível
                      for (let idx = currentIdx + 1; idx < levels.length; idx++) {
                        const nextLevel = levels[idx]
                        if (erpOwned[nextLevel] || nextLevel === 'D') {
                          currentErpLevelAfter = nextLevel
                          break
                        }
                      }
                    }
                  }
                }
              }
              
              // ✅ CORREÇÃO: Recalcula mixProdutos e erpLevel após redução
              const finalMixLevel = letterFromOwned(mixOwned) || currentMixLevelAfter || 'D'
              const finalErpLevel = letterFromOwned(erpOwned) || currentErpLevelAfter || 'D'
              
              next.mixOwned = mixOwned
              next.mix = mixOwned
              next.erpOwned = erpOwned
              next.erp = erpOwned
              next.mixProdutos = finalMixLevel
              next.erpLevel = finalErpLevel
              next.erpSistemas = finalErpLevel
              // Aliases adicionais
              next.mixLevel = finalMixLevel
              next.mixProducts = finalMixLevel
              next.mixLevelLetter = finalMixLevel
              next.erpLevelLetter = finalErpLevel
              
              next.cash = (Number(next.cash) || 0) + totalCredit
              // ✅ CORREÇÃO: Preserva a posição original
              next.pos = p0.pos
              
              console.log('[DEBUG] Redução aplicada - mixProdutos:', finalMixLevel, 'erpLevel:', finalErpLevel, 'crédito:', totalCredit)
              
              return next
            })
            console.log('[DEBUG] Total de crédito da redução:', totalCredit)
            console.log('[DEBUG] Novo saldo após redução:', getById(updatedPlayers, ownerId)?.cash)
            console.log('[DEBUG] Novo mixProdutos:', getById(updatedPlayers, ownerId)?.mixProdutos, 'Novo erpLevel:', getById(updatedPlayers, ownerId)?.erpLevel)
            setPlayers(updatedPlayers)
            broadcastState(updatedPlayers, turnIdx, currentRoundRef.current)
          } else {
            console.log('[DEBUG] ❌ Nenhuma condição foi atendida! Tipo:', recoveryModalRes.type, 'Action:', recoveryModalRes.action)
          }
          
          // Verifica se agora tem saldo suficiente após a recuperação
          const newCash = Number((getById(updatedPlayers, ownerId) || {}).cash || 0)
          console.log('[DEBUG] Verificando saldo após recuperação - Novo saldo:', newCash, 'Necessário:', requiredAmount)
          
          if (newCash >= requiredAmount) {
            console.log('[DEBUG] ✅ Saldo suficiente após recuperação! Processando pagamento de:', requiredAmount)
            // Processa o pagamento já que tem saldo suficiente
            // ✅ CORREÇÃO: Preserva a posição do jogador ao atualizar
            const finalPlayers = mapById(updatedPlayers, ownerId, (p) => ({ ...p, cash: Math.max(0, (p.cash || 0) - requiredAmount), pos: p.pos }))
            console.log('[DEBUG] 💰 PAGAMENTO - Saldo antes:', Number((getById(updatedPlayers, ownerId) || {}).cash || 0), 'Valor a pagar:', requiredAmount, 'Saldo após:', Number((getById(finalPlayers, ownerId) || {}).cash || 0))
            setPlayers(finalPlayers)
            broadcastState(finalPlayers, turnIdx, currentRoundRef.current)
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
        const updatedPlayers = mapById(currentPlayers, ownerId, (p) => ({ ...p, bankrupt: true }))
        const alive = countAlivePlayers(updatedPlayers)
        if (alive <= 1) {
          const winnerIdx = updatedPlayers.findIndex(p => !p?.bankrupt)
          setWinner(winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
          setPlayers(updatedPlayers)
          setGameOver(true)
          setTurnLockBroadcast(false)
          broadcastState(updatedPlayers, turnIdx, round, true, winnerIdx >= 0 ? updatedPlayers[winnerIdx] : null)
          return false
        }
        const ownerIdx = idxById(updatedPlayers, ownerId)
        const nextIdx = findNextAliveIdx(updatedPlayers, ownerIdx >= 0 ? ownerIdx : curIdx)
        // ✅ CORREÇÃO MULTIPLAYER: Calcula turnPlayerId do próximo jogador
        const nextPlayer = updatedPlayers[nextIdx]
        const nextTurnPlayerId = nextPlayer?.id ? String(nextPlayer.id) : null
        setPlayers(updatedPlayers)
        setTurnIdx(nextIdx)
        if (setTurnPlayerId) setTurnPlayerId(nextTurnPlayerId)
        setTurnLockBroadcast(false)
        broadcastState(updatedPlayers, nextIdx, currentRoundRef.current, false, null, {
          turnPlayerId: nextTurnPlayerId // ✅ CORREÇÃO: turnPlayerId autoritativo
        })
        return false
      } else {
        setTurnLockBroadcast(false)
        return false
      }
    }

    const oldPos = cur.pos
    const newPos = (oldPos + steps) % TRACK_LEN
    const lap = newPos < oldPos
    
    // ✅ CORREÇÃO CRÍTICA: Detecta volta completa e incrementa rodada individual do jogador
    // NOTA: A rodada geral só incrementa quando TODOS passam pela casa 0, mas aqui detectamos volta completa
    const completedLap = lap && oldPos >= TRACK_LEN - 1  // Se estava na última casa e deu volta

    console.log('[DEBUG] 🚶 MOVIMENTO - De posição:', oldPos, 'Para posição:', newPos, 'Steps:', steps, 'Lap:', lap, 'CompletedLap:', completedLap)

    // ✅ CORREÇÃO: Verifica se passou pela casa 0 (Faturamento do Mês)
    const crossedStart1ForRound = crossedTile(oldPos, newPos, 0) || lap
    
    // aplica movimento + eventual cashDelta imediato (sem permitir negativo)
    // ✅ Adiciona lastRevenueRound e waitingAtRevenue
    const roundNow = currentRoundRef.current
    const aliveCount = players.filter(p => !p?.bankrupt).length
    
    // ✅ CORREÇÃO: Atualiza jogador por ID/seat, não por índice
    const nextPlayers = normalizePlayers(players).map((p) => {
      if (String(p.id) !== ownerId) return p

      const nextCash = (p.cash || 0) + (deltaCash || 0)

      const prevLastRevenueRound = Number(p.lastRevenueRound) || 0
      const prevWaiting = p.waitingAtRevenue === true

      let newLastRevenueRound = prevLastRevenueRound
      let waitingAtRevenue = (roundNow === MAX_ROUNDS) ? prevWaiting : false
      let finalPos = (waitingAtRevenue ? 0 : newPos)

      // ✅ cruzou casa 0 → marca rodada atual
      if (crossedStart1ForRound) {
        newLastRevenueRound = Math.max(prevLastRevenueRound, roundNow)

        // ✅ rodada 5 trava SEMPRE na casa 0
        if (roundNow === MAX_ROUNDS && aliveCount > 1) {
          waitingAtRevenue = true
          finalPos = 0
        }
      }

      return {
        ...p,
        pos: finalPos,
        cash: Math.max(0, nextCash),
        lastRevenueRound: newLastRevenueRound,
        waitingAtRevenue
      }
    })
    
    // ✅ CORREÇÃO: Encontra jogador atualizado por ID para log
    const updatedCur = nextPlayers.find(p => String(p.id) === ownerId)
    console.log('[DEBUG] 📍 APÓS MOVIMENTO - Jogador:', updatedCur?.name, 'Posição:', updatedCur?.pos, 'Saldo:', updatedCur?.cash, 'lastRevenueRound:', updatedCur?.lastRevenueRound, 'waitingAtRevenue:', updatedCur?.waitingAtRevenue)

    // >>> controle de rodada: só vira quando TODOS os jogadores VIVOS cruzarem a casa 0
    // ✅ CORREÇÃO CRÍTICA: Usa ref para pegar valor atualizado de round (evita stale closure)
    let nextRound = currentRoundRef.current
    let nextFlags = [...roundFlags]
    let shouldIncrementRound = false
    let shouldEndGameAfterTick = false
    
    // ✅ CORREÇÃO CRÍTICA: Se jogador completou volta completa (lap), marca flag imediatamente
    // Isso garante que a flag seja marcada mesmo se crossedStart1ForRound não detectar corretamente
    if (lap) {
      console.log('[DEBUG] 🏁 VOLTA COMPLETA DETECTADA (lap=true) - Jogador completou uma volta completa!', {
        jogador: cur.name,
        posicaoAnterior: oldPos,
        posicaoNova: newPos,
        rodadaAtual: currentRoundRef.current
      })
      
      // Garante que o array de flags tem o tamanho correto
      if (nextFlags.length < players.length) {
        nextFlags = [...nextFlags, ...new Array(players.length - nextFlags.length).fill(false)]
      }
      
      // ✅ CORREÇÃO: Encontra índice do jogador atual por ID para marcar flag
      const curIdxForFlag = playersOrdered.findIndex(p => String(p.id) === ownerId)
      if (curIdxForFlag >= 0) {
        nextFlags[curIdxForFlag] = true
      }
      console.log('[DEBUG] 🏁 Flag marcada por volta completa (lap) - Flags:', nextFlags.map((f, i) => `${playersOrdered[i]?.name}:${f}`).join(', '))
    }
    
    // ✅ CORREÇÃO: Usa crossedStart1ForRound para detectar passagem pela casa 0 (pode ser sem dar volta completa)
    // Se lap já marcou a flag, isso garante que não perde a marcação
    if (crossedStart1ForRound) {
      // Garante que o array de flags tem o tamanho correto
      if (nextFlags.length < players.length) {
        nextFlags = [...nextFlags, ...new Array(players.length - nextFlags.length).fill(false)]
      }
      
      // ✅ CORREÇÃO: Encontra índice do jogador atual por ID para marcar flag
      const curIdxForFlag = playersOrdered.findIndex(p => String(p.id) === ownerId)
      if (curIdxForFlag >= 0) {
        if (!nextFlags[curIdxForFlag]) {
          nextFlags[curIdxForFlag] = true
          console.log('[DEBUG] 🏁 Jogador passou pela casa 0 (crossedStart1ForRound) - Flags:', nextFlags.map((f, i) => `${playersOrdered[i]?.name}:${f}`).join(', '))
        } else {
          console.log('[DEBUG] 🏁 Jogador já tinha flag marcada (por lap) - Flags:', nextFlags.map((f, i) => `${playersOrdered[i]?.name}:${f}`).join(', '))
        }
      }
      
      // ✅ CORREÇÃO: Conta apenas jogadores vivos para verificar se todos passaram
      const alivePlayers = nextPlayers.filter(p => !p?.bankrupt)
      const aliveIndices = nextPlayers.map((p, i) => !p?.bankrupt ? i : -1).filter(i => i >= 0)
      
      // ✅ CORREÇÃO: Verifica se todos os jogadores vivos passaram pela casa 0
      // Usa lastRevenueRound >= roundNow (robusto)
      const alive = nextPlayers.filter(p => !p?.bankrupt)
      const allAliveDone =
        alive.length > 0 &&
        alive.every(p => (Number(p.lastRevenueRound) || 0) >= roundNow)
      
      console.log('[DEBUG] 🔍 Verificando allAliveDone - Rodada atual:', roundNow, 'Jogadores vivos:', alive.map(p => ({ name: p.name, lastRevenueRound: p.lastRevenueRound })))
      
      const curForLog = nextPlayers.find(p => String(p.id) === ownerId)
      console.log('[DEBUG] 🔍 Verificação de rodada - Jogador:', curForLog?.name, 'Rodada atual:', roundNow, 'round do closure:', round)
      console.log('[DEBUG] 🔍 Jogadores vivos:', aliveIndices.map(i => {
        const p = nextPlayers[i]
        const flagIdx = playersOrdered.findIndex(po => String(po.id) === String(p?.id))
        return `${p?.name}:${flagIdx >= 0 ? nextFlags[flagIdx] : false}`
      }).join(', '))
      console.log('[DEBUG] 🔍 Total de jogadores vivos:', aliveIndices.length)
      console.log('[DEBUG] 🔍 Flags completas:', nextFlags.map((f, i) => `${nextPlayers[i]?.name}:${f ? '✓' : '✗'}`).join(', '))
      console.log('[DEBUG] 🔍 Todos passaram pela casa 0?', allAliveDone)
      
      if (allAliveDone) {
        if (roundNow < MAX_ROUNDS) {
          nextRound = roundNow + 1
          shouldIncrementRound = true
        } else {
          // ✅ ROUND 5 + TODOS CHEGARAM → ENCERRA O JOGO
          shouldEndGameAfterTick = true
        }
        
        // ✅ CORREÇÃO: Reseta apenas as flags dos jogadores vivos (mantém flags de falidos)
        if (shouldIncrementRound) {
          nextFlags = nextFlags.map((_, idx) => {
            if (nextPlayers[idx]?.bankrupt) {
              // Mantém a flag do jogador falido (não reseta)
              return nextFlags[idx]
            } else {
              // Reseta a flag do jogador vivo
              return false
            }
          })
          console.log('[DEBUG] 🔄 RODADA INCREMENTADA - Nova rodada:', nextRound, 'Rodada anterior:', roundNow, 'Jogadores vivos:', alive.length)
          console.log('[DEBUG] 🔄 Flags resetadas:', nextFlags.map((f, i) => `${nextPlayers[i]?.name}:${f}`).join(', '))
          appendLog(`🔄 Rodada ${nextRound} iniciada! Todos os jogadores vivos passaram pela casa de faturamento.`)
        } else if (shouldEndGameAfterTick) {
          console.log('[DEBUG] 🏁 FIM DE JOGO - Rodada 5 completa, todos os jogadores vivos chegaram!')
        }
      } else {
        const missingPlayers = alive.filter(p => (Number(p.lastRevenueRound) || 0) < roundNow).map(p => p.name)
        console.log('[DEBUG] ⏳ Rodada NÃO incrementada - ainda faltam jogadores completarem o mês:', missingPlayers.join(', '))
      }
    }
    
    // ✅ CORREÇÃO: Atualiza as flags ANTES de atualizar a rodada
    setRoundFlags(nextFlags)
    console.log('[DEBUG] roundFlags updated / round closed:', nextFlags.map((f, i) => `${nextPlayers[i]?.name}:${f}`).join(', '))
    
    // >>> pular jogadores falidos ao decidir o próximo turno
    // ✅ Na rodada 5, pula também quem está waitingAtRevenue
    let nextTurnIdx = findNextAliveIdx(nextPlayers, curIdx)
    
    // Pula waiting na rodada 5
    if (currentRoundRef.current === 5) {
      let guard = 0
      while (guard < nextPlayers.length) {
        const p = nextPlayers[nextTurnIdx]
        if (!p.bankrupt && !(p.waitingAtRevenue === true)) break
        nextTurnIdx = (nextTurnIdx + 1) % nextPlayers.length
        guard++
      }
    }
    
    if (deltaCash) appendLog(`${cur.name} ${deltaCash>0? 'ganhou' : 'pagou'} $${(Math.abs(deltaCash)).toLocaleString()}`)
    if (note) appendLog(note)
    
    setPlayers(nextPlayers)
    
    // ✅ CORREÇÃO CRÍTICA: Atualiza a rodada garantindo que o incremento aconteça corretamente
    // Usa função de atualização para sempre pegar o valor mais recente do estado
    // NUNCA usa prevRound + 1 - em multiplayer, se prevRound já está adiantado por sync, NÃO incrementa novamente
    setRound(prevRound => {
      const safeNext = Math.min(MAX_ROUNDS, nextRound)
      const finalRound = Math.min(MAX_ROUNDS, Math.max(prevRound, safeNext))
      
      // ✅ CORREÇÃO: Log e appendLog só quando realmente incrementou (shouldIncrementRound E finalRound > prevRound)
      if (shouldIncrementRound && finalRound > prevRound) {
        console.log('[ROUND] allAliveDone=true -> round', prevRound, '->', finalRound)
        appendLog(`🔄 Rodada ${finalRound} iniciada! Todos os jogadores vivos passaram pela casa de faturamento.`)
      }
      
      // ✅ CORREÇÃO: Log obrigatório quando round muda
      if (finalRound !== prevRound) {
        console.log('[ROUND]', prevRound, '->', finalRound)
      }
      
      // ✅ CORREÇÃO: Atualiza o ref com o valor final para uso futuro
      currentRoundRef.current = finalRound
      
      return finalRound
    })
    
    // ✅ CORREÇÃO: Armazena os dados do próximo turno para uso na função tick
    // IMPORTANTE: Não atualiza turnIdx ainda - isso será feito pelo tick quando todas as modais fecharem
    // IMPORTANTE: Usa nextRound calculado acima (pode ser diferente de round se todos passaram pela casa 0)
    // ✅ FIX: pendingTurnDataRef deve carregar EXATAMENTE a rodada calculada
    // (nunca somar +1 aqui, senão o tick/broadcast sai com round errado)
    const finalNextRound = nextRound
    const finalNextFlags = nextFlags
    // ✅ CORREÇÃO MULTIPLAYER: Calcula turnPlayerId do próximo jogador (fonte autoritativa)
    const nextPlayer = nextPlayers[nextTurnIdx]
    const nextTurnPlayerId = nextPlayer?.id ? String(nextPlayer.id) : null
    pendingTurnDataRef.current = {
      nextPlayers,
      nextTurnIdx,
      nextTurnPlayerId, // ✅ CORREÇÃO: turnPlayerId do próximo jogador
      nextRound: finalNextRound,
      nextRoundFlags: finalNextFlags,
      timestamp: Date.now(),
      shouldIncrementRound,
      endGame: shouldEndGameAfterTick
    }
    console.log('[DEBUG] 📝 pendingTurnDataRef preenchido - próximo turno:', nextTurnIdx, 'rodada atual:', round, 'próxima rodada:', finalNextRound, 'nextRound calculado:', nextRound, 'shouldIncrementRound:', shouldIncrementRound, 'rodada foi incrementada?', nextRound > round, 'roundFlags:', finalNextFlags.map((f, i) => `${nextPlayers[i]?.name}:${f}`).join(', '))
    
    // NÃO muda o turno aqui - aguarda todas as modais serem fechadas
    // O turno será mudado na função tick() quando modalLocks === 0
    // ✅ CORREÇÃO: Finalização por rodada será detectada no tick() quando shouldIncrementRound && nextRound > MAX_ROUNDS

    const landedOneBased = newPos + 1
    const crossedStart1 = crossedTile(oldPos, newPos, 0)
    const crossedExpenses23 = crossedTile(oldPos, newPos, 22)

    // ================== Regras por casas (modais) ==================

    // ✅ CORREÇÃO: Flag para indicar que uma modal será aberta (setada antes de abrir)
    let willOpenModal = false

    // ERP
    const isErpTile = (landedOneBased === 6 || landedOneBased === 16 || landedOneBased === 32 || landedOneBased === 49)
    if (isErpTile && isMyTurn && pushModal && awaitTop) {
      willOpenModal = true
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const currentErpLevel = players[curIdx]?.erpLevel || null
        const erpOwned = players[curIdx]?.erpOwned || players[curIdx]?.erp || {}
        const res = await openModalAndWait(<ERPSystemsModal 
          currentCash={nextPlayers[curIdx]?.cash ?? myCash}
          currentLevel={currentErpLevel}
          erpOwned={erpOwned}
        />)
        if (!res || res.action !== 'BUY') return
        const price = Number(res.values?.compra || 0)
        if (!requireFunds(curIdx, price, 'comprar ERP')) { setTurnLockBroadcast(false); return }
        setPlayers(ps => {
          const upd = mapById(ps, ownerId, (p) => applyDeltas(p, { cashDelta: -price, erpLevelSet: res.level }))
          // ✅ CORREÇÃO: Usa turnIdx e round atuais (não nextTurnIdx/nextRound) para compras durante o turno
          broadcastState(upd, turnIdx, currentRoundRef.current)
          return upd
        })
      })()
    }

    // Treinamento
    const isTrainingTile = (landedOneBased === 2 || landedOneBased === 11 || landedOneBased === 19 || landedOneBased === 47)
    if (isTrainingTile && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const ownerForTraining = players.find(isMine) || nextPlayers[curIdx]
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
        if (!res || res.action !== 'BUY') return
        const trainCost = Number(res.grandTotal || 0)
        if (!requireFunds(curIdx, trainCost, 'comprar Treinamento')) { setTurnLockBroadcast(false); return }
          setPlayers(ps => {
          const upd = mapById(ps, ownerId, (p) => applyTrainingPurchase(p, res))
            // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
            broadcastState(upd, turnIdx, currentRoundRef.current)
            return upd
          })
      })()
    }

    // Compra direta (menu)
    const isDirectBuyTile = (landedOneBased === 5 || landedOneBased === 10 || landedOneBased === 43)
    if (isDirectBuyTile && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const cashNow = nextPlayers[curIdx]?.cash ?? myCash

        const res = await openModalAndWait(<DirectBuyModal currentCash={cashNow} />)
        if (!res) return

        if (res.action === 'OPEN') {
          const open = String(res.open || '').toUpperCase()

          if (open === 'MIX') {
            const currentMixLevel = players[curIdx]?.mixProdutos || null
            const mixOwned = players[curIdx]?.mixOwned || players[curIdx]?.mix || {}
            const r2 = await openModalAndWait(<MixProductsModal 
              currentCash={nextPlayers[curIdx]?.cash ?? myCash}
              currentLevel={currentMixLevel}
              mixOwned={mixOwned}
            />)
            if (r2 && r2.action === 'BUY') {
              const price = Number(r2.compra || 0)
              const level = String(r2.level || 'D')
              if (!requireFunds(curIdx, price, 'comprar MIX')) { setTurnLockBroadcast(false); return }
              const cost = Math.max(0, -(-price)) // mantém padrão: custo positivo
              setPlayers(ps => {
                const upd = mapById(ps, ownerId, (p) => applyDeltas(p, {
                    cashDelta: -price,
                    // ✅ BUG 2 FIX: compra de MIX vira patrimônio (bens)
                    bensDelta: cost,
                    mixProdutosSet: level,
                    mixBaseSet: {
                      despesaPorCliente: Number(r2.despesa || 0),
                      faturamentoPorCliente: Number(r2.faturamento || 0),
                    }
                  }))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, currentRoundRef.current); return upd
              })
            }
            return
          }

          if (open === 'MANAGER') {
            const r2 = await openModalAndWait(<ManagerModal currentCash={nextPlayers[curIdx]?.cash ?? myCash} />)
            if (r2 && (r2.action === 'BUY' || r2.action === 'HIRE')) {
              const qty  = Number(r2.headcount ?? r2.qty ?? r2.managersQty ?? 1)
              const cashDelta = Number(
                (typeof r2.cashDelta !== 'undefined'
                  ? r2.cashDelta
                  : -(Number(r2.cost ?? r2.total ?? r2.totalHire ?? 0)))
              )
              const payAbs = cashDelta < 0 ? -cashDelta : 0
              if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Gestor')) { setTurnLockBroadcast(false); return }
              const mexp = Number(r2.expenseDelta ?? r2.totalExpense ?? r2.maintenanceDelta ?? 0)
              setPlayers(ps => {
                const upd = mapById(ps, ownerId, (p) => applyDeltas(p, {
                  cashDelta,
                  gestoresDelta: qty,
                  manutencaoDelta: mexp
                }))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, currentRoundRef.current); return upd
              })
            }
            return
          }

          if (open === 'INSIDE') {
            const r2 = await openModalAndWait(<InsideSalesModal currentCash={nextPlayers[curIdx]?.cash ?? myCash} />)
            if (r2 && (r2.action === 'BUY' || r2.action === 'HIRE')) {
              const cost = Number(r2.cost ?? r2.total ?? 0)
              if (!requireFunds(curIdx, cost, 'contratar Inside Sales')) { setTurnLockBroadcast(false); return }
              const qty  = Number(r2.headcount ?? r2.qty ?? 1)
              setPlayers(ps => {
                const upd = mapById(ps, ownerId, (p) => applyDeltas(p, { cashDelta: -cost, insideSalesDelta: qty }))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, currentRoundRef.current); return upd
              })
            }
            return
          }

          if (open === 'FIELD') {
            const r2 = await openModalAndWait(<FieldSalesModal currentCash={nextPlayers[curIdx]?.cash ?? myCash} />)
            if (r2 && (r2.action === 'HIRE' || r2.action === 'BUY')) {
              const qty = Number(r2.headcount ?? r2.qty ?? 1)
              const deltas = {
                cashDelta: Number(r2.cashDelta ?? -(Number(r2.totalHire ?? r2.total ?? r2.cost ?? 0))),
                manutencaoDelta: Number(r2.expenseDelta ?? r2.totalExpense ?? 0),
                revenueDelta: Number(r2.revenueDelta ?? 0),
                fieldSalesDelta: qty,
              }
              const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
              if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Field Sales')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = mapById(ps, ownerId, (p) => applyDeltas(p, deltas))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, currentRoundRef.current); return upd
              })
            }
            return
          }

          if (open === 'COMMON') {
            const r2 = await openModalAndWait(<BuyCommonSellersModal currentCash={nextPlayers[curIdx]?.cash ?? myCash} />)
            if (r2 && r2.action === 'BUY') {
              const qty  = Number(r2.headcount ?? r2.qty ?? 0)
              const deltas = {
                cashDelta: Number(r2.cashDelta ?? -(Number(r2.totalHire ?? r2.total ?? r2.cost ?? 0))),
                vendedoresComunsDelta: qty,
                manutencaoDelta: Number(r2.expenseDelta ?? r2.totalExpense ?? 0),
                revenueDelta: Number(r2.revenueDelta ?? 0),
              }
              const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
              if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Vendedores Comuns')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = mapById(ps, ownerId, (p) => applyDeltas(p, deltas))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, currentRoundRef.current); return upd
              })
            }
            return
          }

          if (open === 'ERP') {
            const currentErpLevel = players[curIdx]?.erpLevel || null
            const erpOwned = players[curIdx]?.erpOwned || players[curIdx]?.erp || {}
            const r2 = await openModalAndWait(<ERPSystemsModal 
              currentCash={nextPlayers[curIdx]?.cash ?? myCash}
              currentLevel={currentErpLevel}
              erpOwned={erpOwned}
            />)
            if (r2 && r2.action === 'BUY') {
              const price = Number(r2.values?.compra || 0)
              if (!requireFunds(curIdx, price, 'comprar ERP')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = mapById(ps, ownerId, (p) => applyDeltas(p, { cashDelta: -price, erpLevelSet: r2.level }))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, currentRoundRef.current); return upd
              })
            }
            return
          }

          if (open === 'CLIENTS') {
            const buyerCash = Number(nextPlayers.find(p => String(p.id) === ownerId)?.cash ?? myCash)
            const r2 = await openModalAndWait(<ClientsModal currentCash={buyerCash} />)
            if (r2 && r2.action === 'BUY') {
              const cost  = Number(r2.totalCost || 0)
              if (buyerCash < cost) {
                appendLog('Saldo insuficiente para comprar Clientes.')
                setTurnLockBroadcast(false)
                return
              }
              const qty   = Number(r2.qty || 0)
              const mAdd  = Number(r2.maintenanceDelta || 0)
              const bensD = Number(r2.bensDelta || cost)

              setPlayers(ps => {
                const upd = ps.map(p =>
                  String(p.id) !== ownerId
                    ? p
                    : applyDeltas(p, {
                  cashDelta: -cost,
                  clientsDelta: qty,
                  manutencaoDelta: mAdd,
                  bensDelta: bensD
                      })
                )
                broadcastState(upd, turnIdx, currentRoundRef.current)
                return upd
              })
            }
            return
          }

          if (open === 'TRAINING') {
            const ownerForTraining = players.find(isMine) || nextPlayers[curIdx]
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
            if (r2 && r2.action === 'BUY') {
              const trainCost = Number(r2.grandTotal || 0)
              if (!requireFunds(curIdx, trainCost, 'comprar Treinamento')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = mapById(ps, ownerId, (p) => applyTrainingPurchase(p, r2))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, currentRoundRef.current); return upd
              })
            }
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
            const buyerCash = Number(nextPlayers.find(p => String(p.id) === ownerId)?.cash ?? myCash)
            if (buyerCash < cost) { appendLog('Saldo insuficiente para comprar Clientes.'); setTurnLockBroadcast(false); return }
            const qty   = Number(res.clientsQty ?? res.numClients ?? res.qty ?? 0)
            const mAdd  = Number(res.maintenanceDelta ?? res.maintenance ?? res.mexp ?? 0)
            const bensD = Number(res.bensDelta ?? cost)

            setPlayers(ps => {
              const upd = ps.map(p =>
                String(p.id) !== ownerId
                  ? p
                  : applyDeltas(p, {
                      cashDelta: -cost,
                      clientsDelta: qty,
                      manutencaoDelta: mAdd,
                      bensDelta: bensD
                    })
              )
              // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
              broadcastState(upd, turnIdx, currentRoundRef.current)
              return upd
            })
            return
          }

          const total = Number(res.total ?? res.amount ?? 0)
          if (!requireFunds(curIdx, total, 'esta compra')) { setTurnLockBroadcast(false); return }
          setPlayers(ps => {
            const upd = ps.map((p, i) =>
              i !== curIdx
                ? p
                : applyDeltas(p, {
                    cashDelta: -total,
                    directBuysPush: [ (res.item || { total }) ]
                  })
            )
            // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
            broadcastState(upd, turnIdx, currentRoundRef.current)
            return upd
          })
        }
      })()
    }

    // Inside Sales (casa específica)
    const isInsideTile = (landedOneBased === 12 || landedOneBased === 21 || landedOneBased === 30 || landedOneBased === 42 || landedOneBased === 53)
    if (isInsideTile && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const res = await openModalAndWait(<InsideSalesModal currentCash={nextPlayers[curIdx]?.cash ?? myCash} />)
        if (!res || (res.action !== 'HIRE' && res.action !== 'BUY')) return
        const cost = Number(res.cost ?? res.total ?? 0)
        if (!requireFunds(curIdx, cost, 'contratar Inside Sales')) { setTurnLockBroadcast(false); return }
        const qty  = Number(res.headcount ?? res.qty ?? 1)
        setPlayers(ps => {
          const upd = mapById(ps, ownerId, (p) => applyDeltas(p, { cashDelta: -cost, insideSalesDelta: qty }))
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
          broadcastState(upd, turnIdx, currentRoundRef.current)
          return upd
        })
      })()
    }

    // Clientes
    const isClientsTile = [4,8,15,17,20,27,34,36,39,46,52,55].includes(landedOneBased)
    if (isClientsTile && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const buyerCash = Number(nextPlayers.find(p => String(p.id) === ownerId)?.cash ?? myCash)
        const res = await openModalAndWait(<ClientsModal currentCash={buyerCash} />)
        if (!res || res.action !== 'BUY') return

        const cost  = Number(res.totalCost || 0)
        if (buyerCash < cost) {
          appendLog('Saldo insuficiente para comprar Clientes.')
          setTurnLockBroadcast(false)
          return
        }

        const qty   = Number(res.qty || 0)
        const mAdd  = Number(res.maintenanceDelta || 0)
        const bensD = Number(res.bensDelta || cost)

        setPlayers(ps => {
          const upd = ps.map(p =>
            String(p.id) !== ownerId
              ? p
              : applyDeltas(p, {
                  cashDelta: -cost,
                  clientsDelta: qty,
                  manutencaoDelta: mAdd,
                  bensDelta: bensD
                })
          )
          broadcastState(upd, turnIdx, currentRoundRef.current)
          return upd
        })
      })()
    }

    // Gestor
    const isManagerTile = [18,24,29,51].includes(landedOneBased)
    if (isManagerTile && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const res = await openModalAndWait(<ManagerModal currentCash={nextPlayers[curIdx]?.cash ?? myCash} />)
        if (!res || (res.action !== 'BUY' && res.action !== 'HIRE')) return
        const qty  = Number(res.headcount ?? res.qty ?? res.managersQty ?? 1)
        const cashDelta = Number(
          (typeof res.cashDelta !== 'undefined'
            ? res.cashDelta
            : -(Number(res.cost ?? res.total ?? res.totalHire ?? 0)))
        )
        const payAbs = cashDelta < 0 ? -cashDelta : 0
        if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Gestor')) { setTurnLockBroadcast(false); return }
        const mexp = Number(res.expenseDelta ?? res.totalExpense ?? res.maintenanceDelta ?? 0)
        setPlayers(ps => {
          const upd = mapById(ps, ownerId, (p) => applyDeltas(p, { cashDelta, gestoresDelta: qty, manutencaoDelta: mexp }))
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
          broadcastState(upd, turnIdx, currentRoundRef.current)
          return upd
        })
      })()
    }

    // Field Sales
    const isFieldTile = [13,25,33,38,50].includes(landedOneBased)
    if (isFieldTile && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const res = await openModalAndWait(<FieldSalesModal currentCash={nextPlayers[curIdx]?.cash ?? myCash} />)
        if (res && (res.action === 'HIRE' || res.action === 'BUY')) {
          const qty = Number(res.headcount ?? res.qty ?? 1)
          const deltas = {
            cashDelta: Number(res.cashDelta ?? -(Number(res.totalHire ?? res.total ?? res.cost ?? 0))),
            manutencaoDelta: Number(res.expenseDelta ?? res.totalExpense ?? 0),
            revenueDelta: Number(res.revenueDelta ?? 0),
            fieldSalesDelta: qty,
          }
          const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
          if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Field Sales')) { setTurnLockBroadcast(false); return }
          setPlayers(ps => {
            const upd = mapById(ps, ownerId, (p) => applyDeltas(p, deltas))
            // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
            broadcastState(upd, turnIdx, currentRoundRef.current)
            return upd
          })
        }
      })()
    }

    // Vendedores Comuns
    const isCommonSellersTile = [9,28,40,45].includes(landedOneBased)
    if (isCommonSellersTile && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const res = await openModalAndWait(<BuyCommonSellersModal currentCash={nextPlayers[curIdx]?.cash ?? myCash} />)
        if (!res || res.action !== 'BUY') return
        const qty  = Number(res.headcount ?? res.qty ?? 0)
        const deltas = {
          cashDelta: Number(res.cashDelta ?? -(Number(res.totalHire ?? res.total ?? res.cost ?? 0))),
          vendedoresComunsDelta: qty,
          manutencaoDelta: Number(res.expenseDelta ?? res.totalExpense ?? 0),
          revenueDelta: Number(res.revenueDelta ?? 0),
        }
        const payAbs = deltas.cashDelta < 0 ? -deltas.cashDelta : 0
        if (payAbs > 0 && !requireFunds(curIdx, payAbs, 'contratar Vendedores Comuns')) { setTurnLockBroadcast(false); return }
        setPlayers(ps => {
          const upd = mapById(ps, ownerId, (p) => applyDeltas(p, deltas))
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
          broadcastState(upd, turnIdx, currentRoundRef.current)
          return upd
        })
      })()
    }

    // Mix de Produtos
    const isMixTile = [7,31,44].includes(landedOneBased)
    if (isMixTile && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const currentMixLevel = players[curIdx]?.mixProdutos || null
        const mixOwned = players[curIdx]?.mixOwned || players[curIdx]?.mix || {}
        const res = await openModalAndWait(<MixProductsModal 
          currentCash={nextPlayers[curIdx]?.cash ?? myCash}
          currentLevel={currentMixLevel}
          mixOwned={mixOwned}
        />)
        if (!res || res.action !== 'BUY') return
        const price = Number(res.compra || 0)
        if (!requireFunds(curIdx, price, 'comprar MIX')) { setTurnLockBroadcast(false); return }
        const level = String(res.level || 'D')
        const cost = Math.max(0, price)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx
              ? p
              : applyDeltas(p, {
                  cashDelta: -price,
                  // ✅ BUG 2 FIX: compra de MIX vira patrimônio (bens)
                  bensDelta: cost,
                  mixProdutosSet: level,
                  mixBaseSet: {
                    despesaPorCliente: Number(res.despesa || 0),
                    faturamentoPorCliente: Number(res.faturamento || 0),
                  },
                })
          )
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
          broadcastState(upd, turnIdx, currentRoundRef.current)
          return upd
        })
      })()
    }

    // ====== EVENTOS SEQUENCIAIS POR ROLL (sem IIFEs concorrentes) ======
    // Ordem garantida: eventos cruzados (Faturamento/Despesas) -> evento da casa final (Sorte & Revés)
    const isLuckMisfortuneTile = [3,14,22,26,35,41,48,54].includes(landedOneBased)
    const canRunSequenced = isMyTurn && !!pushModal && !!awaitTop
    if (canRunSequenced && (crossedStart1 || crossedExpenses23 || isLuckMisfortuneTile)) {
      const td = pendingTurnDataRef.current
      td._once = td._once || {}

      const forwardDist = (from, to, len) => {
        const d = (to - from + len) % len
        return d === 0 ? len : d
      }

      const events = []
      if (crossedStart1 && !td._once.faturamento) {
        td._once.faturamento = true
        events.push({ type: 'REVENUE', at: forwardDist(oldPos, 0, TRACK_LEN) })
      }
      if (crossedExpenses23 && !td._once.expenses23) {
        td._once.expenses23 = true
        events.push({ type: 'EXPENSES', at: forwardDist(oldPos, 22, TRACK_LEN) })
      }
      if (isLuckMisfortuneTile && !td._once.luck) {
        td._once.luck = true
        events.push({ type: 'LUCK', at: steps })
      }

      events.sort((a, b) => a.at - b.at)

      enqueueAction(async () => {
        let localPlayers = Array.isArray(playersRef.current) ? playersRef.current : nextPlayers
        for (const ev of events) {
          const meNow = getById(localPlayers, ownerId) || {}
          if (!meNow?.id) break

          if (ev.type === 'REVENUE') {
            openingModalRef.current = true
            const fat = Math.max(0, Math.floor(computeFaturamentoFor(meNow)))
            await openModalAndWait(<FaturamentoDoMesModal value={fat} />)
            localPlayers = mapById(localPlayers, ownerId, (p) => ({ ...p, cash: (Number(p.cash) || 0) + fat }))
            setPlayers(localPlayers)
            broadcastState(localPlayers, turnIdxRef.current, currentRoundRef.current)
            appendLog(`${meNow.name} recebeu faturamento do mês: +$${fat.toLocaleString()}`)
            continue
          }

          if (ev.type === 'EXPENSES') {
            openingModalRef.current = true
            const expense = Math.max(0, Math.floor(computeDespesasFor(meNow)))
            const lp = meNow.loanPending || {}
            const shouldChargeLoan = Number(lp.amount) > 0 && !lp.charged && (lp.shouldChargeOnNextExpenses === true)
            const loanCharge = shouldChargeLoan ? Math.max(0, Math.floor(Number(lp.amount))) : 0

            await openModalAndWait(<DespesasOperacionaisModal expense={expense} loanCharge={loanCharge} />)
            const totalCharge = expense + loanCharge
            const ok = await handleInsufficientFunds(totalCharge, 'Despesas Operacionais', 'pagar', localPlayers)
            if (!ok) return

            // Sincroniza snapshot local (handleInsufficientFunds pode ter feito recovery)
            localPlayers = Array.isArray(playersRef.current) ? playersRef.current : localPlayers

            if (shouldChargeLoan) {
              localPlayers = mapById(localPlayers, ownerId, (p) => ({
                ...p,
                loanPending: {
                  ...(p.loanPending || {}),
                  charged: true,
                  chargedAtRound: currentRoundRef.current,
                  shouldChargeOnNextExpenses: false,
                },
              }))
              setPlayers(localPlayers)
              broadcastState(localPlayers, turnIdxRef.current, currentRoundRef.current)
            }

            appendLog(`${meNow.name} pagou despesas operacionais: -$${expense.toLocaleString()}`)
            if (loanCharge > 0) appendLog(`${meNow.name} teve empréstimo cobrado: -$${loanCharge.toLocaleString()}`)
            continue
          }

          if (ev.type === 'LUCK') {
            openingModalRef.current = true
            const curPlayer =
              getById(Array.isArray(playersRef.current) ? playersRef.current : localPlayers, ownerId) ||
              getById(localPlayers, ownerId) ||
              meNow
            const res = await openModalAndWait(<SorteRevesModal player={curPlayer} />)
            if (!res || res.action !== 'APPLY_CARD') continue

            let cashDelta = Number.isFinite(res.cashDelta) ? Number(res.cashDelta) : 0
            const clientsDelta = Number.isFinite(res.clientsDelta) ? Number(res.clientsDelta) : 0

            // ✅ Revés sem cash: usa recuperação e, se falhar, pode levar a falência (handleInsufficientFunds retorna false)
        if (cashDelta < 0) {
              const ok = await handleInsufficientFunds(Math.abs(cashDelta), 'Sorte & Revés', 'pagar', localPlayers)
              if (!ok) return
              cashDelta = 0 // ✅ evita cobrar 2x
              localPlayers = Array.isArray(playersRef.current) ? playersRef.current : localPlayers
            }

            localPlayers = mapById(localPlayers, ownerId, (p) => {
            let next = { ...p }
              if (cashDelta) next.cash = Math.max(0, (Number(next.cash) || 0) + cashDelta)
              if (clientsDelta) next.clients = Math.max(0, (Number(next.clients) || 0) + clientsDelta)
            if (res.gainSpecialCell) {
              next.fieldSales = (next.fieldSales || 0) + (res.gainSpecialCell.fieldSales || 0)
                next.support = (next.support || 0) + (res.gainSpecialCell.support || 0)
                next.gestores = (next.gestores || 0) + (res.gainSpecialCell.manager || 0)
              next.gestoresComerciais = (next.gestoresComerciais || 0) + (res.gainSpecialCell.manager || 0)
                next.managers = (next.managers || 0) + (res.gainSpecialCell.manager || 0)
            }
            if (res.id === 'casa_change_cert_blue') {
              next.az = (next.az || 0) + 1
              const curSet = new Set((next.trainingsByVendor?.comum || []))
              curSet.add('personalizado')
              next.trainingsByVendor = { ...(next.trainingsByVendor || {}), comum: Array.from(curSet) }
            }
            return next
          })
            setPlayers(localPlayers)
            broadcastState(localPlayers, turnIdxRef.current, currentRoundRef.current)

        const anyDerived = res.perClientBonus || res.perCertifiedManagerBonus || res.mixLevelBonusABOnly
        if (anyDerived) {
              const me2 = getById(localPlayers, ownerId) || {}
          let extra = 0
              if (res.perClientBonus) extra += (Number(me2.clients) || 0) * Number(res.perClientBonus || 0)
          if (res.perCertifiedManagerBonus) extra += countManagerCerts(me2) * Number(res.perCertifiedManagerBonus || 0)
          if (res.mixLevelBonusABOnly) {
            const level = String(me2.mixProdutos || '').toUpperCase()
            if (level === 'A' || level === 'B') extra += Number(res.mixLevelBonusABOnly || 0)
          }
          if (extra) {
                localPlayers = mapById(localPlayers, ownerId, (p) => ({ ...p, cash: (Number(p.cash) || 0) + extra }))
                setPlayers(localPlayers)
                broadcastState(localPlayers, turnIdxRef.current, currentRoundRef.current)
              }
            }
          }
        }
      })
    }

    // fail-safe: solta o cadeado quando todas as modais fecharem
    const start = Date.now()
    let tickAttempts = 0
    const maxTickAttempts = 200 // Limita a 20 segundos (200 * 100ms)
    
    const tick = () => {
      tickAttempts++
      
      // ✅ CORREÇÃO: Limite de tentativas para evitar loop infinito
      if (tickAttempts > maxTickAttempts) {
        console.warn('[DEBUG] ⏰ TIMEOUT - excedeu tentativas máximas, forçando desbloqueio')
        const currentLockOwner = lockOwnerRef.current
        const isLockOwner = String(currentLockOwner || '') === String(myUid)
        if (isLockOwner) {
          setTurnLockBroadcast(false)
          turnChangeInProgressRef.current = false
          // ✅ CORREÇÃO: Força limpeza de modalLocks se estiver travado
          if (modalLocksRef.current > 0) {
            console.warn('[DEBUG] ⚠️ Forçando modalLocks para 0 (timeout)')
            modalLocksRef.current = 0
            setModalLocks(0)
          }
          openingModalRef.current = false
        }
        return
      }
      
      const currentModalLocks = modalLocksRef.current
      const currentOpening = openingModalRef.current || eventsInProgressRef.current
      const currentLockOwner = lockOwnerRef.current
      const isLockOwner = String(currentLockOwner || '') === String(myUid)
      
      console.log('[DEBUG] tick - tentativa:', tickAttempts, 'modalLocks:', currentModalLocks, 'openingModalRef:', currentOpening, 'lockOwner:', currentLockOwner, 'myUid:', myUid, 'isLockOwner:', isLockOwner)
      
      // ✅ CORREÇÃO: Verifica se uma modal está sendo aberta (evita race condition)
      if (currentOpening) {
        console.log('[DEBUG] ⚠️ tick - modal está sendo aberta, aguardando...')
        setTimeout(tick, 150)
        return
      }
      
      // ✅ CORREÇÃO: Só muda turno se realmente não houver modais abertas
      // ✅ CORREÇÃO: Verifica também se passou tempo suficiente desde que a última modal foi fechada
      // Isso garante que todas as modais (incluindo aninhadas) foram completamente fechadas
      const timeSinceLastModalClosed = lastModalClosedTimeRef.current ? (Date.now() - lastModalClosedTimeRef.current) : Infinity
      const minTimeAfterModalClose = 200 // ✅ CORREÇÃO: Aguarda 200ms após fechar a última modal antes de mudar turno
      const canChangeTurn = currentModalLocks === 0 && (timeSinceLastModalClosed >= minTimeAfterModalClose || !lastModalClosedTimeRef.current)
      
      if (canChangeTurn) {
        // ✅ ENDGAME autoritativo: finaliza assim que não houver modais
        const td = pendingTurnDataRef.current
        const shouldEnd = !!(td?.endGame || endGamePendingRef.current)

        if (shouldEnd && !endGameFinalizedRef.current) {
          endGameFinalizedRef.current = true
          endGamePendingRef.current = false

          // pega estado mais recente (inclui faturamento/despesas já aplicados)
          const finalPlayers = Array.isArray(playersRef.current) ? playersRef.current : (td?.nextPlayers || [])
          const alive = (finalPlayers || []).filter(p => !p?.bankrupt)

          // campeão: patrimônio desc, cash desc, nome asc
          let champ = null
          if (alive.length > 0) {
            const ranked = alive
              .map(p => ({
                p,
                patrimonio: (Number(p.cash) || 0) + (Number(p.bens) || 0),
                cash: (Number(p.cash) || 0),
              }))
              .sort((a, b) =>
                (b.patrimonio - a.patrimonio) ||
                (b.cash - a.cash) ||
                String(a.p?.name || '').localeCompare(String(b.p?.name || ''))
              )
            champ = ranked[0]?.p || null
          }

          console.log('[ENDGAME] finalizando: vencedor=%s, round=5', champ?.name || '—')

          // estado final local (obrigatório)
          setPlayers(finalPlayers || [])
          setGameOver(true)
          setWinner(champ)
          setRound(5)
          currentRoundRef.current = 5

          // limpa pendências / destrava / não avança turno
          pendingTurnDataRef.current = null
          turnChangeInProgressRef.current = false
          openingModalRef.current = false
          setTurnLockBroadcast(false)

          // propaga para todos (obrigatório)
          broadcastState(finalPlayers || [], turnIdxRef.current, 5, true, champ, {
            round: 5,
            gameOver: true,
            winner: champ,
          })

          return
        }

        // ✅ CORREÇÃO: Verifica se o turnIdx atual corresponde ao lockOwner
        // Se o turno mudou via SYNC, o lockOwner pode estar desatualizado
        const currentPlayer = players[turnIdx]
        const isCurrentPlayerMe = currentPlayer && String(currentPlayer.id) === String(myUid)
        
        // libera apenas se EU for o dono do cadeado OU se é minha vez e não há lockOwner
        if (isLockOwner || (isCurrentPlayerMe && !currentLockOwner)) {
          // Agora muda o turno quando todas as modais são fechadas
          const turnData = pendingTurnDataRef.current
          console.log('[DEBUG] 🔍 tick - verificando pendingTurnDataRef:', turnData ? `próximo turno: ${turnData.nextTurnIdx}` : 'null')
          if (turnData) {
            const latestPlayers =
              (Array.isArray(playersRef.current) && playersRef.current.length)
                ? playersRef.current
                : (turnData.nextPlayers || [])

            // ✅ CORREÇÃO: Verifica novamente se não há modais abertas ou sendo abertas (double-check)
            const finalModalLocks = modalLocksRef.current
            const finalOpening = openingModalRef.current
            // ✅ CORREÇÃO: Verifica se o turnIdx ainda é o mesmo (não mudou via SYNC)
            const finalTurnIdx = turnIdx
            const finalLockOwner = lockOwnerRef.current
            const finalIsLockOwner = String(finalLockOwner || '') === String(myUid)
            
            // ✅ CORREÇÃO: Verifica também se passou tempo suficiente desde que a última modal foi fechada
            const finalTimeSinceLastModalClosed = lastModalClosedTimeRef.current ? (Date.now() - lastModalClosedTimeRef.current) : Infinity
            const finalCanChangeTurn = finalModalLocks === 0 && !finalOpening && (finalTimeSinceLastModalClosed >= 200 || !lastModalClosedTimeRef.current)
            
              // ✅ CORREÇÃO: Verifica se ainda sou o dono do lock (pode ter mudado via SYNC)
              if (finalCanChangeTurn && finalTurnIdx === turnIdx && finalIsLockOwner) {
                console.log('[DEBUG] ✅ Mudando turno - de:', turnIdx, 'para:', turnData.nextTurnIdx, 'finalModalLocks:', finalModalLocks, 'finalOpening:', finalOpening, 'timeSinceLastModalClosed:', finalTimeSinceLastModalClosed)
              
              // ✅ CORREÇÃO C: Detecta finalização por rodada ANTES de mudar turno
              // Condição autoritativa: currentRoundRef.current === 5 E shouldIncrementRound === true
              // OU endGame === true (todos chegaram na rodada 5)
              // (não usa pos/TRACK_LEN - apenas round-based)
              const isEndgameCondition = currentRoundRef.current === 5 && turnData.shouldIncrementRound
              const isEndgameByFlag = turnData.endGame === true
              if (isEndgameCondition || isEndgameByFlag || (turnData.shouldIncrementRound && turnData.nextRound > MAX_ROUNDS)) {
                console.log('[ENDGAME] detectado: fim da 5ª - currentRound:', currentRoundRef.current, 'shouldIncrementRound:', turnData.shouldIncrementRound, 'nextRound:', turnData.nextRound)
                
                // Chama maybeFinishGame para calcular vencedor
                const finishResult = maybeFinishGame(latestPlayers, turnData.nextRound, turnIdx)
                
                if (finishResult.finished) {
                  console.log('[DEBUG] 🏁 FIM DE JOGO finalizando - Rodada:', finishResult.finalRound, 'Vencedor:', finishResult.winner?.name || null)
                  
                  // Atualiza estado local
                  setPlayers(latestPlayers)
                  setWinner(finishResult.winner)
                  setGameOver(true)
                  setRound(finishResult.finalRound)
                  currentRoundRef.current = finishResult.finalRound
                  appendLog(`Fim de jogo! ${MAX_ROUNDS} rodadas completas. Vencedor: ${finishResult.winner?.name || '—'}`)
                  
                  // Prepara patch para broadcast
                  const patch = {}
                  if (turnData.nextRoundFlags) patch.roundFlags = turnData.nextRoundFlags
                  patch.round = finishResult.finalRound
                  patch.gameOver = true
                  patch.winner = finishResult.winner
                  
                  // Broadcast estado final (não muda turnIdx ao encerrar)
                  broadcastState(latestPlayers, turnIdx, finishResult.finalRound, true, finishResult.winner, patch)
                  
                  // Limpa estado e libera lock
                  pendingTurnDataRef.current = null
                  setTurnLockBroadcast(false)
                  turnChangeInProgressRef.current = false
                  return
                }
              }
              
              // ✅ CORREÇÃO: Marca que mudança de turno está em progresso
              turnChangeInProgressRef.current = true
              
              // ✅ CORREÇÃO: Garante que a rodada seja atualizada antes do broadcast
              // Isso garante que o broadcast sempre use o valor correto da rodada
              const roundToBroadcast = turnData.nextRound
              const shouldIncrement = turnData.shouldIncrementRound || false
              console.log('[DEBUG] 🔄 Broadcast - Rodada a ser transmitida:', roundToBroadcast, 'Rodada atual no estado:', round, 'shouldIncrement:', shouldIncrement)
              
              // ✅ CORREÇÃO: Atualiza turnIdx e rodada antes de fazer broadcast
              // O broadcastState atualiza lastLocalStateRef com o novo turnIdx e rodada, protegendo contra estados remotos antigos
              setTurnIdx(turnData.nextTurnIdx)
              if (setTurnPlayerId) setTurnPlayerId(turnData.nextTurnPlayerId ?? null)
              // ✅ FIX: round monotônico no tick (NUNCA soma +1 aqui)
              // roundToBroadcast já é o valor correto calculado no advanceAndMaybeLap.
              // ✅ PROTEÇÃO DEFENSIVA: Clamp para garantir que nunca exiba round > MAX_ROUNDS
              setRound(prevRound => {
                const safeRoundToBroadcast = Math.min(MAX_ROUNDS, roundToBroadcast)
                const finalRound = Math.min(MAX_ROUNDS, Math.max(prevRound, safeRoundToBroadcast))
                if (finalRound !== prevRound) {
                  console.log('[DEBUG] 🔄 Rodada atualizada no tick - de:', prevRound, 'para:', finalRound)
                }
                currentRoundRef.current = finalRound
                return finalRound
              })
              // ✅ CORREÇÃO: Passa roundFlags atualizado no patch para garantir sincronização
              const patch = {}
              if (turnData.nextRoundFlags) {
                patch.roundFlags = turnData.nextRoundFlags
              }
              if (turnData.shouldIncrementRound) {
                patch.round = roundToBroadcast
              }
              if (turnData.nextTurnPlayerId) {
                patch.turnPlayerId = turnData.nextTurnPlayerId // ✅ CORREÇÃO MULTIPLAYER: turnPlayerId autoritativo
              }
              broadcastState(latestPlayers, turnData.nextTurnIdx, roundToBroadcast, gameOver, winner, patch)
              pendingTurnDataRef.current = null // Limpa os dados após usar
              setTurnLockBroadcast(false)
              turnChangeInProgressRef.current = false
              console.log('[DEBUG] ✅ Turno mudado com sucesso - Rodada:', roundToBroadcast)
            } else {
              console.log('[DEBUG] ⚠️ tick - condições não atendidas, não mudando turno', { 
                finalModalLocks, 
                finalOpening, 
                finalCanChangeTurn,
                timeSinceLastModalClosed: finalTimeSinceLastModalClosed,
                finalTurnIdx, 
                turnIdx,
                finalIsLockOwner,
                isLockOwner
              })
              console.log('[DEBUG] ⚠️ tick - condições não atendidas, não mudando turno', { 
                finalModalLocks, 
                finalOpening, 
                finalTurnIdx, 
                turnIdx,
                finalIsLockOwner,
                isLockOwner
              })
              // Continua verificando
              setTimeout(tick, 150)
              return
            }
          } else {
            console.log('[DEBUG] ⚠️ tick - turnData é null, não mudando turno. turnIdx atual:', turnIdx, 'lockOwner:', currentLockOwner, 'isLockOwner:', isLockOwner)
            // ✅ CORREÇÃO: Se não há turnData mas deveria haver, tenta novamente após um delay
            // Pode ser que o pendingTurnDataRef ainda não foi preenchido
            // ✅ CORREÇÃO: Verifica também se passou tempo suficiente desde que a última modal foi fechada
            const retryTimeSinceLastModalClosed = lastModalClosedTimeRef.current ? (Date.now() - lastModalClosedTimeRef.current) : Infinity
            const retryCanChangeTurn = currentModalLocks === 0 && (retryTimeSinceLastModalClosed >= 200 || !lastModalClosedTimeRef.current)
            
            if (isLockOwner && retryCanChangeTurn && !currentOpening) {
              // ✅ CORREÇÃO: Limita tentativas de retry
              if (tickAttempts < 10) {
                console.log('[DEBUG] ⚠️ tick - tentando novamente em 200ms (pode ser que pendingTurnDataRef ainda não foi preenchido)')
                setTimeout(tick, 200)
                return
              } else {
                console.warn('[DEBUG] ⚠️ tick - excedeu tentativas de retry, liberando turnLock')
                setTurnLockBroadcast(false)
                turnChangeInProgressRef.current = false
              }
            } else {
              setTurnLockBroadcast(false)
              turnChangeInProgressRef.current = false
            }
          }
        } else {
          console.log('[DEBUG] ❌ tick - não sou o dono do cadeado e não é minha vez, não mudando turno', { isLockOwner, isCurrentPlayerMe, currentLockOwner, myUid, turnIdx })
          // ✅ CORREÇÃO: Se não sou o dono e não é minha vez, libera o lock
          if (!isCurrentPlayerMe) {
            setTurnLockBroadcast(false)
            turnChangeInProgressRef.current = false
          }
        }
        return
      }
      
      // Continua verificando a cada 100ms
      setTimeout(tick, 100)
    }
    // ✅ CORREÇÃO: Adiciona um delay inicial maior para garantir que modais abertas sejam detectadas
    // Isso evita que o tick rode antes das modais serem realmente abertas
    // Verifica se há modais sendo abertas antes de iniciar o tick
    let checkAttempts = 0
    const maxCheckAttempts = 50 // Limita a 10 segundos (50 * 200ms)
    const checkBeforeTick = () => {
      checkAttempts++
      const hasOpening = openingModalRef.current
      const hasLocks = modalLocksRef.current > 0
      if ((hasOpening || hasLocks) && checkAttempts < maxCheckAttempts) {
        console.log('[DEBUG] ⚠️ checkBeforeTick - modal sendo aberta ou já aberta, aguardando...', { 
          hasOpening, 
          hasLocks, 
          modalLocks: modalLocksRef.current,
          attempt: checkAttempts 
        })
        setTimeout(checkBeforeTick, 200)
        return
      }
      // ✅ CORREÇÃO: Se excedeu tentativas ou não há modais, força o avanço do turno
      if (checkAttempts >= maxCheckAttempts) {
        console.warn('[DEBUG] ⚠️ checkBeforeTick - excedeu tentativas, forçando avanço do turno', {
          hasOpening,
          hasLocks,
          modalLocks: modalLocksRef.current
        })
        // Força o modalLocks para 0 se estiver travado
        if (modalLocksRef.current > 0) {
          console.warn('[DEBUG] ⚠️ checkBeforeTick - forçando modalLocks para 0')
          modalLocksRef.current = 0
          setModalLocks(0)
        }
        openingModalRef.current = false
      }
      // Só inicia o tick se não houver modais sendo abertas
      console.log('[DEBUG] ✅ checkBeforeTick - iniciando tick, sem modais abertas')
      tick()
    }
    // ✅ CORREÇÃO: Delay maior para dar tempo das modais serem abertas (as modais são abertas de forma assíncrona)
    // As modais são abertas dentro de blocos (async () => { ... })(), então precisamos aguardar
    setTimeout(checkBeforeTick, 500)
  } catch (error) {
    console.error('[DEBUG] Erro em advanceAndMaybeLap:', error)
    // ✅ BUG 2 FIX: Libera turnLock em caso de erro
    if (lockOwnerRef.current === String(myUid)) {
      setTurnLockBroadcast(false)
    }
    throw error
  } finally {
    // ✅ BUG 2 FIX: Garante que turnLock é liberado se ainda estiver preso
    // Usa ref para verificar se ainda é o dono do lock
    if (lockOwnerRef.current === String(myUid)) {
      // Pequeno delay para evitar race condition
      setTimeout(() => {
        if (lockOwnerRef.current === String(myUid)) {
          setTurnLockBroadcast(false)
          turnChangeInProgressRef.current = false
        }
      }, 100)
    } else {
      turnChangeInProgressRef.current = false
    }
  }
  }, [
    players, round, turnIdx, roundFlags, isMyTurn, isMine,
    myUid, myCash, gameOver,
    appendLog, broadcastState,
    setPlayers, setRound, setTurnIdx, setRoundFlags,
    setTurnLockBroadcast, requireFunds, maybeFinishGame,
    pushModal, awaitTop, closeTop
  ])

  // ========= handlers menores =========
  const nextTurn = React.useCallback(() => {
    if (gameOver || !players.length) return
    const nextTurnIdx = findNextAliveIdx(players, turnIdx)
    // ✅ CORREÇÃO MULTIPLAYER: Calcula turnPlayerId do próximo jogador
    const nextPlayer = players[nextTurnIdx]
    const nextTurnPlayerId = nextPlayer?.id ? String(nextPlayer.id) : null
    setTurnIdx(nextTurnIdx)
    if (setTurnPlayerId) setTurnPlayerId(nextTurnPlayerId)
    broadcastState(players, nextTurnIdx, currentRoundRef.current, false, null, {
      turnPlayerId: nextTurnPlayerId // ✅ CORREÇÃO: turnPlayerId autoritativo
    })
  }, [broadcastState, gameOver, players, round, setTurnIdx, setTurnPlayerId, turnIdx])

  const onAction = React.useCallback((act) => {
    if (!act?.type || gameOverRef.current || endGamePendingRef.current || endGameFinalizedRef.current) return

    if (act.type === 'ROLL'){
      // ✅ CORREÇÃO: Single-writer - apenas o jogador da vez pode rolar
      if (!isMyTurn) {
        console.warn('[DEBUG] ⚠️ onAction ROLL - não é minha vez, ignorando')
        return
      }
      // ✅ CORREÇÃO: Verifica turnLock antes de executar
      if (turnLock) {
        console.warn('[DEBUG] ⚠️ onAction ROLL - turnLock ativo, ignorando')
        return
      }
      // ✅ CORREÇÃO: Verifica modalLocks antes de executar
      if (modalLocksRef.current > 0) {
        console.warn('[DEBUG] ⚠️ onAction ROLL - há modais abertas, ignorando')
        return
      }

      // ===== ENGINE V2 (DESLIGADO por padrão) =====
      // Nesta etapa, o V2 ainda é conservador e não substitui toda a lógica de modais/commit.
      // A migração real será feita por "events" em `runEvents` (effects).
      if (ENGINE_V2) {
        try {
          const snapshot = {
            players,
            turnIdx,
            // turnPlayerId é fonte autoritativa no App; aqui usamos current?.id como fallback conservador
            turnPlayerId: String(current?.id ?? players?.[turnIdx]?.id ?? ''),
            turnLock: !!turnLock,
            lockOwner,
          }
          const { nextState, events } = reduceGame(snapshot, { type: 'ROLL', steps: act.steps }, { myUid, trackLen: TRACK_LEN })
          if (nextState?.players) setPlayers(nextState.players)
          // efeitos noop seguros nesta etapa (não abre modal nem commita)
          runEvents(events, { logger: console })
        } catch (e) {
          console.error('[ENGINE_V2] erro, caindo no fallback legacy:', e)
          // fallback legacy
          try { advanceAndMaybeLap(act.steps, act.cashDelta, act.note) } catch {}
        }
        return
      }

      // ✅ BUG 2 FIX: try/finally para garantir liberação de turnLock
      try {
        advanceAndMaybeLap(act.steps, act.cashDelta, act.note)
      } catch (error) {
        console.error('[DEBUG] Erro em advanceAndMaybeLap:', error)
        // Libera turnLock em caso de erro
        if (lockOwnerRef.current === String(myUid)) {
          setTurnLockBroadcast(false)
        }
      }
      return
    }

    if (act.type === 'RECOVERY'){
      const recover = Math.floor(Math.random()*3000)+1000
      const cur = players.find(isMine)
      if (!cur) return
      const nextPlayers = players.map(p => (isMine(p) ? { ...p, cash: p.cash + recover } : p))
      appendLog(`${cur.name} ativou Recuperação Financeira (+$${recover})`)
      setPlayers(nextPlayers)
      broadcastState(nextPlayers, turnIdx, currentRoundRef.current)
      // ✅ CORREÇÃO: Não destrava o turno - jogador continua no seu turno após recuperação
      // setTurnLockBroadcast(false)
      return
    }

    if (act.type === 'RECOVERY_CUSTOM'){
      const amount = Number(act.amount || 0)
      const cur = players.find(isMine)
      if (!cur) return
      const nextPlayers = players.map(p => (isMine(p) ? { ...p, cash: p.cash + amount } : p))
      appendLog(`${cur.name} recuperou +$${amount}`)
      setPlayers(nextPlayers)
      broadcastState(nextPlayers, turnIdx, currentRoundRef.current)
      // ✅ CORREÇÃO: Não destrava o turno - jogador continua no seu turno após recuperação
      // setTurnLockBroadcast(false)
      return
    }

    if (act.type === 'RECOVERY_MODAL') {
      if (!isMyTurn || !pushModal || !awaitTop) return
      ;(async () => {
        const res = await openModalAndWait(<RecoveryModal playerName={current?.name || 'Jogador'} currentPlayer={current} />)
        if (!res) return

        if (res && res.type === 'TRIGGER_BANKRUPTCY') {
          // Fecha o fluxo atual e dispara a falência real
          onAction({ type: 'BANKRUPT' })
          return
        }

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
        const ok = await openModalAndWait(<BankruptcyModal playerName={current?.name || 'Jogador'} />)
        if (ok) onAction?.({ type: 'BANKRUPT' })
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
      const ownerIdNow = String(players[curIdx]?.id ?? '')
      setPlayers(ps => {
        const upd = ownerIdNow ? mapById(ps, ownerIdNow, (p) => applyDeltas(p, deltas)) : ps
        broadcastState(upd, turnIdx, currentRoundRef.current);
        return upd;
      });

      appendLog(`${players[curIdx]?.name || 'Jogador'}: ${act.note || 'Demissões'}`);
      // ✅ CORREÇÃO: Não destrava o turno - jogador continua no seu turno após recuperação
      // setTurnLockBroadcast(false);
      return;
    }

    if (act.type === 'RECOVERY_LOAN') {
      const amt = Math.max(0, Number(act.amount || 0));
      if (!amt) { 
        // ✅ CORREÇÃO: Não destrava o turno - jogador continua no seu turno
        // setTurnLockBroadcast(false); 
        return; 
      }

      const curIdx = turnIdx;
      const cur = players[curIdx];

      if (cur?.loanPending && !cur.loanPending.charged) {
        appendLog(`${cur?.name || 'Jogador'} já possui um empréstimo pendente.`);
        // ✅ CORREÇÃO: Não destrava o turno - jogador continua no seu turno
        // setTurnLockBroadcast(false);
        return;
      }

      // ✅ CORREÇÃO: Empréstimo será cobrado na próxima vez que passar pela casa de despesas operacionais
      setPlayers(ps => {
        const upd = ps.map((p, i) =>
          i !== curIdx
            ? p
            : {
                ...p,
                cash: (Number(p.cash) || 0) + amt,
                loanPending: { 
                  amount: amt, 
                  charged: false,
                  // ✅ CORREÇÃO: Marca que o empréstimo deve ser cobrado na próxima passagem pela casa de despesas
                  shouldChargeOnNextExpenses: true
                },
              }
        );
        broadcastState(upd, turnIdx, currentRoundRef.current);
        return upd;
      });

      appendLog(`${cur?.name || 'Jogador'} pegou empréstimo: +$${amt.toLocaleString()}`);
      // ✅ CORREÇÃO: Não destrava o turno - jogador continua no seu turno após recuperação
      // setTurnLockBroadcast(false);
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
            // ✅ BUG 2 FIX: custo da compra vira bens (patrimônio), mantendo Saldo + Bens coerente
            bens: (Number(p.bens) || 0) + price,
            mixOwned,
            mix: mixOwned,
            mixLevel: level,
            mixProdutos: level
          };
        });
        broadcastState(upd, turnIdx, currentRoundRef.current);
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
        broadcastState(upd, turnIdx, currentRoundRef.current);
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
            // ✅ CORREÇÃO: Não permite reduzir nível D (básico)
            .filter(s => (s.group === 'MIX' || s.group === 'ERP') && ['A','B','C'].includes(s.level));
        }
        const one = act.selection || act.target || null;
        if (one) {
          const s = {
            group: normGroup(one.group || one.kind),
            level: normLevel(one.level),
            credit: Math.max(0, Number(one.credit ?? one.amount ?? act.amount ?? 0)),
          };
          // ✅ CORREÇÃO: Não permite reduzir nível D (básico)
          if ((s.group === 'MIX' || s.group === 'ERP') && ['A','B','C'].includes(s.level)) {
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
            broadcastState(upd, turnIdx, currentRoundRef.current);
            return upd;
          });
        }
        // ✅ CORREÇÃO: Não destrava o turno - jogador continua no seu turno
        // setTurnLockBroadcast(false);
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

      // ✅ CORREÇÃO: Valida que não está tentando reduzir nível D
      const hasInvalidLevel = selections.some(s => s.level === 'D');
      if (hasInvalidLevel) {
        appendLog('Não é possível reduzir o nível D (básico).');
        return;
      }

      // ✅ CORREÇÃO: Valida que não está tentando reduzir nível já reduzido
      const reducedMix = Array.isArray(cur.reducedLevels?.MIX) ? cur.reducedLevels.MIX : [];
      const reducedErp = Array.isArray(cur.reducedLevels?.ERP) ? cur.reducedLevels.ERP : [];
      const alreadyReduced = selections.some(s => 
        (s.group === 'MIX' && reducedMix.includes(s.level)) ||
        (s.group === 'ERP' && reducedErp.includes(s.level))
      );
      if (alreadyReduced) {
        appendLog('Não é possível reduzir um nível que já foi reduzido anteriormente.');
        return;
      }

      setPlayers(ps => {
        const upd = ps.map((p, i) => {
          if (i !== curIdx) return p;

          let mixOwned = { A:false, B:false, C:false, D:false, ...(p.mixOwned || p.mix || {}) };
          let erpOwned = { A:false, B:false, C:false, D:false, ...(p.erpOwned || p.erp || {}) };

          mixOwned = ensureOwnedFromLetter(mixOwned, p.mixProdutos);
          erpOwned = ensureOwnedFromLetter(erpOwned, p.erpSistemas);

          // ✅ CORREÇÃO: Rastreia níveis reduzidos
          const newReducedMix = [...(Array.isArray(p.reducedLevels?.MIX) ? p.reducedLevels.MIX : [])];
          const newReducedErp = [...(Array.isArray(p.reducedLevels?.ERP) ? p.reducedLevels.ERP : [])];

          let totalCredit = 0;
          let currentMixLevel = String(p.mixProdutos || 'D').toUpperCase();
          let currentErpLevel = String(p.erpLevel || p.erpSistemas || 'D').toUpperCase();

          for (const s of selections) {
            totalCredit += Math.max(0, Number(s.credit || 0));
            if (s.group === 'MIX') {
              // ✅ CORREÇÃO: Se está reduzindo o nível atual, faz downgrade ANTES de remover
              if (s.level === currentMixLevel) {
                // Encontra o próximo nível disponível (B, C ou D)
                const levels = ['A', 'B', 'C', 'D'];
                const currentIdx = levels.indexOf(currentMixLevel);
                for (let idx = currentIdx + 1; idx < levels.length; idx++) {
                  const nextLevel = levels[idx];
                  // Verifica se o próximo nível está disponível (antes de remover o atual)
                  if (mixOwned[nextLevel] || nextLevel === 'D') {
                    currentMixLevel = nextLevel;
                    break;
                  }
                }
              }
              // ✅ CORREÇÃO: Remove completamente do owned (zera a variável)
              delete mixOwned[s.level];
              mixOwned[s.level] = false; // Garante que está explicitamente false
              // ✅ CORREÇÃO: Adiciona à lista de reduzidos (só uma vez por nível)
              if (!newReducedMix.includes(s.level)) {
                newReducedMix.push(s.level);
              }
            } else if (s.group === 'ERP') {
              // ✅ CORREÇÃO: Se está reduzindo o nível atual, faz downgrade ANTES de remover
              if (s.level === currentErpLevel) {
                // Encontra o próximo nível disponível (B, C ou D)
                const levels = ['A', 'B', 'C', 'D'];
                const currentIdx = levels.indexOf(currentErpLevel);
                for (let idx = currentIdx + 1; idx < levels.length; idx++) {
                  const nextLevel = levels[idx];
                  // Verifica se o próximo nível está disponível (antes de remover o atual)
                  if (erpOwned[nextLevel] || nextLevel === 'D') {
                    currentErpLevel = nextLevel;
                    break;
                  }
                }
              }
              // ✅ CORREÇÃO: Remove completamente do owned (zera a variável)
              delete erpOwned[s.level];
              erpOwned[s.level] = false; // Garante que está explicitamente false
              // ✅ CORREÇÃO: Adiciona à lista de reduzidos (só uma vez por nível)
              if (!newReducedErp.includes(s.level)) {
                newReducedErp.push(s.level);
              }
            }
          }

          // ✅ CORREÇÃO: Garante que D sempre esteja disponível se não houver outros níveis
          const hasAnyMix = mixOwned.A || mixOwned.B || mixOwned.C;
          if (!hasAnyMix) {
            mixOwned.D = true;
            // ✅ CORREÇÃO: Se só tem D, garante que está explicitamente true
            mixOwned.A = false;
            mixOwned.B = false;
            mixOwned.C = false;
          }
          const hasAnyErp = erpOwned.A || erpOwned.B || erpOwned.C;
          if (!hasAnyErp) {
            erpOwned.D = true;
            // ✅ CORREÇÃO: Se só tem D, garante que está explicitamente true
            erpOwned.A = false;
            erpOwned.B = false;
            erpOwned.C = false;
          }

          const mixLetter = letterFromOwned(mixOwned);
          const erpLetter = letterFromOwned(erpOwned);

          // ✅ CORREÇÃO: Garante que o nível atual seja atualizado corretamente após redução
          const finalMixLevel = mixLetter !== '-' ? mixLetter : (currentMixLevel || 'D');
          const finalErpLevel = erpLetter !== '-' ? erpLetter : (currentErpLevel || 'D');

          // ✅ CORREÇÃO: Cria novos objetos para garantir que o React detecte a mudança
          const newMixOwned = { ...mixOwned };
          const newErpOwned = { ...erpOwned };

          return {
            ...p,
            cash: (Number(p.cash) || 0) + totalCredit,
            mixOwned: newMixOwned,
            erpOwned: newErpOwned,
            mix: newMixOwned,
            erp: newErpOwned,
            mixProdutos: finalMixLevel,
            erpLevel: finalErpLevel,
            erpSistemas: finalErpLevel,
            // ✅ CORREÇÃO: Salva lista de níveis reduzidos
            reducedLevels: {
              MIX: newReducedMix,
              ERP: newReducedErp,
            },
          };
        });

        broadcastState(upd, turnIdx, currentRoundRef.current);
        return upd;
      });

      const total = selections.reduce((acc, s) => acc + Math.max(0, Number(s.credit || 0)), 0);
      if (selections.length === 1) {
        const s = selections[0];
        appendLog(`${cur?.name || 'Jogador'} reduziu ${s.group} nível ${s.level} e recebeu +$${total.toLocaleString()}`);
      } else {
        appendLog(`${cur?.name || 'Jogador'} reduziu ${selections.length} níveis e recebeu +$${total.toLocaleString()}`);
      }

      // ✅ CORREÇÃO: Não destrava o turno - jogador continua no seu turno após recuperação
      // setTurnLockBroadcast(false);
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
      if (setTurnPlayerId) {
        const np = updatedPlayers[nextIdx]
        setTurnPlayerId(np?.id ? String(np.id) : null)
      }
      setTurnLockBroadcast(false)
      broadcastState(updatedPlayers, nextIdx, currentRoundRef.current)
      console.log('[DEBUG] 🏁 advanceAndMaybeLap finalizada (falência) - posição final:', updatedPlayers[nextIdx]?.pos)
      return
    }
    console.log('[DEBUG] 🏁 advanceAndMaybeLap finalizada normalmente - posição final:', nextPlayers[curIdx]?.pos)
  }, [
    players, round, turnIdx, isMyTurn, isMine, myUid, myCash,
    gameOver, appendLog, broadcastState,
    setPlayers, setRound, setTurnIdx, setTurnLockBroadcast, setGameOver, setWinner,
    requireFunds, pushModal, awaitTop, closeTop, setShowBankruptOverlay
  ])

  // ====== efeitos de destrava automática ======

  // ✅ CORREÇÃO: Este useEffect foi removido - duplicado do anterior
  // A lógica de atualização de lockOwner e limpeza de pendingTurnDataRef
  // está no useEffect anterior (linhas 100-117)

  // a) quando não houver modal aberta e ainda houver lock, tenta destravar
  React.useEffect(() => {
    if (modalLocks === 0 && turnLock && !openingModalRef.current) {
      const currentLockOwner = lockOwnerRef.current
      const isLockOwner = String(currentLockOwner || '') === String(myUid)
      
      if (isLockOwner) {
        console.log('[DEBUG] 🔓 Destravando turnLock - modalLocks: 0, sou o lockOwner')
        setTurnLockBroadcast(false)
        turnChangeInProgressRef.current = false
      } else if (!isMyTurn) {
        // ✅ CORREÇÃO: Se não é minha vez e não sou o lockOwner, libera o turnLock
        // Isso evita que o botão fique travado após sincronização
        console.log('[DEBUG] 🔓 Destravando turnLock - não é minha vez e não sou lockOwner')
        setTurnLockBroadcast(false)
        turnChangeInProgressRef.current = false
      }
    }
  }, [modalLocks, turnLock, lockOwner, myUid, isMyTurn, setTurnLockBroadcast])

  // b) quando virar "minha vez" e não houver modal, garanto unlock local
  React.useEffect(() => {
    if (isMyTurn && modalLocks === 0 && turnLock && !openingModalRef.current) {
      const currentLockOwner = lockOwnerRef.current
      const isLockOwner = String(currentLockOwner || '') === String(myUid)
      
      if (isLockOwner) {
        console.log('[DEBUG] 🔓 Destravando turnLock - é minha vez e sou o lockOwner')
        setTurnLockBroadcast(false)
        turnChangeInProgressRef.current = false
      } else if (!currentLockOwner) {
        // ✅ CORREÇÃO: Se é minha vez mas não há lockOwner, libera o turnLock
        // Isso garante que o botão seja habilitado quando é minha vez
        console.log('[DEBUG] 🔓 Destravando turnLock - é minha vez mas não há lockOwner')
        setTurnLockBroadcast(false)
        turnChangeInProgressRef.current = false
      }
    }
  }, [isMyTurn, modalLocks, turnLock, lockOwner, myUid, setTurnLockBroadcast])
  
  // ✅ CORREÇÃO: Cleanup ao desmontar componente
  React.useEffect(() => {
    return () => {
      // Limpa timeouts e refs ao desmontar
      if (turnLockTimeoutRef.current) {
        clearTimeout(turnLockTimeoutRef.current)
        turnLockTimeoutRef.current = null
      }
      turnChangeInProgressRef.current = false
      openingModalRef.current = false
    }
  }, [])

  return {
    advanceAndMaybeLap,
    onAction,
    nextTurn,
    modalLocks,
    lockOwner,
  }
}
