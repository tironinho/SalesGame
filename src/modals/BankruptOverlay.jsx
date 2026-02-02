// src/modals/BankruptOverlay.jsx
import React, { useEffect } from 'react'
import ModalBase from './ModalBase'

export default function BankruptOverlay({
  playerName = 'Jogador',
  onClose,
  autoCloseMs = 1500, // fecha sozinho para não travar a partida
}) {
  useEffect(() => {
    if (!autoCloseMs) return
    const id = setTimeout(() => onClose?.(), autoCloseMs)
    return () => clearTimeout(id)
  }, [autoCloseMs, onClose])

  return (
    <ModalBase onClose={onClose} zIndex={4000}>
      <div style={{ padding: 24 }}>
        <h2 style={{ marginTop: 0 }}>Falência declarada</h2>
        <p>
          <b>{playerName}</b>, você foi marcado como <b>FALIDO</b>.
          <br />
          Seu turno será pulado e você não poderá mais executar ações.
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
          <button className="btn" onClick={onClose}>OK</button>
        </div>
      </div>
    </ModalBase>
  )
}
