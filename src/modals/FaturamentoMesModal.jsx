// src/modals/FaturamentoMesModal.jsx
import React from "react";
import ModalBase from "./ModalBase";

/**
 * Fecha usando `onResolve`, que é injetado pelo ModalProvider
 * quando a modal é aberta via `pushModal(<FaturamentoMesModal ... />)`.
 */
export default function FaturamentoMesModal({ value = 0, onResolve }) {
  const v = Number(value || 0);

  const handleOk = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onResolve?.({
      action: "OK",
      value: v,
      source: { modal: "FaturamentoMesModal", file: "src/modals/FaturamentoMesModal.jsx" }
    }); // fecha a modal do topo
  };

  return (
    <ModalBase
      zIndex={2147483647}
      onClose={() => onResolve?.({ action: "CLOSE", value: v, source: { modal: "FaturamentoMesModal", file: "src/modals/FaturamentoMesModal.jsx" } })} // fecha por overlay/X
    >
      <div style={{ padding: 28, textAlign: "center", pointerEvents: "auto" }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: 28,
            color: "#4caf50",
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          FATURAMENTO DO MÊS
        </div>
        <div style={{ opacity: 0.9, marginBottom: 16 }}>
          Será creditado o valor do Faturamento ao seu Saldo
        </div>
        <div style={{ fontSize: 18, marginBottom: 24 }}>
          no valor de:&nbsp; <b>$ {v.toLocaleString()}</b>
        </div>

        <button
          type="button"
          onClick={handleOk}
          className="btn"
          style={{
            minWidth: 120,
            background: "#8bd65a",
            color: "#1a1f2a",
            fontWeight: 800,
            borderRadius: 10,
          }}
        >
          OK
        </button>
      </div>
    </ModalBase>
  );
}
