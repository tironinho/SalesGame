import React, { useState } from 'react'
import ModalBase from './ModalBase'
import { useModal } from './ModalContext'

export default function RecoveryModal({ suggested = 2000 }) {
  const { resolveTop, closeModal } = useModal()
  const [value, setValue] = useState(suggested)

  return (
    <ModalBase width={520} onClose={closeModal}>
      <div className="recoveryModal">
        <div className="paper">
          <p>
            Informe o valor para <b>Recuperação Financeira</b>.
            Esse valor será somado ao caixa do jogador atual.
          </p>

          <div style={{ marginTop:10 }}>
            <input
              type="number"
              value={value}
              onChange={e=>setValue(Number(e.target.value || 0))}
              style={{
                width:'100%', padding:10, borderRadius:10,
                border:'1px solid #333', background:'#111', color:'#fff'
              }}
            />
          </div>

          <div className="actions" style={{ marginTop:12 }}>
            <button className="pill btn-cancel" onClick={closeModal}>CANCELAR</button>
            <button className="pill btn-yes" onClick={()=>resolveTop({ amount:value })}>APLICAR</button>
          </div>
        </div>
      </div>
    </ModalBase>
  )
}
