// src/modals/BankruptcyModal.jsx
import React from 'react'
import { useModal } from './ModalContext'
import ModalBase from './ModalBase'

export default function BankruptcyModal({ playerName = 'Jogador' }) {
  const { resolveTop, closeModal } = useModal()

  return (
    <ModalBase width={700} onClose={closeModal}>
      <div className="bankruptcyModal">
        <div className="paper" style={{ padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Declarar Falência</h2>
          <p>
            Tem certeza que deseja declarar <b>Falência</b>, <b>{playerName}</b>?
            <br />
            Esta ação é irreversível e você não poderá mais jogar.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
            <button
              onClick={() => { closeModal(); resolveTop(false) }}
              className="btn"
            >
              Cancelar
            </button>
            <button
              onClick={() => { closeModal(); resolveTop(true) }}
              className="btn btn-danger"
            >
              Sim, declarar falência
            </button>
          </div>
        </div>
      </div>
    </ModalBase>
  )
}
