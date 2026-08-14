import { useCallback, useEffect } from 'react'

import { useDeviceType } from '../../hooks/useDeviceType.js'
import { useOrientation } from '../../hooks/useOrientation.js'
import { enterGamePresentation } from '../../utils/fullscreen.js'
import { unlockOrientation } from '../../utils/screenOrientation.js'
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
 * Exige landscape só quando `enabled` (ex.: phase === 'game' / tabuleiro).
 * Lobby, nome e salas ficam livres em portrait com scroll.
 * Children permanecem montados sob o overlay.
 */
export default function OrientationGuard({ children, enabled = false }) {
  const { isPortrait, lockLandscape } = useOrientation()
  const { shouldEnforceLandscape } = useDeviceType()

  const active = Boolean(enabled) && shouldEnforceLandscape
  const shouldBlock = active && isPortrait

  useEffect(() => {
    if (!active) {
      unlockOrientation().catch(() => {})
      return undefined
    }
    lockLandscape().catch(() => {})
    return undefined
  }, [active, lockLandscape])

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
