import { useEffect } from 'react'

const MIN_SCALE = 1
const MAX_SCALE = 3
const DOUBLE_TAP_MS = 280

function dist(a, b) {
  const dx = a.clientX - b.clientX
  const dy = a.clientY - b.clientY
  return Math.hypot(dx, dy)
}

function mid(a, b) {
  return {
    x: (a.clientX + b.clientX) / 2,
    y: (a.clientY + b.clientY) / 2,
  }
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * Pinch-zoom + pan locais no tabuleiro (mobile).
 *
 * Por que NÃO confiar só no zoom da página:
 * - O shell do jogo usa overflow:hidden + altura fixa (100dvh) em landscape.
 * - Isso faz o pinch do Safari/Chrome “parecer morto” (conteúdo clipado).
 * - sg-zoomed só libera overflow DEPOIS do zoom — chicken-and-egg.
 * - Solução estável: transformar só o .sg40GameBoard dentro do boardWrap.
 *
 * @param {React.RefObject<HTMLElement|null>} wrapRef
 * @param {boolean} active  true quando a tela de jogo com tabuleiro está montada
 */
export function useBoardPinchZoom(wrapRef, active = true) {
  useEffect(() => {
    if (!active) return undefined
    if (typeof window === 'undefined') return undefined
    const coarse = typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches
    if (!coarse) return undefined

    const wrap = wrapRef?.current
    if (!wrap) return undefined

    // Transforma o tabuleiro em si (sem wrapper extra — preserva seletores CSS boardWrap > .sg40GameBoard)
    const layer = wrap.querySelector('.sg40GameBoard, .board')
    if (!layer) return undefined

    wrap.classList.add('boardWrap--pinch')
    layer.classList.add('boardZoomLayer')

    let scale = 1
    let tx = 0
    let ty = 0
    let mode = null // 'pinch' | 'pan'
    let startDist = 0
    let startScale = 1
    let startTx = 0
    let startTy = 0
    let startMid = { x: 0, y: 0 }
    let panX = 0
    let panY = 0
    let lastTapAt = 0

    const apply = () => {
      if (scale <= 1.02) {
        scale = 1
        tx = 0
        ty = 0
      }
      layer.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`
      wrap.classList.toggle('is-board-zoomed', scale > 1.02)
    }

    const reset = () => {
      scale = 1
      tx = 0
      ty = 0
      apply()
    }

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        mode = 'pinch'
        startDist = dist(e.touches[0], e.touches[1]) || 1
        startScale = scale
        startTx = tx
        startTy = ty
        startMid = mid(e.touches[0], e.touches[1])
        return
      }
      if (e.touches.length === 1 && scale > 1.02) {
        mode = 'pan'
        panX = e.touches[0].clientX
        panY = e.touches[0].clientY
        startTx = tx
        startTy = ty
      }
    }

    const onTouchMove = (e) => {
      if (mode === 'pinch' && e.touches.length === 2) {
        e.preventDefault()
        const d = dist(e.touches[0], e.touches[1]) || 1
        const next = clamp(startScale * (d / startDist), MIN_SCALE, MAX_SCALE)
        const m = mid(e.touches[0], e.touches[1])
        const rect = wrap.getBoundingClientRect()
        const cx = startMid.x - rect.left
        const cy = startMid.y - rect.top
        const ratio = next / startScale
        tx = cx - (cx - startTx) * ratio + (m.x - startMid.x)
        ty = cy - (cy - startTy) * ratio + (m.y - startMid.y)
        scale = next
        apply()
        return
      }
      if (mode === 'pan' && e.touches.length === 1 && scale > 1.02) {
        e.preventDefault()
        tx = startTx + (e.touches[0].clientX - panX)
        ty = startTy + (e.touches[0].clientY - panY)
        apply()
      }
    }

    const onTouchEnd = (e) => {
      if (e.touches.length === 0) {
        if (mode === null && e.changedTouches.length === 1) {
          const now = Date.now()
          if (now - lastTapAt < DOUBLE_TAP_MS) {
            reset()
            lastTapAt = 0
          } else {
            lastTapAt = now
          }
        }
        mode = null
        if (scale <= 1.02) reset()
      } else if (e.touches.length === 1 && scale > 1.02) {
        mode = 'pan'
        panX = e.touches[0].clientX
        panY = e.touches[0].clientY
        startTx = tx
        startTy = ty
      } else {
        mode = null
      }
    }

    apply()
    wrap.addEventListener('touchstart', onTouchStart, { passive: true })
    wrap.addEventListener('touchmove', onTouchMove, { passive: false })
    wrap.addEventListener('touchend', onTouchEnd, { passive: true })
    wrap.addEventListener('touchcancel', onTouchEnd, { passive: true })

    return () => {
      wrap.removeEventListener('touchstart', onTouchStart)
      wrap.removeEventListener('touchmove', onTouchMove)
      wrap.removeEventListener('touchend', onTouchEnd)
      wrap.removeEventListener('touchcancel', onTouchEnd)
      wrap.classList.remove('boardWrap--pinch', 'is-board-zoomed')
      layer.classList.remove('boardZoomLayer')
      layer.style.transform = ''
    }
  }, [wrapRef, active])
}
