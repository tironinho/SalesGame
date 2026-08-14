import { useEffect } from 'react'

/**
 * Libera pinch-zoom no mobile e permite pan enquanto ampliado.
 * Desktop não é afetado (só pointer: coarse / touch).
 *
 * Motivo: html/body com overflow:hidden fazem Chrome/Safari
 * parecerem “sem zoom” (não dá para navegar após pinçar).
 */
export function useMobilePinchZoom() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined
    }

    const coarse = typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches
    if (!coarse) return undefined

    const root = document.documentElement
    root.classList.add('sg-pinch-enabled')

    const syncZoomed = () => {
      const scale = window.visualViewport?.scale
      const zoomed = Number.isFinite(scale) && scale > 1.02
      root.classList.toggle('sg-zoomed', zoomed)
    }

    syncZoomed()
    const vv = window.visualViewport
    vv?.addEventListener?.('resize', syncZoomed)
    vv?.addEventListener?.('scroll', syncZoomed)
    window.addEventListener('resize', syncZoomed)

    return () => {
      vv?.removeEventListener?.('resize', syncZoomed)
      vv?.removeEventListener?.('scroll', syncZoomed)
      window.removeEventListener('resize', syncZoomed)
      root.classList.remove('sg-pinch-enabled', 'sg-zoomed')
    }
  }, [])
}
