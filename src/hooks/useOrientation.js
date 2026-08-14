import { useCallback, useEffect, useState } from 'react'

import {
  canLockOrientation,
  lockPreferredLandscape,
  readOrientation,
  unlockOrientation,
} from '../utils/screenOrientation.js'

/**
 * Estado de orientação + tentativas de lock landscape.
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState(() => readOrientation())

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const update = () => {
      setOrientation(readOrientation())
    }

    update()

    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(orientation: portrait)')
      : null

    if (media) {
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', update)
      } else if (typeof media.addListener === 'function') {
        media.addListener(update)
      }
    }

    const screenOrientation = window.screen?.orientation
    if (screenOrientation && typeof screenOrientation.addEventListener === 'function') {
      screenOrientation.addEventListener('change', update)
    }

    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)

    return () => {
      if (media) {
        if (typeof media.removeEventListener === 'function') {
          media.removeEventListener('change', update)
        } else if (typeof media.removeListener === 'function') {
          media.removeListener(update)
        }
      }
      if (screenOrientation && typeof screenOrientation.removeEventListener === 'function') {
        screenOrientation.removeEventListener('change', update)
      }
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  const lockLandscape = useCallback(async () => {
    const result = await lockPreferredLandscape()
    return Boolean(result?.ok)
  }, [])

  const unlock = useCallback(async () => {
    const result = await unlockOrientation()
    return Boolean(result?.ok)
  }, [])

  return {
    orientation,
    isPortrait: orientation === 'portrait',
    isLandscape: orientation === 'landscape',
    canLockOrientation: canLockOrientation(),
    lockLandscape,
    unlockOrientation: unlock,
  }
}
