import { useCallback, useEffect } from 'react'

import { useDeviceType } from '../../hooks/useDeviceType.js'
import { useOrientation } from '../../hooks/useOrientation.js'
import { enterGamePresentation } from '../../utils/fullscreen.js'
import OrientationOverlay from './OrientationOverlay.jsx'

function blurActiveField() {
  if (typeof document === 'undefined') return
  const el = document.activeElement
  if (!el) return
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    el.blur()
  }
}

/**
 * Exige landscape em mobile/tablet touch.
 * Desktop e landscape: jogo normal.
 * Portrait mobile: overlay por cima (children permanecem montados).
 */
export default function OrientationGuard({ children }) {
  const { isPortrait, lockLandscape } = useOrientation()
  const { shouldEnforceLandscape } = useDeviceType()

  const shouldBlock = shouldEnforceLandscape && isPortrait

  // Tentativa best-effort de lock (só funciona após gesture em vários browsers).
  useEffect(() => {
    if (!shouldEnforceLandscape) return undefined
    lockLandscape().catch(() => {})
    return undefined
  }, [shouldEnforceLandscape, lockLandscape])

  // Ao mostrar o overlay, tira foco de inputs (evita zoom Safari).
  useEffect(() => {
    if (shouldBlock) blurActiveField()
  }, [shouldBlock])

  const handleTryLock = useCallback(async () => {
    await enterGamePresentation()
    await lockLandscape()
  }, [lockLandscape])

  return (
    <>
      {children}
      {shouldBlock ? (
        <OrientationOverlay onTryLock={handleTryLock} />
      ) : null}
    </>
  )
}
