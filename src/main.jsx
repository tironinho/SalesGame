// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import GameNetProvider from './net/GameNetProvider.jsx'

// ✅ importa só o Provider (sem ModalRoot)
import { ModalProvider } from './modals/ModalContext'

function initialRoomFromURL () {
  const qs = new URLSearchParams(window.location.search)
  const q = qs.get('room')
  return (q && String(q).trim()) || null   // null = sem sync remoto até escolher uma sala
}

function Root() {
  const [roomCode, setRoomCode] = React.useState(initialRoomFromURL())

  // expõe um setter global para o App trocar a sala dinamicamente
  React.useEffect(() => {
    window.__setRoomCode = (code) => {
      const c = String(code || '').trim() || null
      setRoomCode(c)
      // mantém a URL coerente com a sala atual
      const url = new URL(window.location.href)
      if (c) url.searchParams.set('room', c)
      else url.searchParams.delete('room')
      window.history.replaceState({}, '', url)
    }
    return () => { delete window.__setRoomCode }
  }, [])

  return (
    <ModalProvider>
      <GameNetProvider roomCode={roomCode}>
        <App />
      </GameNetProvider>
    </ModalProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
