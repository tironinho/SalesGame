// src/App.jsx
import React, { useMemo, useState } from 'react'
import './styles.css'

import StartScreen from './components/StartScreen.jsx'
import LobbyList from './pages/LobbyList.jsx'
import PlayersLobby from './pages/PlayersLobby.jsx'

import Board from './components/Board.jsx'
import HUD from './components/HUD.jsx'
import Controls from './components/Controls.jsx'
import { TRACK_LEN } from './data/track'

import { getOrCreateLocalPlayerId, getOrSetPlayerName } from './auth'

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

  function appendLog(msg){ setLog(l => [msg, ...l].slice(0, 12)) }

  function advanceAndMaybeLap(steps, deltaCash, note){
    setPlayers(ps => ps.map(p => {
      if (p.id !== current.id) return p
      const oldPos = p.pos
      const newPos = (oldPos + steps) % TRACK_LEN
      const lap = newPos < oldPos
      if (deltaCash) appendLog(`${p.name} ${deltaCash>0? 'ganhou' : 'pagou'} $${Math.abs(deltaCash)}`)
      if (note) appendLog(note)
      if (lap) setRound(r => r + 1)
      return { ...p, pos: newPos, cash: p.cash + (deltaCash||0) }
    }))
  }
  function nextTurn(){ setTurnIdx(i => (i+1) % players.length) }
  function onAction(act){
    if (act?.type === 'ROLL'){ advanceAndMaybeLap(act.steps, act.cashDelta, act.note); nextTurn() }
    else if (act?.type === 'BANKRUPT'){ appendLog(`${current.name} declarou falência!`) }
    else if (act?.type === 'RECOVERY'){
      const recover = Math.floor(Math.random()*3000)+1000
      setPlayers(ps => ps.map(p => p.id === current.id ? { ...p, cash: p.cash + recover } : p))
      appendLog(`${current.name} ativou Recuperação Financeira (+$${recover})`); nextTurn()
    } else if (act?.type === 'RECOVERY_CUSTOM'){
      const amount = Number(act.amount || 0)
      setPlayers(ps => ps.map(p => p.id === current.id ? { ...p, cash: p.cash + amount } : p))
      appendLog(`${current.name} recuperou +$${amount}`); nextTurn()
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
          getOrCreateLocalPlayerId()
          const name = getOrSetPlayerName(typedName || 'Jogador')
          setPlayers([{ id: 1, name, cash: 18000, pos: 0, color: '#ffd54f' }])
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
          setPlayers(mapped); setTurnIdx(0); setRound(1); setLog(['Jogo iniciado!'])
          setPhase('game')
        }}
      />
    )
  }

  // === Jogo ===
  return (
    <div className="page">
      <header className="topbar">
        <div className="icons">
          <span className="icon">🧑‍🚀</span>
          <span className="icon">🧙‍♂️</span>
          <span className="icon">🧟‍♂️</span>
        </div>
        <div className="status">
          <span>Jogador {turnIdx}</span>
          <span>Rodada: {round}</span>
          <span>Possib. Atendimento: 0</span>
          <span>Clientes em Atendimento: 0</span>
          <span className="money">💵 $ {current.cash}</span>
        </div>
      </header>

      <main className="content">
        <div className="boardWrap">
          <Board players={players} turnIdx={turnIdx} />
        </div>
        <aside className="side">
          <HUD totals={totals} players={players} />
          <Controls onAction={onAction} current={current} />
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
// src/components/Board.jsx