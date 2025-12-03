// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
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

  // ====== “quem sou eu” no array de players
  const isMine = React.useCallback((p) => !!p && String(p.id) === String(myUid), [myUid])
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

          // adota UID real se PlayersLobby tiver setado
          try {
            const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
            if (wuid) setMyUid(String(wuid))
          } catch {}

          setPlayers(mapped)
          setTurnIdx(0)
          setRound(1)
          setRoundFlags(new Array(Math.max(1, mapped.length)).fill(false))
          setGameOver(false); setWinner(null)
          setPhase('game')
          setLog(['Jogo iniciado!'])
          return
        }

        if (d.type === 'TURNLOCK') {
          setTurnLock(!!d.value)
          return
        }

        if (d.type === 'SYNC' && phase === 'game') {
          console.log('[App] SYNC recebido - turnIdx:', d.turnIdx, 'round:', d.round, 'source:', d.source)
          console.log('[App] SYNC - meu turnIdx atual:', turnIdx, 'meu myUid:', myUid)
          
          // ✅ CORREÇÃO: Sincroniza turnIdx e round, mas protege mudanças locais recentes
          const now = Date.now()
          const lastLocal = lastLocalStateRef.current
          
          // Sincroniza turnIdx apenas se não houver mudança local muito recente
          if (d.turnIdx !== turnIdx) {
            if (lastLocal && (now - lastLocal.timestamp) < 5000) {
              // Verifica se o turnIdx local mudou recentemente
              const localTurnIdxChanged = lastLocal.turnIdx !== turnIdx
              if (localTurnIdxChanged) {
                // ✅ CORREÇÃO: Se o turnIdx local mudou recentemente, NUNCA aceita um turnIdx remoto diferente
                // Isso evita que estados remotos antigos revertam mudanças locais recentes
                // Além disso, se o turnIdx remoto está tentando reverter para um valor anterior, ignora
                const isReverting = d.turnIdx === lastLocal.turnIdx
                if (isReverting) {
                  console.log('[App] SYNC - ❌ IGNORANDO turnIdx remoto - tentando reverter mudança local recente', {
                    lastLocalTurnIdx: lastLocal.turnIdx,
                    currentLocalTurnIdx: turnIdx,
                    remoteTurnIdx: d.turnIdx,
                    timeSinceLocalChange: now - lastLocal.timestamp,
                    isReverting: true
                  })
                } else {
                  console.log('[App] SYNC - Ignorando turnIdx remoto - turnIdx local mudou recentemente (< 5s)', {
                    lastLocalTurnIdx: lastLocal.turnIdx,
                    currentLocalTurnIdx: turnIdx,
                    remoteTurnIdx: d.turnIdx,
                    timeSinceLocalChange: now - lastLocal.timestamp
                  })
                }
              } else {
                // Se o turnIdx local não mudou, pode sincronizar
                setTurnIdx(d.turnIdx)
                console.log('[App] SYNC - Sincronizando turnIdx', { local: turnIdx, remote: d.turnIdx })
              }
            } else {
              // Se não houve mudança local recente, sincroniza normalmente
              setTurnIdx(d.turnIdx)
              console.log('[App] SYNC - Sincronizing turnIdx', { local: turnIdx, remote: d.turnIdx })
            }
          }
          
          // Sincroniza round apenas se não houver mudança local muito recente
          if (d.round !== round) {
            if (lastLocal && (now - lastLocal.timestamp) < 3000) {
              const localRoundChanged = lastLocal.round !== round
              if (localRoundChanged) {
                console.log('[App] SYNC - Ignorando round remoto - round local mudou recentemente (< 3s)')
              } else {
                setRound(d.round)
              }
            } else {
              setRound(d.round)
            }
          }
          
          // ✅ CORREÇÃO: Merge inteligente - preserva propriedades locais do jogador local
          // IMPORTANTE: Sempre aceita propriedades críticas do estado sincronizado (pos, bankrupt, etc)
          const currentPlayers = players
          const syncedPlayers = d.players.map(syncedPlayer => {
            const localPlayer = currentPlayers.find(p => p.id === syncedPlayer.id)
            if (!localPlayer) return syncedPlayer
            
            // Se é o jogador local, SEMPRE preserva recursos locais (compras não devem ser perdidas)
            const isLocalPlayer = String(syncedPlayer.id) === String(myUid)
            if (isLocalPlayer) {
              // Compara recursos para detectar se há compras locais
              const localClients = Number(localPlayer.clients || 0)
              const remoteClients = Number(syncedPlayer.clients || 0)
              const localVendedores = Number(localPlayer.vendedoresComuns || 0)
              const remoteVendedores = Number(syncedPlayer.vendedoresComuns || 0)
              const localFieldSales = Number(localPlayer.fieldSales || 0)
              const remoteFieldSales = Number(syncedPlayer.fieldSales || 0)
              const localInsideSales = Number(localPlayer.insideSales || 0)
              const remoteInsideSales = Number(syncedPlayer.insideSales || 0)
              
              // ✅ CORREÇÃO: Se o local tem mais recursos que o remoto, preserva estado local completo
              // (indica que o local fez compras que o remoto ainda não conhece)
              const hasLocalPurchases = localClients > remoteClients || 
                                       localVendedores > remoteVendedores ||
                                       localFieldSales > remoteFieldSales ||
                                       localInsideSales > remoteInsideSales ||
                                       (localPlayer.mixProdutos && localPlayer.mixProdutos !== syncedPlayer.mixProdutos && localPlayer.mixProdutos !== 'D') ||
                                       (localPlayer.erpLevel && localPlayer.erpLevel !== syncedPlayer.erpLevel && localPlayer.erpLevel !== 'D')
              
              if (hasLocalPurchases) {
                console.log('[App] SYNC - Detectadas compras locais, preservando estado local completo', {
                  localClients, remoteClients, localVendedores, remoteVendedores
                })
                // ✅ CORREÇÃO: Preserva posição local se o jogador acabou de se mover recentemente
                // Verifica se a posição local é maior que a remota (indica movimento recente)
                const localPos = Number(localPlayer.pos || 0)
                const remotePos = Number(syncedPlayer.pos || 0)
                const shouldPreservePos = localPos > remotePos || (localPos === remotePos && localPos > 0)
                
                // Preserva estado local completo (compras), mas aceita propriedades críticas do remoto
                return {
                  ...localPlayer, // Preserva estado local completo
                  // ✅ CORREÇÃO: Preserva posição local se o jogador acabou de se mover
                  pos: shouldPreservePos ? localPos : syncedPlayer.pos,
                  bankrupt: syncedPlayer.bankrupt ?? localPlayer.bankrupt,
                  // Preserva dados de progresso local
                  az: localPlayer.az || syncedPlayer.az || 0,
                  am: localPlayer.am || syncedPlayer.am || 0,
                  rox: localPlayer.rox || syncedPlayer.rox || 0,
                  trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
                  onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
                }
              }
              
              // Se não há compras locais, faz merge preservando o maior valor de recursos
              // ✅ CORREÇÃO: Preserva posição local se o jogador acabou de se mover recentemente
              const localPos = Number(localPlayer.pos || 0)
              const remotePos = Number(syncedPlayer.pos || 0)
              const shouldPreservePos = localPos > remotePos || (localPos === remotePos && localPos > 0)
              
              return {
                ...syncedPlayer, // Aceita estado sincronizado (bankrupt, etc)
                // ✅ CORREÇÃO: Preserva posição local se o jogador acabou de se mover
                pos: shouldPreservePos ? localPos : syncedPlayer.pos,
                // Preserva o maior valor de recursos
                cash: Math.max(Number(localPlayer.cash || 0), Number(syncedPlayer.cash || 0)),
                clients: Math.max(localClients, remoteClients),
                mixProdutos: localPlayer.mixProdutos ?? syncedPlayer.mixProdutos,
                erpLevel: localPlayer.erpLevel ?? syncedPlayer.erpLevel,
                vendedoresComuns: Math.max(localVendedores, remoteVendedores),
                fieldSales: Math.max(localFieldSales, remoteFieldSales),
                insideSales: Math.max(localInsideSales, remoteInsideSales),
                gestores: Math.max(Number(localPlayer.gestores ?? localPlayer.gestoresComerciais ?? localPlayer.managers ?? 0), Number(syncedPlayer.gestores ?? syncedPlayer.gestoresComerciais ?? syncedPlayer.managers ?? 0)),
                gestoresComerciais: Math.max(Number(localPlayer.gestoresComerciais ?? localPlayer.gestores ?? localPlayer.managers ?? 0), Number(syncedPlayer.gestoresComerciais ?? syncedPlayer.gestores ?? syncedPlayer.managers ?? 0)),
                managers: Math.max(Number(localPlayer.managers ?? localPlayer.gestores ?? localPlayer.gestoresComerciais ?? 0), Number(syncedPlayer.managers ?? syncedPlayer.gestores ?? syncedPlayer.gestoresComerciais ?? 0)),
                bens: Math.max(Number(localPlayer.bens || 0), Number(syncedPlayer.bens || 0)),
                manutencao: localPlayer.manutencao ?? syncedPlayer.manutencao,
                loanPending: localPlayer.loanPending ?? syncedPlayer.loanPending,
                // Preserva dados de progresso local
                az: localPlayer.az || syncedPlayer.az || 0,
                am: localPlayer.am || syncedPlayer.am || 0,
                rox: localPlayer.rox || syncedPlayer.rox || 0,
                trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
                onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
              }
            }
            
            // Para outros jogadores, aceita o estado sincronizado mas preserva certificados locais (caso existam)
            return {
              ...syncedPlayer,
              az: localPlayer.az || syncedPlayer.az || 0,
              am: localPlayer.am || syncedPlayer.am || 0,
              rox: localPlayer.rox || syncedPlayer.rox || 0,
              trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
              onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
            }
          })
          setPlayers(syncedPlayers)
          
          console.log('[App] SYNC aplicado - novo turnIdx:', d.turnIdx)
          console.log('[App] SYNC - jogador da vez:', syncedPlayers[d.turnIdx]?.name, 'id:', syncedPlayers[d.turnIdx]?.id)
          console.log('[App] SYNC - é minha vez?', String(syncedPlayers[d.turnIdx]?.id) === String(myUid))
          
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
  
  // ✅ CORREÇÃO: Ref para rastrear quando uma mudança local foi feita recentemente
  const localChangeRef = React.useRef(null)
  const lastLocalStateRef = React.useRef(null)
  
  // Rastreia mudanças locais
  // ✅ CORREÇÃO: Atualiza lastLocalStateRef quando turnIdx, round ou players mudam
  // Mas só atualiza o timestamp se realmente mudou E se não foi atualizado recentemente pelo broadcastState
  React.useEffect(() => {
    const current = lastLocalStateRef.current
    const turnIdxChanged = !current || current.turnIdx !== turnIdx
    const roundChanged = !current || current.round !== round
    const playersChanged = !current || JSON.stringify(current.players) !== JSON.stringify(players)
    
    // Só atualiza timestamp se realmente mudou algo crítico
    // E só atualiza se não foi atualizado muito recentemente (< 100ms) pelo broadcastState
    if (turnIdxChanged || roundChanged || playersChanged) {
      const now = Date.now()
      const timeSinceLastUpdate = current ? (now - current.timestamp) : Infinity
      
      // Se foi atualizado muito recentemente pelo broadcastState, não sobrescreve
      if (timeSinceLastUpdate > 100) {
        lastLocalStateRef.current = { players, turnIdx, round, timestamp: now }
        if (turnIdxChanged) {
          console.log('[App] lastLocalStateRef atualizado via useEffect - turnIdx mudou:', current?.turnIdx, '->', turnIdx)
        }
      } else {
        // Atualiza apenas os valores, mantém o timestamp do broadcastState
        lastLocalStateRef.current = { 
          ...lastLocalStateRef.current, 
          players, 
          turnIdx, 
          round 
        }
      }
    }
  }, [players, turnIdx, round])

  useEffect(() => {
    if (!netState) return
    const np = Array.isArray(netState.players) ? netState.players : null
    const nt = Number.isInteger(netState.turnIdx) ? netState.turnIdx : null
    const nr = Number.isInteger(netState.round) ? netState.round : null

    let changed = false
    
    // ✅ CORREÇÃO: Sincroniza turnIdx e round primeiro (crítico para funcionamento)
    // Mas só se não houver mudança local muito recente
    if (nt !== null && nt !== turnIdx) {
      const now = Date.now()
      const lastLocal = lastLocalStateRef.current
      // Se houve mudança local muito recente (< 5s), não sincroniza turnIdx ainda
      // Isso protege contra estados remotos que chegam logo após mudança local
      if (lastLocal && (now - lastLocal.timestamp) < 5000) {
        // Verifica se o turnIdx local mudou recentemente
        const localTurnIdxChanged = lastLocal.turnIdx !== turnIdx
        if (localTurnIdxChanged) {
          // ✅ CORREÇÃO: Se o turnIdx local mudou recentemente, NUNCA aceita um turnIdx remoto diferente
          // Isso evita que estados remotos antigos revertam mudanças locais recentes
          // Além disso, se o turnIdx remoto está tentando reverter para um valor anterior, ignora
          const isReverting = nt === lastLocal.turnIdx
          if (isReverting) {
            console.log('[NET] ❌ IGNORANDO turnIdx remoto - tentando reverter mudança local recente', {
              lastLocalTurnIdx: lastLocal.turnIdx,
              currentLocalTurnIdx: turnIdx,
              remoteTurnIdx: nt,
              timeSinceLocalChange: now - lastLocal.timestamp,
              isReverting: true
            })
          } else {
            console.log('[NET] Ignorando turnIdx remoto - turnIdx local mudou recentemente (< 5s)', {
              lastLocalTurnIdx: lastLocal.turnIdx,
              currentLocalTurnIdx: turnIdx,
              remoteTurnIdx: nt,
              timeSinceLocalChange: now - lastLocal.timestamp
            })
          }
        } else {
          // Se o turnIdx local não mudou, pode sincronizar
          setTurnIdx(nt)
          changed = true
          console.log('[NET] Sincronizando turnIdx remoto', { local: turnIdx, remote: nt })
        }
      } else {
        // Se não houve mudança local recente, sincroniza normalmente
        setTurnIdx(nt)
        changed = true
        console.log('[NET] Sincronizando turnIdx remoto', { local: turnIdx, remote: nt })
      }
    }
    if (nr !== null && nr !== round) {
      const now = Date.now()
      const lastLocal = lastLocalStateRef.current
      // Se houve mudança local muito recente (< 2s), não sincroniza round ainda
      if (lastLocal && (now - lastLocal.timestamp) < 2000) {
        console.log('[NET] Ignorando round remoto - mudança local muito recente (< 2s)')
      } else {
        setRound(nr)
        changed = true
      }
    }
    
    if (np && JSON.stringify(np) !== JSON.stringify(players)) { 
      // ✅ CORREÇÃO: Ignora estado remoto se houver uma mudança local muito recente (< 1000ms)
      const now = Date.now()
      const lastLocal = lastLocalStateRef.current
      if (lastLocal && (now - lastLocal.timestamp) < 1000) {
        console.log('[NET] Ignorando estado remoto - mudança local muito recente (< 1s)')
        return
      }
      
      // ✅ CORREÇÃO: Compara valores críticos para detectar se o estado local é mais recente
      const currentPlayers = players
      const myPlayer = currentPlayers.find(p => p.id === myUid)
      const remoteMyPlayer = np.find(p => p.id === myUid)
      
      if (myPlayer && remoteMyPlayer) {
        // Se o estado local tem mais recursos que o remoto, pode ser uma mudança local recente
        const localCash = Number(myPlayer.cash || 0)
        const remoteCash = Number(remoteMyPlayer.cash || 0)
        const localClients = Number(myPlayer.clients || 0)
        const remoteClients = Number(remoteMyPlayer.clients || 0)
        
        // Se o local tem significativamente mais recursos, ignora o remoto
        if (localCash > remoteCash + 500 || localClients > remoteClients + 1) {
          console.log('[NET] Ignorando estado remoto - estado local parece mais recente', {
            localCash, remoteCash, localClients, remoteClients
          })
          return
        }
      }
      
      // ✅ CORREÇÃO: Merge inteligente - preserva propriedades locais do jogador local
      // IMPORTANTE: Sempre aceita propriedades críticas do estado sincronizado (pos, bankrupt, etc)
      const syncedPlayers = np.map(syncedPlayer => {
        const localPlayer = currentPlayers.find(p => p.id === syncedPlayer.id)
        if (!localPlayer) return syncedPlayer
        
        // Se é o jogador local, SEMPRE preserva recursos locais (compras não devem ser perdidas)
        const isLocalPlayer = String(syncedPlayer.id) === String(myUid)
        if (isLocalPlayer) {
          // Compara recursos para detectar se há compras locais
          const localClients = Number(localPlayer.clients || 0)
          const remoteClients = Number(syncedPlayer.clients || 0)
          const localVendedores = Number(localPlayer.vendedoresComuns || 0)
          const remoteVendedores = Number(syncedPlayer.vendedoresComuns || 0)
          const localFieldSales = Number(localPlayer.fieldSales || 0)
          const remoteFieldSales = Number(syncedPlayer.fieldSales || 0)
          const localInsideSales = Number(localPlayer.insideSales || 0)
          const remoteInsideSales = Number(syncedPlayer.insideSales || 0)
          
          // ✅ CORREÇÃO: Se o local tem mais recursos que o remoto, preserva estado local completo
          // (indica que o local fez compras que o remoto ainda não conhece)
          const hasLocalPurchases = localClients > remoteClients || 
                                   localVendedores > remoteVendedores ||
                                   localFieldSales > remoteFieldSales ||
                                   localInsideSales > remoteInsideSales ||
                                   (localPlayer.mixProdutos && localPlayer.mixProdutos !== syncedPlayer.mixProdutos && localPlayer.mixProdutos !== 'D') ||
                                   (localPlayer.erpLevel && localPlayer.erpLevel !== syncedPlayer.erpLevel && localPlayer.erpLevel !== 'D')
          
          if (hasLocalPurchases) {
            console.log('[NET] Detectadas compras locais, preservando estado local completo', {
              localClients, remoteClients, localVendedores, remoteVendedores
            })
            // ✅ CORREÇÃO: Preserva posição local se o jogador acabou de se mover recentemente
            const localPos = Number(localPlayer.pos || 0)
            const remotePos = Number(syncedPlayer.pos || 0)
            const shouldPreservePos = localPos > remotePos || (localPos === remotePos && localPos > 0)
            
            // Preserva estado local completo (compras), mas aceita propriedades críticas do remoto
            return {
              ...localPlayer, // Preserva estado local completo
              // ✅ CORREÇÃO: Preserva posição local se o jogador acabou de se mover
              pos: shouldPreservePos ? localPos : syncedPlayer.pos,
              bankrupt: syncedPlayer.bankrupt ?? localPlayer.bankrupt,
              // Preserva dados de progresso local
              az: localPlayer.az || syncedPlayer.az || 0,
              am: localPlayer.am || syncedPlayer.am || 0,
              rox: localPlayer.rox || syncedPlayer.rox || 0,
              trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
              onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
            }
          }
          
          // Se não há compras locais, faz merge preservando o maior valor de recursos
          // ✅ CORREÇÃO: Preserva posição local se o jogador acabou de se mover recentemente
          const localPos = Number(localPlayer.pos || 0)
          const remotePos = Number(syncedPlayer.pos || 0)
          const shouldPreservePos = localPos > remotePos || (localPos === remotePos && localPos > 0)
          
          return {
            ...syncedPlayer, // Aceita estado sincronizado (bankrupt, etc)
            // ✅ CORREÇÃO: Preserva posição local se o jogador acabou de se mover
            pos: shouldPreservePos ? localPos : syncedPlayer.pos,
            // Preserva o maior valor de recursos
            cash: Math.max(Number(localPlayer.cash || 0), Number(syncedPlayer.cash || 0)),
            clients: Math.max(localClients, remoteClients),
            mixProdutos: localPlayer.mixProdutos ?? syncedPlayer.mixProdutos,
            erpLevel: localPlayer.erpLevel ?? syncedPlayer.erpLevel,
            vendedoresComuns: Math.max(localVendedores, remoteVendedores),
            fieldSales: Math.max(localFieldSales, remoteFieldSales),
            insideSales: Math.max(localInsideSales, remoteInsideSales),
            gestores: Math.max(Number(localPlayer.gestores ?? localPlayer.gestoresComerciais ?? localPlayer.managers ?? 0), Number(syncedPlayer.gestores ?? syncedPlayer.gestoresComerciais ?? syncedPlayer.managers ?? 0)),
            gestoresComerciais: Math.max(Number(localPlayer.gestoresComerciais ?? localPlayer.gestores ?? localPlayer.managers ?? 0), Number(syncedPlayer.gestoresComerciais ?? syncedPlayer.gestores ?? syncedPlayer.managers ?? 0)),
            managers: Math.max(Number(localPlayer.managers ?? localPlayer.gestores ?? localPlayer.gestoresComerciais ?? 0), Number(syncedPlayer.managers ?? syncedPlayer.gestores ?? syncedPlayer.gestoresComerciais ?? 0)),
            bens: Math.max(Number(localPlayer.bens || 0), Number(syncedPlayer.bens || 0)),
            manutencao: localPlayer.manutencao ?? syncedPlayer.manutencao,
            loanPending: localPlayer.loanPending ?? syncedPlayer.loanPending,
            // Preserva dados de progresso local
            az: localPlayer.az || syncedPlayer.az || 0,
            am: localPlayer.am || syncedPlayer.am || 0,
            rox: localPlayer.rox || syncedPlayer.rox || 0,
            trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
            onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
          }
        }
        
        // Para outros jogadores, aceita o estado sincronizado mas preserva certificados locais (caso existam)
        return {
          ...syncedPlayer,
          az: localPlayer.az || syncedPlayer.az || 0,
          am: localPlayer.am || syncedPlayer.am || 0,
          rox: localPlayer.rox || syncedPlayer.rox || 0,
          trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
          onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
        }
      })
      setPlayers(syncedPlayers); 
      changed = true 
      
      // ✅ CORREÇÃO: Se aplicou estado remoto de players, garante que turnLock está liberado
      // Isso evita que o botão fique travado após sincronização
      // Verifica se é minha vez após sincronização
      const currentPlayer = syncedPlayers[turnIdx]
      const isMyTurnAfterSync = currentPlayer && String(currentPlayer.id) === String(myUid)
      
      if (turnLock) {
        // Se turnLock está ativo após sincronização, libera
        // O turnLock deve ser gerenciado apenas durante ações do jogador, não durante sincronização
        console.log('[NET] Liberando turnLock após sincronização', { isMyTurnAfterSync, turnIdx })
        setTurnLock(false)
      }
    }

    if (changed) console.log('[NET] applied remote v=%d', netVersion)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netVersion])

  async function commitRemoteState(nextPlayers, nextTurnIdx, nextRound) {
    if (typeof netCommit === 'function') {
      try {
        await netCommit(prev => ({
          ...(prev || {}),
          players: nextPlayers,
          turnIdx: nextTurnIdx,
          round: nextRound,
        }))
      } catch (e) {
        console.warn('[NET] commit failed:', e?.message || e)
      }
    }
  }

  function broadcastState(nextPlayers, nextTurnIdx, nextRound, gameOverState = gameOver, winnerState = winner) {
    // ✅ CORREÇÃO: Atualiza lastLocalStateRef imediatamente antes de fazer broadcast
    // Isso protege contra estados remotos que chegam logo após a mudança local
    const now = Date.now()
    lastLocalStateRef.current = { 
      players: nextPlayers, 
      turnIdx: nextTurnIdx, 
      round: nextRound, 
      timestamp: now
    }
    console.log('[App] broadcastState - atualizando lastLocalStateRef', { 
      turnIdx: nextTurnIdx, 
      round: nextRound, 
      timestamp: now 
    })
    
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
    // rede
    commitRemoteState(nextPlayers, 0, 1)
    // entre abas
    try {
      bcRef.current?.postMessage?.({
        type: 'START',
        players: nextPlayers,
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

  // ====== overlay “falido” (mostra quando eu declaro falência)
  const [showBankruptOverlay, setShowBankruptOverlay] = useState(false)

  // ====== Hook do motor de turnos (centraliza TODA a lógica pesada)
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
          broadcastStart(mapped)
          setPhase('game')
        }}
      />
    )
  }

  // 4) Jogo
  const controlsCanRoll = isMyTurn && modalLocks === 0 && !turnLock
  console.log('[App] controlsCanRoll - isMyTurn:', isMyTurn, 'modalLocks:', modalLocks, 'turnLock:', turnLock, 'result:', controlsCanRoll)

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
              isMyTurn={controlsCanRoll}
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
