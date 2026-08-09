// src/components/Board.jsx
import React, { useRef, useLayoutEffect, useState, useEffect, useMemo } from 'react'
import boardUrl from '/board.jpg'

import {
  BASE_W, BASE_H, TRACK_LEN, TRACK_POINTS_NORM, scalePoint
} from '../data/track'
import {
  ERP_BOARD_PRICE_OVERLAYS,
  getErpBoardPriceLines,
} from '../data/erpBoardOverlays'

import BoardMarkers from './BoardMarkers'
import TrackRecorder from '../dev/TrackRecorder'

const ERP_PRICE_LINES = getErpBoardPriceLines()

// Fallbacks (caso o pai ainda não envie `me`)
import { getOrCreateTabPlayerId } from '../auth'

// --- NOVO: dimensões/estilo dos tokens ---
const TOKEN_BASE_PX = 40;     // tamanho “normal” do peão
const TOKEN_ACTIVE_SCALE = 1.15; // multiplicador para o peão do jogador da vez
const TOKEN_RING_PX = 3;      // largura do anel branco

/** Duração visual por casa (ms). Só afeta a UI — não altera player.pos. */
const TOKEN_STEP_MS = 150
const TOKEN_ANIM_MAX_MS = 2200

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

function normalizeTrackPos(pos) {
  const n = Number(pos)
  if (!Number.isFinite(n)) return 0
  return ((Math.trunc(n) % TRACK_LEN) + TRACK_LEN) % TRACK_LEN
}

/** Percurso visual somente para frente: from → … → to (ciclo 0…TRACK_LEN-1). */
function buildForwardPath(from, to) {
  const start = normalizeTrackPos(from)
  const end = normalizeTrackPos(to)
  if (start === end) return []
  const path = []
  let cur = start
  for (let guard = 0; guard < TRACK_LEN; guard += 1) {
    cur = (cur + 1) % TRACK_LEN
    path.push(cur)
    if (cur === end) break
  }
  return path
}

/** Distância progressiva no ciclo (0 = mesmo ponto; 1…TRACK_LEN-1 = casas à frente). */
function forwardDistance(from, to) {
  const start = normalizeTrackPos(from)
  const end = normalizeTrackPos(to)
  return (end - start + TRACK_LEN) % TRACK_LEN
}

