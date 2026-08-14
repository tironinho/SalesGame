import React from 'react'
import { getTileContext } from './tileContext.js'

/**
 * Uma linha de contexto no topo das modais de casa.
 * kind: CLIENTS | COMMON | FIELD | INSIDE | MANAGER | ERP | MIX | TRAINING | …
 */
export default function TileContextHint({ kind, children }) {
  const text = children || getTileContext(kind)
  if (!text) return null
  return (
    <p className="tileContextHint" role="note">
      {text}
    </p>
  )
}
