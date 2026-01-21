// src/App.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
import './styles.css'

// Telas
import StartScreen from './components/StartScreen.jsx'
import LobbyList from './pages/LobbyList.jsx'
import PlayersLobby from './pages/PlayersLobby.jsx'
import Board from './components/board/Board.jsx'
import HUD from './components/panel/HUD.jsx'
import Controls from './components/panel/Controls.jsx'
import FinalWinners from './components/FinalWinners.jsx'
import BankruptOverlay from './modals/BankruptOverlay.jsx'
import DebugPanel from './components/DebugPanel.jsx'
import { ModalProvider } from './modals/ModalContext.jsx'

// Regras / Engine
import { useTurnEngine } from './game/useTurnEngine.jsx'
import {
  computeDespesasFor,
  computeFaturamentoFor,
  capacityAndAttendance
} from './game/gameMath'
import { debugMode, validateGameState, validateCalculations } from './game/debugMode.js'
import { initCashAudit, captureCashDiff } from './debug/cashAudit.js'
// ✅ CORREÇÃO: Imports de testes apenas em DEV (carregamento dinâmico)
if (import.meta.env.DEV) {
  // Carrega validadores e testes apenas em desenvolvimento
  Promise.all([
    import('./game/__tests__/realTimeValidator.js'),
    import('./game/__tests__/index.js')
  ]).then(([realTimeModule]) => {
    if (realTimeModule?.validateGameState) {
      window.__validateGameStateRealTime = realTimeModule.validateGameState
    }
  }).catch(err => {
    console.warn('[App] Failed to load test modules:', err)
  })
}

// Identidade por aba
import { getOrCreateTabPlayerId, setTabPlayerName } from './auth'

// Net (opcional)
import { useGameNet } from './net/GameNetProvider.jsx'

// Gerenciamento de salas
import { leaveRoom } from './lib/lobbies'

// Tamanho da pista
import { TRACK_LEN } from './data/track'

// -------------------------------------------------------------
// App raiz – concentra roteamento de fases e estado global leve
// -------------------------------------------------------------

// ✅ CORREÇÃO: Função util para clamp de round (defesa em profundidade)
const MAX_ROUNDS = 5
const clampRound = (r) => {
  const n = Number(r)
  if (!Number.isFinite(n)) return 1
  return Math.min(MAX_ROUNDS, Math.max(1, n))
}

