// src/App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'

// Telas
import StartScreen from './components/StartScreen.jsx'
import LobbyList from './pages/LobbyList.jsx'
import PlayersLobby from './pages/PlayersLobby.jsx'
import Board from './components/Board.jsx'
import HUD from './components/HUD.jsx'
import Controls from './components/Controls.jsx'
import FinalWinners from './components/FinalWinners.jsx'
import BankruptOverlay from './modals/BankruptOverlay.jsx'
import DebugPanel from './components/DebugPanel.jsx'

// Regras / Engine
import { useTurnEngine } from './game/useTurnEngine.jsx'
import {
  computeDespesasFor,
  computeFaturamentoFor,
  capacityAndAttendance
} from './game/gameMath'
import { debugMode, validateGameState, validateCalculations } from './game/debugMode.js'
import { validateGameState as validateGameStateRealTime } from './game/__tests__/realTimeValidator.js'
// Carrega sistema de testes completo
import './game/__tests__/index.js'

// Identidade por aba
import { getOrCreateTabPlayerId, getOrSetTabPlayerName } from './auth'

// Net (opcional)
import { useGameNet } from './net/GameNetProvider.jsx'

// Gerenciamento de salas
import { leaveRoom } from './lib/lobbies'

// Tamanho da pista
import { TRACK_LEN } from './data/track'

