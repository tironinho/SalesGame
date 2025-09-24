// src/dev/TrackRecorder.jsx
import React, { useState, useMemo } from 'react'

/**
 * Gravador interativo do track:
 * - Clique em cada casa na ordem (1..N)
 * - Gera pontos normalizados [{nx, ny}, ...]
 */
export default function TrackRecorder({
  boardRef,             // ref do container .board
  expected = 55,        // nº de casas que você quer gravar
  onFinish,             // callback(pointsNorm)
  initial = [],         // se quiser continuar de onde parou
}){
  const [pts, setPts] = useState(initial)

  function handleClick(e){
    if (!boardRef?.current) return
    const rect = boardRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const nx = x / rect.width
    const ny = y / rect.height
    setPts(p => (p.length >= expected ? p : [...p, { nx, ny }]))
  }

  function undo(){ setPts(p => p.slice(0, -1)) }
  function clear(){ setPts([]) }

  const json = useMemo(() => JSON.stringify(pts, null, 2), [pts])

  async function copyJSON(){
    try {
      await navigator.clipboard.writeText(json)
      alert('Copiado para a área de transferência!')
    } catch {
      alert('Não foi possível copiar. Use o botão Baixar.')
    }
  }

  function downloadJSON(){
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'track-points-55.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function finish(){
    onFinish?.(pts)
    console.log('TRACK_POINTS_NORM (cole em src/data/track.js):\n', json)
    alert('Finalizado! O JSON foi impresso no console. Copie e cole em src/data/track.js')
  }

  return (
    <>
      {/* camada que captura cliques */}
      <div className="recLayer" onClick={handleClick} />

      {/* pontos já gravados */}
      <div className="recDotsLayer" pointerEvents="none">
        {pts.map((p, i) => (
          <div
            key={i}
            className="recDot"
            style={{ left: `${p.nx*100}%`, top: `${p.ny*100}%` }}
            title={`Casa ${i+1}`}
          >
            {i+1}
          </div>
        ))}
      </div>

      {/* toolbar */}
      <div className="recToolbar">
        <div className="recInfo">
          <b>Gravando trilha</b> — clique nas casas na ordem.
          <span>Marcados: <b>{pts.length}</b> / {expected}</span>
        </div>
        <div className="recBtns">
          <button onClick={undo} disabled={!pts.length}>Desfazer</button>
          <button onClick={clear} disabled={!pts.length}>Limpar</button>
          <button onClick={copyJSON} disabled={!pts.length}>Copiar JSON</button>
          <button onClick={downloadJSON} disabled={!pts.length}>Baixar .json</button>
          <button onClick={finish} disabled={pts.length !== expected}>Finalizar</button>
        </div>
      </div>
    </>
  )
}
