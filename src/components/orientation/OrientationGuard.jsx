import { useCallback, useEffect, useRef, useState } from 'react'

import { useDeviceType } from '../../hooks/useDeviceType.js'
import { useFullscreen } from '../../hooks/useFullscreen.js'
import { useOrientation } from '../../hooks/useOrientation.js'
import { enterGamePresentation } from '../../utils/fullscreen.js'
import { isIOSDevice } from '../../utils/iosDetect.js'
import { unlockOrientation } from '../../utils/screenOrientation.js'
import OrientationOverlay from './OrientationOverlay.jsx'
import './orientation.css'

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
 * Android: tenta tela cheia ao girar.
 * iOS/WebKit: não insiste em fullscreen (API fraca) — layout usa visualViewport.
 */
export default function OrientationGuard({ children, enabled = false }) {
  const { isPortrait, isLandscape, lockLandscape } = useOrientation()
  const { shouldEnforceLandscape } = useDeviceType()
  const { isFullscreen, canFullscreen } = useFullscreen()

  const [needsFullscreenTap, setNeedsFullscreenTap] = useState(false)
  const landscapeAttemptRef = useRef(0)
  const isIOS = isIOSDevice()

  const active = Boolean(enabled) && shouldEnforceLandscape
  const shouldBlock = active && isPortrait
  // iOS: fullscreen web quase não funciona — não mostra chip/gate
  const showFullscreenChip = (
    !isIOS
    && active
    && isLandscape
    && canFullscreen
    && !isFullscreen
    && !needsFullscreenTap
  )

  useEffect(() => {
    if (!active) {
      unlockOrientation().catch(() => {})
      setNeedsFullscreenTap(false)
      return undefined
    }
    // Lock de orientação também falha no iOS; tentativa best-effort ok.
    lockLandscape().catch(() => {})
    return undefined
  }, [active, lockLandscape])

  useEffect(() => {
    if (shouldBlock) blurActiveField()
  }, [shouldBlock])

  // Android (não-iOS): tenta FS ao entrar em landscape; senão 1 toque.
  useEffect(() => {
    if (isIOS) {
      setNeedsFullscreenTap(false)
      return undefined
    }
    if (!active || !isLandscape || !canFullscreen) {
      setNeedsFullscreenTap(false)
      return undefined
    }
    if (isFullscreen) {
      setNeedsFullscreenTap(false)
      return undefined
    }

    const attemptId = landscapeAttemptRef.current + 1
    landscapeAttemptRef.current = attemptId

    let cancelled = false
    const tryAuto = async () => {
      await enterGamePresentation()
      await lockLandscape()
      if (cancelled || landscapeAttemptRef.current !== attemptId) return
      const stillOut = typeof document !== 'undefined'
        && !document.fullscreenElement
        && !document.webkitFullscreenElement
      if (stillOut) setNeedsFullscreenTap(true)
    }

    tryAuto().catch(() => {
      if (!cancelled) setNeedsFullscreenTap(true)
    })

    return () => {
      cancelled = true
    }
  }, [active, isLandscape, canFullscreen, isFullscreen, lockLandscape, isIOS])

  const handleEnterPresentation = useCallback(async () => {
    await enterGamePresentation()
    await lockLandscape()
    setNeedsFullscreenTap(false)
  }, [lockLandscape])

  return (
    <>
      {children}
      {shouldBlock ? (
        <OrientationOverlay onTryLock={isIOS ? undefined : handleEnterPresentation} />
      ) : null}
      {needsFullscreenTap ? (
        <button
          type="button"
          className="orientationFullscreenGate"
          onClick={handleEnterPresentation}
          onTouchEnd={(event) => {
            event.preventDefault()
            handleEnterPresentation()
          }}
          aria-label="Toque para entrar em tela cheia"
        >
          <span className="orientationFullscreenGate__card">
            <strong>Toque para tela cheia</strong>
            <span>O navegador exige um toque para maximizar o jogo.</span>
          </span>
        </button>
      ) : null}
      {showFullscreenChip ? (
        <button
          type="button"
          className="orientationFullscreenChip"
          onClick={handleEnterPresentation}
          aria-label="Entrar em tela cheia"
        >
          Tela cheia
        </button>
      ) : null}
    </>
  )
}
