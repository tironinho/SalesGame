import React from 'react'
import { createPortal } from 'react-dom'
import { useModal } from './ModalContext'

export default function ModalBase({ children, width = 520, onClose }){
  const { closeModal } = useModal()
  const handleClose = onClose || closeModal
  return createPortal(
    <div className="modalBackdrop" onClick={handleClose}>
      <div className="modalCard" style={{ width }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  )
}
