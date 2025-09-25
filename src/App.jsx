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

// >>> modal ERP
import { useModal } from './modals/ModalContext'
import ERPSystemsModal from './modals/ERPSystemsModal'
import TrainingModal from './modals/TrainingModal'
import DirectBuyModal from './modals/DirectBuyModal'

// >>> novas modais
import InsideSalesModal from './modals/InsideSalesModal'
import ClientsModal from './modals/BuyClientsModal'
import ManagerModal from './modals/BuyManagerModal'
import FieldSalesModal from './modals/BuyFieldSalesModal'

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
  const myName = useMemo(() => getOrSetTabPlayerName('Jogador'), [])
  const meIdx = useMemo(
    () => players.findIndex(p => p.id === meId || p.name === myName),
    [players, meId, myName]
  )
  const isMyTurn = useMemo(() => {
    const t = players[turnIdx]
    if (!t) return false
    return t.id === meId || t.name === myName
  }, [players, turnIdx, meId, myName])

  // >>> acesso ao sistema de modais
  const { pushModal, awaitTop } = useModal?.() || {}

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

  // >>> SALDO ATUAL DO JOGADOR DESTA ABA (sempre atualizado)
  const myCash = useMemo(
    () => (players.find(p => p.id === meId || p.name === myName)?.cash ?? 0),
    [players, meId, myName]
  )

  // Mantém o meHud.cash sincronizado (caso outros pontos dependam dele)
  useEffect(() => {
    const mine = players.find(p => p.id === meId || p.name === myName)
    if (!mine) return
    setMeHud(h => (h.cash === mine.cash ? h : { ...h, cash: mine.cash }))
  }, [players, meId, myName])

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
        if (d.source === meId) return
        setPlayers(d.players)
        setTurnIdx(d.turnIdx)
        setRound(d.round)
      }
      bcRef.current = bc
      return () => bc.close()
    } catch {}
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

  function appendLog(msg){ setLog(l => [msg, ...l].slice(0, 12)) }

  function advanceAndMaybeLap(steps, deltaCash, note){
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
    broadcastState(nextPlayers, nextTurnIdx, nextRound)

    // === Tiles (1-based) ===
    const landedOneBased = newPos + 1

    // === ERP/Sistemas: 6,16,32,49 ===
    const isErpTile = (landedOneBased === 6 || landedOneBased === 16 || landedOneBased === 32 || landedOneBased === 49)
    if (isErpTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<ERPSystemsModal />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
        const price = Number(res.values?.compra || 0)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx ? p : { ...p, cash: p.cash - price, erpLevel: res.level }
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Treinamento: 2,11,19,47 ===
    const isTrainingTile = (landedOneBased === 2 || landedOneBased === 11 || landedOneBased === 19 || landedOneBased === 47)
    if (isTrainingTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<TrainingModal />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
        const total = Number(res.total || 0)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx
              ? p
              : {
                  ...p,
                  cash: p.cash - total,
                  trainings: [...(p.trainings || []), ...(res.items || [])],
                }
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Compra Direta: 5,10,43 ===
    const isDirectBuyTile = (landedOneBased === 5 || landedOneBased === 10 || landedOneBased === 43)
    if (isDirectBuyTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<DirectBuyModal />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
        const total = Number(res.total ?? res.amount ?? 0)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx
              ? p
              : {
                  ...p,
                  cash: p.cash - total,
                  directBuys: [...(p.directBuys || []), (res.item || { total })],
                }
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Inside Sales: 12,21,30,42,53 ===
    const isInsideTile = (landedOneBased === 12 || landedOneBased === 21 || landedOneBased === 30 || landedOneBased === 42 || landedOneBased === 53)
    if (isInsideTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<InsideSalesModal />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || (res.action !== 'HIRE' && res.action !== 'BUY')) return
        const cost = Number(res.cost ?? res.total ?? 0)
        const qty  = Number(res.headcount ?? res.qty ?? 1)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx
              ? p
              : {
                  ...p,
                  cash: p.cash - cost,
                  insideSales: (p.insideSales || 0) + qty,
                }
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Clientes: 4,8,15,17,20,27,34,36,39,46,52,55 ===
    const isClientsTile = (
      landedOneBased === 4 || landedOneBased === 8 || landedOneBased === 15 || landedOneBased === 17 ||
      landedOneBased === 20 || landedOneBased === 27 || landedOneBased === 34 || landedOneBased === 36 ||
      landedOneBased === 39 || landedOneBased === 46 || landedOneBased === 52 || landedOneBased === 55
    )
    if (isClientsTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<ClientsModal />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
        const cost = Number(res.cost ?? res.total ?? 0)
        const qty  = Number(res.qty ?? 1)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx
              ? p
              : {
                  ...p,
                  cash: p.cash - cost,
                  clients: (p.clients || 0) + qty,
                }
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Gestor: 18,24,29,51 ===
    const isManagerTile = (landedOneBased === 18 || landedOneBased === 24 || landedOneBased === 29 || landedOneBased === 51)
    if (isManagerTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<ManagerModal />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || res.action !== 'BUY') return
        const cost = Number(res.cost ?? res.total ?? 0)
        const qty  = Number(res.qty ?? 1)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx
              ? p
              : {
                  ...p,
                  cash: p.cash - cost,
                  gestores: (p.gestores || 0) + qty,
                }
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }

    // === Field Sales: 13,25,33,38,50 ===
    const isFieldTile = (landedOneBased === 13 || landedOneBased === 25 || landedOneBased === 33 || landedOneBased === 38 || landedOneBased === 50)
    if (isFieldTile && isMyTurn && pushModal && awaitTop) {
      pushModal(<FieldSalesModal />)
      ;(async () => {
        const res = await awaitTop()
        if (!res || (res.action !== 'HIRE' && res.action !== 'BUY')) return
        const cost = Number(res.cost ?? res.total ?? 0)
        const qty  = Number(res.headcount ?? res.qty ?? 1)
        setPlayers(ps => {
          const upd = ps.map((p, i) =>
            i !== curIdx
              ? p
              : {
                  ...p,
                  cash: p.cash - cost,
                  fieldSales: (p.fieldSales || 0) + qty,
                }
          )
          broadcastState(upd, nextTurnIdx, nextRound)
          return upd
        })
      })()
    }
  }

  function nextTurn(){
    const nextTurnIdx = (turnIdx + 1) % players.length
    setTurnIdx(nextTurnIdx)
    broadcastState(players, nextTurnIdx, round)
  }

  function onAction(act){
    if (!act?.type) return

    if (act.type === 'ROLL'){
      if (!isMyTurn) return
      advanceAndMaybeLap(act.steps, act.cashDelta, act.note)
      return
    }

    if (act.type === 'RECOVERY'){
      const recover = Math.floor(Math.random()*3000)+1000
      const cur = players.find(p => p.id === meId || p.name === myName)
      if (!cur) return
      const nextPlayers = players.map(p => (p.id === meId || p.name === myName) ? { ...p, cash: p.cash + recover } : p)
      appendLog(`${cur.name} ativou Recuperação Financeira (+$${recover})`)
      setPlayers(nextPlayers)
      broadcastState(nextPlayers, turnIdx, round)
      return
    }

    if (act.type === 'RECOVERY_CUSTOM'){
      const amount = Number(act.amount || 0)
      const cur = players.find(p => p.id === meId || p.name === myName)
      if (!cur) return
      const nextPlayers = players.map(p => (p.id === meId || p.name === myName) ? { ...p, cash: p.cash + amount } : p)
      appendLog(`${cur.name} recuperou +$${amount}`)
      setPlayers(nextPlayers)
      broadcastState(nextPlayers, turnIdx, round)
      return
    }

    if (act.type === 'BANKRUPT'){
      appendLog(`${current.name} declarou falência!`)
      nextTurn()
      return
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
        onStartGame={(payload) => {
          // ✅ Aceita {players: [...]}, {lobbyPlayers: [...]}, ou o próprio array
          const raw = Array.isArray(payload)
            ? payload
            : (payload?.players ?? payload?.lobbyPlayers ?? [])
          const mapped = raw.map((p, i) => ({
            id: p.id ?? p.player_id,
            name: p.name ?? p.player_name,
            cash: 18000,
            pos: 0,
            color: ['#ffd54f','#90caf9','#a5d6a7','#ffab91'][i % 4]
          }))

          if (mapped.length === 0) return

          setPlayers(mapped)
          setTurnIdx(0)
          setRound(1)
          setLog(['Jogo iniciado!'])
          setMeHud(h => {
            const mine = mapped.find(x => x.id === meId || x.name === myName)
            return {
              ...h,
              name: mine?.name || mapped[0]?.name || 'Jogador',
              color: mine?.color || mapped[0]?.color || '#6c5ce7',
              cash: mine?.cash ?? 18000,
              possibAt: 0, clientsAt: 0
            }
          })
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
