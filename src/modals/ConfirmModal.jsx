import React from 'react'
import ModalBase from './ModalBase'
import { useModal } from './ModalContext'

export default function ConfirmModal({ title = 'Confirmar', message = 'Tem certeza?' }) {
  const { resolveTop, closeModal } = useModal()
  return (
    <ModalBase>
      <div className="modalHeader">{title}</div>
      <div style={{ opacity:.9 }}>{message}</div>
      <div className="modalActions">
        <button className="btn light" onClick={closeModal}>Cancelar</button>
        <button className="btn primary" onClick={() => resolveTop(true)}>Confirmar</button>
      </div>
    </ModalBase>
  )
}
