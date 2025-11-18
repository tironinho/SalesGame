// src/components/FinalWinners.jsx
import React, { useMemo } from "react";
import ModalBase from "../modals/ModalBase";

/**
 * Pódio final (Top 3) como **modal travada** no centro da tela.
 * - Não fecha pelo overlay/ESC (travada).
 * - Fecha apenas pelo botão "Voltar aos Lobbies".
 * - Se aberta via ModalProvider.pushModal, use `onResolve({action:'EXIT'})`.
 *   Se usada “solta”, aceita `onExit`.
 */
export default function FinalWinners({ players = [], onExit, onResolve }) {
  // classifica por patrimônio (cash + bens) e pega o top 3
  const top3 = useMemo(() => {
    const ranked = [...players]
      .map((p) => ({
        ...p,
        patrimonio: (Number(p.cash) || 0) + (Number(p.bens) || 0),
      }))
      .sort((a, b) => b.patrimonio - a.patrimonio);

    // layout: esquerda(2º), centro(1º), direita(3º)
    return [ranked[1], ranked[0], ranked[2]];
  }, [players]);

  const first = top3?.[1];
  const second = top3?.[0];
  const third = top3?.[2];

  const doExit = () => {
    if (onResolve) onResolve({ action: "EXIT" });
    else onExit?.();
  };

  return (
    // onClose vazio => clicar no overlay NÃO fecha (travada)
    <ModalBase zIndex={2147483647} onClose={() => {}}>
      <div style={S.wrap}>
        <h1 style={S.title}>🏁 Fim da 5ª Rodada</h1>
        <p style={S.subtitle}>
          Vence quem tiver <b>Saldo + Bens</b>. Eis o pódio:
        </p>

        <div style={S.podium}>
          <MedalCard place="second" player={second} />
          <MedalCard place="first" player={first} big />
          <MedalCard place="third" player={third} />
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            marginTop: 18,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <button style={S.btn} onClick={doExit}>
            🏠 Voltar aos Lobbies
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

function MedalCard({ place, player, big }) {
  if (!player) return <div style={{ width: 220 }} />;
  const palette = {
    first: medalPaint("#d4af37", "#f5d76e"), // ouro
    second: medalPaint("#9fa4ad", "#cfd4db"), // prata
    third: medalPaint("#b87333", "#d28c45"), // bronze
  };
  const label = { first: "1º", second: "2º", third: "3º" }[place];
  const ring = palette[place].ring;
  const face = palette[place].face;

  return (
    <div style={{ ...S.medalCol, transform: big ? "translateY(-18px)" : "none" }}>
      <div style={S.ribbon} />
      <div style={{ ...S.medal, ...ring, width: big ? 180 : 150, height: big ? 180 : 150 }}>
        <div style={{ ...S.medalFace, ...face }}>
          <div style={S.medalNumber}>{label}</div>
        </div>
      </div>

      <div style={S.cardBelow}>
        <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2, textAlign: "center" }}>
          {player.name}
        </div>
        <div style={{ opacity: 0.9, fontSize: 13, marginTop: 4, textAlign: "center" }}>
          Saldo: <b>$ {Number(player.cash || 0).toLocaleString()}</b>
          <br />
          Bens: <b>$ {Number(player.bens || 0).toLocaleString()}</b>
        </div>
        <div style={{ marginTop: 6, fontWeight: 900, textAlign: "center" }}>
          Patrimônio: <b>$ {Number(player.patrimonio || 0).toLocaleString()}</b>
        </div>
      </div>
    </div>
  );
}

function medalPaint(dark, light) {
  return {
    ring: {
      background: `radial-gradient(circle at 35% 30%, ${light} 0%, ${dark} 65%, #000 120%)`,
      boxShadow: "0 12px 30px rgba(0,0,0,.35), inset 0 0 12px rgba(255,255,255,.12)",
    },
    face: {
      background: `conic-gradient(from 0deg, ${light}, ${dark}, ${light})`,
    },
  };
}

const S = {
  wrap: {
    pointerEvents: "auto",
    border: "1px solid rgba(255,255,255,.15)",
    background: "#11161f",
    color: "#eef1f6",
    borderRadius: 16,
    padding: 20,
    width: "min(900px, 92vw)",
    maxWidth: "92vw",
    textAlign: "center",
  },
  title: { margin: "0 0 6px", fontWeight: 900, fontSize: 28 },
  subtitle: { margin: "0 0 14px", opacity: 0.9 },
  podium: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 24,
    padding: "10px 0",
    flexWrap: "wrap",
  },
  medalCol: { display: "flex", flexDirection: "column", alignItems: "center" },
  ribbon: {
    width: 16,
    height: 70,
    background: "linear-gradient(#e41f1f,#9e1313)",
    borderRadius: 4,
    marginBottom: -12,
  },
  medal: {
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "3px solid rgba(255,255,255,.18)",
  },
  medalFace: {
    width: "85%",
    height: "85%",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 8px 18px rgba(0,0,0,.35), inset 0 -6px 10px rgba(255,255,255,.08)",
  },
  medalNumber: {
    fontWeight: 900,
    fontSize: 28,
    letterSpacing: 1,
    textShadow: "0 2px 4px rgba(0,0,0,.45)",
  },
  cardBelow: {
    background: "#19202c",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 12,
    padding: "10px 12px",
    width: 220,
    marginTop: 10,
  },
  btn: {
    background: "#2a3342",
    color: "#fff",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: 10,
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
};
