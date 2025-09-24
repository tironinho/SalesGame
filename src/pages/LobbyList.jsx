// src/pages/LobbyList.jsx
import React, { useEffect, useState } from 'react'
import { ensureAnonLogin, auth } from '../firebaseConfig'
import { listenLobbies, createLobby, joinLobby, DEFAULT_CAPACITY } from '../lobby/firebaseLobby'

export default function LobbyList({ onEnterRoom }){
  const [meName, setMeName] = useState('Jogador')
  const [rooms, setRooms] = useState([])
  const [roomName, setRoomName] = useState('')
  const [cap, setCap] = useState(DEFAULT_CAPACITY)

  useEffect(()=>{
    ensureAnonLogin()
    const unsub = listenLobbies(setRooms)
    return unsub
  },[])

  async function handleCreate(){
    await ensureAnonLogin()
    const id = await createLobby({ name: roomName || `Sala #${rooms.length+1}`, capacity: cap })
    await joinLobby(id, { name: meName })
    onEnterRoom?.(id)
  }

  async function handleJoin(id){
    await ensureAnonLogin()
    await joinLobby(id, { name: meName })
    onEnterRoom?.(id)
  }

  return (
    <div className="lobbyPage">
      <header className="lobbyHeader">
        <h1>SalesGame - Lobbies</h1>
        <div className="meBox">
          <label>Seu nome</label>
          <input className="txt" value={meName} onChange={e=>setMeName(e.target.value)} />
          <small className="uid">uid: {auth.currentUser?.uid?.slice(0,6) || '...'}</small>
        </div>
      </header>

      <section className="lobbyCreate">
        <input className="txt" placeholder="Nome da sala" value={roomName} onChange={e=>setRoomName(e.target.value)} />
        <input className="num" type="number" min="2" max="12" value={cap} onChange={e=>setCap(Number(e.target.value || DEFAULT_CAPACITY))} />
        <button className="btn go" onClick={handleCreate}>Criar sala</button>
      </section>

      <section className="lobbyTable">
        <div className="head"><div>Lobby name</div><div>Players</div><div></div></div>
        {rooms.map(r=>(
          <div className="row" key={r.id}>
            <div className="name">{r.name}</div>
            <div className="players">{r.playersCount ?? '—'}/{r.capacity ?? DEFAULT_CAPACITY}</div>
            <div className="actions">
              <button className="btn primary" onClick={()=>handleJoin(r.id)}>Entrar</button>
            </div>
          </div>
        ))}
        {rooms.length===0 && <div className="empty">Nenhuma sala criada ainda.</div>}
      </section>
    </div>
  )
}
