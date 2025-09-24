// src/modals/BankruptcyModal.jsx
import React from 'react'
import { useModal } from './ModalContext'
import ModalBase from './ModalBase'

export default function BankruptcyModal({ playerName = 'Jogador' }){
  const { resolveTop, closeModal } = useModal()

  return (
    <ModalBase width={700} onClose={closeModal}>
      <div className="bankruptcyModal">
        <div className="paper">
          <p>
            Tem certeza que irá declarar <b>Falência</b>? Uma vez que realizar a ação,
            <br/>o jogo <b>ACABA</b> e você será <b>Declarado Falido</b>.
            <br/>Clique em <b>SIM</b> para declarar falência e <b>Cancelar</b> para voltar ao JOGO.
          </p>

          <div className="actions">
            <button className="pill btn-cancel" onClick={closeModal}>CANCELAR</button>
            <button className="pill btn-yes" onClick={()=>resolveTop(true)}>SIM</button>
          </div>
        </div>
      </div>
    </ModalBase>
  )
}
