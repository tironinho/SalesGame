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
import { getOrCreateTabPlayerId, getOrSetTabPlayerName, setTabPlayerName } from './auth'

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
    lap: obj.lap ?? 0, // ✅ CORREÇÃO: Inicializa lap sempre
    tile: obj.tile ?? obj.pos ?? 0, // ✅ CORREÇÃO: Garante tile inicializado
    pos: obj.pos ?? obj.tile ?? 0, // mantém compatibilidade
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
  const lastSeqRef = useRef(0)  // seq monotônico para evitar estados antigos

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

          // ✅ CORREÇÃO CRÍTICA: Prioriza window.__MY_UID e valida nome
          try {
            const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
            if (wuid) {
              const foundPlayer = mapped.find(p => String(p.id) === String(wuid))
              if (foundPlayer) {
                const nameMatches = (String(foundPlayer.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase())
                if (String(foundPlayer.id) !== String(myUid)) {
                  console.log('[App] START - Atualizando myUid pelo window.__MY_UID - antigo:', myUid, 'novo:', wuid, 'player:', foundPlayer.name, 'myName:', myName, 'nome corresponde:', nameMatches)
                  if (nameMatches) {
                    setMyUid(String(wuid))
                  } else {
                    console.warn('[App] START - ⚠️ window.__MY_UID encontrou jogador mas nome não corresponde! Ignorando atualização.')
                  }
                }
              }
            } else {
              // Se não encontrou pelo window.__MY_UID, tenta pelo nome
              const mineByName = mapped.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
              if (mineByName?.id && String(mineByName.id) !== String(myUid)) {
                console.log('[App] START - Atualizando myUid pelo nome - antigo:', myUid, 'novo:', mineByName.id, 'player:', mineByName.name)
                setMyUid(String(mineByName.id))
              }
            }
          } catch (e) {
            console.warn('[App] START - Erro ao atualizar myUid:', e)
          }

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

        // ✅ CORREÇÃO: Suporta tanto SYNC (antigo) quanto GAME_STATE (novo com seq)
        if ((d.type === 'SYNC' || d.type === 'GAME_STATE') && phase === 'game') {
          // Para GAME_STATE, verifica seq para evitar estados antigos/duplicados
          if (d.type === 'GAME_STATE' && typeof d.seq === 'number') {
            if (d.seq <= lastSeqRef.current) {
              console.log(`[App] GAME_STATE - ⚠️ Ignorando estado antigo (seq: ${d.seq} <= lastSeq: ${lastSeqRef.current})`)
              return
            }
            lastSeqRef.current = d.seq
            console.log(`[App] GAME_STATE - ✅ Seq válido: ${d.seq}`)
          }
          
          console.group(`[App] ${d.type} recebido - turnIdx: ${d.turnIdx}, round: ${d.round}, source: ${d.source}${d.seq ? `, seq: ${d.seq}` : ''}`)
          console.log('[App] SYNC - meu turnIdx atual:', turnIdx, 'meu myUid:', myUid, 'meId:', meId)
          console.log('[App] SYNC - jogadores locais:', players.map(p => ({ id: p.id, name: p.name })))
          console.log('[App] SYNC - jogadores remotos:', d.players?.map(p => ({ id: p.id, name: p.name })))
          
          // ✅ CORREÇÃO CRÍTICA: Se o SYNC/GAME_STATE é do próprio cliente, ignora (evita loop de sincronização)
          if (String(d.source) === String(meId)) {
            console.log(`[App] ${d.type} - ⚠️ Ignorando ${d.type} do próprio cliente (source: ${d.source}, meId: ${meId})`)
            console.groupEnd()
            return
          }
          
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
            // ✅ CORREÇÃO CRÍTICA: Prioriza window.__MY_UID sobre busca por nome
            const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
            if (wuid) {
              const foundPlayerByWindow = syncedPlayers.find(p => String(p.id) === String(wuid))
              if (foundPlayerByWindow) {
                // Valida que o nome corresponde
                const nameMatches = (String(foundPlayerByWindow.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase())
                if (String(foundPlayerByWindow.id) !== String(myUid)) {
                  console.log('[App] SYNC - Atualizando myUid pelo window.__MY_UID - antigo:', myUid, 'novo:', wuid, 'player:', foundPlayerByWindow.name, 'myName:', myName, 'nome corresponde:', nameMatches)
                  if (nameMatches) {
                    setMyUid(String(wuid))
                  } else {
                    console.warn('[App] SYNC - ⚠️ window.__MY_UID encontrou jogador mas nome não corresponde! Ignorando atualização.')
                  }
                }
              }
            }
            
            // Se não encontrou pelo window.__MY_UID, tenta pelo nome (mas valida)
            if (!wuid || !syncedPlayers.find(p => String(p.id) === String(wuid))) {
              const mineByName = syncedPlayers.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
              if (mineByName?.id && String(mineByName.id) !== String(myUid)) {
                // Só atualiza se não houver window.__MY_UID ou se corresponder
                if (!wuid || String(wuid) === String(mineByName.id)) {
                  console.log('[App] SYNC - Atualizando myUid pelo nome - antigo:', myUid, 'novo:', mineByName.id, 'player:', mineByName.name)
                  setMyUid(String(mineByName.id))
                } else {
                  console.warn('[App] SYNC - ⚠️ Jogador encontrado pelo nome mas window.__MY_UID é diferente! Ignorando atualização.')
                }
              }
            }
          } catch (e) {
            console.warn('[App] SYNC - Erro ao atualizar myUid:', e)
          }
          
          setPlayers(syncedPlayers)
          
          // ✅ CORREÇÃO: Sincroniza turnIdx e round DEPOIS de atualizar jogadores
          // Isso garante que os jogadores estejam atualizados antes de verificar quem é o dono do turno
          // ✅ CORREÇÃO CRÍTICA: Se gameJustStarted está ativo, NUNCA sincroniza turnIdx remoto
          if (gameJustStarted) {
            if (d.turnIdx !== undefined && d.turnIdx !== turnIdx) {
              console.log('[App] SYNC - ⚠️ gameJustStarted ativo - IGNORANDO sincronização de turnIdx remoto - remoto:', d.turnIdx, 'local:', turnIdx, 'round:', round)
            }
            // Força turnIdx = 0 se o round é 1 (jogo acabou de começar)
            if (round === 1 && turnIdx !== 0) {
              console.log('[App] SYNC - ⚠️ gameJustStarted ativo - FORÇANDO turnIdx = 0 (jogo deve começar no jogador 1)')
              setTurnIdx(0)
            }
          }
          // Se o jogo acabou de começar (round === 1 e turnIdx === 0), não sobrescreve
          else if (round === 1 && turnIdx === 0 && d.turnIdx !== undefined && d.turnIdx !== turnIdx) {
            if (d.turnIdx > 0) {
              console.log('[App] SYNC - ⚠️ Ignorando sincronização de turnIdx remoto (jogo acabou de começar - deve ser 0) - remoto:', d.turnIdx, 'local:', turnIdx)
            } else {
              // Se o remoto também é 0, está ok
              console.log('[App] SYNC - ✅ Sincronizando turnIdx (BroadcastChannel) - ambos são 0 - remoto:', d.turnIdx, 'local:', turnIdx)
            }
          }
          // ✅ CORREÇÃO: Se o round remoto é menor que o local, ignora (estado antigo do BroadcastChannel)
          // ✅ CORREÇÃO CRÍTICA: Mas só ignora se o turnIdx remoto também for menor ou igual (para não bloquear avanços válidos)
          else if (d.round !== undefined && d.round < round) {
            console.log('[App] SYNC - Ignorando sincronização de turnIdx remoto (round remoto é menor) - remoto round:', d.round, 'local round:', round, 'turnIdx remoto:', d.turnIdx, 'turnIdx local:', turnIdx)
          }
          // ✅ CORREÇÃO CRÍTICA: Se o round remoto é igual ao local mas o turnIdx remoto é maior, significa que outro jogador avançou - DEVE sincronizar
          else if (d.round !== undefined && d.round === round && d.turnIdx !== undefined && d.turnIdx > turnIdx) {
            console.log('[App] SYNC - ✅ Sincronizando turnIdx (outro jogador avançou) - remoto:', d.turnIdx, 'local:', turnIdx, 'round:', round)
            setTurnIdx(d.turnIdx)
          }
          // ✅ CORREÇÃO: BroadcastChannel tem prioridade sobre Supabase - sempre sincroniza se o turnIdx é diferente e o round é igual ou maior
          else if (d.turnIdx !== undefined && d.turnIdx !== turnIdx && (d.round === undefined || d.round >= round)) {
            console.log('[App] SYNC - Sincronizando turnIdx (BroadcastChannel) - remoto:', d.turnIdx, 'local:', turnIdx, 'round remoto:', d.round, 'round local:', round)
            setTurnIdx(d.turnIdx)
          }
          
          // ✅ CORREÇÃO: Calcula turnIdxChanged DEPOIS de todas as verificações acima
          const turnIdxChanged = (d.turnIdx !== undefined && d.turnIdx !== turnIdx) && !gameJustStarted && !(round === 1 && turnIdx === 0 && d.turnIdx > 0)
          
          // ✅ CORREÇÃO: Sincroniza round também
          if (d.round !== undefined && d.round !== round) {
            setRound(d.round)
          }
          
          // ✅ CORREÇÃO: Usa o turnIdx local (que pode ter sido atualizado ou não) para verificar o jogador da vez
          const currentTurnIdx = turnIdx // Usa o turnIdx local atual, não o remoto
          console.log('[App] SYNC - jogador da vez (turnIdx local):', syncedPlayers[currentTurnIdx]?.name, 'id:', syncedPlayers[currentTurnIdx]?.id, 'turnIdx:', currentTurnIdx)
          console.log('[App] SYNC - é minha vez?', String(syncedPlayers[currentTurnIdx]?.id) === String(myUid), 'myUid:', myUid)
          
          // ✅ CORREÇÃO: Se o turnIdx mudou e agora é minha vez, desativa o turnLock para permitir que eu jogue
          if (turnIdxChanged && d.turnIdx !== undefined) {
            const newTurnPlayerId = syncedPlayers[d.turnIdx]?.id
            const isMyTurnNow = newTurnPlayerId && String(newTurnPlayerId) === String(myUid)
            console.log('[App] SYNC - Turno mudou - novo jogador:', newTurnPlayerId, 'myUid:', myUid, 'é minha vez?', isMyTurnNow)
            if (isMyTurnNow) {
              console.log('[App] SYNC - Turno mudou para mim, desativando turnLock')
              setTurnLock(false)
            }
          }
          // ✅ CORREÇÃO: Mesmo se turnIdx não mudou, verifica se é minha vez e desativa turnLock se necessário
          // ✅ CORREÇÃO CRÍTICA: Também verifica se o myUid precisa ser atualizado
          else {
            const currentTurnPlayerId = syncedPlayers[currentTurnIdx]?.id
            const isMyTurnNow = currentTurnPlayerId && String(currentTurnPlayerId) === String(myUid)
            if (isMyTurnNow && turnLock) {
              console.log('[App] SYNC - É minha vez e turnLock está ativo, desativando turnLock')
              setTurnLock(false)
            }
            // ✅ CORREÇÃO: Se o turnIdx indica que é minha vez mas o myUid não corresponde, tenta atualizar
            // Mas só atualiza se validado pelo window.__MY_UID
            else if (!isMyTurnNow && currentTurnPlayerId) {
              const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
              if (wuid) {
                const foundPlayerByWindow = syncedPlayers.find(p => String(p.id) === String(wuid))
                if (foundPlayerByWindow && String(foundPlayerByWindow.id) !== String(myUid)) {
                  const nameMatches = (String(foundPlayerByWindow.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase())
                  if (nameMatches) {
                    console.log('[App] SYNC - ⚠️ myUid não corresponde ao owner.id - Atualizando myUid pelo window.__MY_UID - antigo:', myUid, 'novo:', wuid, 'player:', foundPlayerByWindow.name, 'owner.id:', currentTurnPlayerId)
                    setMyUid(String(wuid))
                  } else {
                    console.warn('[App] SYNC - ⚠️ window.__MY_UID encontrou jogador mas nome não corresponde! Ignorando atualização.')
                  }
                }
              }
            }
          }
          
          // Sincroniza estado do jogo (gameOver e winner)
          if (d.gameOver !== undefined) {
            setGameOver(d.gameOver)
          }
          if (d.winner !== undefined) {
            setWinner(d.winner)
          }
          
          console.groupEnd()
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
          
          // ✅ CORREÇÃO: Ao sair da sala, zera tudo (tick, locks, pendingTurnData)
          // O useEffect de phase no useTurnEngine já faz isso, mas garantimos aqui também
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

    // ✅ CORREÇÃO: Log detalhado para debug quando WebSocket falha
    if (nt !== null && nt !== turnIdx) {
      console.log('[NET] ⚠️ turnIdx divergente detectado - remoto:', nt, 'local:', turnIdx, 'round remoto:', nr, 'round local:', round, 'gameJustStarted:', gameJustStarted)
    }

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
        // ✅ CORREÇÃO CRÍTICA: Prioriza window.__MY_UID sobre busca por nome
        const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
        if (wuid) {
          const foundPlayerByWindow = syncedPlayers.find(p => String(p.id) === String(wuid))
          if (foundPlayerByWindow) {
            const nameMatches = (String(foundPlayerByWindow.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase())
            if (String(foundPlayerByWindow.id) !== String(myUid)) {
              console.log('[NET] Sincronizando jogadores - Atualizando myUid pelo window.__MY_UID - antigo:', myUid, 'novo:', wuid, 'player:', foundPlayerByWindow.name, 'myName:', myName, 'nome corresponde:', nameMatches)
              if (nameMatches) {
                setMyUid(String(wuid))
              } else {
                console.warn('[NET] ⚠️ window.__MY_UID encontrou jogador mas nome não corresponde! Ignorando atualização.')
              }
            }
          }
        }
        
        // Se não encontrou pelo window.__MY_UID, tenta pelo nome (mas valida)
        if (!wuid || !syncedPlayers.find(p => String(p.id) === String(wuid))) {
          const mineByName = syncedPlayers.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
          if (mineByName?.id && String(mineByName.id) !== String(myUid)) {
            if (!wuid || String(wuid) === String(mineByName.id)) {
              console.log('[NET] Sincronizando jogadores - Atualizando myUid pelo nome - antigo:', myUid, 'novo:', mineByName.id, 'player:', mineByName.name)
              setMyUid(String(mineByName.id))
            } else {
              console.warn('[NET] ⚠️ Jogador encontrado pelo nome mas window.__MY_UID é diferente! Ignorando atualização.')
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
        // ✅ CORREÇÃO CRÍTICA: Se gameJustStarted está ativo, NUNCA sobrescreve turnIdx
        if (gameJustStarted) {
          console.log('[NET] ⚠️ gameJustStarted ativo - IGNORANDO sincronização de turnIdx remoto - remoto:', nt, 'local:', turnIdx, 'round:', round)
          // Força turnIdx = 0 se o round é 1 (jogo acabou de começar)
          if (round === 1 && turnIdx !== 0) {
            console.log('[NET] ⚠️ gameJustStarted ativo - FORÇANDO turnIdx = 0 (jogo deve começar no jogador 1)')
            setTurnIdx(0)
            changed = true
          }
        }
        // ✅ CORREÇÃO CRÍTICA: Se o turnIdx remoto é maior que o local E estamos no mesmo round, 
        // significa que outro jogador avançou o turno - DEVE sincronizar (importante para quando WebSocket falha)
        else if (nt > turnIdx && nr === round && nr === 1) {
          // Se o round é 1 e o turnIdx remoto é maior, significa que o jogo já começou e outro jogador já jogou
          // Isso é especialmente importante quando o WebSocket falha e o Player 2 precisa receber a atualização via polling
          console.log('[NET] ✅ Sincronizando turnIdx (remoto maior que local - outro jogador avançou) - remoto:', nt, 'local:', turnIdx, 'round:', round)
          setTurnIdx(nt)
          changed = true
        }
        // Se o jogo acabou de começar (round === 1 e turnIdx === 0) E o remoto é 0 também, está ok
        // Mas se o remoto é > 0 e o local ainda é 0 no round 1, pode ser que o jogo já começou e outro jogador já jogou
        // Mas só sincroniza se não for gameJustStarted (já tratado acima)
        else if ((round === 1 && turnIdx === 0 && nt > 0) && !gameJustStarted) {
          // ✅ CORREÇÃO: Se o jogo já começou (não está em gameJustStarted) e o remoto tem turnIdx > 0,
          // significa que outro jogador já jogou - DEVE sincronizar (importante para quando WebSocket falha)
          console.log('[NET] ✅ Sincronizando turnIdx (jogo em andamento - outro jogador já jogou) - remoto:', nt, 'local:', turnIdx, 'round:', round)
          setTurnIdx(nt)
          changed = true
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

  // seq monotônico para ordenar mensagens e evitar estados antigos
  const broadcastSeqRef = useRef(0)

  function broadcastState(nextPlayers, nextTurnIdx, nextRound, gameOverState = gameOver, winnerState = winner, extra = {}) {
    broadcastSeqRef.current += 1
    
    console.group(`[📡 BROADCAST] Enviando estado GAME_STATE - seq: ${broadcastSeqRef.current}, turnIdx: ${nextTurnIdx}, round: ${nextRound}`)
    console.log('  - players:', nextPlayers.length)
    console.log('  - turnIdx:', nextTurnIdx, '(local atual:', turnIdx, ')')
    console.log('  - round:', nextRound, '(local atual:', round, ')')
    console.log('  - source (meId):', meId)
    console.log('  - seq:', broadcastSeqRef.current)
    
    // ✅ CORREÇÃO CRÍTICA: Atualiza o estado LOCAL ANTES de fazer broadcast
    // Isso garante que o cliente que faz o broadcast também atualiza seu próprio estado
    // Isso previne que o cliente ignore seu próprio broadcast por pensar que o estado remoto é antigo
    if (nextTurnIdx !== turnIdx) {
      console.log('  - ⚠️ turnIdx mudou - atualizando estado local ANTES do broadcast')
      console.log('  - turnIdx atual:', turnIdx, '→ novo:', nextTurnIdx)
      setTurnIdx(nextTurnIdx)
    }
    if (nextRound !== round) {
      console.log('  - ⚠️ round mudou - atualizando estado local ANTES do broadcast')
      console.log('  - round atual:', round, '→ novo:', nextRound)
      setRound(nextRound)
    }
    if (JSON.stringify(nextPlayers) !== JSON.stringify(players)) {
      console.log('  - ⚠️ players mudaram - atualizando estado local ANTES do broadcast')
      setPlayers(nextPlayers)
    }
    
    // 1) rede
    commitRemoteState(nextPlayers, nextTurnIdx, nextRound)
    
    // 2) entre abas - agora com tipo GAME_STATE e seq
    try {
      bcRef.current?.postMessage?.({
        type: 'GAME_STATE',
        players: nextPlayers,          // inclui posições/tile atualizados
        turnIdx: nextTurnIdx,
        round: nextRound,
        seq: broadcastSeqRef.current,
        ts: Date.now(),
        gameOver: gameOverState,
        winner: winnerState,
        source: meId,
        ...extra          // (opcional) dados de UX, ex.: dice, landed, actorId
      })
      console.log('  - ✅ Broadcast GAME_STATE enviado via BroadcastChannel - seq:', broadcastSeqRef.current)
    } catch (e) { 
      console.warn('[App] broadcastState failed:', e) 
    }
    
    console.groupEnd()
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

  // ✅ CORREÇÃO: Garante que myUid seja atualizado quando players mudar (especialmente no início do jogo)
  useEffect(() => {
    if (players.length > 0 && phase === 'game') {
      // ✅ CORREÇÃO CRÍTICA: Se o turnIdx mudou e o myUid não corresponde ao owner.id, tenta atualizar
      const currentOwner = players[turnIdx]
      const isMyTurnBasedOnOwner = currentOwner && String(currentOwner.id) === String(myUid)
      
      // Se é minha vez mas o myUid não corresponde, tenta encontrar meu ID correto
      if (currentOwner && !isMyTurnBasedOnOwner) {
        console.log('[App] useEffect - ⚠️ myUid não corresponde ao owner.id - turnIdx:', turnIdx, 'owner.id:', currentOwner.id, 'myUid:', myUid, 'owner.name:', currentOwner.name)
        
        // ✅ CORREÇÃO CRÍTICA: Prioriza window.__MY_UID sobre busca por nome
        const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
        if (wuid) {
          const foundPlayerByWindow = players.find(p => String(p.id) === String(wuid))
          if (foundPlayerByWindow) {
            const nameMatches = (String(foundPlayerByWindow.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase())
            if (String(foundPlayerByWindow.id) !== String(myUid)) {
              console.log('[App] useEffect - ⚠️ Atualizando myUid pelo window.__MY_UID - antigo:', myUid, 'novo:', wuid, 'player:', foundPlayerByWindow.name, 'myName:', myName, 'nome corresponde:', nameMatches, 'owner.id:', currentOwner.id)
              if (nameMatches) {
                setMyUid(String(wuid))
                return
              } else {
                console.warn('[App] useEffect - ⚠️ window.__MY_UID encontrou jogador mas nome não corresponde! Ignorando atualização.')
              }
            }
          }
        }
        
        // Se não encontrou pelo window.__MY_UID, tenta pelo nome (mas valida)
        const mineByName = players.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
        if (mineByName?.id && String(mineByName.id) !== String(myUid)) {
          if (!wuid || String(wuid) === String(mineByName.id)) {
            console.log('[App] useEffect - ⚠️ Atualizando myUid pelo nome - antigo:', myUid, 'novo:', mineByName.id, 'player:', mineByName.name, 'owner.id:', currentOwner.id)
            setMyUid(String(mineByName.id))
            return
          } else {
            console.warn('[App] useEffect - ⚠️ Jogador encontrado pelo nome mas window.__MY_UID é diferente! Ignorando atualização.')
          }
        }
      }
      
      // Se não é minha vez, ainda verifica se o myUid está correto (para garantir que está sincronizado)
      // Mas prioriza window.__MY_UID
      const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
      if (wuid) {
        const foundPlayerByWindow = players.find(p => String(p.id) === String(wuid))
        if (foundPlayerByWindow && String(foundPlayerByWindow.id) !== String(myUid)) {
          const nameMatches = (String(foundPlayerByWindow.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase())
          if (nameMatches) {
            console.log('[App] useEffect - Atualizando myUid pelo window.__MY_UID - antigo:', myUid, 'novo:', wuid, 'player:', foundPlayerByWindow.name)
            setMyUid(String(wuid))
          }
        }
      }
      
      // Se não encontrou pelo window.__MY_UID, tenta pelo nome (mas valida)
      if (!wuid || !players.find(p => String(p.id) === String(wuid))) {
        const mineByName = players.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
        if (mineByName?.id && String(mineByName.id) !== String(myUid)) {
          if (!wuid || String(wuid) === String(mineByName.id)) {
            console.log('[App] useEffect - Atualizando myUid pelo nome - antigo:', myUid, 'novo:', mineByName.id, 'player:', mineByName.name)
            setMyUid(String(mineByName.id))
          }
        }
      }
    }
  }, [players, phase, myName, myUid, turnIdx])
  
  // ✅ CORREÇÃO CRÍTICA: Monitora mudanças no turnIdx e verifica se myUid precisa ser atualizado
  // Este useEffect é executado SEMPRE que turnIdx muda, garantindo que o myUid seja atualizado imediatamente
  useEffect(() => {
    if (players.length > 0 && phase === 'game' && turnIdx >= 0) {
      const currentOwner = players[turnIdx]
      if (currentOwner) {
        const isMyTurnBasedOnOwner = String(currentOwner.id) === String(myUid)
        
        // Se o turnIdx indica que é minha vez mas o myUid não corresponde, tenta atualizar IMEDIATAMENTE
        if (!isMyTurnBasedOnOwner) {
          console.log('[App] useEffect turnIdx - ⚠️ turnIdx mudou mas myUid não corresponde ao owner.id - turnIdx:', turnIdx, 'owner.id:', currentOwner.id, 'myUid:', myUid, 'owner.name:', currentOwner.name)
          console.log('[App] useEffect turnIdx - ⚠️ players:', players.map(p => ({ name: p.name, id: p.id })))
          console.log('[App] useEffect turnIdx - ⚠️ myName:', myName)
          
          // ✅ CORREÇÃO CRÍTICA: Prioriza window.__MY_UID sobre busca por nome
          // Isso previne que o myUid seja atualizado incorretamente para outro jogador
          const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
          if (wuid) {
            const foundPlayerByWindow = players.find(p => String(p.id) === String(wuid))
            if (foundPlayerByWindow) {
              // Se encontrou pelo window.__MY_UID, valida que o nome corresponde
              const nameMatches = (String(foundPlayerByWindow.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase())
              if (String(foundPlayerByWindow.id) !== String(myUid)) {
                console.log('[App] useEffect turnIdx - ⚠️ Atualizando myUid pelo window.__MY_UID - antigo:', myUid, 'novo:', wuid, 'player:', foundPlayerByWindow.name, 'myName:', myName, 'nome corresponde:', nameMatches)
                if (nameMatches) {
                  setMyUid(String(wuid))
                  return
                } else {
                  console.warn('[App] useEffect turnIdx - ⚠️ window.__MY_UID encontrou jogador mas nome não corresponde! Ignorando atualização.')
                  console.warn('[App] useEffect turnIdx - ⚠️ window.__MY_UID encontrou:', foundPlayerByWindow.name, 'mas myName é:', myName)
                }
              }
            }
          }
          
          // Se não encontrou pelo window.__MY_UID ou não corresponde, tenta pelo nome
          // Mas só atualiza se o nome corresponder EXATAMENTE
          const mineByName = players.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
          if (mineByName?.id && String(mineByName.id) !== String(myUid)) {
            // ✅ CORREÇÃO CRÍTICA: Valida que o window.__MY_UID não está definido ou corresponde ao jogador encontrado
            if (!wuid || String(wuid) === String(mineByName.id)) {
              console.log('[App] useEffect turnIdx - ⚠️ Atualizando myUid pelo nome - antigo:', myUid, 'novo:', mineByName.id, 'player:', mineByName.name, 'owner.id:', currentOwner.id)
              setMyUid(String(mineByName.id))
              return
            } else {
              console.warn('[App] useEffect turnIdx - ⚠️ Jogador encontrado pelo nome mas window.__MY_UID é diferente! Ignorando atualização.')
              console.warn('[App] useEffect turnIdx - ⚠️ window.__MY_UID:', wuid, 'jogador encontrado pelo nome:', mineByName.id)
            }
          }
          
          // ✅ CORREÇÃO CRÍTICA: Se ainda não encontrou, verifica se algum jogador tem o mesmo nome (case-insensitive)
          // Isso pode acontecer se houver diferenças de capitalização ou espaços
          const allPlayers = players.map(p => ({ name: p.name, id: p.id }))
          console.log('[App] useEffect turnIdx - ⚠️ Todos os jogadores:', allPlayers)
          console.log('[App] useEffect turnIdx - ⚠️ Tentando encontrar pelo nome exato (case-insensitive):', myName)
        }
      }
    }
  }, [turnIdx, players, phase, myName, myUid])

  // ====== "é minha vez?" e player atual
  // ✅ PATCH 3: Definidos antes do hook useTurnEngine para garantir ordem correta
  const current = useMemo(() => players[turnIdx] || null, [players, turnIdx])
  const isMyTurn = useMemo(() => {
    const owner = players[turnIdx]
    if (!owner) {
      console.log('[App] isMyTurn - owner não encontrado, turnIdx:', turnIdx, 'players.length:', players.length)
      return false
    }
    const isMine = owner.id != null && String(owner.id) === String(myUid)
    console.log('[App] isMyTurn - owner:', owner.name, 'id:', owner.id, 'myUid:', myUid, 'isMine:', isMine, 'turnIdx:', turnIdx)
    // ✅ CORREÇÃO: Log adicional para debug
    if (!isMine && phase === 'game') {
      if (turnIdx === 0) {
        console.log('[App] ⚠️ isMyTurn - Player 1 não reconheceu que é sua vez! Verificando...')
      } else {
        console.log('[App] ⚠️ isMyTurn - Player', turnIdx + 1, 'não reconheceu que é sua vez! Verificando...')
      }
      console.log('[App] ⚠️ isMyTurn - players:', players.map(p => ({ name: p.name, id: p.id, index: players.indexOf(p) })))
      console.log('[App] ⚠️ isMyTurn - myName:', myName, 'myUid:', myUid, 'owner.id:', owner.id)
      console.log('[App] ⚠️ isMyTurn - window.__MY_UID:', window.__MY_UID || window.__myUid || window.__playerId || 'undefined')
      
      // ✅ CORREÇÃO CRÍTICA: Se o turnIdx indica que é minha vez mas o myUid não corresponde, loga detalhes
      const mineByName = players.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
      if (mineByName?.id && String(mineByName.id) !== String(myUid)) {
        console.log('[App] ⚠️ isMyTurn - myUid está incorreto! Deveria ser:', mineByName.id, 'mas é:', myUid)
        console.log('[App] ⚠️ isMyTurn - jogador encontrado pelo nome:', mineByName)
        // O useEffect acima deve corrigir isso
      } else if (!mineByName) {
        console.log('[App] ⚠️ isMyTurn - Nenhum jogador encontrado pelo nome:', myName)
      }
    } else if (isMine) {
      console.log('[App] ✅ isMyTurn - É minha vez!', owner.name, 'pode jogar')
    }
    console.groupEnd()
    return isMine
  }, [players, turnIdx, myUid, phase, myName])

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
  // ✅ PATCH 3: Garantir que todos os parâmetros estejam sendo passados corretamente
  const {
    advanceAndMaybeLap,
    onAction,
    nextTurn,
    modalLocks,
    lockOwner,
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
    gameJustStarted, // ✅ CORREÇÃO: Passa gameJustStarted para prevenir mudança de turno imediata
    myName, // ✅ CORREÇÃO: Passa myName para verificação de owner por nome
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

          // ✅ NOVO: Se PlayersLobby informou quem sou eu, fixa myUid e meu nome para esta aba
          try {
            const meFromPayload = payload?.me || payload?.current || null
            if (meFromPayload?.id) {
              window.__MY_UID = String(meFromPayload.id)
              if (String(myUid) !== String(meFromPayload.id)) {
                console.log('[App] onStartGame - Fixando myUid pelo payload.me - antigo:', myUid, 'novo:', meFromPayload.id)
                setMyUid(String(meFromPayload.id))
              }
            }
            if (meFromPayload?.name) {
              try {
                setTabPlayerName(String(meFromPayload.name))
              } catch {}
            }
          } catch (e) {
            console.warn('[App] onStartGame - erro ao aplicar payload.me:', e)
          }

          // ✅ CORREÇÃO: Alinha meu UID com o id real (comparando pelo nome salvo)
          // Tenta primeiro pelo window.__MY_UID, depois pelo nome
          try {
            const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
            if (wuid) {
              const foundPlayer = mapped.find(p => String(p.id) === String(wuid))
              if (foundPlayer && String(foundPlayer.id) !== String(myUid)) {
                console.log('[App] onStartGame - Atualizando myUid pelo window.__MY_UID - antigo:', myUid, 'novo:', wuid)
                setMyUid(String(wuid))
              }
            } else {
              // Se não encontrou pelo window.__MY_UID, tenta pelo nome
              const mine = mapped.find(p => (String(p.name || '').trim().toLowerCase()) === (String(myName || '').trim().toLowerCase()))
              if (mine?.id && String(mine.id) !== String(myUid)) {
                console.log('[App] onStartGame - Atualizando myUid pelo nome - antigo:', myUid, 'novo:', mine.id)
                setMyUid(String(mine.id))
              }
            }
          } catch (e) {
            console.warn('[App] onStartGame - Erro ao atualizar myUid:', e)
          }

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
              myUid={myUid}
              myName={myName}
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
      {/* ✅ PATCH 3: Renderiza overlay quando necessário */}
      {showBankruptOverlay && (
        <BankruptOverlay onClose={() => setShowBankruptOverlay(false)} />
      )}
    </div>
  )
  }

  // Fallback para fases não reconhecidas
  return <div>Fase não reconhecida: {phase}</div>
}
