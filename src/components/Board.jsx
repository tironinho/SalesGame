// src/components/Board.jsx
import React, { useRef, useLayoutEffect, useState, useEffect, useMemo } from 'react'
import boardUrl from '/board.jpg'

import {
  BASE_W, BASE_H, TRACK_LEN, TRACK_POINTS_NORM, scalePoint
} from '../data/track'

import BoardMarkers from './BoardMarkers'
import TrackRecorder from '../dev/TrackRecorder'

// Fallbacks (caso o pai ainda não envie `me`)
import { getOrCreateTabPlayerId } from '../auth'

// --- NOVO: dimensões/estilo dos tokens ---
const TOKEN_BASE_PX = 40;     // tamanho “normal” do peão
const TOKEN_ACTIVE_SCALE = 1.15; // multiplicador para o peão do jogador da vez
const TOKEN_RING_PX = 3;      // largura do anel branco

const DEFAULT_STATS = {
  cash: 18000,
  possibAt: 0,
  clientsAt: 0,

  faturamento: 770,
  manutencao: 1150,
  emprestimos: 0,
  vendedoresComuns: 0,
  fieldSales: 0,
  insideSales: 0,
  mixDBens: 4000,
  erpClientes: 0,
  manualOnboarding: true,
  azul: 0, amarelo: 0, roxo: 0,
  gestores: 0,
}

export default function Board({
  players,
  turnIdx,
  recordTrack = false,
  matchId,
  me,
  onMeHud,          // opcional: pai pode receber os dados para renderizar no header
}) {
  const boardRef = useRef(null)
  const [size, setSize] = useState({ w: BASE_W, h: BASE_H })

  // 🔐 “quem sou eu” preferindo o que vem do pai (PlayersLobby/App)
  const myId = me?.id || getOrCreateTabPlayerId()
  // ✅ D1: Board não deve gerar nome automaticamente nem ler storage para isso.
  const fallbackName = 'Jogador'
  const meFromPlayers = useMemo(
    () => players?.find(p => p.id === myId) || null,
    [players, myId]
  )
  const meName  = me?.name || meFromPlayers?.name || fallbackName
  const myColor = meFromPlayers?.color || '#6c5ce7'

  // key única por partida + jogador (aba)
  const statsKey = useMemo(() => {
    const scope = matchId || 'local'
    return `sg_stats_v1:${scope}:${myId}`
  }, [matchId, myId])

  const [stats, setStats] = useState(() => {
    try {
      const raw = sessionStorage.getItem(statsKey)
      return raw ? JSON.parse(raw) : DEFAULT_STATS
    } catch {
      return DEFAULT_STATS
    }
  })

  useEffect(() => {
    try { sessionStorage.setItem(statsKey, JSON.stringify(stats)) } catch {}
  }, [statsKey, stats])

  // 🔊 Emite os dados do HUD (para o App.jsx renderizar na topbar)
  useEffect(() => {
    const payload = {
      id: myId,
      name: meName,
      color: myColor,
      cash: stats.cash,
      possibAt: stats.possibAt,
      clientsAt: stats.clientsAt,
      matchId: matchId || 'local',
    }
    onMeHud?.(payload)
    document.dispatchEvent(new CustomEvent('sg:meHud', { detail: payload }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, meName, myColor, stats.cash, stats.possibAt, stats.clientsAt, matchId])

  useLayoutEffect(() => {
    if (!boardRef.current) return
    const el = boardRef.current
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const cr = e.contentRect
        setSize({ w: cr.width, h: cr.height })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sx = size.w / BASE_W
  const sy = size.h / BASE_H
  const s  = Math.min(sx, sy)

  return (
    <div className="board" ref={boardRef}>
      <img src={boardUrl} alt="Board" className="boardImg" />

      {/* ====== MODO GRAVAÇÃO ====== */}
      {recordTrack && (
        <TrackRecorder
          boardRef={boardRef}
          expected={55}
          onFinish={(norms) => {
            console.log('TRACK_POINTS_NORM (cole em src/data/track.js):', JSON.stringify(norms, null, 2))
          }}
        />
      )}

      {/* ====== MODO NORMAL ====== */}
      {!recordTrack && (
        <>
          <BoardMarkers visible={false} boardWidth={size.w} boardHeight={size.h} />

          {players.map((p, idx) => {
            // ✅ OBJ 6: turno por ID estável (não por índice potencialmente divergente)
            const activePlayerId = players?.[turnIdx]?.id
            const isTurn = String(p?.id) === String(activePlayerId)
            const i   = ((p.pos % TRACK_LEN) + TRACK_LEN) % TRACK_LEN
            const pt  = TRACK_POINTS_NORM[i]
            const xy  = scalePoint(pt, size.w, size.h)

            // separação diagonal entre peões na mesma casa
            const off = idx * 12 * s

            // tamanho do peão (escala com o board) e destaque do jogador da vez
            const base = TOKEN_BASE_PX * s
            const sizePx = base * (isTurn ? TOKEN_ACTIVE_SCALE : 1)
            const ring = Math.max(2, TOKEN_RING_PX * s)

            // Inicial do nome (fallback "?"); identidade visível em qualquer cor
            const rawInitial = String(p?.name || '').trim().charAt(0)
            const initial = rawInitial ? rawInitial.toUpperCase() : '?'

            return (
              <div
                key={p.id}
                className={`token${isTurn ? ' token--active' : ''}`}
                style={{
                  // dinâmicos: posição, tamanho, cor do jogador (via CSS var) e
                  // largura do anel; o visual estático mora em styles.css
                  position: 'absolute',
                  left: xy.x + off,
                  top:  xy.y - off,
                  transform: 'translate(-50%, -50%)',   // centraliza no ponto da casa
                  width:  sizePx,
                  height: sizePx,
                  '--token-color': p.color,
                  borderWidth: ring,
                  zIndex: isTurn ? 4 : 3,
                  fontSize: `${Math.max(16, sizePx * 0.6)}px`, // inicial proporcional
                }}
                title={`${p.name} • Casa ${i + 1}`}
                aria-label={`${p.name} está na casa ${i + 1}`}
              >
                <span className="tokenInitial">{initial}</span>
                {/* Indicador da vez: estrela pequena no canto, sem cobrir a inicial */}
                {isTurn && <span className="tokenTurnBadge" aria-hidden="true">⭐</span>}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
