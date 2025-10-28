import React from "react";

/**
 * Componente base de modal. NÃO usa o contexto.
 * Quem chama passa `onClose`, e esse onClose deve chamar `onResolve`
 * do provider (feito no componente da modal).
 */
export default function ModalBase({ children, onClose, zIndex = 3000 }) {
  const handleClose = () => {
    console.log('[🎲 MODAL] Jogador clicou no botão X (fechar)')
    if (typeof onClose === "function") onClose();
  };

  return (
    <div
      className="sg-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,10,16,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex,
      }}
      onClick={handleClose}
    >
      <div
        className="sg-modal-card"
        style={{
          position: "relative",
          background: "#0f1420",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: 14,
          width: "min(780px, 92vw)",
          maxWidth: "92vw",
          color: "#fff",
          boxShadow: "0 20px 60px rgba(0,0,0,.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
