// src/modals/BankruptcyModal.jsx
import React, { useEffect, useRef } from 'react'
import { useModal } from './ModalContext'
import ModalBase from './ModalBase'

/**
 * Modal de Falência – estilo igual à modal de compra (header forte, callout âmbar,
 * infos nos cantos e rodapé com dois botões). Sem fechar por ESC/backdrop.
 * Tudo em um arquivo: estilos embutidos com <style>.
 */
export default function BankruptcyModal({ playerName = 'Jogador', balanceText = '' }) {
  const { resolveTop, closeModal } = useModal()
  const confirmBtnRef = useRef(null)

  // Bloqueia rolagem e foca no botão principal
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    confirmBtnRef.current?.focus()
    return () => { document.body.style.overflow = prev }
  }, [])

  // Bloqueia ESC/Enter/Espaço para não acionar nada por engano
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopPropagation()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  const stop = (e) => { e.preventDefault(); e.stopPropagation() }
  const onCancel = () => { resolveTop(false); closeModal?.() }
  const onConfirm = () => { resolveTop(true); closeModal?.() }

  return (
    <ModalBase width={780} onClose={onCancel}>
      {/* === Estilos embutidos === */}
      <style>{`
        .sg-modal-panel {
          background:#111827; border:1px solid rgba(255,255,255,0.08);
          border-radius:16px; padding:20px 22px 18px; color:#e5e7eb;
          position:relative; box-shadow:0 10px 35px rgba(0,0,0,.55);
        }
        .sg-modal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .sg-modal-title{font-size:22px;font-weight:700;margin:0}
        .sg-icon-close{background:transparent;border:0;color:#9ca3af;font-size:24px;line-height:1;cursor:pointer}
        .sg-icon-close:hover{color:#e5e7eb}

        .sg-modal-infos{display:flex;justify-content:space-between;align-items:center;
          font-size:14px;color:#cbd5e1;margin:6px 0 12px}
        .sg-modal-infos .right{opacity:.8}

        .sg-callout-warning{
          background:rgba(250,204,21,.12); border:1px solid rgba(250,204,21,.45);
          border-radius:12px; padding:14px 16px; margin-bottom:14px
        }
        .sg-callout-title{font-weight:700;margin-bottom:6px;color:#fde68a}
        .sg-muted{opacity:.7}

        .sg-modal-body{margin:8px 2px 14px;font-size:15px;line-height:1.5}

        .sg-modal-actions{display:flex;justify-content:space-between;gap:12px;margin-top:10px}
        .sg-btn{font-weight:600;border:0;cursor:pointer;padding:12px 18px}
        .sg-pill{border-radius:999px}
        .sg-btn-neutral{background:#374151;color:#e5e7eb}
        .sg-btn-neutral:hover{background:#4b5563}
        .sg-btn-danger{background:#b91c1c;color:#fff}
        .sg-btn-danger:hover{background:#991b1b}
        .sg-btn:focus{outline:2px solid rgba(255,255,255,.35);outline-offset:2px}
      `}</style>

      {/* === Estrutura === */}
      <div
        className="sg-modal-panel"
        role="dialog" aria-modal="true"
        aria-labelledby="bk-title" aria-describedby="bk-desc"
        onClick={stop} onMouseDown={stop} onKeyDown={stop}
      >
        {/* Header */}
        <div className="sg-modal-header">
          <h2 id="bk-title" className="sg-modal-title">Declarar Falência</h2>
          <button className="sg-icon-close" aria-label="Fechar" onClick={onCancel}>×</button>
        </div>

        {/* Subheader infos (cantos) */}
        <div className="sg-modal-infos">
          <div className="left">
            {balanceText ? <>Saldo disponível: <b>{balanceText}</b></> : <>&nbsp;</>}
          </div>
          <div className="right">Ação permanente nesta partida</div>
        </div>

        {/* Callout âmbar */}
        <div className="sg-callout-warning" id="bk-desc">
          <div className="sg-callout-title">Atenção</div>
          <p>
            {playerName}, ao confirmar, você será marcado como <b>FALIDO</b>.
            Seu turno será <b>sempre pulado</b> e você não poderá mais executar ações.
          </p>
          <p className="sg-muted">Esta decisão é irreversível até o fim da partida.</p>
        </div>

        {/* Corpo curto */}
        <div className="sg-modal-body">
          <p>
            Confirme abaixo para encerrar sua participação ativa. Você continuará
            visível no placar como <b>FALIDO</b>.
          </p>
        </div>

        {/* Rodapé – padrão: seguro à esquerda, ação à direita */}
        <div className="sg-modal-actions">
          <button className="sg-btn sg-pill sg-btn-neutral" onClick={onCancel}>Cancelar</button>
          <button
            ref={confirmBtnRef}
            className="sg-btn sg-pill sg-btn-danger"
            onClick={onConfirm}
          >
            Declarar Falência
          </button>
        </div>
      </div>
    </ModalBase>
  )
}
