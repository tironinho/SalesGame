import React from 'react'
import { TRACK_POINTS_NORM, scalePoint } from '../data/track'

export default function BoardMarkers({ visible = true, boardWidth, boardHeight }) {
  if (!visible) return null
  return (
    <div className="markersLayer">
      {TRACK_POINTS_NORM.map((p, i) => {
        const { x, y } = scalePoint(p, boardWidth, boardHeight)
        return (
          <div key={i} className="marker" style={{ left: x, top: y }} title={`Casa ${i+1}`}>
            {i+1}
          </div>
        )
      })}
    </div>
  )
}
