// src/components/Board.jsx
import React, { useRef, useLayoutEffect, useState } from 'react'
import boardUrl from '/board.jpg'

import {
  BASE_W, BASE_H, TRACK_LEN, TRACK_POINTS_NORM, scalePoint
} from '../data/track'

// overlay de markers (apenas para conferência; deixe false no final)
import BoardMarkers from './BoardMarkers'

// gravador interativo (para gerar os 55 pontos corretos)
import TrackRecorder from '../dev/TrackRecorder'

export default function Board({ players, turnIdx, recordTrack = false }){
  const boardRef = useRef(null)
  const [size, setSize] = useState({ w: BASE_W, h: BASE_H })

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

      {/* ====== MODO GRAVAÇÃO (clique para marcar 55 casas) ====== */}
      {recordTrack && (
        <TrackRecorder
          boardRef={boardRef}
          expected={55}
          onFinish={(norms) => {
            // imprimo também aqui por garantia
            console.log('TRACK_POINTS_NORM (cole em src/data/track.js):', JSON.stringify(norms, null, 2))
          }}
        />
      )}

      {/* ====== MODO NORMAL ====== */}
      {!recordTrack && (
        <>
          {/* deixe visível só enquanto confere os pontos definitivos */}
          <BoardMarkers visible={true} boardWidth={size.w} boardHeight={size.h} />

          {players.map((p, idx) => {
            const i   = ((p.pos % TRACK_LEN) + TRACK_LEN) % TRACK_LEN
            const pt  = TRACK_POINTS_NORM[i]
            const xy  = scalePoint(pt, size.w, size.h)
            const off = idx * 12 * s

            return (
              <div
                key={p.id}
                className="token"
                style={{
                  left: xy.x + off,
                  top:  xy.y - off,
                  background: p.color
                }}
                title={`${p.name} • Casa ${i + 1}`}
              >
                {idx === turnIdx ? '★' : ''}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
