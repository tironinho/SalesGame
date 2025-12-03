// src/game/useTurnEngine.jsx
import React from 'react'

// Pista
import { TRACK_LEN } from '../data/track'

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
}) {
  // ===== Modais =====
  const { pushModal, awaitTop, closeTop } = useModal?.() || {}

  // 🔒 contagem de modais abertas (para saber quando destravar turno)
  const [modalLocks, setModalLocks] = React.useState(0)
  const modalLocksRef = React.useRef(0)
  React.useEffect(() => { modalLocksRef.current = modalLocks }, [modalLocks])
  
  // ✅ CORREÇÃO: Flag para indicar que uma modal está sendo aberta (evita race condition)
  const openingModalRef = React.useRef(false)

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
      }
    }
  }, [isMyTurn, modalLocks])

  // 🔒 dono do cadeado de turno (garante que só o iniciador destrava)
  // ✅ CORREÇÃO: Declarado ANTES do useEffect que o usa
  const [lockOwner, setLockOwner] = React.useState(null)
  const lockOwnerRef = React.useRef(null)
  React.useEffect(() => { lockOwnerRef.current = lockOwner }, [lockOwner])

  // 🔄 dados do próximo turno (para evitar stale closure)
  // ✅ CORREÇÃO: Declarado ANTES do useEffect que o usa
  const pendingTurnDataRef = React.useRef(null)

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
  const openModalAndWait = async (element) => {
    if (!(pushModal && awaitTop)) return null
    
    // ✅ CORREÇÃO: Marca que uma modal está sendo aberta ANTES de qualquer coisa
    openingModalRef.current = true
    
    // ✅ CORREÇÃO: Atualiza o ref ANTES de abrir a modal para evitar race condition
    const newLockCount = modalLocksRef.current + 1
    modalLocksRef.current = newLockCount
    console.log('[DEBUG] openModalAndWait - ABRINDO modal, modalLocks:', modalLocksRef.current, '->', newLockCount, 'openingModalRef:', openingModalRef.current)
    setModalLocks(newLockCount)
    
    try {
      pushModal(element)
      // ✅ CORREÇÃO: Pequeno delay para garantir que a modal foi renderizada
      await new Promise(resolve => setTimeout(resolve, 100))
      openingModalRef.current = false
      console.log('[DEBUG] openModalAndWait - Modal renderizada, openingModalRef:', openingModalRef.current)
      const res = await awaitTop()
      return res
    } finally {
      openingModalRef.current = false
      // ✅ CORREÇÃO: Captura o valor ANTES de decrementar para o log
      const currentLockCount = modalLocksRef.current
      // ✅ CORREÇÃO: Atualiza o ref ANTES de fechar a modal
      const newLockCountAfter = Math.max(0, currentLockCount - 1)
      modalLocksRef.current = newLockCountAfter
      console.log('[DEBUG] openModalAndWait - FECHANDO modal, modalLocks:', currentLockCount, '->', newLockCountAfter)
      setModalLocks(newLockCountAfter)
    }
  }


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
  const maybeFinishGame = React.useCallback((nextPlayers, nextRound) => {
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
  const advanceAndMaybeLap = React.useCallback((steps, deltaCash, note) => {
    console.log('[DEBUG] 🎯 advanceAndMaybeLap chamada - steps:', steps, 'deltaCash:', deltaCash, 'note:', note)
    if (gameOver || !players.length) return

    // Bloqueia os próximos jogadores até esta ação (e todas as modais) terminar
    setTurnLockBroadcast(true)
    setLockOwner(String(myUid))

    const curIdx = turnIdx
    const cur = players[curIdx]
    if (!cur) { setTurnLockBroadcast(false); return }
    
    console.log('[DEBUG] 📍 POSIÇÃO INICIAL - Jogador:', cur.name, 'Posição:', cur.pos, 'Saldo:', cur.cash)

    // ========= função recursiva para lidar com saldo insuficiente =========
    const handleInsufficientFunds = async (requiredAmount, context, action, currentPlayers = players) => {
      const currentCash = Number(currentPlayers[curIdx]?.cash || 0)
      
      if (currentCash >= requiredAmount) {
        // Processa o pagamento já que tem saldo suficiente
        console.log('[DEBUG] ✅ Saldo suficiente! Processando pagamento de:', requiredAmount)
        // ✅ CORREÇÃO: Preserva a posição do jogador ao atualizar
        const updatedPlayers = currentPlayers.map((p, i) => 
          i !== curIdx ? p : { ...p, cash: Math.max(0, (p.cash || 0) - requiredAmount), pos: p.pos }
        )
        setPlayers(updatedPlayers)
        broadcastState(updatedPlayers, turnIdx, round)
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
        console.log('[DEBUG] Abrindo RecoveryModal para jogador:', currentPlayers[curIdx])
        const recoveryModalRes = await openModalAndWait(<RecoveryModal currentPlayer={currentPlayers[curIdx]} canClose={false} />)
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
            updatedPlayers = currentPlayers.map((p, i) => {
              if (i !== curIdx) return p
              const updated = applyDeltas(p, deltas)
              // Preserva a posição original
              return { ...updated, pos: p.pos }
            })
            console.log('[DEBUG] Novo saldo após demissões:', updatedPlayers[curIdx]?.cash)
            setPlayers(updatedPlayers)
            broadcastState(updatedPlayers, turnIdx, round)
          } else if (recoveryModalRes.type === 'LOAN') {
            console.log('[DEBUG] ✅ Condição LOAN atendida! Processando empréstimo:', recoveryModalRes)
            
            // Verifica se o jogador já tem um empréstimo pendente
            const currentLoan = currentPlayers[curIdx]?.loanPending
            if (currentLoan && Number(currentLoan.amount) > 0) {
              console.log('[DEBUG] ❌ Jogador já possui empréstimo pendente:', currentLoan)
              // Mostra modal informando que já tem empréstimo - NÃO PODE FECHAR
              const loanModalRes = await openModalAndWait(
                <InsufficientFundsModal
                  requiredAmount={requiredAmount}
                  currentCash={currentPlayers[curIdx]?.cash || 0}
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
              const updatedPlayers = currentPlayers.map((p, i) => (i === curIdx ? { ...p, bankrupt: true } : p))
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
              const nextIdx = findNextAliveIdx(updatedPlayers, curIdx)
              setPlayers(updatedPlayers)
              setTurnIdx(nextIdx)
              setTurnLockBroadcast(false)
              broadcastState(updatedPlayers, nextIdx, round)
              return false
            }
            
            const amt = Number(recoveryModalRes.amount || 0)
            console.log('[DEBUG] Valor do empréstimo:', amt)
            console.log('[DEBUG] Saldo atual do jogador:', currentPlayers[curIdx]?.cash)
            // ✅ CORREÇÃO: Preserva a posição do jogador ao atualizar
            updatedPlayers = currentPlayers.map((p, i) =>
              i !== curIdx ? p : {
                ...p,
                cash: (Number(p.cash) || 0) + amt,
                loanPending: { amount: amt, dueRound: round + 1, charged: false },
                pos: p.pos // ✅ CORREÇÃO: Preserva a posição
              }
            )
            console.log('[DEBUG] Novo saldo do jogador:', updatedPlayers[curIdx]?.cash)
            console.log('[DEBUG] Novo loanPending:', updatedPlayers[curIdx]?.loanPending)
            setPlayers(updatedPlayers)
            broadcastState(updatedPlayers, turnIdx, round)
          } else if (recoveryModalRes.type === 'REDUCE') {
            console.log('[DEBUG] ✅ Condição REDUCE atendida! Processando redução:', recoveryModalRes)
            const selections = recoveryModalRes.items || []
            let totalCredit = 0
            console.log('[DEBUG] Seleções para reduzir:', selections)
            // ✅ CORREÇÃO: Preserva a posição do jogador ao atualizar
            updatedPlayers = currentPlayers.map((p, i) => {
              if (i !== curIdx) return p
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
              // ✅ CORREÇÃO: Preserva a posição original
              next.pos = p.pos
              return next
            })
            console.log('[DEBUG] Total de crédito da redução:', totalCredit)
            console.log('[DEBUG] Novo saldo após redução:', updatedPlayers[curIdx]?.cash)
            setPlayers(updatedPlayers)
            broadcastState(updatedPlayers, turnIdx, round)
          } else {
            console.log('[DEBUG] ❌ Nenhuma condição foi atendida! Tipo:', recoveryModalRes.type, 'Action:', recoveryModalRes.action)
          }
          
          // Verifica se agora tem saldo suficiente após a recuperação
          const newCash = Number(updatedPlayers[curIdx]?.cash || 0)
          console.log('[DEBUG] Verificando saldo após recuperação - Novo saldo:', newCash, 'Necessário:', requiredAmount)
          
          if (newCash >= requiredAmount) {
            console.log('[DEBUG] ✅ Saldo suficiente após recuperação! Processando pagamento de:', requiredAmount)
            // Processa o pagamento já que tem saldo suficiente
            // ✅ CORREÇÃO: Preserva a posição do jogador ao atualizar
            const finalPlayers = updatedPlayers.map((p, i) => 
              i !== curIdx ? p : { ...p, cash: Math.max(0, (p.cash || 0) - requiredAmount), pos: p.pos }
            )
            console.log('[DEBUG] 💰 PAGAMENTO - Saldo antes:', updatedPlayers[curIdx]?.cash, 'Valor a pagar:', requiredAmount, 'Saldo após:', finalPlayers[curIdx]?.cash)
            setPlayers(finalPlayers)
            broadcastState(finalPlayers, turnIdx, round)
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
        const updatedPlayers = currentPlayers.map((p, i) => (i === curIdx ? { ...p, bankrupt: true } : p))
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
        const nextIdx = findNextAliveIdx(updatedPlayers, curIdx)
        setPlayers(updatedPlayers)
        setTurnIdx(nextIdx)
        setTurnLockBroadcast(false)
        broadcastState(updatedPlayers, nextIdx, round)
        return false
      } else {
        setTurnLockBroadcast(false)
        return false
      }
    }

    const oldPos = cur.pos
    const newPos = (oldPos + steps) % TRACK_LEN
    const lap = newPos < oldPos

    console.log('[DEBUG] 🚶 MOVIMENTO - De posição:', oldPos, 'Para posição:', newPos, 'Steps:', steps, 'Lap:', lap)

    // aplica movimento + eventual cashDelta imediato (sem permitir negativo)
    const nextPlayers = players.map((p, i) => {
      if (i !== curIdx) return p
      const nextCash = (p.cash || 0) + (deltaCash || 0)
      return { ...p, pos: newPos, cash: Math.max(0, nextCash) }
    })
    
    console.log('[DEBUG] 📍 APÓS MOVIMENTO - Jogador:', nextPlayers[curIdx]?.name, 'Posição:', nextPlayers[curIdx]?.pos, 'Saldo:', nextPlayers[curIdx]?.cash)

    // ✅ CORREÇÃO: Verifica se passou pela casa 0 (Faturamento do Mês) - será usado abaixo
    // crossedStart1 será definido mais abaixo, mas precisamos verificar aqui também
    const crossedStart1ForRound = crossedTile(oldPos, newPos, 0)

    // >>> controle de rodada: só vira quando TODOS os jogadores VIVOS cruzarem a casa 0
    let nextRound = round
    let nextFlags = [...roundFlags]
    
    // ✅ CORREÇÃO: Usa crossedStart1ForRound em vez de lap para detectar passagem pela casa 0
    if (crossedStart1ForRound) {
      // Garante que o array de flags tem o tamanho correto
      if (nextFlags.length < players.length) {
        nextFlags = [...nextFlags, ...new Array(players.length - nextFlags.length).fill(false)]
      }
      
      // Marca que este jogador passou pela casa 0
      nextFlags[curIdx] = true
      console.log('[DEBUG] 🏁 Jogador passou pela casa 0 - Flags:', nextFlags.map((f, i) => `${players[i]?.name}:${f}`).join(', '))
      
      // ✅ CORREÇÃO: Conta apenas jogadores vivos para verificar se todos passaram
      const alivePlayers = nextPlayers.filter(p => !p?.bankrupt)
      const aliveIndices = nextPlayers.map((p, i) => !p?.bankrupt ? i : -1).filter(i => i >= 0)
      
      // Verifica se todos os jogadores vivos passaram pela casa 0
      const allAliveDone = aliveIndices.length > 0 && aliveIndices.every(idx => nextFlags[idx] === true)
      
      console.log('[DEBUG] 🔍 Verificação de rodada - Jogador:', nextPlayers[curIdx]?.name, 'Rodada atual:', round)
      console.log('[DEBUG] 🔍 Jogadores vivos:', aliveIndices.map(i => `${nextPlayers[i]?.name}:${nextFlags[i]}`).join(', '))
      console.log('[DEBUG] 🔍 Todos passaram pela casa 0?', allAliveDone)
      
      if (allAliveDone) {
        nextRound = round + 1
        // ✅ CORREÇÃO: Reseta apenas as flags dos jogadores vivos
        nextFlags = nextFlags.map((_, idx) => nextPlayers[idx]?.bankrupt ? nextFlags[idx] : false)
        console.log('[DEBUG] 🔄 RODADA INCREMENTADA - Nova rodada:', nextRound, 'Jogadores vivos:', alivePlayers.length)
        console.log('[DEBUG] 🔄 Flags resetadas:', nextFlags.map((f, i) => `${nextPlayers[i]?.name}:${f}`).join(', '))
      } else {
        console.log('[DEBUG] ⏳ Rodada NÃO incrementada - ainda faltam jogadores passarem pela casa 0')
      }
    }
    setRoundFlags(nextFlags)

    // >>> pular jogadores falidos ao decidir o próximo turno
    const nextTurnIdx = findNextAliveIdx(nextPlayers, curIdx)

    if (deltaCash) appendLog(`${cur.name} ${deltaCash>0? 'ganhou' : 'pagou'} $${(Math.abs(deltaCash)).toLocaleString()}`)
    if (note) appendLog(note)

    setPlayers(nextPlayers)
    // ✅ CORREÇÃO: Atualiza a rodada imediatamente quando todos os jogadores passam pela casa 0
    // Isso garante que a rodada está correta antes de fazer broadcast
    setRound(nextRound)
    console.log('[DEBUG] 🔄 RODADA ATUALIZADA - Rodada atual:', round, 'Nova rodada:', nextRound)
    
    // ✅ CORREÇÃO: Armazena os dados do próximo turno para uso na função tick
    // IMPORTANTE: Não atualiza turnIdx ainda - isso será feito pelo tick quando todas as modais fecharem
    // IMPORTANTE: Usa nextRound calculado acima (pode ser diferente de round se todos passaram pela casa 0)
    pendingTurnDataRef.current = {
      nextPlayers,
      nextTurnIdx,
      nextRound, // Usa o nextRound calculado (pode ser round + 1 se todos passaram pela casa 0)
      timestamp: Date.now() // Adiciona timestamp para rastrear quando foi criado
    }
    console.log('[DEBUG] 📝 pendingTurnDataRef preenchido - próximo turno:', nextTurnIdx, 'rodada atual:', round, 'próxima rodada:', nextRound)
    
    // NÃO muda o turno aqui - aguarda todas as modais serem fechadas
    // O turno será mudado na função tick() quando modalLocks === 0

    // Verifica se o jogo deve terminar (quando todos os jogadores vivos completaram 5 rodadas)
    const alivePlayers = nextPlayers.filter(p => !p?.bankrupt)
    const allCompleted5Rounds = alivePlayers.every(p => {
      // Conta quantas vezes o jogador passou pela casa 1 (faturamento)
      // Cada volta completa no tabuleiro = 1 rodada completada
      const roundsCompleted = Math.floor((p.pos || 0) / TRACK_LEN)
      return roundsCompleted >= 5
    })
    
    if (allCompleted5Rounds) {
      console.log('[DEBUG] 🏁 FIM DE JOGO - Todos os jogadores completaram 5 rodadas')
      maybeFinishGame(nextPlayers, nextRound)
      setTurnLockBroadcast(false)
      return
    }
    
    // Se o jogador atual completou 5 rodadas, pula para o próximo
    const currentPlayerRounds = Math.floor((nextPlayers[curIdx]?.pos || 0) / TRACK_LEN)
    if (currentPlayerRounds >= 5) {
      console.log('[DEBUG] ⏭️ JOGADOR COMPLETOU 5 RODADAS - Pulando para próximo:', nextPlayers[curIdx]?.name)
      // O jogador que completou 5 rodadas aguarda, mas o jogo continua para os outros
      setTurnLockBroadcast(false)
      return
    }

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
        const res = await openModalAndWait(<ERPSystemsModal 
          currentCash={nextPlayers[curIdx]?.cash ?? myCash}
          currentLevel={currentErpLevel}
        />)
        if (!res || res.action !== 'BUY') return
        const price = Number(res.values?.compra || 0)
        if (!requireFunds(curIdx, price, 'comprar ERP')) { setTurnLockBroadcast(false); return }
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyDeltas(p, { cashDelta: -price, erpLevelSet: res.level })
          )
          // ✅ CORREÇÃO: Usa turnIdx e round atuais (não nextTurnIdx/nextRound) para compras durante o turno
          broadcastState(upd, turnIdx, round)
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
            const upd = ps.map((p, i) =>
              i !== curIdx ? p : applyTrainingPurchase(p, res)
            )
            // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
            broadcastState(upd, turnIdx, round)
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
            const r2 = await openModalAndWait(<MixProductsModal 
              currentCash={nextPlayers[curIdx]?.cash ?? myCash}
              currentLevel={currentMixLevel}
            />)
            if (r2 && r2.action === 'BUY') {
              const price = Number(r2.compra || 0)
              const level = String(r2.level || 'D')
              if (!requireFunds(curIdx, price, 'comprar MIX')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = ps.map((p,i)=>
                  i!==curIdx ? p : applyDeltas(p, {
                    cashDelta: -price,
                    mixProdutosSet: level,
                    mixBaseSet: {
                      despesaPorCliente: Number(r2.despesa || 0),
                      faturamentoPorCliente: Number(r2.faturamento || 0),
                    }
                  })
                )
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, round); return upd
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
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, {
                  cashDelta,
                  gestoresDelta: qty,
                  manutencaoDelta: mexp
                }))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, round); return upd
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
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, { cashDelta: -cost, insideSalesDelta: qty }))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, round); return upd
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
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, deltas))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, round); return upd
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
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, deltas))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, round); return upd
              })
            }
            return
          }

          if (open === 'ERP') {
            const currentErpLevel = players[curIdx]?.erpLevel || null
            const r2 = await openModalAndWait(<ERPSystemsModal 
              currentCash={nextPlayers[curIdx]?.cash ?? myCash}
              currentLevel={currentErpLevel}
            />)
            if (r2 && r2.action === 'BUY') {
              const price = Number(r2.values?.compra || 0)
              if (!requireFunds(curIdx, price, 'comprar ERP')) { setTurnLockBroadcast(false); return }
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, { cashDelta: -price, erpLevelSet: r2.level }))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, round); return upd
              })
            }
            return
          }

          if (open === 'CLIENTS') {
            const r2 = await openModalAndWait(<ClientsModal currentCash={nextPlayers[curIdx]?.cash ?? myCash} />)
            if (r2 && r2.action === 'BUY') {
              const cost  = Number(r2.totalCost || 0)
              if (!requireFunds(curIdx, cost, 'comprar Clientes')) { setTurnLockBroadcast(false); return }
              const qty   = Number(r2.qty || 0)
              const mAdd  = Number(r2.maintenanceDelta || 0)
              const bensD = Number(r2.bensDelta || cost)
              setPlayers(ps => {
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyDeltas(p, {
                  cashDelta: -cost,
                  clientsDelta: qty,
                  manutencaoDelta: mAdd,
                  bensDelta: bensD
                }))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, round); return upd
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
                const upd = ps.map((p,i)=> i!==curIdx ? p : applyTrainingPurchase(p, r2))
                // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
                broadcastState(upd, turnIdx, round); return upd
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
            if (!requireFunds(curIdx, cost, 'comprar Clientes')) { setTurnLockBroadcast(false); return }
            const qty   = Number(res.clientsQty ?? res.numClients ?? res.qty ?? 0)
            const mAdd  = Number(res.maintenanceDelta ?? res.maintenance ?? res.mexp ?? 0)
            const bensD = Number(res.bensDelta ?? cost)

            setPlayers(ps => {
              const upd = ps.map((p, i) =>
                i !== curIdx
                  ? p
                  : applyDeltas(p, {
                      cashDelta: -cost,
                      clientsDelta: qty,
                      manutencaoDelta: mAdd,
                      bensDelta: bensD
                    })
              )
              // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
              broadcastState(upd, turnIdx, round)
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
            broadcastState(upd, turnIdx, round)
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
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyDeltas(p, { cashDelta: -cost, insideSalesDelta: qty })
          )
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
          broadcastState(upd, turnIdx, round)
          return upd
        })
      })()
    }

    // Clientes
    const isClientsTile = [4,8,15,17,20,27,34,36,39,46,52,55].includes(landedOneBased)
    if (isClientsTile && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const res = await openModalAndWait(<ClientsModal currentCash={nextPlayers[curIdx]?.cash ?? myCash} />)
        if (!res || res.action !== 'BUY') return
        const cost  = Number(res.totalCost || 0)
        if (!requireFunds(curIdx, cost, 'comprar Clientes')) { setTurnLockBroadcast(false); return }
        const qty   = Number(res.qty || 0)
        const mAdd  = Number(res.maintenanceDelta || 0)
        const bensD = Number(res.bensDelta || cost)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx
              ? p
              : applyDeltas(p, {
                  cashDelta: -cost,
                  clientsDelta: qty,
                  manutencaoDelta: mAdd,
                  bensDelta: bensD
                })
          )
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
          broadcastState(upd, turnIdx, round)
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
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyDeltas(p, { cashDelta, gestoresDelta: qty, manutencaoDelta: mexp })
          )
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
          broadcastState(upd, turnIdx, round)
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
            const upd = ps.map((p, i) =>
              i !== curIdx ? p : applyDeltas(p, deltas)
            )
            // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
            broadcastState(upd, turnIdx, round)
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
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : applyDeltas(p, deltas)
          )
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
          broadcastState(upd, turnIdx, round)
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
        const res = await openModalAndWait(<MixProductsModal 
          currentCash={nextPlayers[curIdx]?.cash ?? myCash}
          currentLevel={currentMixLevel}
        />)
        if (!res || res.action !== 'BUY') return
        const price = Number(res.compra || 0)
        if (!requireFunds(curIdx, price, 'comprar MIX')) { setTurnLockBroadcast(false); return }
        const level = String(res.level || 'D')
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
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
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
          broadcastState(upd, turnIdx, round)
          return upd
        })
      })()
    }

    // Sorte & Revés
    const isLuckMisfortuneTile = [3,14,22,26,35,41,48,54].includes(landedOneBased)
    if (isLuckMisfortuneTile && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      ;(async () => {
        const res = await openModalAndWait(<SorteRevesModal />)
        if (!res || res.action !== 'APPLY_CARD') return

        const meNow = nextPlayers[curIdx] || players.find(isMine) || {}

        let cashDelta    = Number.isFinite(res.cashDelta)    ? Number(res.cashDelta)    : 0
        let clientsDelta = Number.isFinite(res.clientsDelta) ? Number(res.clientsDelta) : 0

        // O modal já calculou os efeitos baseados no estado do jogador
        // Não precisamos verificar novamente aqui

        if (cashDelta < 0) {
          const need = -cashDelta
          await handleInsufficientFunds(need, 'Sorte & Revés', 'pagar', nextPlayers)
        }

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
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para compras durante o turno
          broadcastState(upd, turnIdx, round)
          return upd
        })

        const anyDerived = res.perClientBonus || res.perCertifiedManagerBonus || res.mixLevelBonusABOnly
        if (anyDerived) {
          const me2 = nextPlayers[curIdx] || players.find(isMine) || {}
          let extra = 0
          if (res.perClientBonus)           extra += (Number(me2.clients) || 0) * Number(res.perClientBonus || 0)
          if (res.perCertifiedManagerBonus) extra += countManagerCerts(me2) * Number(res.perCertifiedManagerBonus || 0)
          if (res.mixLevelBonusABOnly) {
            const level = String(me2.mixProdutos || '').toUpperCase()
            if (level === 'A' || level === 'B') extra += Number(res.mixLevelBonusABOnly || 0)
          }
          if (extra) {
            setPlayers(ps => {
              const upd = ps.map((p,i) => i===curIdx ? { ...p, cash: (Number(p.cash)||0) + extra } : p)
              // ✅ CORREÇÃO: Usa turnIdx e round atuais para bônus durante o turno
              broadcastState(upd, turnIdx, round); return upd
            })
          }
        }
      })()
    }

    // === AUTO-MODAIS (Faturamento / Despesas) ===
    if (crossedStart1 && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      const meNow = nextPlayers[curIdx] || {}
      const fat = Math.max(0, Math.floor(computeFaturamentoFor(meNow)))
      ;(async () => {
        await openModalAndWait(<FaturamentoDoMesModal value={fat} />)
        setPlayers(ps => {
          const upd = ps.map((p,i)=> i!==curIdx ? p : { ...p, cash: (p.cash||0) + fat })
          // ✅ CORREÇÃO: Usa turnIdx e round atuais para faturamento durante o turno
          broadcastState(upd, turnIdx, round); return upd
        })
        appendLog(`${meNow.name} recebeu faturamento do mês: +$${fat.toLocaleString()}`)
        try { setTimeout(() => closeTop?.({ action:'AUTO_CLOSE_BELOW' }), 0) } catch {}
      })()
    }

    if (crossedExpenses23 && isMyTurn && pushModal && awaitTop) {
      openingModalRef.current = true // ✅ CORREÇÃO: Marca ANTES de abrir
      console.log('[DEBUG] 💰 DESPESAS OPERACIONAIS - Jogador:', nextPlayers[curIdx]?.name, 'Posição atual:', nextPlayers[curIdx]?.pos)
      const meNow = nextPlayers[curIdx] || {}
      const expense = Math.max(0, Math.floor(computeDespesasFor(meNow)))

      const lp = meNow.loanPending || {}
      const shouldChargeLoan = Number(lp.amount) > 0 && !lp.charged && (round >= Math.max(1, Number(lp.dueRound || 0)))
      const loanCharge = shouldChargeLoan ? Math.max(0, Math.floor(Number(lp.amount))) : 0

      console.log('[DEBUG] 💰 DESPESAS - Valor:', expense, 'Empréstimo a cobrar:', loanCharge, 'Total:', expense + loanCharge)
      console.log('[DEBUG] 💰 EMPRÉSTIMO - Detalhes:', {
        amount: Number(lp.amount),
        charged: lp.charged,
        dueRound: Number(lp.dueRound || 0),
        currentRound: round,
        shouldCharge: shouldChargeLoan
      })

      ;(async () => {
        await openModalAndWait(<DespesasOperacionaisModal expense={expense} loanCharge={loanCharge} />)
        const totalCharge = expense + loanCharge
        
        console.log('[DEBUG] 💰 ANTES handleInsufficientFunds - Saldo atual:', nextPlayers[curIdx]?.cash, 'Total a pagar:', totalCharge, 'Posição:', nextPlayers[curIdx]?.pos)
        // ✅ CORREÇÃO: Preserva a posição do jogador ao passar nextPlayers
        const canPayExpenses = await handleInsufficientFunds(totalCharge, 'Despesas Operacionais', 'pagar', nextPlayers)
        console.log('[DEBUG] 💰 APÓS handleInsufficientFunds - canPayExpenses:', canPayExpenses, 'Posição atual:', nextPlayers[curIdx]?.pos)
        if (!canPayExpenses) {
          // ✅ CORREÇÃO: Não libera o turno aqui - deixa o tick() gerenciar
          // O handleInsufficientFunds já gerencia o turno quando necessário (falência, etc)
          console.log('[DEBUG] 💰 canPayExpenses é false - não liberando turno aqui, deixando tick() gerenciar')
          return
        }
        
        // O handleInsufficientFunds já processou o pagamento, não precisa duplicar
        // Apenas marca o empréstimo como cobrado se necessário
        if (shouldChargeLoan) {
          setPlayers(ps => {
            const upd = ps.map((p,i)=>{
              if (i!==curIdx) return p
              const next = { ...p }
              next.loanPending = { ...(p.loanPending||{}), charged:true, chargedAtRound: round }
              // ✅ CORREÇÃO: Preserva a posição original do nextPlayers
              next.pos = nextPlayers[curIdx]?.pos ?? p.pos
              return next
            })
            // ✅ CORREÇÃO: Usa turnIdx e round atuais para despesas durante o turno
            broadcastState(upd, turnIdx, round); return upd
          })
        }
        appendLog(`${meNow.name} pagou despesas operacionais: -$${expense.toLocaleString()}`)
        if (loanCharge > 0) appendLog(`${meNow.name} teve empréstimo cobrado: -$${loanCharge.toLocaleString()}`)
        // ✅ CORREÇÃO: Garante que a posição seja preservada após o processamento
        setPlayers(ps => {
          const upd = ps.map((p, i) => {
            if (i !== curIdx) return p
            // Preserva a posição original do nextPlayers
            return { ...p, pos: nextPlayers[curIdx]?.pos ?? p.pos }
          })
          console.log('[DEBUG] 💰 DESPESAS FINALIZADAS - Jogador:', upd[curIdx]?.name, 'Posição final:', upd[curIdx]?.pos, 'Saldo final:', upd[curIdx]?.cash)
          return upd
        })
        // ✅ CORREÇÃO: Não precisa fechar modal aqui - a modal de despesas já foi fechada pelo openModalAndWait
        // O closeTop pode causar problemas com o modalLocks
      })()
    }

    // fail-safe: solta o cadeado quando todas as modais fecharem
    const start = Date.now()
    const tick = () => {
      const currentModalLocks = modalLocksRef.current
      const currentOpening = openingModalRef.current
      const currentLockOwner = lockOwnerRef.current
      const isLockOwner = String(currentLockOwner || '') === String(myUid)
      
      console.log('[DEBUG] tick - modalLocks:', currentModalLocks, 'openingModalRef:', currentOpening, 'lockOwner:', currentLockOwner, 'myUid:', myUid, 'isLockOwner:', isLockOwner)
      
      // ✅ CORREÇÃO: Verifica se uma modal está sendo aberta (evita race condition)
      if (currentOpening) {
        console.log('[DEBUG] ⚠️ tick - modal está sendo aberta, aguardando...')
        setTimeout(tick, 150)
        return
      }
      
      // ✅ CORREÇÃO: Só muda turno se realmente não houver modais abertas
      if (currentModalLocks === 0) {
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
            // ✅ CORREÇÃO: Verifica novamente se não há modais abertas ou sendo abertas (double-check)
            const finalModalLocks = modalLocksRef.current
            const finalOpening = openingModalRef.current
            // ✅ CORREÇÃO: Verifica se o turnIdx ainda é o mesmo (não mudou via SYNC)
            const finalTurnIdx = turnIdx
            if (finalModalLocks === 0 && !finalOpening && finalTurnIdx === turnIdx) {
              console.log('[DEBUG] ✅ Mudando turno - de:', turnIdx, 'para:', turnData.nextTurnIdx, 'finalModalLocks:', finalModalLocks, 'finalOpening:', finalOpening)
              // ✅ CORREÇÃO: Atualiza turnIdx primeiro, depois faz broadcast
              // O broadcastState atualiza lastLocalStateRef com o novo turnIdx, protegendo contra estados remotos antigos
              setTurnIdx(turnData.nextTurnIdx)
              broadcastState(turnData.nextPlayers, turnData.nextTurnIdx, turnData.nextRound)
              pendingTurnDataRef.current = null // Limpa os dados após usar
              setTurnLockBroadcast(false)
            } else {
              console.log('[DEBUG] ⚠️ tick - modal foi aberta durante verificação ou turnIdx mudou, não mudando turno', { finalModalLocks, finalOpening, finalTurnIdx, turnIdx })
              // Continua verificando
              setTimeout(tick, 150)
              return
            }
          } else {
            console.log('[DEBUG] ⚠️ tick - turnData é null, não mudando turno. turnIdx atual:', turnIdx, 'lockOwner:', currentLockOwner, 'isLockOwner:', isLockOwner)
            // ✅ CORREÇÃO: Se não há turnData mas deveria haver, tenta novamente após um delay
            // Pode ser que o pendingTurnDataRef ainda não foi preenchido
            if (isLockOwner && currentModalLocks === 0 && !currentOpening) {
              console.log('[DEBUG] ⚠️ tick - tentando novamente em 200ms (pode ser que pendingTurnDataRef ainda não foi preenchido)')
              setTimeout(tick, 200)
              return
            }
            setTurnLockBroadcast(false)
          }
        } else {
          console.log('[DEBUG] ❌ tick - não sou o dono do cadeado e não é minha vez, não mudando turno', { isLockOwner, isCurrentPlayerMe, currentLockOwner, myUid, turnIdx })
        }
        return
      }
      
      if (Date.now() - start > 20000) {
        // força desbloqueio em caso extremo
        console.log('[DEBUG] ⏰ TIMEOUT - forçando desbloqueio após 20s')
        if (isLockOwner) {
          setTurnLockBroadcast(false)
        }
        return
      }
      
      // Continua verificando a cada 100ms (aumentado para dar mais tempo)
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
        console.log('[DEBUG] ⚠️ checkBeforeTick - excedeu tentativas, forçando avanço do turno', {
          hasOpening,
          hasLocks,
          modalLocks: modalLocksRef.current
        })
        // Força o modalLocks para 0 se estiver travado
        if (modalLocksRef.current > 0) {
          console.log('[DEBUG] ⚠️ checkBeforeTick - forçando modalLocks para 0')
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
    setTurnIdx(nextTurnIdx)
    broadcastState(players, nextTurnIdx, round)
  }, [broadcastState, gameOver, players, round, setTurnIdx, turnIdx])

  const onAction = React.useCallback((act) => {
    if (!act?.type || gameOver) return

    if (act.type === 'ROLL'){
      if (!isMyTurn) return
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
      broadcastState(nextPlayers, turnIdx, round)
      // ✅ CORREÇÃO: Não destrava o turno - jogador continua no seu turno após recuperação
      // setTurnLockBroadcast(false)
      return
    }

    if (act.type === 'RECOVERY_MODAL') {
      if (!isMyTurn || !pushModal || !awaitTop) return
      ;(async () => {
        const res = await openModalAndWait(<RecoveryModal playerName={current?.name || 'Jogador'} currentPlayer={current} />)
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
      setPlayers(ps => {
        const upd = ps.map((p, i) => (i !== curIdx ? p : applyDeltas(p, deltas)));
        broadcastState(upd, turnIdx, round);
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
            broadcastState(upd, turnIdx, round);
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
              // ✅ CORREÇÃO: Se está reduzindo o nível atual, faz downgrade ANTES de marcar como false
              if (s.level === currentMixLevel) {
                // Encontra o próximo nível disponível (B, C ou D)
                const levels = ['A', 'B', 'C', 'D'];
                const currentIdx = levels.indexOf(currentMixLevel);
                for (let idx = currentIdx + 1; idx < levels.length; idx++) {
                  const nextLevel = levels[idx];
                  // Verifica se o próximo nível está disponível (antes de marcar o atual como false)
                  if (mixOwned[nextLevel] || nextLevel === 'D') {
                    currentMixLevel = nextLevel;
                    break;
                  }
                }
              }
              // Agora marca como false
              mixOwned[s.level] = false;
              // ✅ CORREÇÃO: Adiciona à lista de reduzidos
              if (!newReducedMix.includes(s.level)) {
                newReducedMix.push(s.level);
              }
            } else if (s.group === 'ERP') {
              // ✅ CORREÇÃO: Se está reduzindo o nível atual, faz downgrade ANTES de marcar como false
              if (s.level === currentErpLevel) {
                // Encontra o próximo nível disponível (B, C ou D)
                const levels = ['A', 'B', 'C', 'D'];
                const currentIdx = levels.indexOf(currentErpLevel);
                for (let idx = currentIdx + 1; idx < levels.length; idx++) {
                  const nextLevel = levels[idx];
                  // Verifica se o próximo nível está disponível (antes de marcar o atual como false)
                  if (erpOwned[nextLevel] || nextLevel === 'D') {
                    currentErpLevel = nextLevel;
                    break;
                  }
                }
              }
              // Agora marca como false
              erpOwned[s.level] = false;
              // ✅ CORREÇÃO: Adiciona à lista de reduzidos
              if (!newReducedErp.includes(s.level)) {
                newReducedErp.push(s.level);
              }
            }
          }

          // ✅ CORREÇÃO: Garante que D sempre esteja disponível se não houver outros níveis
          const hasAnyMix = mixOwned.A || mixOwned.B || mixOwned.C;
          if (!hasAnyMix) mixOwned.D = true;
          const hasAnyErp = erpOwned.A || erpOwned.B || erpOwned.C;
          if (!hasAnyErp) erpOwned.D = true;

          const mixLetter = letterFromOwned(mixOwned);
          const erpLetter = letterFromOwned(erpOwned);

          // ✅ CORREÇÃO: Garante que o nível atual seja atualizado corretamente após redução
          const finalMixLevel = mixLetter !== '-' ? mixLetter : (currentMixLevel || 'D');
          const finalErpLevel = erpLetter !== '-' ? erpLetter : (currentErpLevel || 'D');

          return {
            ...p,
            cash: (Number(p.cash) || 0) + totalCredit,
            mixOwned, erpOwned,
            mix: mixOwned, erp: erpOwned,
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
      setTurnLockBroadcast(false)
      broadcastState(updatedPlayers, nextIdx, round)
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
    if (modalLocks === 0 && turnLock) {
      if (String(lockOwner || '') === String(myUid)) {
        console.log('[DEBUG] 🔓 Destravando turnLock - modalLocks: 0, sou o lockOwner')
        setTurnLockBroadcast(false)
      } else if (!isMyTurn) {
        // ✅ CORREÇÃO: Se não é minha vez e não sou o lockOwner, libera o turnLock
        // Isso evita que o botão fique travado após sincronização
        console.log('[DEBUG] 🔓 Destravando turnLock - não é minha vez e não sou lockOwner')
        setTurnLockBroadcast(false)
      }
    }
  }, [modalLocks, turnLock, lockOwner, myUid, isMyTurn, setTurnLockBroadcast])

  // b) quando virar "minha vez" e não houver modal, garanto unlock local
  React.useEffect(() => {
    if (isMyTurn && modalLocks === 0 && turnLock) {
      if (String(lockOwner || '') === String(myUid)) {
        console.log('[DEBUG] 🔓 Destravando turnLock - é minha vez e sou o lockOwner')
        setTurnLockBroadcast(false)
      } else if (!lockOwner) {
        // ✅ CORREÇÃO: Se é minha vez mas não há lockOwner, libera o turnLock
        // Isso garante que o botão seja habilitado quando é minha vez
        console.log('[DEBUG] 🔓 Destravando turnLock - é minha vez mas não há lockOwner')
        setTurnLockBroadcast(false)
      }
    }
  }, [isMyTurn, modalLocks, turnLock, lockOwner, myUid, setTurnLockBroadcast])

  return {
    advanceAndMaybeLap,
    onAction,
    nextTurn,
    modalLocks,
    lockOwner,
  }
}