/** Movimento oficial do dado: 1–6 casas (ver useTurnEngine / gameReducer ROLL). */
const MAX_NORMAL_MOVE_STEPS = 6

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

  // Posição visual dos peões (separada de player.pos — só apresentação)
  const [visualPositions, setVisualPositions] = useState({})
  const visualRef = useRef({})
  const animTimersRef = useRef({})
  const animTargetRef = useRef({}) // alvo oficial da animação em curso
  const playersRef = useRef(players)
  playersRef.current = players

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

  // Assinatura só de id+pos — evita reiniciar animação em updates irrelevantes
  const positionsSignature = useMemo(() => {
    if (!Array.isArray(players)) return ''
    return players
      .map((p) => `${p?.id}:${normalizeTrackPos(p?.pos)}`)
      .join('|')
  }, [players])

  // Animação visual: NÃO altera player.pos nem o estado da partida.
  // Depende só da assinatura id:pos para não reiniciar em updates irrelevantes.
  useEffect(() => {
    const list = Array.isArray(playersRef.current) ? playersRef.current : []
    const alive = new Set(list.map((p) => String(p?.id)))

    Object.keys(visualRef.current).forEach((id) => {
      if (!alive.has(id)) {
        if (animTimersRef.current[id]) {
          clearTimeout(animTimersRef.current[id])
          delete animTimersRef.current[id]
        }
        delete visualRef.current[id]
        delete animTargetRef.current[id]
        setVisualPositions((prev) => {
          if (!(id in prev)) return prev
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
    })

    list.forEach((p) => {
      if (p?.id == null) return
      const id = String(p.id)
      const target = normalizeTrackPos(p.pos)
      const current = visualRef.current[id]

      // Primeira aparição: posiciona direto, sem animar desde a casa 0
      if (current === undefined) {
        visualRef.current[id] = target
        animTargetRef.current[id] = target
        setVisualPositions((prev) => (
          prev[id] === target ? prev : { ...prev, [id]: target }
        ))
        return
      }

      if (current === target) {
        animTargetRef.current[id] = target
        return
      }

      // Já animando rumo ao mesmo alvo oficial — não reinicia
      if (animTimersRef.current[id] && animTargetRef.current[id] === target) {
        return
      }

      if (animTimersRef.current[id]) {
        clearTimeout(animTimersRef.current[id])
        delete animTimersRef.current[id]
      }

      animTargetRef.current[id] = target

      // Distância progressiva: jogada real do dado é 1–6; >6 = resync/correção → snap
      const dist = forwardDistance(current, target)
      if (dist === 0) {
        visualRef.current[id] = target
        setVisualPositions((prev) => ({ ...prev, [id]: target }))
        return
      }
      if (dist > MAX_NORMAL_MOVE_STEPS) {
        visualRef.current[id] = target
        setVisualPositions((prev) => ({ ...prev, [id]: target }))
        return
      }

      const path = buildForwardPath(current, target)
      if (path.length === 0) {
        visualRef.current[id] = target
        setVisualPositions((prev) => ({ ...prev, [id]: target }))
        return
      }

      // 16ms = piso técnico (evita 0); TOKEN_ANIM_MAX_MS limita ~duração total
      const stepMs = Math.max(
        16,
        Math.min(TOKEN_STEP_MS, Math.floor(TOKEN_ANIM_MAX_MS / path.length))
      )

      let step = 0
      const tick = () => {
        if (step >= path.length) {
          delete animTimersRef.current[id]
          return
        }
        const nextPos = path[step]
        step += 1
        visualRef.current[id] = nextPos
        setVisualPositions((prev) => ({ ...prev, [id]: nextPos }))
        if (step < path.length) {
          animTimersRef.current[id] = setTimeout(tick, stepMs)
        } else {
          delete animTimersRef.current[id]
        }
      }

      animTimersRef.current[id] = setTimeout(tick, stepMs)
    })
  }, [positionsSignature])

  useEffect(() => {
    return () => {
      Object.values(animTimersRef.current).forEach((t) => clearTimeout(t))
      animTimersRef.current = {}
    }
  }, [])

  const sx = size.w / BASE_W
  const sy = size.h / BASE_H
  const s  = Math.min(sx, sy)

  // Fonte tipográfica dos overlays escala com o board (não com o viewport).
  const erpOverlayFontPx = Math.max(5, Math.min(size.w, size.h) * 0.0092)

  return (
    <div className="board" ref={boardRef}>
      <img src={boardUrl} alt="Board" className="boardImg" />

      {/* Preços ERP rebalanceados — só visual; não captura clique */}
      <div className="erpPriceOverlayLayer" aria-hidden="true">
        {ERP_BOARD_PRICE_OVERLAYS.map((box) => (
          <div
            key={box.house}
            className="erpPriceOverlay"
            style={{
              left: `${box.left}%`,
              top: `${box.top}%`,
              width: `${box.width}%`,
              height: `${box.height}%`,
              fontSize: `${erpOverlayFontPx}px`,
            }}
          >
            {ERP_PRICE_LINES.map((line) => (
              <span key={line} className="erpPriceOverlayLine">{line}</span>
            ))}
          </div>
        ))}
      </div>

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
            const official = normalizeTrackPos(p.pos)
            const visual = visualPositions[String(p.id)]
            const i = visual !== undefined ? normalizeTrackPos(visual) : official
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
                title={`${p.name} • Casa ${official + 1}`}
                aria-label={`${p.name} está na casa ${official + 1}`}
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
