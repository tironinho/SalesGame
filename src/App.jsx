// src/App.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react'
import './styles.css'

import StartScreen from './components/StartScreen.jsx'
import LobbyList from './pages/LobbyList.jsx'
import PlayersLobby from './pages/PlayersLobby.jsx'

import Board from './components/Board.jsx'
import HUD from './components/HUD.jsx'
import Controls from './components/Controls.jsx'
import { TRACK_LEN } from './data/track'

// >>> usa identidade POR ABA (evita bloquear em todo mundo)
import { getOrCreateTabPlayerId, getOrSetTabPlayerName } from './auth'

export default function App() {
  const [phase, setPhase] = useState('start')  // 'start' | 'lobbies' | 'playersLobby' | 'game'
  const [currentLobbyId, setCurrentLobbyId] = useState(null)

  const [players, setPlayers] = useState([
    { id: 1, name: 'Jogador 1', cash: 18000, pos: 0, color: '#ffd54f' }
  ])
  const [round, setRound] = useState(1)
  const [turnIdx, setTurnIdx] = useState(0)
  const [log, setLog] = useState(['Bem-vindo ao Sales Game!'])
  const current = players[turnIdx]

  // --- quem sou eu (por ABA)
  const meId = useMemo(() => getOrCreateTabPlayerId(), [])
  const meIdx = useMemo(() => players.findIndex(p => p.id === meId), [players, meId])
  const isMyTurn = players[turnIdx]?.id === meId

  // HUD vindo do Board
  const [meHud, setMeHud] = useState({
    id: null,
    name: players[0]?.name || 'Jogador',
    color: players[0]?.color || '#6c5ce7',
    cash: players[0]?.cash ?? 18000,
    possibAt: 0,
    clientsAt: 0,
    matchId: 'local',
  })

  // ======= SYNC ENTRE ABAS (mesmo navegador) =======
  const syncKey = useMemo(
    () => `sg-sync:${currentLobbyId || 'local'}`,
    [currentLobbyId]
  )
  const bcRef = useRef(null)

  useEffect(() => {
    if (phase !== 'game') return
    try {
      bcRef.current?.close?.()
      const bc = new BroadcastChannel(syncKey)
      bc.onmessage = (e) => {
        const d = e.data
        if (!d || d.type !== 'SYNC') return
        // evita aplicar o que eu mesmo emiti
        if (d.source === meId) return
        setPlayers(d.players)
        setTurnIdx(d.turnIdx)
        setRound(d.round)
      }
      bcRef.current = bc
      return () => bc.close()
    } catch {
      // se BroadcastChannel não existir, apenas ignora (sem sync cross-aba)
    }
  }, [phase, syncKey, meId])

  function broadcastState(nextPlayers, nextTurnIdx, nextRound) {
    try {
      bcRef.current?.postMessage?.({
        type: 'SYNC',
        players: nextPlayers,
        turnIdx: nextTurnIdx,
        round: nextRound,
        source: meId,
      })
    } catch {}
  }
  // ================================================

  function appendLog(msg){ setLog(l => [msg, ...l].slice(0, 12)) }

  function advanceAndMaybeLap(steps, deltaCash, note){
    // snapshot atual
    const curIdx = turnIdx
    const cur = players[curIdx]
    if (!cur) return

    const oldPos = cur.pos
    const newPos = (oldPos + steps) % TRACK_LEN
    const lap = newPos < oldPos

    const nextPlayers = players.map((p, i) =>
      i !== curIdx ? p : { ...p, pos: newPos, cash: p.cash + (deltaCash || 0) }
    )
    const nextRound = lap ? round + 1 : round
    const nextTurnIdx = (curIdx + 1) % players.length

    if (deltaCash) appendLog(`${cur.name} ${deltaCash>0? 'ganhou' : 'pagou'} $${Math.abs(deltaCash)}`)
    if (note) appendLog(note)

    setPlayers(nextPlayers)
    setRound(nextRound)
    setTurnIdx(nextTurnIdx)

    // sincroniza com as outras abas
    broadcastState(nextPlayers, nextTurnIdx, nextRound)
  }

  function nextTurn(){
    const nextTurnIdx = (turnIdx + 1) % players.length
    setTurnIdx(nextTurnIdx)
    broadcastState(players, nextTurnIdx, round)
  }

  function onAction(act){
    // segurança extra: só processa ações do jogador da vez nesta ABA
    if (!isMyTurn) return

    if (act?.type === 'ROLL'){
      advanceAndMaybeLap(act.steps, act.cashDelta, act.note)
    } else if (act?.type === 'BANKRUPT'){
      appendLog(`${current.name} declarou falência!`)
      nextTurn()
    } else if (act?.type === 'RECOVERY'){
      const recover = Math.floor(Math.random()*3000)+1000
      const curIdx = turnIdx
      const nextPlayers = players.map((p, i) => i === curIdx ? { ...p, cash: p.cash + recover } : p)
      appendLog(`${players[curIdx].name} ativou Recuperação Financeira (+$${recover})`)
      const nextTurnIdx = (curIdx + 1) % players.length
      setPlayers(nextPlayers); setTurnIdx(nextTurnIdx)
      broadcastState(nextPlayers, nextTurnIdx, round)
    } else if (act?.type === 'RECOVERY_CUSTOM'){
      const amount = Number(act.amount || 0)
      const curIdx = turnIdx
      const nextPlayers = players.map((p, i) => i === curIdx ? { ...p, cash: p.cash + amount } : p)
      appendLog(`${players[curIdx].name} recuperou +$${amount}`)
      const nextTurnIdx = (curIdx + 1) % players.length
      setPlayers(nextPlayers); setTurnIdx(nextTurnIdx)
      broadcastState(nextPlayers, nextTurnIdx, round)
    }
  }

  const totals = useMemo(() => ({
    faturamento: 770, manutencao: 1150, emprestimos: 0, vendedoresComuns: 0,
    fieldSales: 0, insideSales: 0, mixProdutos: 'D', bens: 4000, erpSistemas: 'D',
    clientes: 0, onboarding: true, az: 0, am: 0, rox: 0, gestores: 0,
  }), [])

  // === Start ===
  if (phase === 'start'){
    return (
      <StartScreen
        onEnter={(typedName) => {
          const name = getOrSetTabPlayerName(typedName || 'Jogador')
          // este jogador local começa sozinho até entrar na sala
          setPlayers([{ id: meId, name, cash: 18000, pos: 0, color: '#ffd54f' }])
          setRound(1); setTurnIdx(0); setLog([`Bem-vindo, ${name}!`])
          setPhase('lobbies')
        }}
      />
    )
  }

  // === Lobbies ===
  if (phase === 'lobbies'){
    return (
      <LobbyList
        onEnterRoom={(id) => {
          setCurrentLobbyId(id)
          setPhase('playersLobby')
        }}
      />
    )
  }

  // === Players Lobby (pronto / host / iniciar) ===
  if (phase === 'playersLobby'){
    return (
      <PlayersLobby
        lobbyId={currentLobbyId}
        onBack={() => setPhase('lobbies')}
        onStartGame={({ players: lobbyPlayers }) => {
          // aceita tanto {id,name} quanto {player_id,player_name}
          const mapped = lobbyPlayers.map((p, i) => ({
            id: p.id ?? p.player_id,
            name: p.name ?? p.player_name,
            cash: 18000,
            pos: 0,
            color: ['#ffd54f','#90caf9','#a5d6a7','#ffab91'][i % 4]
          }))
          setPlayers(mapped)
          // turno começa no primeiro da lista (servidor/host pode ajustar futuramente)
          setTurnIdx(0)
          setRound(1)
          setLog(['Jogo iniciado!'])
          // zera HUD até o Board emitir
          setMeHud(h => ({
            ...h,
            name: mapped.find(x => x.id === meId)?.name || mapped[0]?.name || 'Jogador',
            color: mapped.find(x => x.id === meId)?.color || mapped[0]?.color || '#6c5ce7',
            cash: mapped.find(x => x.id === meId)?.cash ?? 18000,
            possibAt: 0, clientsAt: 0
          }))
          setPhase('game')
        }}
      />
    )
  }

  // === Jogo ===
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
          <span className="money">💵 $ {Number(meHud.cash ?? 0).toLocaleString()}</span>
        </div>
      </header>

      <main className="content">
        <div className="boardWrap">
          {/* Board emite dados do HUD para a topbar via onMeHud */}
          <Board
            players={players}
            turnIdx={turnIdx}
            onMeHud={setMeHud}
          />
        </div>
        <aside className="side">
          <HUD totals={totals} players={players} />
          {/* botão só habilita na ABA do jogador da vez */}
          <Controls onAction={onAction} current={current} isMyTurn={isMyTurn} />
          <div style={{ marginTop: 10 }}>
            <button className="btn dark" onClick={() => setPhase('lobbies')}>Sair para Lobbies</button>
          </div>
        </aside>
      </main>

      <footer className="foot">
        <small>Desenvolvido por <a href="https://www.tironitech.com" target="_blank" rel="noreferrer">tironitech.com</a></small>
      </footer>
    </div>
  )
}
