// src/pages/RoomLobby.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { auth } from '../firebaseConfig'
import { listenLobby, listenPlayers, leaveLobby, toggleReady, startGame } from '../lobby/firebaseLobby'

export default function RoomLobby({ lobbyId, onLeave, onStart }){
  const [lobby, setLobby] = useState(null)
  const [players, setPlayers] = useState([])

  useEffect(()=>{ return listenLobby(lobbyId, setLobby) }, [lobbyId])
  useEffect(()=>{ return listenPlayers(lobbyId, setPlayers) }, [lobbyId])

  const meId = auth.currentUser?.uid
  const amHost = lobby?.hostId === meId
  const allReady = players.length>=2 && players.every(p=>p.ready)

  useEffect(()=>{
    if (lobby?.started){
      // host já iniciou — envia lista para o App “abrir jogo”
      onStart?.({ lobbyId, players })
    }
  }, [lobby?.started])

  async function leave(){
    await leaveLobby(lobbyId)
    onLeave?.()
  }
  async function toggle(){ await toggleReady(lobbyId) }
  async function start(){ if (amHost && allReady) await startGame(lobbyId) }

  if (!lobby) return <div className="roomPage"><div className="card">Sala não encontrada.</div></div>

  return (
    <div className="roomPage">
      <div className="roomHeader">
        <h2>{lobby.name}</h2>
        <div className="sub">Host: {players.find(p=>p.id===lobby.hostId)?.name || '—'}</div>
      </div>

      <div className="roomPlayers">
        {players.map(p=>(
          <div className={`pCard ${p.ready?'ready':''}`} key={p.id}>
            <div className="pName">{p.name}</div>
            <div className="pState">{p.ready?'Pronto ✅':'Aguardando…'}</div>
            {p.id===meId && <button className="btn light sm" onClick={toggle}>{p.ready?'Cancelar':'Pronto'}</button>}
          </div>
        ))}
        {players.length===0 && <div className="empty">Ninguém na sala.</div>}
      </div>

      <div className="roomActions">
        <button className="btn dark" onClick={leave}>Sair</button>
        <button className="btn go" onClick={start} disabled={!amHost || !allReady}>Iniciar jogo</button>
      </div>
    </div>
  )
}