export default function App() {
  // ====== fases da UI
  const [phase, setPhase] = useState('start') // 'start' | 'lobbies' | 'playersLobby' | 'game'
  const [currentLobbyId, setCurrentLobbyId] = useState(null)
  const [roomId, setRoomId] = useState(null)

  // ====== identidade por aba
  const meId = useMemo(() => getOrCreateTabPlayerId(), [])
  // ✅ OBJ 2: nome começa vazio; só define após StartScreen confirmar.
  const [myName, setMyName] = useState('')
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

  // ✅ CORREÇÃO: Normaliza ordem dos players para garantir consistência entre clientes
  // Seat é IMUTÁVEL após atribuído no start - nunca reatribui seat existente
  const normalizePlayers = (players) => {
    if (!Array.isArray(players) || players.length === 0) return players
    
    // Cria cópia para não mutar o original
    const arr = [...players].filter(Boolean)
    
    // ✅ DETERMINÍSTICO: nunca ordenar por campos mutáveis (cash/name/clients/etc).
    // Regra: usa joinOrder (persistido no player) e fallback por seat e depois por id.
    const hasJoinOrder = arr.every(p => Number.isInteger(p.joinOrder))
    const hasSeat = arr.every(p => Number.isInteger(p.seat))

    // 1) ordena por joinOrder se todos tiverem; senão usa seat se todos tiverem; senão fallback por id.
    let ordered = hasJoinOrder
      ? arr.sort((a, b) => (a.joinOrder - b.joinOrder) || String(a?.id ?? '').localeCompare(String(b?.id ?? '')))
      : hasSeat
        ? arr.sort((a, b) => (a.seat - b.seat) || String(a?.id ?? '').localeCompare(String(b?.id ?? '')))
        : arr.sort((a, b) => String(a?.id ?? a?.player_id ?? '').localeCompare(String(b?.id ?? b?.player_id ?? '')))
    
    // Preenche seats faltantes SEM alterar os existentes (determinístico)
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

    // ✅ joinOrder persistido: se faltante, deriva de seat (imutável) para estabilizar ordenação entre clientes
    ordered = ordered.map(p => {
      if (Number.isInteger(p.joinOrder)) return p
      if (Number.isInteger(p.seat)) return { ...p, joinOrder: p.seat }
      return { ...p, joinOrder: 0 }
    })
    
    // Reordena por seat após preencher faltantes
    // Importante: a ordem global passa a ser joinOrder (determinístico)
    ordered = ordered.sort((a, b) => (a.joinOrder - b.joinOrder) || String(a?.id ?? '').localeCompare(String(b?.id ?? '')))
    
    console.log('[App] normalizePlayers - ordenados:', ordered.map(p => ({ id: p.id, name: p.name, seat: p.seat })))
    return ordered
  }

  const [players, _setPlayers] = useState([
    applyStarterKit({ id: meId, name: '', cash: 18000, pos: 0, color: '#ffd54f', bens: 4000 })
  ])

  // ====== Cash Audit (instrumentação de saldo) ======
  // Wrapper do setPlayers: captura diffs de cash sem mudar schema do estado.
  const setPlayers = React.useCallback((updater, meta = {}) => {
    _setPlayers((prev) => {
      const next = (typeof updater === 'function') ? updater(prev) : updater
      // meta pode ser setado via `setCashAuditContext()` por qualquer fluxo (ex.: useTurnEngine).
      captureCashDiff(prev, next, null)

      // ✅ OBJ 3: log obrigatório de mudança de posição
      try {
        const source = meta?.source || 'UNKNOWN'
        const prevById = new Map((prev || []).map(p => [String(p?.id), p]))
        for (const p of (next || [])) {
          const id = String(p?.id)
          const before = prevById.get(id)?.pos
          const after = p?.pos
          if (after !== undefined && before !== undefined && Number(before) !== Number(after)) {
            console.log('[POS_CHANGE]', { playerId: id, from: before, to: after, source })
          }
        }
      } catch {}
      return next
    })
  }, [])

  useEffect(() => {
    // Ativa via ENV ou querystring; por padrão fica OFF e é silencioso.
    let enabled = false
    try {
      enabled = String(import.meta.env.VITE_CASH_AUDIT || '') === '1'
    } catch {}
    try {
      const url = new URL(window.location.href)
      if (url.searchParams.get('cashAudit') === '1') enabled = true
    } catch {}
    initCashAudit({ enabled })
  }, [])
  const [round, setRound] = useState(1)
  const [turnIdx, setTurnIdx] = useState(0)
  const [turnPlayerId, setTurnPlayerId] = useState(null) // ✅ CORREÇÃO: ID do jogador da vez (autoritativo)
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
  const [lockOwner, setLockOwner] = useState(null)
  const bcRef = useRef(null)
  // ✅ INIT_GUARD: após aplicar snapshot autoritativo do Supabase, nunca mais aceitar "reset local" de turno/round
  const hydratedFromNetRef = useRef(false)
  
  // ✅ BUG 2 FIX: Refs para watchdog anti-trava
  const lockSinceRef = useRef(null)
  const lastNetApplyAtRef = useRef(0)

  // ✅ Invariante: turnLock=true nunca pode ficar com lockOwner null.
  useEffect(() => {
    if (!turnLock) return
    if (lockOwner) return
    if (turnPlayerId) {
      console.warn('[LOCK_INVARIANT] turnLock=true com lockOwner=null -> corrigindo owner para turnPlayerId', { turnPlayerId })
      setLockOwner(String(turnPlayerId))
    } else {
      console.warn('[LOCK_INVARIANT] turnLock=true sem turnPlayerId -> desligando turnLock')
      setTurnLock(false)
    }
  }, [turnLock, lockOwner, turnPlayerId])

  // ====== “quem sou eu” no array de players
  const isMine = React.useCallback((p) => !!p && String(p.id) === String(myUid), [myUid])
  const myCash = useMemo(() => (players.find(isMine)?.cash ?? 0), [players, isMine])

  // ====== bootstrap de contexto (NÃO muda fase automaticamente)
  // ✅ OBJ 1: StartScreen NUNCA deve ser pulada automaticamente.
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
        // não entrar automaticamente; apenas guardar para depois do StartScreen
        setRoomId(String(room))
        // mantém referência para quando o usuário confirmar o nome
        setCurrentLobbyId(String(room))
        try {
          url.searchParams.set('room', String(room))
          history.replaceState(null, '', url.toString())
        } catch {}
      }
    } catch {}
  }, [])

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
          // ✅ INIT_GUARD: em multiplayer via Supabase, ignore START via BroadcastChannel
          // (BC é apenas para abas na mesma máquina; em rede, o snapshot do servidor é a autoridade)
          if (net?.enabled && net?.ready) {
            console.log('[INIT_GUARD] init skipped: net enabled/ready (BC START ignored)')
            return
          }
          if (hydratedFromNetRef.current) {
            console.log('[INIT_GUARD] init skipped: hydratedFromNet=true (BC START ignored)')
            return
          }
          // ✅ OBJ 1: nunca pular StartScreen automaticamente
          if (phase === 'start') {
            console.log('[INIT_GUARD] init skipped: phase=start (BC START ignored)')
            return
          }
          const mapped = Array.isArray(d.players) ? d.players.map(applyStarterKit) : []
          if (!mapped.length) return

          // ✅ CORREÇÃO: Normaliza players antes de usar
          const normalized = normalizePlayers(mapped)

          // adota UID real se PlayersLobby tiver setado
          try {
            const wuid = (window.__MY_UID || window.__myUid || window.__playerId) || null
            if (wuid) setMyUid(String(wuid))
          } catch {}

          setPlayers(normalized, { source: 'BC_START' })
          setTurnIdx(0)
          // ✅ CORREÇÃO: Define turnPlayerId no start (fonte autoritativa)
          const firstPlayerId = normalized[0]?.id ? String(normalized[0].id) : null
          setTurnPlayerId(firstPlayerId)
          setRound(1)
          setRoundFlags(new Array(Math.max(1, normalized.length)).fill(false))
          setGameOver(false); setWinner(null)
          // não troca fase automaticamente aqui; fase é conduzida pelo usuário
          setLog(['Jogo iniciado!'])
          return
        }

        if (d.type === 'TURNLOCK') {
          setTurnLock(!!d.value)
          // ✅ Invariante: turnLock=true deve ter owner
          if (d.value) {
            if (d.owner) setLockOwner(String(d.owner))
          } else {
            setLockOwner(null)
          }
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
          
          // ✅ CORREÇÃO MULTIPLAYER: BroadcastChannel SYNC é para mesma máquina (abas)
          // Em multiplayer via Supabase, o netState é a autoridade
          // Aqui aplicamos turnIdx/turnPlayerId do BroadcastChannel apenas se não houver netState ativo
          // REMOVIDO: todas as heurísticas de rejeição baseadas em timestamp local (< 5s)
          if (d.turnIdx !== turnIdx && (!net?.enabled || !net?.ready)) {
            // ✅ CORREÇÃO: Aplica turnPlayerId se disponível (fonte autoritativa)
            if (d.turnPlayerId !== undefined && d.turnPlayerId !== null) {
              setTurnPlayerId(d.turnPlayerId)
              // Deriva turnIdx de turnPlayerId
              const normalized = normalizePlayers(d.players || players)
              const derivedTurnIdx = normalized.findIndex(p => String(p.id) === String(d.turnPlayerId))
              if (derivedTurnIdx >= 0) {
                setTurnIdx(derivedTurnIdx)
                console.log('[App] SYNC (BC) - turnIdx derivado de turnPlayerId:', derivedTurnIdx, 'turnPlayerId:', d.turnPlayerId)
              }
            } else if (d.turnIdx >= 0 && d.turnIdx < (d.players?.length || players.length)) {
              // Fallback: usa turnIdx se turnPlayerId não disponível
              setTurnIdx(d.turnIdx)
              console.log('[App] SYNC (BC) - Sincronizando turnIdx', { local: turnIdx, remote: d.turnIdx })
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
          // ✅ PROTEÇÃO: Clamp para garantir que nunca exiba round > MAX_ROUNDS
          if (d.round !== round) {
            const incoming = clampRound(d.round)
            if (lastLocal && (now - lastLocal.timestamp) < 3000) {
              const localRoundChanged = lastLocal.round !== round
              if (localRoundChanged) {
                // Se a rodada local mudou recentemente, usa Math.max para proteger o incremento
                setRound(prevRound => {
                  const finalRound = Math.min(MAX_ROUNDS, Math.max(prevRound, incoming))
                  if (finalRound > prevRound) {
                    console.log('[App] SYNC round aplicado (clamp): local=', prevRound, 'remote=', incoming, 'final=', finalRound)
                  }
                  return finalRound
                })
              } else {
                setRound(incoming)
              }
            } else {
              // Sempre usa Math.max para proteger contra reversão
              setRound(prevRound => {
                const finalRound = Math.min(MAX_ROUNDS, Math.max(prevRound, incoming))
                console.log('[App] SYNC round aplicado (clamp): local=', prevRound, 'remote=', incoming, 'final=', finalRound)
                return finalRound
              })
            }
          }
          
          // ✅ CORREÇÃO: Se gameOver, força round para MAX_ROUNDS para estabilizar HUD
          if (d.gameOver === true || d.winner) {
            setRound(MAX_ROUNDS)
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
              
              // Se não há compras locais, aceita snapshot remoto COMO AUTORITATIVO.
              // ⚠️ Nunca usar Math.max em cash/recursos aqui, senão multas/pagamentos "voltam" em testes com múltiplas abas.
              return {
                ...syncedPlayer, // Aceita estado sincronizado autoritativo (pos, bankrupt, etc)
                // Recursos autoritativos (do snapshot recebido)
                cash: Number(syncedPlayer.cash || 0),
                clients: remoteClients,
                mixProdutos: syncedPlayer.mixProdutos,
                erpLevel: syncedPlayer.erpLevel,
                vendedoresComuns: remoteVendedores,
                fieldSales: remoteFieldSales,
                insideSales: remoteInsideSales,
                gestores: Number(syncedPlayer.gestores ?? syncedPlayer.gestoresComerciais ?? syncedPlayer.managers ?? 0),
                gestoresComerciais: Number(syncedPlayer.gestoresComerciais ?? syncedPlayer.gestores ?? syncedPlayer.managers ?? 0),
                managers: Number(syncedPlayer.managers ?? syncedPlayer.gestores ?? syncedPlayer.gestoresComerciais ?? 0),
                bens: Number(syncedPlayer.bens || 0),
                manutencao: syncedPlayer.manutencao,
                loanPending: syncedPlayer.loanPending,
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
          // ✅ BUG 2 FIX: Usa merge monotônico para evitar reset de cash/assets
          // A lógica de merge já foi aplicada acima em syncedPlayers, então usa diretamente
          setPlayers(syncedPlayers, { source: 'BC_SYNC' })
          
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

  const setTurnLockBroadcast = (value, owner = undefined) => {
    const v = !!value
    const nextOwner =
      v
        ? String(owner ?? myUid ?? turnPlayerId ?? '')
        : null

    // ✅ Invariante: turnLock=true nunca deve coexistir com lockOwner null/''.
    setTurnLock(v)
    if (v) {
      if (nextOwner) setLockOwner(nextOwner)
    } else {
      setLockOwner(null)
    }

    // ✅ Propaga para abas (mesma máquina)
    try {
      bcRef.current?.postMessage?.({ type: 'TURNLOCK', value: v, owner: nextOwner, ts: Date.now(), source: meId })
    } catch {}

    // ✅ Propaga para Supabase (estado compartilhado) — sem depender de turnIdx
    try {
      if (net?.enabled && net?.ready && typeof netCommit === 'function') {
        commitGamePatch({
          playersDeltaById: {},
          statePatch: {
            kind: 'LOCK',
            turnLock: v,
            lockOwner: nextOwner,
            lockTs: Date.now(),
          }
        })
      }
    } catch {}
  }

  // ====== multiplayer em rede (opcional) via provider
  // ✅ CORREÇÃO: useGameNet deve ser chamado diretamente, sem try/catch (Rules of Hooks)
  const net = useGameNet()
  const netCommit = net?.commit
  const netVersion = net?.version
  const netState = net?.state
  const netStateId = net?.stateId
  
  // ====== "é minha vez?" (ÚNICA fonte: turnPlayerId) ======
  const isMyTurn = useMemo(() => {
    const me = String(myUid || meId || "")
    if (!me) return false
    if (!turnPlayerId) return false
    return String(turnPlayerId) === me
  }, [turnPlayerId, myUid, meId])

  // ✅ coerência: mantém turnIdx <-> turnPlayerId sincronizados (evita desync UI vs engine)
  useEffect(() => {
    if (!players?.length) return

    if (turnPlayerId) {
      const idx = players.findIndex(p => String(p.id) === String(turnPlayerId))
      if (idx >= 0 && idx !== turnIdx) {
        setTurnIdx(idx)
      }
    } else {
      // ✅ Sem turnPlayerId: não inventa em multiplayer. Em local, pode usar fallback.
      if (!net?.enabled || !net?.ready) {
        const fallback = players[turnIdx]?.id || players[0]?.id
        if (fallback) setTurnPlayerId(String(fallback))
      }
    }
  }, [players, turnPlayerId, turnIdx])
  
  // ✅ CORREÇÃO: Ref para rastrear quando uma mudança local foi feita recentemente
  const localChangeRef = React.useRef(null)
  const lastLocalStateRef = React.useRef(null)
  
  // ✅ MELHORIA: Versionamento sequencial para garantir ordem de sincronização
  const stateVersionRef = React.useRef(0)
  const lastAcceptedVersionRef = React.useRef(0)
  
  // ✅ CORREÇÃO: Ref para garantir monotonicidade do estado remoto aplicado
  const lastAppliedNetVersionRef = React.useRef(0)
  const lastAppliedStateIdRef = React.useRef(null)
  
  // ✅ CORREÇÃO: Refs para rastrear baseline local antes de mudanças (para merge 3-way)
  const playersBeforeRef = React.useRef(null)
  
  // ✅ CORREÇÃO MULTIPLAYER: Helper para commitar patch/delta (não snapshot completo)
  // Permite fazer merge por ID sem sobrescrever estado completo
  const commitGamePatch = React.useCallback(({ playersDeltaById = {}, statePatch = {} }) => {
    if (typeof netCommit !== 'function') return
    
    // Calcula versionamento e timestamp
    stateVersionRef.current = stateVersionRef.current + 1
    const currentVersion = stateVersionRef.current
    const now = Date.now()
    
    try {
      netCommit(prev => {
        const prevState = prev || {}
        
        // ✅ CORREÇÃO 1: Garantir versão monotônica no commit remoto
        const localStateVersion = currentVersion
        const remoteStateVersion = prevState.stateVersion ?? 0
        const safeVersion = Math.max(localStateVersion, remoteStateVersion) + 1
        
        // ✅ CORREÇÃO CRÍTICA: nunca deixe o patch "encolher" players para 1 só jogador.
        // Em commits iniciais, prevState.players pode vir vazio/stale (antes do primeiro snapshot).
        // Então usamos um seed robusto vindo de refs locais (lastLocalStateRef / playersBeforeRef).
        const seedPlayersRaw =
          (Array.isArray(prevState.players) && prevState.players.length > 0)
            ? prevState.players
            : (Array.isArray(lastLocalStateRef.current?.players) && lastLocalStateRef.current.players.length > 0)
              ? lastLocalStateRef.current.players
              : (Array.isArray(playersBeforeRef.current) && playersBeforeRef.current.length > 0)
                ? playersBeforeRef.current
                : []

        const prevPlayers = normalizePlayers(seedPlayersRaw)
        const byId = new Map(prevPlayers.map(p => [String(p.id), p]))
        
        // Aplica deltas por ID (idempotente por actionId)
        for (const [id, delta] of Object.entries(playersDeltaById)) {
          const playerId = String(id)
          const existing = byId.get(playerId)
          if (existing) {
            const actionId = delta?._actionId || statePatch?.actionId || null
            if (actionId) {
              const lastActions = (existing.lastActions && typeof existing.lastActions === 'object') ? existing.lastActions : {}
              if (lastActions[actionId]) {
                console.warn('[IDEMPOTENCY] ignorando delta já aplicado', { playerId, actionId })
                continue
              }
              // registra actionId com limite (50)
              const nextActions = { ...lastActions, [actionId]: now }
              const keys = Object.keys(nextActions)
              if (keys.length > 50) {
                keys
                  .sort((a, b) => Number(nextActions[a] || 0) - Number(nextActions[b] || 0))
                  .slice(0, keys.length - 50)
                  .forEach(k => { try { delete nextActions[k] } catch {} })
              }
              const { _actionId, ...cleanDelta } = (delta || {})
              // ✅ OBJ 3: nunca sobrescrever campos com undefined (especialmente pos)
              const merged = { ...existing }
              for (const [k, v] of Object.entries(cleanDelta)) {
                if (v !== undefined) merged[k] = v
              }
              byId.set(playerId, applyStarterKit({ ...merged, lastActions: nextActions }))
            } else {
              const { _actionId, ...cleanDelta } = (delta || {})
              const merged = { ...existing }
              for (const [k, v] of Object.entries(cleanDelta)) {
                if (v !== undefined) merged[k] = v
              }
              byId.set(playerId, applyStarterKit(merged))
            }
          } else {
            // Novo player (não deve acontecer, mas trata)
            const { _actionId, ...cleanDelta } = (delta || {})
            byId.set(playerId, applyStarterKit({ id: playerId, ...cleanDelta }))
          }
        }
        
        // Reconstrói array ordenado
        const mergedPlayers = normalizePlayers(Array.from(byId.values()))
        
        // Prepara statePatch completo (inclui versionamento monotônico)
        const finalStatePatch = {
          ...statePatch,
          stateVersion: safeVersion, // ✅ CORREÇÃO: Versão monotônica garantida
          updatedAt: now,
          updatedBy: myUid
        }
        
        // Se players foram modificados, inclui no patch
        if (Object.keys(playersDeltaById).length > 0) {
          finalStatePatch.players = mergedPlayers
        }
        
        // Merge do statePatch sobre o estado anterior
        const next = {
          ...prevState,
          ...finalStatePatch
        }
        // ✅ TURNO: turnIdx não é mais persistido no estado compartilhado
        try { delete next.turnIdx } catch {}
        
        // Garante que players sempre está normalizado
        if (next.players) {
          next.players = normalizePlayers(next.players)
        }
        
        console.log('[NET] ✅ commitGamePatch - tipo:', statePatch.turnPlayerId ? 'TURN' : statePatch.round ? 'ROUND' : 'PLAYER_DELTA', 
                   'playersDeltaIds:', Object.keys(playersDeltaById).join(','),
                   'statePatchKeys:', Object.keys(statePatch).join(','),
                   'stateVersion:', safeVersion, '(local:', localStateVersion, 'remote:', remoteStateVersion, ')')
        
        return next
      })
    } catch (e) {
      console.warn('[NET] commitGamePatch failed:', e?.message || e)
    }
  }, [netCommit, myUid])
  
  // ✅ CORREÇÃO: O baseline é capturado no broadcastState antes de fazer commit
  // Não precisamos capturar via useEffect, pois o baseline deve ser o estado ANTES da mudança
  
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
        // ✅ FIX: não sobrescreve o ref com um "shape" menor (isso apagava stateVersion/turnPlayerId/winner etc.)
        lastLocalStateRef.current = {
          ...(current || {}),
          players,
          turnIdx,
          round,
          timestamp: now,
          // mantém stateVersion consistente caso ainda não exista no ref
          stateVersion: (current?.stateVersion ?? stateVersionRef.current ?? 0),
        }
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

    // ✅ CORREÇÃO MULTIPLAYER: Usa SOMENTE netVersion como autoridade (versão da linha no servidor)
    // Snapshot autoritativo:
    // - aplica se netVersion avançou
    // - OU se netVersion é igual mas stateId é diferente (corrige divergência com mesma versão)
    // ✅ CORREÇÃO 4: Blindagem no client que recebe rollback
    if (typeof netVersion === 'number') {
      // ✅ FIX: lastLocalStateRef pode ser sobrescrito por effects; stateVersionRef é a fonte local mais confiável
      const localStateVersion = (stateVersionRef.current ?? lastLocalStateRef.current?.stateVersion ?? 0)
      const remoteStateVersion = netState?.stateVersion ?? 0
      
      const incomingStateId = String(netState?.stateId ?? netState?.actionId ?? netStateId ?? '')
      const lastStateId = String(lastAppliedStateIdRef.current ?? '')

      // Ignora se versão é menor (rollback)
      if (netVersion < lastAppliedNetVersionRef.current) {
        console.log('[NET] ⏭️ IGNORADO - netVersion regressivo:', { netVersion, lastApplied: lastAppliedNetVersionRef.current })
        return
      }

      // Se versão é igual, só aplica se stateId for diferente (e não vazio)
      if (netVersion === lastAppliedNetVersionRef.current) {
        if (incomingStateId && incomingStateId !== lastStateId) {
          console.warn('[NET] same version but different stateId -> applying', {
            netVersion,
            incomingStateId,
            lastStateId
          })
        } else {
          console.log('[NET] ⏭️ IGNORADO - same version and same stateId:', {
            netVersion,
            stateId: incomingStateId || '(empty)'
          })
          return
        }
      }
      
      // ✅ CORREÇÃO 4: Ignora rollback de stateVersion (proteção adicional)
      if (remoteStateVersion > 0 && localStateVersion > 0 && remoteStateVersion < localStateVersion) {
        console.warn('[NET] ⚠️ IGNORANDO rollback de stateVersion:', {
          remoteStateVersion,
          localStateVersion,
          netVersion
        })
        // Ainda atualiza netVersion para não ficar preso, mas não aplica o estado
        lastAppliedNetVersionRef.current = netVersion
        return
      }
      
      // Atualiza refs ANTES de aplicar (garante monotonicidade)
      lastAppliedNetVersionRef.current = netVersion
      if (incomingStateId) lastAppliedStateIdRef.current = incomingStateId
    } else {
      // Se netVersion não está disponível, não aplica (aguarda versão válida)
      return
    }

    // ✅ CORREÇÃO MULTIPLAYER: Aplica snapshot COMPLETO sempre que netVersion avançar
    // REMOVIDO: todas as heurísticas de rejeição (stateVersion, timestamp local, "mudança recente")
    // O servidor (netVersion) é a única autoridade
    
    const np = Array.isArray(netState.players) ? netState.players : null
    // turnIdx remoto é legado e NÃO é fonte de verdade
    const nr = Number.isInteger(netState.round) ? netState.round : null

    // ✅ TURNO: turnPlayerId é a ÚNICA fonte de verdade.
    const incomingTurnId =
      (netState.turnPlayerId !== undefined && netState.turnPlayerId !== null && String(netState.turnPlayerId) !== '')
        ? String(netState.turnPlayerId)
        : null
    if (incomingTurnId && String(turnPlayerId || '') !== incomingTurnId) {
      setTurnPlayerId(incomingTurnId)
    }

    // ✅ CORREÇÃO MULTIPLAYER: Aplica players SEMPRE quando netVersion avançar (snapshot autoritativo)
    if (np) {
      // Normaliza players antes de aplicar (garante ordem consistente)
      const normalizedPlayers = normalizePlayers(np)
      setPlayers(normalizedPlayers, { source: 'SNAPSHOT' })
      // Atualiza baseline para próximo merge
      playersBeforeRef.current = JSON.parse(JSON.stringify(normalizedPlayers))
      console.log('[NET] ✅ Aplicado players (snapshot autoritativo) - netVersion:', netVersion, 'playersOrdered:', normalizedPlayers.map(p => ({ id: p.id, seat: p.seat })))

      // turnIdx é DERIVADO localmente do turnPlayerId (nunca do remoto)
      if (incomingTurnId) {
        const derivedTurnIdx = normalizedPlayers.findIndex(p => String(p.id) === String(incomingTurnId))
        if (derivedTurnIdx >= 0 && derivedTurnIdx !== turnIdx) {
          console.log('[NET] ✅ derived turnIdx from turnPlayerId:', derivedTurnIdx, 'turnPlayerId:', incomingTurnId)
          setTurnIdx(derivedTurnIdx)
        }
      }
    }
    
    if (nr !== null) {
      // ✅ FIX: evita round regredir por snapshots antigos, MAS permite reset de jogo (START)
      const isResetState = (
        nr === 1 &&
        Array.isArray(np) && np.length > 0 &&
        np.every(p => Number(p?.pos ?? 0) === 0) &&
        (netState.gameOver === false || netState.gameOver == null)
      )
      const safeNr = clampRound(nr)
      setRound(prev => {
        const finalRound = isResetState ? 1 : Math.min(MAX_ROUNDS, Math.max(prev, safeNr))
        return finalRound
      })
    }
    
    // ✅ CORREÇÃO: Se gameOver, força round para MAX_ROUNDS para estabilizar HUD
    if (netState.gameOver === true || netState.winner) {
      setRound(MAX_ROUNDS)
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

    // ✅ LOCKS: aplicar do Supabase (estado compartilhado) e sanar invariantes
    if (typeof netState.turnLock !== 'undefined') {
      setTurnLock(!!netState.turnLock)
    }
    if (typeof netState.lockOwner !== 'undefined') {
      setLockOwner(netState.lockOwner ? String(netState.lockOwner) : null)
    }
    if (netState.turnLock === true && (!netState.lockOwner) && incomingTurnId) {
      setLockOwner(incomingTurnId)
    }
    lastNetApplyAtRef.current = Date.now()

    // ✅ Monotônico: gameOver nunca volta para false
    setGameOver(prev => prev || !!netState.gameOver);
    
    // ✅ Monotônico: winner nunca some depois que gameOver=true
    setWinner(prev => {
      const willBeGameOver = (!!netState.gameOver || !!netState.winner);
      if (willBeGameOver && prev && (!netState.winner)) return prev;
      return netState.winner ?? prev;
    });
    
    // ✅ Log obrigatório
    if (netState.gameOver === true) {
      console.log(`[App] [ENDGAME] estado remoto aplicado: gameOver=true winner=${netState.winner?.name ?? netState.winner ?? "N/A"}`);
    }

    // ✅ CORREÇÃO MULTIPLAYER: Log de aplicação do snapshot autoritativo
    console.log('[NET] ✅ applied remote snapshot - netVersion:', netVersion, 'turnPlayerId:', netState.turnPlayerId, 'round:', nr)

    // ✅ INIT_GUARD: marca hidratação real quando há turno/players válidos vindos da rede
    try {
      const hasPlayers = Array.isArray(netState.players) && netState.players.length > 0
      const hasTurn = netState.turnPlayerId !== undefined && netState.turnPlayerId !== null && String(netState.turnPlayerId) !== ''
      if (hasPlayers && hasTurn) {
        hydratedFromNetRef.current = true
      }
    } catch {}
  }, [netVersion, netState, net?.enabled, net?.ready])

  // ✅ BUG 2 FIX: Watchdog anti-trava - libera turnLock se travado por muito tempo
  useEffect(() => {
    if (!turnLock) {
      lockSinceRef.current = null
      return
    }

    // Inicializa lockSinceRef quando turnLock vira true
    if (!lockSinceRef.current) {
      lockSinceRef.current = Date.now()
    }

    const checkInterval = setInterval(() => {
      const now = Date.now()
      const lockAge = lockSinceRef.current ? (now - lockSinceRef.current) : 0
      const currentPlayer = players[turnIdx]
      const isCurrentPlayerMe = currentPlayer && String(currentPlayer.id) === String(myUid)
      const isMyTurnCheck = isMyTurn && isCurrentPlayerMe
      const isLockOwnerMe = lockOwner === myUid
      const shouldSteal = lockAge > 8000 && isMyTurnCheck && !isLockOwnerMe && lockOwner != null

      if (shouldSteal) {
        console.warn('[LOCK-WATCHDOG] stole lock - turnLock travado por', lockAge, 'ms, liberando...', {
          isMyTurn: isMyTurnCheck,
          lockOwner,
          myUid
        })
        // Tenta "steal lock" via commit/broadcast
        commitRemoteState({ turnLock: false, lockOwner: myUid })
        setTurnLockBroadcast(false)
        setLockOwner(myUid)
        lockSinceRef.current = null
      }
    }, 1000)

    return () => clearInterval(checkInterval)
  }, [turnLock, isMyTurn, turnIdx, players, lockOwner, myUid, netCommit])

  async function commitRemoteState(nextStatePartial) {
    if (typeof netCommit === 'function') {
      try {
        await netCommit(prev => {
          const prevState = prev || {}
          const nextPartial = nextStatePartial || {}
          
          // ✅ CORREÇÃO: Merge 3-way para players (evita sobrescrever com snapshot stale)
          if (nextPartial.players && Array.isArray(nextPartial.players)) {
            const baseline = playersBeforeRef.current || prevState.players || []
            const prevPlayers = prevState.players || []
            const nextPlayers = nextPartial.players
            
            // Cria mapas por ID para facilitar lookup
            const baselineMap = new Map(baseline.map(p => [String(p?.id), p]))
            const prevMap = new Map(prevPlayers.map(p => [String(p?.id), p]))
            const nextMap = new Map(nextPlayers.map(p => [String(p?.id), p]))
            
            // Merge 3-way: para cada playerId
            const mergedPlayers = []
            const allPlayerIds = new Set([
              ...baselineMap.keys(),
              ...prevMap.keys(),
              ...nextMap.keys()
            ])
            
            for (const playerId of allPlayerIds) {
              const baselinePlayer = baselineMap.get(playerId)
              const prevPlayer = prevMap.get(playerId)
              const nextPlayer = nextMap.get(playerId)
              
              // Se o player mudou do baseline para nextPlayers => aplicar nextPlayer (mudança local)
              const changedFromBaseline = baselinePlayer && nextPlayer && 
                JSON.stringify(baselinePlayer) !== JSON.stringify(nextPlayer)
              
              if (changedFromBaseline && nextPlayer) {
                // Mudança local: aplicar nextPlayer
                mergedPlayers.push(applyStarterKit(nextPlayer))
              } else if (prevPlayer) {
                // Não mudou localmente: manter o que está no servidor (prevPlayer)
                mergedPlayers.push(applyStarterKit(prevPlayer))
              } else if (nextPlayer) {
                // Novo player: aplicar nextPlayer
                mergedPlayers.push(applyStarterKit(nextPlayer))
              }
            }
            
            // Ordena por ordem original (preserva índices)
            const orderedPlayers = []
            const nextOrder = nextPlayers.map(p => String(p?.id))
            for (const playerId of nextOrder) {
              const found = mergedPlayers.find(p => String(p?.id) === playerId)
              if (found) orderedPlayers.push(found)
            }
            // Adiciona players que não estavam em nextPlayers
            for (const player of mergedPlayers) {
              if (!nextOrder.includes(String(player?.id))) {
                orderedPlayers.push(player)
              }
            }
            
            // Limpa baseline após merge
            playersBeforeRef.current = null
            
            // ✅ CORREÇÃO 1: Garantir versão monotônica no commit remoto
            const localStateVersion = nextPartial.stateVersion ?? 0
            const remoteStateVersion = prevState.stateVersion ?? 0
            const safeVersion = Math.max(localStateVersion, remoteStateVersion) + 1
            
            const next = {
              ...prevState,
              ...nextPartial,
              players: orderedPlayers.length > 0 ? orderedPlayers : nextPlayers,
              stateVersion: safeVersion // ✅ CORREÇÃO: Versão monotônica garantida
            }
            // ✅ TURNO: turnIdx não é mais persistido
            try { delete next.turnIdx } catch {}
            return next
          }
          
          // ✅ CORREÇÃO 1: Garantir versão monotônica no commit remoto
          const localStateVersion = nextPartial.stateVersion ?? 0
          const remoteStateVersion = prevState.stateVersion ?? 0
          const safeVersion = Math.max(localStateVersion, remoteStateVersion) + 1
          
          // Para outros campos, merge simples com versão monotônica
          const next = {
            ...prevState,
            ...nextPartial,
            stateVersion: safeVersion // ✅ CORREÇÃO: Versão monotônica garantida
          }
          // ✅ TURNO: turnIdx não é mais persistido
          try { delete next.turnIdx } catch {}
          return next
        })
      } catch (e) {
        console.warn('[NET] commit failed:', e?.message || e)
        // Limpa baseline em caso de erro
        playersBeforeRef.current = null
      }
    }
  }

  function broadcastState(nextPlayers, nextTurnIdx, nextRound, gameOverState = gameOver, winnerState = winner, patch = {}) {
    // ✅ CORREÇÃO: Captura baseline ANTES de qualquer mudança (para merge 3-way)
    // O baseline é o estado ATUAL de players (antes de ser atualizado para nextPlayers)
    // Isso permite fazer merge 3-way: baseline -> nextPlayers (local) vs baseline -> prevState.players (remoto)
    if (!playersBeforeRef.current) {
      playersBeforeRef.current = JSON.parse(JSON.stringify(players))
      console.log('[App] broadcastState - baseline capturado (estado atual antes da mudança):', playersBeforeRef.current.length, 'players')
    }
    
    // ✅ MELHORIA: Incrementa versão sequencial
    stateVersionRef.current = stateVersionRef.current + 1
    const currentVersion = stateVersionRef.current
    
    // ✅ CORREÇÃO: Usa patch para obter valores atualizados (evita stale closure)
    const nextRoundFlags = patch.roundFlags !== undefined ? patch.roundFlags : roundFlags
    // lock fields podem existir no patch (e são persistidos quando kind='LOCK')
    const nextTurnLock = patch.turnLock !== undefined ? patch.turnLock : turnLock
    const lastKnownLockOwner = lastLocalStateRef.current?.lockOwner ?? null
    const nextLockOwner = patch.lockOwner !== undefined ? patch.lockOwner : lastKnownLockOwner
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
    const safeRound = clampRound(Math.max(
      Number(patchedRound || 1),
      Number(round || 1),
      Number(lastLocalStateRef.current?.round || 1)
    ))
    
    // ✅ CORREÇÃO: O baseline já foi capturado via useEffect quando players mudou
    // Se não houver baseline, usa o estado atual como fallback
    if (!playersBeforeRef.current) {
      playersBeforeRef.current = JSON.parse(JSON.stringify(players))
      console.log('[App] broadcastState - baseline capturado (fallback):', playersBeforeRef.current.length, 'players')
    }
    
    // ✅ CORREÇÃO: Normaliza players antes de broadcast
    const normalizedPlayers = normalizePlayers(nextPlayers)
    
    // ✅ TURNO: turnPlayerId é a ÚNICA fonte de verdade.
    // - TURN: patch.turnPlayerId deve vir explícito
    // - PLAYER_DELTA: nunca mexe em turnPlayerId
    const nextTurnPlayerId =
      (patch.turnPlayerId !== undefined && patch.turnPlayerId !== null)
        ? String(patch.turnPlayerId)
        : String(turnPlayerId || '')

    // ✅ FIX: mantém turnPlayerId em sync imediato no cliente (evita UI travar/bloquear dados)
    // O net snapshot pode demorar; sem isso, turnIdx muda mas turnPlayerId pode ficar stale.
    if (nextTurnPlayerId !== undefined && nextTurnPlayerId !== null) {
      const nextIdStr = String(nextTurnPlayerId)
      if (String(turnPlayerId || '') !== nextIdStr) setTurnPlayerId(nextIdStr)
    }
    
    // ✅ CORREÇÃO 3: Nunca aceitar turnPlayerId mais antigo (proteção monotônica)
    // Aceita mudança de turnPlayerId apenas se:
    // 1. É explícita no patch (mudança de turno intencional)
    // 2. Round mudou (nova rodada = novo turno válido)
    // 3. É uma mudança de turno dentro da mesma rodada (normal)
    // NUNCA aceita rollback (voltar para turnPlayerId anterior)
    const safeTurnPlayerId = (() => {
      if (!nextTurnPlayerId) return turnPlayerId
      if (nextTurnPlayerId === turnPlayerId) return turnPlayerId
      
      // Se é mudança explícita no patch, aceita (mudança de turno intencional)
      if (patch.turnPlayerId !== undefined) {
        return nextTurnPlayerId
      }
      
      // Se round mudou, aceita (nova rodada = novo turno válido)
      if (safeRound !== round) {
        return nextTurnPlayerId
      }
      
      // Se é mudança de turno dentro da mesma rodada, aceita (normal)
      // (não é rollback se está avançando para próximo jogador)
      return nextTurnPlayerId
    })()
    
    // ✅ PATCH KIND: separa atualização de turno (TURN) de atualização de players (PLAYER_DELTA)
    const patchKind =
      patch.kind ||
      (patch.turnPlayerId !== undefined ? 'TURN' : 'PLAYER_DELTA')

    // ✅ actionId (idempotência): gera se não vier do chamador
    const mkId = () => {
      try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
      } catch {}
      return `${String(myUid || 'anon')}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    }
    const stateId = String(patch.stateId || mkId())
    const actionId = String(patch.actionId || `${String(myUid || 'anon')}-${Date.now()}-${currentVersion}`)

    // ✅ CORREÇÃO: Atualiza lastLocalStateRef imediatamente antes de fazer broadcast
    // Isso protege contra estados remotos que chegam logo após a mudança local
    const now = Date.now()
    const derivedTurnIdxForLocal = nextTurnPlayerId
      ? normalizedPlayers.findIndex(p => String(p.id) === String(nextTurnPlayerId))
      : nextTurnIdx

    lastLocalStateRef.current = {
      players: normalizedPlayers,
      turnIdx: derivedTurnIdxForLocal,
      turnPlayerId: safeTurnPlayerId, // ✅ CORREÇÃO: Armazena turnPlayerId seguro (monotônico)
      round: safeRound,
      gameOver: finalGameOver,
      winner: finalWinner,
      lockOwner: nextLockOwner, // local only
      timestamp: now,
      version: currentVersion,
      stateVersion: currentVersion, // ✅ CORREÇÃO: Versionamento autoritativo
      updatedAt: now, // ✅ CORREÇÃO: Timestamp em ms
      updatedBy: myUid // ✅ CORREÇÃO: Quem fez a mudança
    }
    lastAcceptedVersionRef.current = currentVersion
    
    // ✅ CORREÇÃO MULTIPLAYER: Detectar se é START GAME (snapshot completo) ou ação parcial (delta)
    const isStartGame = patch.isStartGame === true || (safeRound === 1 && nextTurnIdx === 0 && normalizedPlayers.every(p => Number(p?.pos ?? 0) === 0))
    
    if (isStartGame) {
      // ✅ START GAME: Usa commitRemoteState com snapshot completo (única exceção permitida)
      console.log('[App] broadcastState (START) - versão:', currentVersion, 'turnPlayerId:', safeTurnPlayerId, 'round:', safeRound)
      commitRemoteState({
        players: normalizedPlayers,
        turnPlayerId: safeTurnPlayerId,
        round: safeRound,
        roundFlags: nextRoundFlags,
        stateId,
        actionId,
        kind: 'START',
        stateVersion: currentVersion,
        updatedAt: now,
        updatedBy: myUid
      })
    } else {
      // ✅ CORREÇÃO MULTIPLAYER: Ação parcial - usar commitGamePatch com delta
      // Calcula delta apenas dos players que mudaram
      const playersDeltaById = {}
      const currentPlayersMap = new Map(players.map(p => [String(p.id), p]))
      
      for (const nextPlayer of normalizedPlayers) {
        const playerId = String(nextPlayer.id)
        const currentPlayer = currentPlayersMap.get(playerId)
        if (!currentPlayer) {
          // Novo player (não deve acontecer em ações, mas trata)
          playersDeltaById[playerId] = { ...nextPlayer, _actionId: actionId }
        } else {
          // Compara propriedades para detectar mudanças
          const delta = {}
          const keysToCheck = ['pos', 'cash', 'bankrupt', 'clients', 'vendedoresComuns', 'fieldSales', 'insideSales', 
                               'gestores', 'gestoresComerciais', 'manutencao', 'bens', 'mixProdutos', 'erpLevel',
                               'az', 'am', 'rox', 'onboarding', 'trainingByVendor', 'trainingsByVendor', 'loanPending',
                               'waitingAtRevenue', 'revenue', 'erpOwned', 'erp', 'mixOwned', 'mix', 'lastRevenueRound',
                               // ✅ MULTIPLAYER: arrays/objetos de compras/treinos precisam entrar no delta
                               'directBuys', 'directBuysPush', 'trainings', 'mixBase']
          for (const key of keysToCheck) {
            if (JSON.stringify(currentPlayer[key]) !== JSON.stringify(nextPlayer[key])) {
              delta[key] = nextPlayer[key]
            }
          }
          // Se há mudanças, inclui no delta
          if (Object.keys(delta).length > 0) {
            playersDeltaById[playerId] = { ...delta, _actionId: actionId }
          }
        }
      }

      // ✅ evita spam/dedup: se nada mudou e não há patch de estado, não commita/broadcast
      const hasPlayerDelta = Object.keys(playersDeltaById).length > 0
      const hasStateChange = patchKind === 'TURN' || patchKind === 'LOCK' || patch.round !== undefined || patch.roundFlags !== undefined || patch.gameOver !== undefined || patch.winner !== undefined
      if (!hasPlayerDelta && !hasStateChange) {
        console.log('[App] broadcastState skipped (no-op)', { actionId, patchKind })
        return
      }
      
      // ✅ CORREÇÃO MULTIPLAYER: Usa commitGamePatch para fazer merge por delta
      // PLAYER_DELTA nunca altera turno (turnPlayerId/round/roundFlags)
      const statePatch = {
        kind: patchKind,
        actionId,
        stateId,
        ...(finalGameOver ? { gameOver: true, winner: finalWinner } : {}),
        ...(patchKind === 'TURN'
          ? {
              turnPlayerId: nextTurnPlayerId,
              round: safeRound,
              roundFlags: nextRoundFlags,
              gameOver: finalGameOver,
              winner: finalWinner,
            }
          : {}),
        ...(patchKind === 'LOCK'
          ? {
              turnLock: nextTurnLock,
              lockOwner: nextLockOwner,
              lockTs: Date.now(),
            }
          : {}),
      }
      commitGamePatch({
        playersDeltaById,
        statePatch
      })
      
      console.log('[App] broadcastState (PATCH) - kind:', patchKind,
                  'playersDeltaIds:', Object.keys(playersDeltaById).join(','), 
                  'turnPlayerId:', safeTurnPlayerId, 'round:', safeRound)
    }
    // 2) entre abas
    try {
      bcRef.current?.postMessage?.({
        type: 'SYNC',
        version: currentVersion,  // ✅ MELHORIA: Inclui versão na mensagem
        players: normalizedPlayers, // ✅ CORREÇÃO: Usa players normalizados
        round: safeRound,
        roundFlags: nextRoundFlags, // ✅ CORREÇÃO: Usa valor do patch se disponível
        // turnLock/lockOwner podem ser enviados localmente (mesma máquina) via BroadcastChannel
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
    let normalized = normalizePlayers(nextPlayers)

    // HOST (quem clicou iniciar) joga primeiro:
    const hostIdx = normalized.findIndex(p => String(p?.id) === String(myUid))
    if (hostIdx > 0) {
      normalized = [normalized[hostIdx], ...normalized.slice(0, hostIdx), ...normalized.slice(hostIdx + 1)]
    }

    const firstPlayerId = normalized[0]?.id ? String(normalized[0].id) : null
    
    // rede
    broadcastState(normalized, 0, 1, false, null, {
      turnPlayerId: firstPlayerId,
      roundFlags: Array(normalized.length).fill(false),
      isStartGame: true // ✅ CORREÇÃO: Marca como START GAME (snapshot completo permitido)
    })
    // entre abas
    try {
      bcRef.current?.postMessage?.({
        type: 'START',
        players: normalized,
        source: meId,
      })
    } catch (e) { console.warn('[App] broadcastStart failed:', e) }
  }

  // ====== "é minha vez?" (declaração movida para antes do useEffect do watchdog)
  const current = players[turnIdx]

  // ====== Validação do estado do jogo (modo debug)
  useEffect(() => {
    if (phase === 'game') {
      validateGameState(players, turnIdx, round, gameOver, winner, 'Game State Update')
      // Validação em tempo real adicional
      // ✅ CORREÇÃO: Validação apenas em DEV e se disponível
      if (import.meta.env.DEV && typeof window.__validateGameStateRealTime === 'function') {
        window.__validateGameStateRealTime(players, turnIdx, round, gameOver, winner, 'Real-time Validation')
      }
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
  })

  // ====== Jogo (derivações + logs) ======
  // ✅ IMPORTANT: Hooks (useEffect) NÃO podem ficar depois de returns condicionais por phase.
  // Mantemos estas derivações sempre declaradas para evitar React error #310.
  const currentPlayer = players[turnIdx]
  const isCurrentPlayerBankrupt = currentPlayer?.bankrupt === true
  const isWaitingRevenue = round === 5 && players[turnIdx]?.waitingAtRevenue
  const isMyTurnExact = (turnPlayerId != null && myUid != null) && (String(turnPlayerId) === String(myUid))
  const controlsCanRoll =
    !!turnPlayerId &&
    players.length > 0 &&
    isMyTurnExact &&
    turnLock === false &&
    Number(modalLocks || 0) === 0 &&
    gameOver !== true &&
    isCurrentPlayerBankrupt !== true &&
    isWaitingRevenue !== true

  useEffect(() => {
    // log sempre, mas não interfere no fluxo; ajuda a diagnosticar turn/lock
    console.log('[CAN_ROLL_CHECK]', {
      phase,
      myUid,
      turnPlayerId,
      isMyTurn: isMyTurnExact,
      turnLock,
      modalLocks,
      gameOver,
      bankrupt: isCurrentPlayerBankrupt,
      result: controlsCanRoll,
    })
  }, [phase, myUid, turnPlayerId, isMyTurnExact, turnLock, modalLocks, gameOver, isCurrentPlayerBankrupt, controlsCanRoll])

  // ====== fases ======

  // 1) Tela inicial: pega o nome e vai para Lobbies
  if (phase === 'start') {
    return (
      <ModalProvider>
        <StartScreen
          currentName={myName}
          onEnter={(typedName) => {
          const clean = String(typedName || '').trim()
          if (!clean) return
          // ✅ salva somente após ação explícita do usuário
          setTabPlayerName(clean)
          setMyName(clean)
          setPlayers([applyStarterKit({ id: meId, name: clean, cash: 18000, pos: 0, color: '#ffd54f', bens: 4000 })], { source: 'START' })
          setRound(1); setTurnIdx(0); setGameOver(false); setWinner(null)
          setRoundFlags(new Array(1).fill(false))
          setMeHud(h => ({ ...h, name: clean }))
          setLog([`Bem-vindo, ${clean}!`])

          // ✅ após confirmar nome: se há roomId (URL), entra direto nela; senão vai para lista de salas
          if (roomId) {
            setCurrentLobbyId(roomId)
            window.__setRoomCode?.(roomId)
            setPhase('playersLobby')
          } else {
            setPhase('lobbies')
          }
        }}
        />
      </ModalProvider>
    )
  }

  // 2) Lista de lobbies
  if (phase === 'lobbies') {
    return (
      <ModalProvider>
        <LobbyList
          playerName={myName}
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
      </ModalProvider>
    )
  }

  // 3) Lobby dos jogadores (aguarda e inicia)
  if (phase === 'playersLobby') {
    return (
      <ModalProvider>
        <PlayersLobby
          lobbyId={currentLobbyId || roomId}
          playerName={myName}
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
          
          // ✅ CORREÇÃO: Ordena raw antes de map para garantir ordem consistente
          // Ordena por created_at/joined_at se existir, senão por id
          const sortedRaw = [...raw].sort((a, b) => {
            // Se ambos têm created_at ou joined_at, ordena por timestamp
            const timeA = a.created_at || a.joined_at || a.createdAt || a.joinedAt
            const timeB = b.created_at || b.joined_at || b.createdAt || b.joinedAt
            if (timeA && timeB) {
              return new Date(timeA) - new Date(timeB)
            }
            // Caso contrário, ordena por id
            const idA = String(a.id ?? a.player_id ?? '')
            const idB = String(b.id ?? b.player_id ?? '')
            return idA.localeCompare(idB)
          })
          
          const mapped = sortedRaw.map((p, i) =>
            applyStarterKit({
              id: String(p.id ?? p.player_id),
              name: p.name ?? p.player_name,
              cash: 18000,
              pos: 0,
              bens: 4000,
              color: ['#ffd54f','#90caf9','#a5d6a7','#ffab91'][i % 4],
              seat: i // ✅ CORREÇÃO: Atribui seat baseado na ordem ordenada
            })
          )
          if (mapped.length === 0) return

          // ✅ CORREÇÃO: Normaliza players antes de usar
          const normalized = normalizePlayers(mapped)

          // ✅ FIX: myUid NUNCA deve ser inferido por nome (nomes podem colidir: "Jogador").
          // Identidade por aba é SEMPRE meId.
          try {
            const mineById = normalized.find(p => String(p.id) === String(meId))
            if (mineById) setMyUid(String(meId))
          } catch {}

          setPlayers(normalized, { source: 'START_GAME' })
          setTurnIdx(0)
          setRound(1)
          setRoundFlags(new Array(normalized.length).fill(false))
          setGameOver(false); setWinner(null)
          setMeHud(h => {
            const mine = normalized.find(isMine)
            return {
              ...h,
              name: mine?.name || normalized[0]?.name || 'Jogador',
              color: mine?.color || normalized[0]?.color || '#6c5ce7',
              cash: mine?.cash ?? 18000,
              possibAt: 0, clientsAt: 0
            }
          })
          setLog(['Jogo iniciado!'])
          broadcastStart(normalized)
          setPhase('game')
        }}
        />
      </ModalProvider>
    )
  }

  // 4) Jogo
  return (
    <ModalProvider>
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
              myUid={myUid}
              turnPlayerId={turnPlayerId}
              turnLock={turnLock}
              lockOwner={lockOwner}
              modalLocks={modalLocks}
              gameOver={gameOver}
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
                setPlayers(reset, { source: 'RESTART' })
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
    </ModalProvider>
  )
}
