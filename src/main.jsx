// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import GameNetProvider from './net/GameNetProvider.jsx' // ✅ default export

// Defina o "roomCode" (nome da sala) — pode vir da querystring ou de localStorage.
// Ex.: http://localhost:5173/?room=Sala%20de%20Jogador
const qs = new URLSearchParams(window.location.search)
let roomName = qs.get('room')

// fallback: tenta recuperar do localStorage (última sala usada)
if (!roomName) {
  roomName = localStorage.getItem('sg:lastRoomName') || 'sala-demo'
} else {
  localStorage.setItem('sg:lastRoomName', roomName)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* O App usa o hook useGameNet internamente; aqui só passamos o identificador da sala */}
    <GameNetProvider roomCode={roomName}>
      <App />
    </GameNetProvider>
  </React.StrictMode>
)
