// src/App.jsx
import React, { useMemo, useState } from 'react'
import StartScreen from './components/StartScreen.jsx'
import Board from './components/Board.jsx'
import HUD from './components/HUD.jsx'
import Controls from './components/Controls.jsx'
import { TRACK_LEN } from './data/track'
import './styles.css'

export default function App(){
  // nome do jogador vem da StartScreen
  const [playerName, setPlayerName] = useState(null)

  const [players, setPlayers] = useState([
    { id: 1, name: 'Jogador 1', cash: 18000, pos: 0, color:'#ffd54f' } // pos 0 = Casa 1
  ])
  const [round, setRound] = useState(1)
  const [turnIdx, setTurnIdx] = useState(0)
  const [log, setLog] = useState(['Bem-vindo ao Sales Game!'])

  const current = players[turnIdx]

  function appendLog(msg){
    setLog(l => [msg, ...l].slice(0, 12))
  }

  // avança N casas e conta 1 rodada ao cruzar a casa 1
  function advanceAndMaybeLap(steps, deltaCash, note){
    setPlayers(ps => ps.map(p => {
      if (p.id !== current.id) return p
      const oldPos = p.pos
      const newPos = (oldPos + steps) % TRACK_LEN
      const lap = newPos < oldPos // se “voltou” ao início, fechou volta

      if (deltaCash) appendLog(`${p.name} ${deltaCash>0? 'ganhou' : 'pagou'} $${Math.abs(deltaCash)}`)
      if (note) appendLog(note)
      if (lap) setRound(r => r + 1)

      return { ...p, pos: newPos, cash: p.cash + (deltaCash||0) }
    }))
  }

  function nextTurn(){
    setTurnIdx(i => (i+1) % players.length)
  }

  function onAction(act){
    if (act?.type === 'ROLL'){
      advanceAndMaybeLap(act.steps, act.cashDelta, act.note)
      nextTurn()
    } else if (act?.type === 'BANKRUPT'){
      // Só registra no log; a confirmação é feita na modal do botão
      appendLog(`${current.name} declarou falência!`)
    } else if (act?.type === 'RECOVERY'){
      const recover = Math.floor(Math.random()*3000)+1000
      setPlayers(ps => ps.map(p => p.id === current.id ? { ...p, cash: p.cash + recover } : p))
      appendLog(`${current.name} ativou Recuperação Financeira (+$${recover})`)
      nextTurn()
    } else if (act?.type === 'RECOVERY_CUSTOM'){
      const amount = Number(act.amount || 0)
      setPlayers(ps => ps.map(p => p.id === current.id ? { ...p, cash: p.cash + amount } : p))
      appendLog(`${current.name} recuperou +$${amount}`)
      nextTurn()
    }
  }

  const totals = useMemo(() => ({
    faturamento: 770,
    manutencao: 1150,
    emprestimos: 0,
    vendedoresComuns: 0,
    fieldSales: 0,
    insideSales: 0,
    mixProdutos: 'D',
    bens: 4000,
    erpSistemas: 'D',
    clientes: 0,
    onboarding: true,
    az: 0, am: 0, rox: 0,
    gestores: 0,
  }), [])

  // ---- Start Screen: mostra antes do jogo carregar ----
  if (!playerName) {
    return (
      <StartScreen
        onEnter={(name) => {
          setPlayerName(name)
          // atualiza o nome no array de players
          setPlayers(ps => ps.map(p => p.id === 1 ? ({ ...p, name }) : p))
          // (opcional) limpar log inicial e dar boas-vindas personalizadas
          setLog([`Bem-vindo, ${name}!`])
        }}
      />
    )
  }

  // ---- Jogo (tabuleiro + HUD + Controles) ----
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
          {/* Tabuleiro normal */}
          <Board players={players} turnIdx={turnIdx} /> 
          {/* Tabuleiro em modo gravação */}
          {/* <Board players={players} turnIdx={turnIdx} recordTrack /> */}
        </div>

        <aside className="side">
          <HUD totals={totals} players={players} />
          <Controls onAction={onAction} current={current} />
        </aside>
      </main>

      <footer className="foot">
        <small>Desenvolvido por <a href="https://www.tironitech.com" target="_blank">tironitech.com</a></small>
      </footer>
    </div>
  )
}