// -------------------------------------------------------------
// App raiz – concentra roteamento de fases e estado global leve
// -------------------------------------------------------------
export default function App() {
  // ====== fases da UI
  const [phase, setPhase] = useState('start') // 'start' | 'lobbies' | 'playersLobby' | 'game'
  const [currentLobbyId, setCurrentLobbyId] = useState(null)

  // ====== identidade por aba
  const meId = useMemo(() => getOrCreateTabPlayerId(), [])
  const myName = useMemo(() => {
    // Obter nome salvo do sessionStorage
    return getOrSetTabPlayerName('')
  }, [])
  const [myUid, setMyUid] = useState(meId)

  // ====== estado mínimo do jogo
  const STARTER_KIT = useMemo(
    () => Object.freeze({ mixProdutos: 'D', erpLevel: 'D', clients: 1, vendedoresComuns: 1 }),
    []
  )
  const applyStarterKit = (obj = {}) => ({
    ...obj,
    mixProdutos: obj.mixProdutos ?? 'D',
    erpLevel: obj.erpLevel ?? 'D',
    clients: obj.clients ?? 1,
    vendedoresComuns: obj.vendedoresComuns ?? 1,
  })

  const [players, setPlayers] = useState([
    applyStarterKit({ id: meId, name: myName || 'Jogador', cash: 18000, pos: 0, color: '#ffd54f', bens: 4000 })
  ])
  const [round, setRound] = useState(1)
  const [turnIdx, setTurnIdx] = useState(0)
  const [roundFlags, setRoundFlags] = useState(new Array(1).fill(false)) // quem já cruzou a casa 1
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState(null)

  // ====== HUD do meu jogador
  const [meHud, setMeHud] = useState({
    id: meId,
    name: players[0]?.name || 'Jogador',
    color: players[0]?.color || '#6c5ce7',
    cash: players[0]?.cash ?? 18000,
    possibAt: 0,
    clientsAt: 0,
    matchId: 'local',
  })

  // ====== log leve (se quiser usar num console próprio depois)
  const [log, setLog] = useState(['Bem-vindo ao Sales Game!'])
  const appendLog = (msg) => setLog(l => [msg, ...l].slice(0, 12))

  // ====== bloqueio de turno (cadeado entre abas)
  const [turnLock, setTurnLock] = useState(false)
  const bcRef = useRef(null)

  // ====== "quem sou eu" no array de players
  const isMine = useCallback((p) => !!p && String(p.id) === String(myUid), [myUid])
  const myCash = useMemo(() => (players.find(isMine)?.cash ?? 0), [players, isMine])

  // ====== bootstrap de fase via ?room= e último lobby salvo
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const roomFromUrl = url.searchParams.get('room')
      const roomFromStorage = localStorage.getItem('sg:lastRoomName')
      const room = roomFromUrl || roomFromStorage

      // Limpar localStorage antigo para forçar tela inicial
      if (roomFromStorage && !roomFromUrl) {
        localStorage.removeItem('sg:lastRoomName')
      }

      if (room && roomFromUrl) {
        setCurrentLobbyId(room)
        window.__setRoomCode?.(room)
        try {
          url.searchParams.set('room', String(room))
          history.replaceState(null, '', url.toString())
        } catch {}
        setPhase('playersLobby')
      } else if (myName && myName.trim() !== '') {
        setPhase('lobbies')
      }
    } catch {}
  }, [myName])

  // ====== BroadcastChannel para sync entre abas (mesmo navegador)
  const syncKey = useMemo(() => `sg-sync:${currentLobbyId || 'local'}`, [currentLobbyId])

  useEffect(() => {
    try {
      bcRef.current?.close?.()
      const bc = new BroadcastChannel(syncKey)
      bc.onmessage = (e) => {
        const d = e.data || {}
        if (String(d.source) === String(meId)) return

        if (d.type === 'START') {
          const mapped = Array.isArray(d.players) ? d.players.map(applyStarterKit) : []
          if (!mapped.length) return

          console.log('[App] START recebido - jogadores:', mapped.map(p => ({ id: p.id, name: p.name })), 'turnIdx: 0 (forçado)')

          // adota UID real se PlayersLobby tiver setado
          try {
            const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
            if (wuid) setMyUid(String(wuid))
          } catch {}

          setPlayers(mapped)
          // ✅ CORREÇÃO: Garante que o turnIdx seja sempre 0 (jogador 1) ao iniciar
          // Ignora qualquer turnIdx que venha na mensagem START (se houver)
          setTurnIdx(0)
          setRound(1)
          setRoundFlags(new Array(Math.max(1, mapped.length)).fill(false))
          setGameOver(false); setWinner(null)
          // ✅ CORREÇÃO: Marca que o jogo acabou de começar para proteger o turnIdx inicial
          setGameJustStarted(true)
          // ✅ CORREÇÃO: Reseta o flag após um pequeno delay para permitir sincronização normal depois
          setTimeout(() => setGameJustStarted(false), 3000)
          setPhase('game')
          setLog(['Jogo iniciado!'])
          console.log('[App] START aplicado - turnIdx: 0, jogadores:', mapped.length, 'nomes:', mapped.map(p => p.name))
          return
        }

        if (d.type === 'TURNLOCK') {
          setTurnLock(!!d.value)
          return
        }

        if (d.type === 'SYNC' && phase === 'game') {
          console.log('[App] SYNC recebido - turnIdx:', d.turnIdx, 'round:', d.round, 'source:', d.source)
          console.log('[App] SYNC - meu turnIdx atual:', turnIdx, 'meu myUid:', myUid)
          console.log('[App] SYNC - jogadores locais:', players.map(p => ({ id: p.id, name: p.name })))
          console.log('[App] SYNC - jogadores remotos:', d.players?.map(p => ({ id: p.id, name: p.name })))
          
          // ✅ CORREÇÃO: Sincroniza turnIdx e round DEPOIS de processar jogadores
          // Isso garante que os jogadores estejam atualizados antes de verificar quem é o dono do turno
          // Não sincroniza turnIdx aqui ainda - será feito depois de processar os jogadores
          
          // ✅ CORREÇÃO: Preserva dados locais do próprio jogador, aplica dados sincronizados de outros
          // ✅ CORREÇÃO: Garante que TODOS os jogadores sejam mantidos (mescla local + remoto)
          const currentPlayers = players
          const syncedPlayersMap = new Map()
          
          // Primeiro, adiciona todos os jogadores locais
          currentPlayers.forEach(p => {
            syncedPlayersMap.set(String(p.id), p)
          })
          
          // Depois, mescla com jogadores remotos
          if (Array.isArray(d.players)) {
            d.players.forEach(syncedPlayer => {
              const playerId = String(syncedPlayer.id)
              const localPlayer = syncedPlayersMap.get(playerId)
              
              if (localPlayer) {
                // Se é o próprio jogador, preserva TODOS os dados locais
                if (String(syncedPlayer.id) === String(myUid)) {
                  syncedPlayersMap.set(playerId, {
                    ...localPlayer,
                    // Aplica apenas certificados e treinamentos sincronizados (se houver)
                    az: syncedPlayer.az || localPlayer.az || 0,
                    am: syncedPlayer.am || localPlayer.am || 0,
                    rox: syncedPlayer.rox || localPlayer.rox || 0,
                    trainingsByVendor: syncedPlayer.trainingsByVendor || localPlayer.trainingsByVendor || {},
                    onboarding: syncedPlayer.onboarding !== undefined ? syncedPlayer.onboarding : localPlayer.onboarding
                  })
                } else {
                  // Para outros jogadores, aplica dados sincronizados (preservando progresso)
                  syncedPlayersMap.set(playerId, {
                    ...syncedPlayer,
                    // Preserva certificados e treinamentos locais (dados de progresso)
                    az: localPlayer.az || syncedPlayer.az || 0,
                    am: localPlayer.am || syncedPlayer.am || 0,
                    rox: localPlayer.rox || syncedPlayer.rox || 0,
                    trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
                    onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
                  })
                }
              } else {
                // Novo jogador remoto (não existe localmente)
                syncedPlayersMap.set(playerId, syncedPlayer)
              }
            })
          }
          
          // Converte Map para array, mantendo a ordem dos jogadores remotos (se existir)
          let syncedPlayers = []
          if (Array.isArray(d.players) && d.players.length > 0) {
            syncedPlayers = d.players.map(sp => {
              const playerId = String(sp.id)
              return syncedPlayersMap.get(playerId) || sp
            })
          } else {
            // Se não há jogadores remotos, usa os locais
            syncedPlayers = Array.from(syncedPlayersMap.values())
          }
          
          // Adiciona jogadores locais que não estão no remoto (segurança)
          currentPlayers.forEach(p => {
            const playerId = String(p.id)
            if (!syncedPlayers.find(sp => String(sp.id) === playerId)) {
              syncedPlayers.push(p)
            }
          })
          
          console.log('[App] SYNC aplicado - novo turnIdx:', d.turnIdx)
          console.log('[App] SYNC - jogadores após sincronização:', syncedPlayers.map(p => ({ id: p.id, name: p.name })))
          
          // ✅ CORREÇÃO: Atualiza myUid se necessário quando os jogadores são sincronizados
          // Isso garante que o myUid corresponda ao jogador correto na lista sincronizada
          try {
            // Tenta encontrar o jogador pelo nome salvo primeiro
            const mineByName = syncedPlayers.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
            if (mineByName?.id && String(mineByName.id) !== String(myUid)) {
              console.log('[App] SYNC - Atualizando myUid pelo nome - antigo:', myUid, 'novo:', mineByName.id)
              setMyUid(String(mineByName.id))
            }
            // Se não encontrou pelo nome, tenta pelo window.__MY_UID
            else if (!mineByName) {
              const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
              if (wuid && syncedPlayers.find(p => String(p.id) === String(wuid))) {
                if (String(wuid) !== String(myUid)) {
                  console.log('[App] SYNC - Atualizando myUid pelo window.__MY_UID - antigo:', myUid, 'novo:', wuid)
                  setMyUid(String(wuid))
                }
              }
            }
          } catch (e) {
            console.warn('[App] SYNC - Erro ao atualizar myUid:', e)
          }
          
          setPlayers(syncedPlayers)
          
          // ✅ CORREÇÃO: Sincroniza turnIdx e round DEPOIS de atualizar jogadores
          // Isso garante que os jogadores estejam atualizados antes de verificar quem é o dono do turno
          const turnIdxChanged = round === 1 && turnIdx === 0 && d.turnIdx > 0 ? false : (d.turnIdx !== turnIdx)
          
          // ✅ CORREÇÃO: Se gameJustStarted está ativo, ignora sincronização de turnIdx remoto
          if (gameJustStarted && d.turnIdx !== undefined && d.turnIdx !== turnIdx) {
            console.log('[App] SYNC - gameJustStarted ativo - ignorando sincronização de turnIdx remoto - remoto:', d.turnIdx, 'local:', turnIdx)
          } else if (round === 1 && turnIdx === 0 && d.turnIdx > 0) {
            console.log('[App] SYNC - Ignorando sincronização de turnIdx remoto (jogo acabou de começar) - remoto:', d.turnIdx, 'local:', turnIdx)
          }
          // ✅ CORREÇÃO: Se o round remoto é menor que o local, ignora (estado antigo do BroadcastChannel)
          else if (d.round !== undefined && d.round < round) {
            console.log('[App] SYNC - Ignorando sincronização de turnIdx remoto (round remoto é menor) - remoto round:', d.round, 'local round:', round, 'turnIdx remoto:', d.turnIdx, 'turnIdx local:', turnIdx)
          }
          // ✅ CORREÇÃO: BroadcastChannel tem prioridade sobre Supabase - sempre sincroniza se o turnIdx é diferente
          else if (d.turnIdx !== undefined && d.turnIdx !== turnIdx) {
            console.log('[App] SYNC - Sincronizando turnIdx (BroadcastChannel) - remoto:', d.turnIdx, 'local:', turnIdx, 'round remoto:', d.round, 'round local:', round)
            setTurnIdx(d.turnIdx)
          }
          
          // ✅ CORREÇÃO: Sincroniza round também
          if (d.round !== undefined && d.round !== round) {
            setRound(d.round)
          }
          
          console.log('[App] SYNC - jogador da vez:', syncedPlayers[d.turnIdx]?.name, 'id:', syncedPlayers[d.turnIdx]?.id)
          console.log('[App] SYNC - é minha vez?', String(syncedPlayers[d.turnIdx]?.id) === String(myUid))
          
          // ✅ CORREÇÃO: Se o turnIdx mudou e agora é minha vez, desativa o turnLock para permitir que eu jogue
          if (turnIdxChanged && d.turnIdx !== undefined) {
            const newTurnPlayerId = syncedPlayers[d.turnIdx]?.id
            if (newTurnPlayerId && String(newTurnPlayerId) === String(myUid)) {
              console.log('[App] SYNC - Turno mudou para mim, desativando turnLock')
              setTurnLock(false)
            }
          }
          
          // Sincroniza estado do jogo (gameOver e winner)
          if (d.gameOver !== undefined) {
            setGameOver(d.gameOver)
          }
          if (d.winner !== undefined) {
            setWinner(d.winner)
          }
        }
      }
      bcRef.current = bc
      return () => bc.close()
    } catch (e) {
      console.warn('[App] BroadcastChannel init failed:', e)
    }
  }, [syncKey, meId, phase])

  // ====== Gerenciamento de saída de salas de jogo ======
  useEffect(() => {
    const handleLeaveRoom = async () => {
      console.log(`[App] handleLeaveRoom chamado - fase: ${phase}, currentLobbyId: ${currentLobbyId}, myUid: ${myUid}`)
      
      // Executa se estivermos em uma sala (lobbies ou game) e tivermos IDs válidos
      if ((phase === 'lobbies' || phase === 'playersLobby' || phase === 'game') && currentLobbyId && myUid) {
        try {
          console.log(`[App] Saindo da sala ${currentLobbyId} na fase ${phase}`)
          await leaveRoom({ roomCode: currentLobbyId, playerId: myUid })
        } catch (error) {
          console.warn('[App] Erro ao sair da sala:', error)
        }
      } else {
        console.log(`[App] Não executando leaveRoom - condições não atendidas`)
      }
    }

    // Event listeners para detectar saída
    const handleBeforeUnload = () => {
      // Executa a saída da sala de forma síncrona
      handleLeaveRoom()
    }

    const handlePageHide = () => {
      handleLeaveRoom()
    }

    // Adiciona os event listeners
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [phase, currentLobbyId, myUid])

  const setTurnLockBroadcast = (value) => {
    const v = !!value
    setTurnLock(v)
    try {
      bcRef.current?.postMessage?.({ type: 'TURNLOCK', value: v, source: meId })
    } catch {}
  }

  // ====== multiplayer em rede (opcional) via provider
  let net = null
  try {
    net = useGameNet?.() || null
  } catch (error) {
    console.warn('[App] useGameNet not available:', error)
  }
  const netCommit = net?.commit
  const netVersion = net?.version
  const netState = net?.state

  // ✅ CORREÇÃO: Flag para rastrear se o jogo acabou de começar
  const [gameJustStarted, setGameJustStarted] = useState(false)
  
  useEffect(() => {
    if (!netState) return
    const np = Array.isArray(netState.players) ? netState.players : null
    const nt = Number.isInteger(netState.turnIdx) ? netState.turnIdx : null
    const nr = Number.isInteger(netState.round) ? netState.round : null

    let changed = false
    
    // ✅ CORREÇÃO: Se o jogo acabou de começar (gameJustStarted = true), força turnIdx = 0
    // Se o estado remoto tem turnIdx > 0 e round === 1, pode ser um estado antigo - corrige
    if (gameJustStarted && nt !== null && nt !== 0 && nr === 1) {
      console.log('[NET] Jogo acabou de começar - estado remoto tem turnIdx incorreto:', nt, '- corrigindo para 0')
      // Força turnIdx = 0 no commit remoto também
      if (typeof netCommit === 'function') {
        commitRemoteState(np || players, 0, 1).catch(err => console.warn('[NET] Erro ao corrigir turnIdx:', err))
      }
      // Não atualiza o turnIdx local - mantém 0
      return
    }
    
    if (np && JSON.stringify(np) !== JSON.stringify(players)) { 
      console.log('[NET] Sincronizando jogadores - local:', players.length, 'remoto:', np.length)
      console.log('[NET] Jogadores locais:', players.map(p => ({ id: p.id, name: p.name })))
      console.log('[NET] Jogadores remotos:', np.map(p => ({ id: p.id, name: p.name })))
      
      // ✅ CORREÇÃO: Preserva dados locais do próprio jogador, aplica dados sincronizados de outros
      // ✅ CORREÇÃO: Garante que TODOS os jogadores sejam mantidos (mescla local + remoto)
      const currentPlayers = players
      const syncedPlayersMap = new Map()
      
      // Primeiro, adiciona todos os jogadores locais
      currentPlayers.forEach(p => {
        syncedPlayersMap.set(String(p.id), p)
      })
      
      // Depois, mescla com jogadores remotos
      np.forEach(syncedPlayer => {
        const playerId = String(syncedPlayer.id)
        const localPlayer = syncedPlayersMap.get(playerId)
        
        if (localPlayer) {
          // Se é o próprio jogador, preserva TODOS os dados locais
          if (String(syncedPlayer.id) === String(myUid)) {
            syncedPlayersMap.set(playerId, {
              ...localPlayer,
              // Aplica apenas certificados e treinamentos sincronizados (se houver)
              az: syncedPlayer.az || localPlayer.az || 0,
              am: syncedPlayer.am || localPlayer.am || 0,
              rox: syncedPlayer.rox || localPlayer.rox || 0,
              trainingsByVendor: syncedPlayer.trainingsByVendor || localPlayer.trainingsByVendor || {},
              onboarding: syncedPlayer.onboarding !== undefined ? syncedPlayer.onboarding : localPlayer.onboarding
            })
          } else {
            // Para outros jogadores, aplica dados sincronizados (preservando progresso)
            syncedPlayersMap.set(playerId, {
              ...syncedPlayer,
              // Preserva certificados e treinamentos locais (dados de progresso)
              az: localPlayer.az || syncedPlayer.az || 0,
              am: localPlayer.am || syncedPlayer.am || 0,
              rox: localPlayer.rox || syncedPlayer.rox || 0,
              trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
              onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
            })
          }
        } else {
          // Novo jogador remoto (não existe localmente)
          syncedPlayersMap.set(playerId, syncedPlayer)
        }
      })
      
      // Converte Map para array, mantendo a ordem dos jogadores remotos
      const syncedPlayers = np.map(sp => {
        const playerId = String(sp.id)
        return syncedPlayersMap.get(playerId) || sp
      })
      
      // Adiciona jogadores locais que não estão no remoto (segurança)
      currentPlayers.forEach(p => {
        const playerId = String(p.id)
        if (!np.find(sp => String(sp.id) === playerId)) {
          syncedPlayers.push(p)
        }
      })
      
      console.log('[NET] Jogadores após sincronização:', syncedPlayers.map(p => ({ id: p.id, name: p.name })))
      
      // ✅ CORREÇÃO: Atualiza myUid se necessário quando os jogadores são sincronizados
      // Isso garante que o myUid corresponda ao jogador correto na lista sincronizada
      try {
        // Tenta encontrar o jogador pelo nome salvo primeiro
        const mineByName = syncedPlayers.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
        if (mineByName?.id && String(mineByName.id) !== String(myUid)) {
          console.log('[NET] Sincronizando jogadores - Atualizando myUid pelo nome - antigo:', myUid, 'novo:', mineByName.id)
          setMyUid(String(mineByName.id))
        }
        // Se não encontrou pelo nome, tenta pelo window.__MY_UID
        else if (!mineByName) {
          const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
          if (wuid && syncedPlayers.find(p => String(p.id) === String(wuid))) {
            if (String(wuid) !== String(myUid)) {
              console.log('[NET] Sincronizando jogadores - Atualizando myUid pelo window.__MY_UID - antigo:', myUid, 'novo:', wuid)
              setMyUid(String(wuid))
            }
          }
        }
      } catch (e) {
        console.warn('[NET] Sincronizando jogadores - Erro ao atualizar myUid:', e)
      }
      
      setPlayers(syncedPlayers); 
      changed = true 
    }
    
    // ✅ CORREÇÃO: Só atualiza turnIdx se o jogo já estiver em andamento (round > 1 ou turnIdx > 0)
    // Isso previne que a sincronização sobrescreva o turnIdx inicial (0) quando o jogo acaba de começar
    if (nt !== null && nt !== turnIdx) {
      // Se o jogo acabou de começar (gameJustStarted = true), NUNCA sobrescreve turnIdx = 0
      if (gameJustStarted && turnIdx === 0) {
        console.log('[NET] Jogo acabou de começar - ignorando sincronização de turnIdx remoto (deve ser 0) - remoto:', nt, 'local:', turnIdx, 'round:', round)
      }
      // Se o jogo acabou de começar (round === 1 e turnIdx === 0), não sobrescreve
      // Também não sobrescreve se o turnIdx local é 0 e o remoto é > 0 (jogo deve começar no jogador 1)
      else if ((round === 1 && turnIdx === 0 && nt > 0) || (turnIdx === 0 && nt > 0 && players.length > 0)) {
        console.log('[NET] Ignorando sincronização de turnIdx remoto (jogo deve começar no jogador 1) - remoto:', nt, 'local:', turnIdx, 'round:', round)
      }
      // ✅ CORREÇÃO: Se o turnIdx local é maior que o remoto E estamos no mesmo round, pode ser que o local esteja mais atualizado
      // Não sobrescreve se o turnIdx local é maior que o remoto (prioriza estado local mais recente)
      else if (turnIdx > nt && nr === round) {
        console.log('[NET] Ignorando sincronização de turnIdx remoto (local é mais recente) - remoto:', nt, 'local:', turnIdx, 'round:', round)
      }
      // ✅ CORREÇÃO: Se o round remoto é menor que o local, ignora (estado antigo)
      else if (nr !== null && nr < round) {
        console.log('[NET] Ignorando sincronização de turnIdx remoto (round remoto é menor) - remoto round:', nr, 'local round:', round, 'turnIdx remoto:', nt, 'turnIdx local:', turnIdx)
      }
      else {
        console.log('[NET] Sincronizando turnIdx - remoto:', nt, 'local:', turnIdx, 'round:', round)
        setTurnIdx(nt); 
        changed = true 
      }
    }
    
    if (nr !== null && nr !== round) { 
      console.log('[NET] Sincronizando round - remoto:', nr, 'local:', round)
      setRound(nr); 
      changed = true 
    }

    if (changed) console.log('[NET] applied remote v=%d', netVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netVersion, gameJustStarted])

  async function commitRemoteState(nextPlayers, nextTurnIdx, nextRound) {
    if (typeof netCommit === 'function') {
      try {
        // ✅ CORREÇÃO: Garante que o turnIdx seja sempre 0 ao iniciar o jogo (broadcastStart)
        // Se o round é 1 e o turnIdx é 0, força turnIdx = 0 no commit
        const finalTurnIdx = (nextRound === 1 && nextTurnIdx === 0) ? 0 : nextTurnIdx
        console.log('[NET] commitRemoteState - turnIdx:', finalTurnIdx, 'round:', nextRound, 'players:', nextPlayers.length)
        await netCommit(prev => ({
          ...(prev || {}),
          players: nextPlayers,
          turnIdx: finalTurnIdx,
          round: nextRound,
        }))
      } catch (e) {
        console.warn('[NET] commit failed:', e?.message || e)
      }
    }
  }

  function broadcastState(nextPlayers, nextTurnIdx, nextRound, gameOverState = gameOver, winnerState = winner) {
    // 1) rede
    commitRemoteState(nextPlayers, nextTurnIdx, nextRound)
    // 2) entre abas
    try {
      bcRef.current?.postMessage?.({
        type: 'SYNC',
        players: nextPlayers,
        turnIdx: nextTurnIdx,
        round: nextRound,
        gameOver: gameOverState,
        winner: winnerState,
        source: meId,
      })
    } catch (e) { console.warn('[App] broadcastState failed:', e) }
  }

  function broadcastStart(nextPlayers) {
    console.log('[App] broadcastStart - jogadores:', nextPlayers.map(p => ({ id: p.id, name: p.name })), 'turnIdx: 0')
    // ✅ CORREÇÃO: Garante que o turnIdx seja 0 (jogador 1) ao iniciar o jogo
    // rede
    commitRemoteState(nextPlayers, 0, 1)
    // entre abas
    try {
      bcRef.current?.postMessage?.({
        type: 'START',
        players: nextPlayers,
        turnIdx: 0, // ✅ CORREÇÃO: Garante que o turnIdx seja 0 no START
        round: 1,
        source: meId,
      })
    } catch (e) { console.warn('[App] broadcastStart failed:', e) }
  }

  // ====== "é minha vez?"
  const current = players[turnIdx]
  const isMyTurn = useMemo(() => {
    const owner = players[turnIdx]
    if (!owner) {
      console.log('[App] isMyTurn - owner não encontrado, turnIdx:', turnIdx, 'players.length:', players.length)
      return false
    }
    const isMine = owner.id != null && String(owner.id) === String(myUid)
    console.log('[App] isMyTurn - owner:', owner.name, 'id:', owner.id, 'myUid:', myUid, 'isMine:', isMine)
    return isMine
  }, [players, turnIdx, myUid])

  // ====== Validação do estado do jogo (modo debug)
  useEffect(() => {
    if (phase === 'game') {
      validateGameState(players, turnIdx, round, gameOver, winner, 'Game State Update')
      // Validação em tempo real adicional
      validateGameStateRealTime(players, turnIdx, round, gameOver, winner, 'Real-time Validation')
    }
  }, [players, turnIdx, round, gameOver, winner, phase])

  // ====== HUD -> possibAt & clientsAt sincronizados do meu jogador
  useEffect(() => {
    const mine = players.find(isMine)
    if (!mine) return
    const { cap, inAtt } = capacityAndAttendance(mine)
    setMeHud(h => ({ ...h, cash: mine.cash, possibAt: cap, clientsAt: inAtt, name: mine.name, color: mine.color }))
  }, [players, isMine])

  // ====== Totais do HUD (faturamento/ despesas / etc.)
  const totals = useMemo(() => {
    const me = players.find(isMine) || players[0] || {}
    const fat = computeFaturamentoFor(me)
    const desp = computeDespesasFor(me)
    const { cap, inAtt } = capacityAndAttendance(me)
    const lvl = String(me.erpLevel || 'D').toUpperCase()
    const managerQty = Number(me.gestores ?? me.gestoresComerciais ?? me.managers ?? 0)
    
    console.log('[App] Totals recalculado - me:', me.name, 'clients:', me.clients, 'faturamento:', fat, 'manutencao:', desp, 'vendedoresComuns:', me.vendedoresComuns, 'fieldSales:', me.fieldSales, 'insideSales:', me.insideSales)
    
    // Validação de cálculos em modo debug
    validateCalculations(me, 'HUD Totals')
    
    return {
      faturamento: fat,
      manutencao: desp,
      emprestimos: (me.loanPending && !me.loanPending.charged) ? Number(me.loanPending.amount || 0) : 0,
      vendedoresComuns: me.vendedoresComuns || 0,
      fieldSales: me.fieldSales || 0,
      insideSales: me.insideSales || 0,
      mixProdutos: me.mixProdutos || 'D',
      bens: me.bens ?? 0,
      erpSistemas: lvl,
      clientes: me.clients || 0,
      onboarding: !!me.onboarding,
      az: me.az || 0, am: me.am || 0, rox: me.rox || 0,
      gestores: managerQty,
      gestoresComerciais: managerQty,
      possibAt: cap,
      clientsAt: inAtt,
    }
  }, [players, isMine])

  // ====== overlay "falido" (mostra quando eu declaro falência)
  const [showBankruptOverlay, setShowBankruptOverlay] = useState(false)

  // ====== Hook do motor de turnos (centraliza TODA a lógica pesada)
  // Este hook DEVE ser chamado ANTES dos returns condicionais para manter consistência de hooks
  const {
    advanceAndMaybeLap,
    onAction,
    nextTurn,
    modalLocks,
  } = useTurnEngine({
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
    phase, // Passar a fase como prop
  })

  // ====== fases ======

  // 1) Tela inicial: pega o nome e vai para Lobbies
  if (phase === 'start') {
    return (
      <StartScreen
        onEnter={(typedName) => {
          const name = getOrSetTabPlayerName(typedName || 'Jogador')
          setPlayers([applyStarterKit({ id: meId, name, cash: 18000, pos: 0, color: '#ffd54f', bens: 4000 })])
          setRound(1); setTurnIdx(0); setGameOver(false); setWinner(null)
          setRoundFlags(new Array(1).fill(false))
          setPhase('lobbies')
          setMeHud(h => ({ ...h, name }))
          setLog([`Bem-vindo, ${name}!`])
        }}
      />
    )
  }

  // 2) Lista de lobbies
  if (phase === 'lobbies') {
    return (
      <LobbyList
        onEnterRoom={(id) => {
          setCurrentLobbyId(id)
          window.__setRoomCode?.(id)
          try {
            localStorage.setItem('sg:lastRoomName', String(id))
            const url = new URL(window.location.href)
            url.searchParams.set('room', String(id))
            history.replaceState(null, '', url.toString())
          } catch {}
          setPhase('playersLobby')
        }}
      />
    )
  }

  // 3) Lobby dos jogadores (aguarda e inicia)
  if (phase === 'playersLobby') {
    return (
      <PlayersLobby
        lobbyId={currentLobbyId}
        onBack={() => {
          window.__setRoomCode?.(null)
          setPhase('lobbies')
        }}
        onStartGame={(payload) => {
          // nome/uuid da sala
          const roomName =
            payload?.lobbyName ||
            payload?.lobby?.name ||
            payload?.name ||
            currentLobbyId ||
            'sala-demo'
          try {
            localStorage.setItem('sg:lastRoomName', String(roomName))
            const url = new URL(window.location.href)
            url.searchParams.set('room', String(roomName))
            history.replaceState(null, '', url.toString())
            if (!sessionStorage.getItem('sg:room-reloaded')) {
              sessionStorage.setItem('sg:room-reloaded', '1')
              location.reload()
              return
            }
          } catch {}

          // normaliza jogadores vindos do lobby
          const raw = Array.isArray(payload) ? payload : (payload?.players ?? payload?.lobbyPlayers ?? [])
          const mapped = raw.map((p, i) =>
            applyStarterKit({
              id: String(p.id ?? p.player_id),
              name: p.name ?? p.player_name,
              cash: 18000,
              pos: 0,
              bens: 4000,
              color: ['#ffd54f','#90caf9','#a5d6a7','#ffab91'][i % 4]
            })
          )
          if (mapped.length === 0) return

          // alinha meu UID com o id real (comparando pelo nome salvo)
          try {
            const mine = mapped.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
            if (mine?.id) setMyUid(String(mine.id))
          } catch {}

          setPlayers(mapped)
          setTurnIdx(0)
          setRound(1)
          setRoundFlags(new Array(mapped.length).fill(false))
          setGameOver(false); setWinner(null)
          setMeHud(h => {
            const mine = mapped.find(isMine)
            return {
              ...h,
              name: mine?.name || mapped[0]?.name || 'Jogador',
              color: mine?.color || mapped[0]?.color || '#6c5ce7',
              cash: mine?.cash ?? 18000,
              possibAt: 0, clientsAt: 0
            }
          })
          setLog(['Jogo iniciado!'])
          // ✅ CORREÇÃO: Marca que o jogo acabou de começar para proteger o turnIdx inicial
          setGameJustStarted(true)
          // ✅ CORREÇÃO: Reseta o flag após um pequeno delay para permitir sincronização normal depois
          setTimeout(() => setGameJustStarted(false), 3000)
          broadcastStart(mapped)
          setPhase('game')
        }}
      />
    )
  }

  // 4) Jogo
  if (phase === 'game') {
    return (
    <div className="page">
      <header className="topbar">
        <div className="status" style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span
            style={{
              width:18, height:18, borderRadius:'50%',
              border:'2px solid rgba(255,255,255,.9)',
              boxShadow:'0 0 0 2px rgba(0,0,0,.25)',
              background: meHud.color
            }}
          />
          <span style={{
            background:'#1f2430', border:'1px solid rgba(255,255,255,.12)',
            borderRadius:10, padding:'4px 10px', fontWeight:800
          }}>
            👤 {meHud.name}
          </span>
          <span>Possib. Atendimento: <b>{meHud.possibAt ?? 0}</b></span>
          <span>Clientes em Atendimento: <b>{meHud.clientsAt ?? 0}</b></span>
          <DebugPanel players={players} turnIdx={turnIdx} round={round} gameOver={gameOver} winner={winner} />
        </div>

        <div className="status" style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span>Rodada: {round}</span>
          <span className="money">💵 $ {Number(myCash).toLocaleString()}</span>
        </div>
      </header>

      <main className="content">
        <div className="boardWrap">
          <Board
            players={players}
            turnIdx={turnIdx}
            onMeHud={setMeHud}
          />
        </div>

        <aside className="side">
          <HUD totals={totals} players={players} />

          {/* CONTROLES FIXOS NO RODAPÉ DA SIDEBAR */}
          <div className="controlsSticky">
            <Controls
              onAction={(act) => {
                // Encaminha para o motor de turnos
                onAction(act)
              }}
              current={current}
              isMyTurn={isMyTurn}
              turnLocked={turnLock}
            />
            <div style={{ marginTop: 10 }}>
              <button
                className="btn dark"
                onClick={async () => {
                  // Remove o jogador da sala antes de sair
                  if (currentLobbyId && myUid) {
                    try {
                      await leaveRoom({ roomCode: currentLobbyId, playerId: myUid })
                    } catch (error) {
                      console.warn('[App] Erro ao sair da sala:', error)
                    }
                  }
                  window.__setRoomCode?.(null) // pausa sync remoto ao sair
                  setPhase('lobbies')
                }}
              >
                Sair para Lobbies
              </button>
            </div>
          </div>

          {/* Tela final (pódio Top 3) */}
          {gameOver && (
            <FinalWinners
              players={players}
              onExit={async () => {
                // Remove o jogador da sala antes de sair
                if (currentLobbyId && myUid) {
                  try {
                    await leaveRoom({ roomCode: currentLobbyId, playerId: myUid })
                  } catch (error) {
                    console.warn('[App] Erro ao sair da sala:', error)
                  }
                }
                window.__setRoomCode?.(null)
                setPhase('lobbies')
              }}
              onRestart={() => {
                const reset = players.map(p => applyStarterKit({ ...p, cash:18000, bens:4000, pos:0 }))
                setPlayers(reset)
                setTurnIdx(0)
                setRound(1)
                setRoundFlags(new Array(reset.length).fill(false))
                setLog(['Novo jogo iniciado!'])
                setGameOver(false)
                setWinner(null)
              }}
            />
          )}
        </aside>
      </main>

      <footer className="foot">
        <small>Desenvolvido por <a href="https://www.tironitech.com" target="_blank" rel="noreferrer">tironitech.com</a></small>
      </footer>

      {/* Overlay persistente de FALÊNCIA para o meu jogador */}
      {showBankruptOverlay && <BankruptOverlay />}
    </div>
  )
  }

  // Fallback para fases não reconhecidas
  return <div>Fase não reconhecida: {phase}</div>
}
