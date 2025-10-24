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

// Regras / Engine
import { useTurnEngine } from './game/useTurnEngine.jsx'
import {
  computeDespesasFor,
  computeFaturamentoFor,
  capacityAndAttendance
} from './game/gameMath'

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
    // Limpar nome antigo para forçar tela inicial
    sessionStorage.removeItem('sg_tab_player_name')
    return ''
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
          setPlayers(d.players)
          setTurnIdx(d.turnIdx)
          setRound(d.round)
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
  const net = (() => { try { return useGameNet?.() } catch { return null } })() || null
  const netCommit = net?.commit
  const netVersion = net?.version
  const netState = net?.state

  useEffect(() => {
    if (!netState) return
    const np = Array.isArray(netState.players) ? netState.players : null
    const nt = Number.isInteger(netState.turnIdx) ? netState.turnIdx : null
    const nr = Number.isInteger(netState.round) ? netState.round : null

    let changed = false
    if (np && JSON.stringify(np) !== JSON.stringify(players)) { setPlayers(np); changed = true }
    if (nt !== null && nt !== turnIdx) { setTurnIdx(nt); changed = true }
    if (nr !== null && nr !== round)  { setRound(nr); changed = true }

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

  function broadcastState(nextPlayers, nextTurnIdx, nextRound) {
    // 1) rede
    commitRemoteState(nextPlayers, nextTurnIdx, nextRound)
    // 2) entre abas
    try {
      bcRef.current?.postMessage?.({
        type: 'SYNC',
        players: nextPlayers,
        turnIdx: nextTurnIdx,
        round: nextRound,
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

  // ====== “é minha vez?”
  const current = players[turnIdx]
  const isMyTurn = useMemo(() => {
    const owner = players[turnIdx]
    if (!owner) return false
    return (owner.id != null && String(owner.id) === String(myUid))
  }, [players, turnIdx, myUid])

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
  const controlsCanRoll = isMyTurn

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
