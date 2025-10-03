import React from 'react'
import { createPortal } from 'react-dom'

export default function ModalBase({ children, width = 520 }) {
  return createPortal(
    <div className="modalBackdrop">
      {/* Não fecha ao clicar fora */}
      <div className="modalCard" style={{ width }}>
        {children}
      </div>
    </div>,
    document.body
  )
}
