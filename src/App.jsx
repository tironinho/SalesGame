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
          // ✅ CORREÇÃO: Se netState estiver ativo, ignora SYNC do BroadcastChannel
          // O Supabase (netState) é a fonte autoritativa para multiplayer em rede
          if (net?.enabled && net?.ready && netState) {
            console.log('[App] SYNC ignorado - netState ativo, usando Supabase como autoridade única')
            return
          }
          
          const remoteVersion = Number(d.version || 0)
          const remoteTimestamp = Number(d.timestamp || 0)
          const localVersion = lastAcceptedVersionRef.current
          
          console.log('[App] SYNC recebido - versão remota:', remoteVersion, 'versão local:', localVersion, 'turnIdx:', d.turnIdx, 'round:', d.round, 'source:', d.source)
          console.log('[App] SYNC - meu turnIdx atual:', turnIdx, 'meu myUid:', myUid)
          
          // ✅ MELHORIA: Rejeita estados com versão menor que a última aceita (fora de ordem)
          if (remoteVersion > 0 && localVersion > 0 && remoteVersion < localVersion) {
            console.log('[App] SYNC - ❌ REJEITANDO estado remoto - versão antiga:', remoteVersion, '< versão local:', localVersion)
            return
          }
          
          // ✅ CORREÇÃO: Sincroniza turnIdx e round, mas protege mudanças locais recentes
          const now = Date.now()
          const lastLocal = lastLocalStateRef.current
          
          // ✅ MELHORIA: Atualiza versão aceita se a remota for maior
          if (remoteVersion > localVersion) {
            lastAcceptedVersionRef.current = remoteVersion
            console.log('[App] SYNC - ✅ Aceitando versão remota:', remoteVersion, '> versão local:', localVersion)
          }
          
          // ✅ CORREÇÃO CRÍTICA: Sincroniza turnIdx apenas se não houver mudança local muito recente
          // E NUNCA aceita um turnIdx remoto que está revertendo uma mudança local
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
                  return // ✅ CORREÇÃO: Retorna cedo para não processar o resto da sincronização
                } else {
                  console.log('[App] SYNC - ❌ IGNORANDO turnIdx remoto - turnIdx local mudou recentemente (< 5s)', {
                    lastLocalTurnIdx: lastLocal.turnIdx,
                    currentLocalTurnIdx: turnIdx,
                    remoteTurnIdx: d.turnIdx,
                    timeSinceLocalChange: now - lastLocal.timestamp
                  })
                  return // ✅ CORREÇÃO: Retorna cedo para não processar o resto da sincronização
                }
              } else {
                // ✅ CORREÇÃO: Se o turnIdx local não mudou, mas há uma mudança local recente,
                // verifica se o turnIdx remoto está tentando reverter
                // Se o turnIdx remoto é igual ao lastLocal.turnIdx, está tentando reverter
                if (d.turnIdx === lastLocal.turnIdx && lastLocal.turnIdx !== turnIdx) {
                  console.log('[App] SYNC - ❌ IGNORANDO turnIdx remoto - tentando reverter para valor anterior', {
                    lastLocalTurnIdx: lastLocal.turnIdx,
                    currentLocalTurnIdx: turnIdx,
                    remoteTurnIdx: d.turnIdx
                  })
                  return // ✅ CORREÇÃO: Retorna cedo para não processar o resto da sincronização
                }
                // Se o turnIdx local não mudou, pode sincronizar
                setTurnIdx(d.turnIdx)
                console.log('[App] SYNC - Sincronizando turnIdx', { local: turnIdx, remote: d.turnIdx })
              }
            } else {
              // ✅ CORREÇÃO: Se não houve mudança local recente, mas há lastLocal,
              // verifica se o turnIdx remoto está tentando reverter
              if (lastLocal && d.turnIdx === lastLocal.turnIdx && lastLocal.turnIdx !== turnIdx) {
                console.log('[App] SYNC - ❌ IGNORANDO turnIdx remoto - tentando reverter para valor anterior (sem mudança recente)', {
                  lastLocalTurnIdx: lastLocal.turnIdx,
                  currentLocalTurnIdx: turnIdx,
                  remoteTurnIdx: d.turnIdx
                })
                return // ✅ CORREÇÃO: Retorna cedo para não processar o resto da sincronização
              }
              // Se não houve mudança local recente, sincroniza normalmente
              setTurnIdx(d.turnIdx)
              console.log('[App] SYNC - Sincronizando turnIdx', { local: turnIdx, remote: d.turnIdx })
            }
          }
          
          // ✅ CORREÇÃO: Sincroniza roundFlags se presente na mensagem
          if (Array.isArray(d.roundFlags) && d.roundFlags.length > 0) {
            setRoundFlags(prevFlags => {
              // Faz merge: preserva flags locais e aceita flags remotas (OR lógico)
              const merged = d.roundFlags.map((remoteFlag, idx) => {
                const localFlag = prevFlags[idx] || false
                return localFlag || remoteFlag // Se qualquer um passou, marca como true
              })
              // Garante que o array tem o tamanho correto
              while (merged.length < prevFlags.length) {
                merged.push(prevFlags[merged.length] || false)
              }
              console.log('[App] SYNC - roundFlags sincronizado:', merged.map((f, i) => `${players[i]?.name}:${f}`).join(', '))
              return merged
            })
          }
          
          // ✅ CORREÇÃO: Sincroniza round usando Math.max para proteger incrementos locais
          if (d.round !== round) {
            if (lastLocal && (now - lastLocal.timestamp) < 3000) {
              const localRoundChanged = lastLocal.round !== round
              if (localRoundChanged) {
                // Se a rodada local mudou recentemente, usa Math.max para proteger o incremento
                setRound(prevRound => {
                  const finalRound = Math.max(prevRound, d.round)
                  if (finalRound > prevRound) {
                    console.log('[App] SYNC - Rodada incrementada via sincronização:', prevRound, '->', finalRound)
                  }
                  return finalRound
                })
              } else {
                setRound(d.round)
              }
            } else {
              // Sempre usa Math.max para proteger contra reversão
              setRound(prevRound => Math.max(prevRound, d.round))
            }
          }
          
          // ✅ CORREÇÃO: Merge inteligente - preserva propriedades locais do jogador local
          // IMPORTANTE: Sempre aceita propriedades críticas do estado sincronizado (pos, bankrupt, etc)
          const currentPlayers = players
          const syncedPlayers = d.players.map(syncedPlayer => {
            const localPlayer = currentPlayers.find(p => p.id === syncedPlayer.id)
            if (!localPlayer) return syncedPlayer
            
            // ✅ CORREÇÃO: Estado autoritativo vence - aceita posição do snapshot recebido
            // Para jogo de turno, não fazemos merge heurístico de posição (evita desync)
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
                
                // Preserva estado local completo (compras), mas aceita propriedades críticas do remoto
                return {
                  ...localPlayer, // Preserva estado local completo
                  // ✅ CORREÇÃO: Aceita posição autoritativa do remoto (não faz Math.max)
                  pos: syncedPlayer.pos,
                  bankrupt: syncedPlayer.bankrupt ?? localPlayer.bankrupt,
                  // Preserva dados de progresso local
                  az: localPlayer.az || syncedPlayer.az || 0,
                  am: localPlayer.am || syncedPlayer.am || 0,
                  rox: localPlayer.rox || syncedPlayer.rox || 0,
                  trainingsByVendor: localPlayer.trainingsByVendor || syncedPlayer.trainingsByVendor || {},
                  onboarding: localPlayer.onboarding || syncedPlayer.onboarding || false
                }
              }
              
              // Se não há compras locais, aceita snapshot remoto mas preserva o maior valor de recursos
              return {
                ...syncedPlayer, // Aceita estado sincronizado autoritativo (pos, bankrupt, etc)
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
            
            // Para outros jogadores, aceita o snapshot autoritativo mas preserva certificados locais (caso existam)
            return {
              ...syncedPlayer, // Aceita estado sincronizado autoritativo
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
          // ✅ Monotônico: gameOver nunca volta para false
          setGameOver(prev => prev || !!d.gameOver);
          
          // ✅ Monotônico: winner nunca some depois que gameOver=true
          setWinner(prev => {
            const willBeGameOver = (gameOver || d.gameOver);
            if (willBeGameOver && prev && (!d.winner)) return prev;
            return d.winner ?? prev;
          });
          
          // ✅ Log obrigatório
          if (d.gameOver === true) {
            console.log(`[App] [ENDGAME] estado remoto aplicado: gameOver=true winner=${d.winner?.name ?? d.winner ?? "N/A"}`);
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
  
  // ✅ MELHORIA: Versionamento sequencial para garantir ordem de sincronização
  const stateVersionRef = React.useRef(0)
  const lastAcceptedVersionRef = React.useRef(0)
  
  // ✅ CORREÇÃO: Ref para garantir monotonicidade do estado remoto aplicado
  const lastAppliedNetVersionRef = React.useRef(0)
  
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
    // ✅ CORREÇÃO: Verifica se net está habilitado e pronto
    if (!net?.enabled || !net?.ready) return
    if (!netState) return

    // ✅ CORREÇÃO: Garante monotonicidade do que você aplica
    if (typeof netVersion === 'number') {
      if (netVersion <= lastAppliedNetVersionRef.current) return
      lastAppliedNetVersionRef.current = netVersion
    }

    const np = Array.isArray(netState.players) ? netState.players : null
    const nt = Number.isInteger(netState.turnIdx) ? netState.turnIdx : null
    const nr = Number.isInteger(netState.round) ? netState.round : null

    if (np) setPlayers(np)
    if (nt !== null) setTurnIdx(nt)
    if (nr !== null) {
      // ✅ FIX: evita round regredir por snapshots antigos, MAS permite reset de jogo (START)
      const isResetState = (
        nr === 1 &&
        (nt === 0 || nt === null) &&
        Array.isArray(np) && np.length > 0 &&
        np.every(p => Number(p?.pos ?? 0) === 0) &&
        (netState.gameOver === false || netState.gameOver == null)
      )
      setRound(prev => isResetState ? 1 : Math.max(prev, nr))
    }

    // ✅ CORREÇÃO: Aplica roundFlags do estado autoritativo
    if (netState.roundFlags !== undefined) {
      if (Array.isArray(netState.roundFlags)) {
        setRoundFlags(netState.roundFlags)
        console.log('[NET] applied remote includes roundFlags?', true, 'length:', netState.roundFlags.length)
      } else if (typeof netState.roundFlags === 'object') {
        // Se for objeto, converte para array (compatibilidade)
        const flagsArray = Object.values(netState.roundFlags)
        setRoundFlags(flagsArray)
        console.log('[NET] applied remote includes roundFlags?', true, 'converted from object, length:', flagsArray.length)
      }
    }

    // ✅ CORREÇÃO: Aplica campos de controle de turno e estado do jogo
    if (typeof netState.turnLock === 'boolean') setTurnLock(netState.turnLock)
    if (netState.lockOwner !== undefined) {
      // lockOwner não é state do App, mas pode ser usado se necessário
      console.log('[NET] applied remote includes lockOwner?', true, 'value:', netState.lockOwner)
    }
    // ✅ Monotônico: gameOver nunca volta para false
    setGameOver(prev => prev || !!netState.gameOver);
    
    // ✅ Monotônico: winner nunca some depois que gameOver=true
    setWinner(prev => {
      const willBeGameOver = (gameOver || netState.gameOver);
      if (willBeGameOver && prev && (!netState.winner)) return prev;
      return netState.winner ?? prev;
    });
    
    // ✅ Log obrigatório
    if (netState.gameOver === true) {
      console.log(`[App] [ENDGAME] estado remoto aplicado: gameOver=true winner=${netState.winner?.name ?? netState.winner ?? "N/A"}`);
    }

    console.log('[NET] applied remote v=%d', netVersion)
  }, [netVersion, netState, net?.enabled, net?.ready])

  async function commitRemoteState(nextStatePartial) {
    if (typeof netCommit === 'function') {
      try {
        await netCommit(prev => ({
          ...(prev || {}),
          ...(nextStatePartial || {}),
        }))
      } catch (e) {
        console.warn('[NET] commit failed:', e?.message || e)
      }
    }
  }

  function broadcastState(nextPlayers, nextTurnIdx, nextRound, gameOverState = gameOver, winnerState = winner, patch = {}) {
    // ✅ MELHORIA: Incrementa versão sequencial
    stateVersionRef.current = stateVersionRef.current + 1
    const currentVersion = stateVersionRef.current
    
    // ✅ CORREÇÃO: Usa patch para obter valores atualizados (evita stale closure)
    const nextRoundFlags = patch.roundFlags !== undefined ? patch.roundFlags : roundFlags
    const nextTurnLock = patch.turnLock !== undefined ? patch.turnLock : turnLock
    const nextLockOwner = patch.lockOwner !== undefined ? patch.lockOwner : null
    const patchedGameOver = patch.gameOver !== undefined ? patch.gameOver : gameOverState
    const prevGameOver = !!gameOver || !!lastLocalStateRef.current?.gameOver
    const finalGameOver = prevGameOver ? true : !!patchedGameOver

    const patchedWinner = patch.winner !== undefined ? patch.winner : winnerState
    const prevWinner = (winner ?? lastLocalStateRef.current?.winner ?? null)
    const finalWinner = finalGameOver ? (patchedWinner ?? prevWinner) : patchedWinner

    // ✅ FIX CRÍTICO: round monotônico (nunca deixa broadcast rebaixar rodada)
    // - nextRound pode vir stale (closures em modais/compras)
    // - lastLocalStateRef.current.round geralmente já tem o maior round local
    const patchedRound = patch.round !== undefined ? patch.round : nextRound
    const safeRound = Math.max(
      Number(patchedRound || 1),
      Number(round || 1),
      Number(lastLocalStateRef.current?.round || 1)
    )
    
    // ✅ CORREÇÃO: Atualiza lastLocalStateRef imediatamente antes de fazer broadcast
    // Isso protege contra estados remotos que chegam logo após a mudança local
    const now = Date.now()
    lastLocalStateRef.current = {
      players: nextPlayers,
      turnIdx: nextTurnIdx,
      round: safeRound,
      gameOver: finalGameOver,
      winner: finalWinner,
      timestamp: now,
      version: currentVersion
    }
    lastAcceptedVersionRef.current = currentVersion
    
    console.log('[App] broadcastState - versão:', currentVersion, 'turnIdx:', nextTurnIdx, 'round(next):', nextRound, 'round(safe):', safeRound, 'timestamp:', now)
    if (Object.keys(patch).length > 0) {
      console.log('[NET] commit patch keys:', Object.keys(patch).join(', '))
    }
    
    // 1) rede
    commitRemoteState({
      players: nextPlayers,
      turnIdx: nextTurnIdx,
      round: safeRound,
      roundFlags: nextRoundFlags,
      turnLock: nextTurnLock,
      lockOwner: nextLockOwner,
      gameOver: finalGameOver,
      winner: finalWinner,
    })
    // 2) entre abas
    try {
      bcRef.current?.postMessage?.({
        type: 'SYNC',
        version: currentVersion,  // ✅ MELHORIA: Inclui versão na mensagem
        players: nextPlayers,
        turnIdx: nextTurnIdx,
        round: safeRound,
        roundFlags: nextRoundFlags, // ✅ CORREÇÃO: Usa valor do patch se disponível
        turnLock: nextTurnLock,
        lockOwner: nextLockOwner,
        gameOver: finalGameOver,
        winner: finalWinner,
        source: meId,
        timestamp: now,  // ✅ MELHORIA: Inclui timestamp
      })
    } catch (e) { console.warn('[App] broadcastState failed:', e) }
  }

  function broadcastStart(nextPlayers) {
    // rede
    commitRemoteState({
      players: nextPlayers,
      turnIdx: 0,
      round: 1,
    })
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
    // ✅ CORREÇÃO: Verifica se turnIdx é válido
    if (turnIdx < 0 || turnIdx >= players.length) {
      console.warn('[App] isMyTurn - turnIdx inválido:', turnIdx, 'players.length:', players.length)
      return false
    }
    
    const owner = players[turnIdx]
    if (!owner) {
      console.log('[App] isMyTurn - owner não encontrado, turnIdx:', turnIdx, 'players.length:', players.length)
      return false
    }
    
    // ✅ CORREÇÃO: Verifica se o jogador não está falido
    if (owner.bankrupt) {
      console.log('[App] isMyTurn - owner está falido:', owner.name)
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
  // ✅ CORREÇÃO: Verificações adicionais para garantir que o botão só seja habilitado quando seguro
  const currentPlayer = players[turnIdx]
  const isCurrentPlayerBankrupt = currentPlayer?.bankrupt === true
  // ✅ CORREÇÃO: Botão só é habilitado quando:
  // 1. É minha vez (isMyTurn) - verifica se o jogador atual é realmente eu
  // 2. Não há modais abertas (modalLocks === 0) - garante que todas as modais foram fechadas
  // 3. Não há turnLock ativo (!turnLock) - garante que não há ação em progresso
  // 4. O jogador atual não está falido
  // 5. O jogo não terminou
  // IMPORTANTE: O turno só muda quando todas as modais são fechadas, então se modalLocks > 0, ainda não é a vez do próximo
  // ✅ CORREÇÃO ADICIONAL: Verifica se o jogador atual realmente corresponde ao turnIdx
  const isCurrentPlayerMe = currentPlayer && String(currentPlayer.id) === String(myUid)
  const isWaitingRevenue = round === 5 && players[turnIdx]?.waitingAtRevenue
  const controlsCanRoll = isMyTurn && isCurrentPlayerMe && modalLocks === 0 && !turnLock && !isCurrentPlayerBankrupt && !gameOver && !isWaitingRevenue
  console.log('[App] controlsCanRoll - isMyTurn:', isMyTurn, 'isCurrentPlayerMe:', isCurrentPlayerMe, 'modalLocks:', modalLocks, 'turnLock:', turnLock, 'isBankrupt:', isCurrentPlayerBankrupt, 'gameOver:', gameOver, 'isWaitingRevenue:', isWaitingRevenue, 'result:', controlsCanRoll)

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
