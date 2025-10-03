import React from "react";
import ModalBase from "./ModalBase";

/**
 * Esta modal fecha chamando `onResolve`, que é injetado pelo ModalProvider
 * quando você usa `pushModal(<DespesasOperacionaisModal ... />)`.
 */
export default function DespesasOperacionaisModal({
  expense = 0,
  loanCharge = 0,
  onResolve, // <- vem do provider
}) {
  const total = Number(expense || 0) + Number(loanCharge || 0);

  const handleOk = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    onResolve?.({ action: "OK" }); // <- fecha a modal do topo
  };

  return (
    <ModalBase
      zIndex={2147483647}
      onClose={() => onResolve?.({ action: "CLOSE" })} // fecha no overlay/X
    >
      <div style={{ padding: 28, textAlign: "center", pointerEvents: "auto" }}>
        <div
          style={{
            fontWeight: 900,
            fontSize: 26,
            color: "#ffb74d",
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          DESPESAS DO MÊS
        </div>

        <div style={{ marginBottom: 8 }}>
          Despesas operacionais:&nbsp;
          <b>-$ {Number(expense).toLocaleString()}</b>
        </div>

        {Number(loanCharge) > 0 && (
          <div style={{ marginBottom: 8, color: "#ffd54f" }}>
            Empréstimo cobrado nesta rodada:&nbsp;
            <b>-$ {Number(loanCharge).toLocaleString()}</b>
          </div>
        )}

        <div style={{ margin: "6px 0 18px", opacity: 0.85 }}>
          Total a debitar:&nbsp; <b>-$ {total.toLocaleString()}</b>
        </div>

        <button
          type="button"
          onClick={handleOk}
          className="btn"
          style={{
            minWidth: 120,
            background: "#ffcc80",
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
